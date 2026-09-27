// Entornos 3D con constructor (environment.builder + environment.data): carga, construcción, exportación a GLB y detección de caras coplanarias.
// Lo usan scripts/entorno-glb.mjs, scripts/entorno-coplanares.mjs y scripts/linea-base.mjs.
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

export async function loadEnvironment(projectId, envId) {
  const project = load(projectId), env = (project.environments || []).find(e => e.id === envId);
  if (!env) throw Error('Entorno no encontrado: ' + envId);
  if (!env.builder || !env.data) throw Error('El entorno no tiene constructor (builder) y datos (data): ' + envId);
  const base = dir(project.id);
  const data = JSON.parse(fs.readFileSync(safe(base, env.data), 'utf8'));
  const {build} = await import(pathToFileURL(safe(base, env.builder)).href);
  return {project, env, base, data, build};
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
