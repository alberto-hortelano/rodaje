// Exporta a GLB un entorno 3D de un proyecto a partir de su constructor (environment.builder) y sus datos (environment.data).
// Uso: node scripts/entorno-glb.mjs <proyecto> <entorno> [preset] [--salida ruta/relativa.glb]
// Sin preset usa el estado por defecto del constructor. La salida por defecto es environment.glb.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {load, dir, safe} from '../app/store.mjs';

// GLTFExporter usa FileReader para el binario; Node tiene Blob pero no FileReader.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};

const args = process.argv.slice(2);
const out = args.includes('--salida') ? args.splice(args.indexOf('--salida'), 2)[1] : null;
const [projectId, envId, presetId] = args;
if (!projectId || !envId) throw Error('Uso: node scripts/entorno-glb.mjs <proyecto> <entorno> [preset] [--salida ruta.glb]');
const p = load(projectId), env = (p.environments || []).find(e => e.id === envId);
if (!env) throw Error('Entorno no encontrado: ' + envId);
if (!env.builder || !env.data) throw Error('El entorno no tiene constructor (builder) y datos (data)');
const base = dir(p.id);
const data = JSON.parse(fs.readFileSync(safe(base, env.data), 'utf8'));
const {build} = await import(pathToFileURL(safe(base, env.builder)).href);
const preset = presetId ? (data.presets || []).find(x => x.id === presetId) : null;
if (presetId && !preset) throw Error('Preset no encontrado: ' + presetId + '. Disponibles: ' + (data.presets || []).map(x => x.id).join(', '));
const scene = new T.Scene();
scene.add(build(T, data, {state: preset?.state, textures: false}));
const glb = await new GLTFExporter().parseAsync(scene, {binary: true});
const rel = out || env.glb || path.posix.join(path.posix.dirname(env.data), env.id + '.glb');
const file = safe(base, rel);
fs.writeFileSync(file, Buffer.from(glb));
let meshes = 0; scene.traverse(o => { if (o.isMesh) meshes++; });
console.log(`${rel} · ${meshes} mallas · ${(glb.byteLength / 1024).toFixed(0)} KB${preset ? ' · preset ' + preset.id : ''}`);
