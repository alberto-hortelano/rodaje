// Exporta a GLB un entorno 3D de un proyecto a partir de su constructor (environment.builder) y sus datos (environment.data).
// Uso: node scripts/entorno-glb.mjs [proyecto] <entorno> [preset] [--project id] [--salida ruta/relativa.glb]
// Sin proyecto posicional se usa --project, RODAJE_PROJECT o el activo en la app; con preset, el proyecto va como posicional o con --project.
// Sin preset usa el estado por defecto del constructor. La salida por defecto es environment.glb.
import fs from 'node:fs';
import path from 'node:path';
import {safe} from '../lib/paths.mjs';
import {loadEnvironment, buildEnvironment, exportGlb} from '../lib/entorno3d.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/entorno-glb.mjs [proyecto] <entorno> [preset] [--project id] [--salida ruta.glb]';
const args = process.argv.slice(2);
const out = args.includes('--salida') ? args.splice(args.indexOf('--salida'), 2)[1] : null;
const p0 = takeOption(args, '--project');
if (!args.length) usageExit(USAGE);
const {project: projectId, args: [envId, presetId]} = cliProject({usage: USAGE, opts: {project: p0}, args, positional: 1});
if (!envId) usageExit(USAGE);
const ctx = await loadEnvironment(projectId, envId), {env, base, data} = ctx;
const preset = presetId ? (data.presets || []).find(x => x.id === presetId) : null;
if (presetId && !preset) throw Error('Preset no encontrado: ' + presetId + '. Disponibles: ' + (data.presets || []).map(x => x.id).join(', '));
const {buffer, meshes} = await exportGlb(buildEnvironment(ctx, {state: preset?.state, textures: false}));
const rel = out || env.glb || path.posix.join(path.posix.dirname(env.data), env.id + '.glb');
fs.writeFileSync(safe(base, rel), buffer);
console.log(`${rel} · ${meshes} mallas · ${(buffer.length / 1024).toFixed(0)} KB${preset ? ' · preset ' + preset.id : ''}`);
