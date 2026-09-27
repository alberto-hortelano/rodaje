// Entornos 3D con constructor (environment.builder + environment.data): carga, construcción, exportación a GLB y detección de caras coplanarias.
// Lo usan scripts/entorno-glb.mjs, scripts/entorno-coplanares.mjs, scripts/linea-base.mjs y scripts/entornos/{capturar,recorrer}.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {dir, safe, DATA, ID_RE} from './paths.mjs';
import {readJSON} from './json.mjs';

const load = id => readJSON(path.join(dir(id), 'proyecto.json'));

// GLTFExporter usa FileReader para el binario; Node tiene Blob pero no FileReader.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};

export const projectIds = () => fs.readdirSync(DATA, {withFileTypes: true})
  .filter(d => d.isDirectory() && ID_RE.test(d.name) && fs.existsSync(path.join(DATA, d.name, 'proyecto.json')))
  .map(d => d.name).sort();

export const environmentsWithBuilder = () => projectIds().flatMap(projectId =>
  (load(projectId).environments || []).filter(e => e.builder && e.data).map(e => ({projectId, envId: e.id})));

// Datos del entorno (environment.data) sin importar el constructor.
export function environmentData(projectId, envId) {
  const project = load(projectId), env = (project.environments || []).find(e => e.id === envId);
  if (!env) throw Error('Entorno no encontrado: ' + envId);
  if (!env.builder || !env.data) throw Error('El entorno no tiene constructor (builder) y datos (data): ' + envId);
  const base = dir(project.id);
  return {project, env, base, data: JSON.parse(fs.readFileSync(safe(base, env.data), 'utf8'))};
}

export async function loadEnvironment(projectId, envId) {
  const ctx = environmentData(projectId, envId);
  const {build} = await import(pathToFileURL(safe(ctx.base, ctx.env.builder)).href);
  return {...ctx, build};
}

// Recorrido a pie (data.walkthrough) para scripts/entornos/recorrer.mjs: [{label, walk?, view?, position?, yawDeg?, noclip?, keys?, seconds?, snapshot?}].
export function walkthroughSteps(data) {
  const steps = data?.walkthrough;
  if (!Array.isArray(steps) || !steps.length) throw Error('El entorno no tiene recorrido (walkthrough en sus datos)');
  return steps.map((s, i) => {
    const where = `Paso ${i + 1} del recorrido`;
    if (!s || typeof s.label !== 'string' || !s.label) throw Error(where + ': falta label');
    const out = {label: s.label};
    if (s.walk !== undefined) out.walk = !!s.walk;
    if (s.view !== undefined) { if (typeof s.view !== 'string') throw Error(where + ': view debe ser un texto'); out.view = s.view; }
    if (s.position !== undefined) { if (!Array.isArray(s.position) || s.position.length !== 3 || !s.position.every(Number.isFinite)) throw Error(where + ': position necesita 3 números'); out.position = s.position; out.yawDeg = Number.isFinite(s.yawDeg) ? s.yawDeg : 0; }
    else if (s.yawDeg !== undefined) throw Error(where + ': yawDeg va con position');
    if (s.noclip !== undefined) out.noclip = !!s.noclip;
    if (s.keys !== undefined) {
      if (!Array.isArray(s.keys) || !s.keys.length || !s.keys.every(k => typeof k === 'string')) throw Error(where + ': keys debe ser una lista de teclas');
      if (!(Number.isFinite(s.seconds) && s.seconds > 0)) throw Error(where + ': keys exige seconds > 0');
      out.keys = s.keys; out.seconds = s.seconds;
    } else if (s.seconds !== undefined) throw Error(where + ': seconds va con keys');
    if (s.snapshot !== undefined) { if (typeof s.snapshot !== 'string' || !/^[\w.-]+$/.test(s.snapshot)) throw Error(where + ': snapshot no válido'); out.snapshot = s.snapshot; }
    return out;
  });
}

// Qué se ve en las capturas (data.capture): objeto raíz, grupo del que solo quedan visibles keep y si se quita la niebla.
export function captureSetup(data, envId) {
  const c = data?.capture || {};
  return {root: c.root || envId, group: c.group, keep: c.keep || [], fog: c.fog ?? true};
}

export function buildEnvironment(ctx, {state, textures} = {}) {
  const root = ctx.build(T, ctx.data, {state, textures});
  root.updateMatrixWorld(true);
  return root;
}

export async function exportGlb(root, {quiet = false} = {}) {
  const scene = new T.Scene();
  scene.add(root);
  const warn = console.warn;
  if (quiet) console.warn = () => {};
  let glb;
  try { glb = await new GLTFExporter().parseAsync(scene, {binary: true}); } finally { console.warn = warn; }
  const buffer = Buffer.from(glb);
  let meshes = 0; scene.traverse(o => { if (o.isMesh) meshes++; });
  return {buffer, meshes, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex')};
}

// Pares de caras coplanarias solapadas entre cajas alineadas a ejes. Ignora las caras que miran hacia abajo a ras de suelo o bajo tierra.
export function coplanarPairs(root) {
  root.updateMatrixWorld(true);
  const faces = [], q = new T.Quaternion(), pos = new T.Vector3(), sc = new T.Vector3();
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry.type !== 'BoxGeometry') return;
    o.matrixWorld.decompose(pos, q, sc);
    const e = new T.Euler().setFromQuaternion(q);
    if (![e.x, e.y, e.z].every(a => Math.abs(Math.sin(a * 2)) < 1e-6)) return;
    const b = new T.Box3().setFromObject(o);
    let name = o.name, par = o.parent; while (!name && par) { name = par.name; par = par.parent; }
    for (const ax of ['x', 'y', 'z']) for (const side of [-1, 1]) {
      const o2 = ['x', 'y', 'z'].filter(a => a !== ax);
      faces.push({ax, side, v: side < 0 ? b.min[ax] : b.max[ax], r: o2.map(k => [b.min[k], b.max[k]]), name: name || '?'});
    }
  });
  const found = new Map();
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const a = faces[i], c = faces[j];
    if (a.ax !== c.ax || a.side !== c.side || Math.abs(a.v - c.v) > 1e-4) continue;
    if (a.ax === 'y' && a.side < 0 && a.v <= 0.001) continue;
    const ov = [0, 1].map(k => Math.min(a.r[k][1], c.r[k][1]) - Math.max(a.r[k][0], c.r[k][0]));
    if (ov[0] > 1e-3 && ov[1] > 1e-3) { const key = [a.name, c.name].sort().join(' ↔ ') + ` (${a.ax}${a.side > 0 ? '+' : '−'} ${a.v.toFixed(2)})`; found.set(key, (found.get(key) || 0) + 1); }
  }
  return found;
}

// which: '--todos' (defecto y todos los presets), el id de un preset o nada (defecto).
export function coplanarReport(ctx, which) {
  const list = ctx.data.presets || [];
  const presets = which === '--todos' ? [{id: 'defecto'}, ...list] : [which ? list.find(x => x.id === which) || (() => { throw Error('Preset no encontrado: ' + which); })() : {id: 'defecto'}];
  const porPreset = {}, pares = new Map();
  let total = 0;
  for (const pr of presets) {
    const found = coplanarPairs(buildEnvironment(ctx, {state: pr.state}));
    total += found.size; porPreset[pr.id] = found.size; pares.set(pr.id, found);
  }
  return {total, porPreset, pares};
}
