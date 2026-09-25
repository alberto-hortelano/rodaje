// Busca caras coplanarias solapadas (z-fighting, parpadeo) entre las cajas alineadas de un entorno 3D con constructor.
// Uso: node scripts/entorno-coplanares.mjs <proyecto> <entorno> [preset|--todos]
// Ignora las caras que miran hacia abajo a ras de suelo o bajo tierra. Sale con código 1 si encuentra alguna.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {load, dir, safe} from '../app/store.mjs';

const [projectId, envId, which] = process.argv.slice(2);
if (!projectId || !envId) throw Error('Uso: node scripts/entorno-coplanares.mjs <proyecto> <entorno> [preset|--todos]');
const p = load(projectId), env = (p.environments || []).find(e => e.id === envId);
if (!env?.builder || !env?.data) throw Error('Entorno sin constructor (builder) y datos (data): ' + envId);
const base = dir(p.id), data = JSON.parse(fs.readFileSync(safe(base, env.data), 'utf8'));
const {build} = await import(pathToFileURL(safe(base, env.builder)).href);
const presets = which === '--todos' ? [{id: 'defecto'}, ...(data.presets || [])] : [which ? (data.presets || []).find(x => x.id === which) || (() => { throw Error('Preset no encontrado: ' + which); })() : {id: 'defecto'}];

function check(state) {
  const root = build(T, data, {state}); root.updateMatrixWorld(true);
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
let total = 0;
for (const pr of presets) {
  const found = check(pr.state);
  total += found.size;
  console.log(`${pr.id}: ${found.size} pares coplanarios`);
  for (const [k, n] of found) console.log('  ' + k + (n > 1 ? ' ×' + n : ''));
}
process.exitCode = total ? 1 : 0;
