// Exporta a GLB un entorno 3D de un proyecto a partir de su constructor (environment.builder) y sus datos (environment.data).
// Uso: node scripts/entorno-glb.mjs <proyecto> <entorno> [preset] [--salida ruta/relativa.glb]
// Sin preset usa el estado por defecto del constructor. La salida por defecto es environment.glb.
import fs from 'node:fs';
import path from 'node:path';
import {safe} from '../app/store.mjs';
import {loadEnvironment, buildEnvironment, exportGlb} from '../lib/entorno3d.mjs';

const args = process.argv.slice(2);
const out = args.includes('--salida') ? args.splice(args.indexOf('--salida'), 2)[1] : null;
const [projectId, envId, presetId] = args;
if (!projectId || !envId) throw Error('Uso: node scripts/entorno-glb.mjs <proyecto> <entorno> [preset] [--salida ruta.glb]');
const ctx = await loadEnvironment(projectId, envId), {env, base, data} = ctx;
const preset = presetId ? (data.presets || []).find(x => x.id === presetId) : null;
if (presetId && !preset) throw Error('Preset no encontrado: ' + presetId + '. Disponibles: ' + (data.presets || []).map(x => x.id).join(', '));
const {buffer, meshes} = await exportGlb(buildEnvironment(ctx, {state: preset?.state, textures: false}));
const rel = out || env.glb || path.posix.join(path.posix.dirname(env.data), env.id + '.glb');
fs.writeFileSync(safe(base, rel), buffer);
console.log(`${rel} · ${meshes} mallas · ${(buffer.length / 1024).toFixed(0)} KB${preset ? ' · preset ' + preset.id : ''}`);
