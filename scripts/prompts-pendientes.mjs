// Lista los prompts de imagen (.prompt.txt con cabecera «Destino:») cuya imagen aún no existe, para generarlos con ChatGPT.
// Uso: node scripts/prompts-pendientes.mjs [proyecto] [filtro] [--project id]   (filtro: trozo de ruta, p. ej. «personajes/01-ana» o «ambientes/plaza»)
//      Sin proyecto posicional: --project, RODAJE_PROJECT o el activo en la app; para filtrar sin nombrar el proyecto, --project id filtro.
//      --todos  lista también los ya generados
import fs from 'node:fs';
import path from 'node:path';
import {dir} from '../app/store.mjs';
import {ROOT} from '../lib/paths.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/prompts-pendientes.mjs [proyecto] [filtro] [--project id] [--todos]';
const args = process.argv.slice(2);
const all = args.includes('--todos');
const p0 = takeOption(args, '--project');
const {project: projectId, args: [filter = '']} = cliProject({usage: USAGE, opts: {project: p0}, args: args.filter(a => a !== '--todos'), positional: 0});
const base = dir(projectId), root = ROOT;
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.name.startsWith('.') ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.prompt.txt') ? [path.join(d, e.name)] : []);
let pending = 0, done = 0;
const groups = new Map();
for (const file of walk(base).sort()) {
  const rel = path.relative(base, file);
  if (filter && !rel.includes(filter)) continue;
  const head = fs.readFileSync(file, 'utf8').split('\n', 3);
  if (!head[0].startsWith('Destino:')) continue;
  const dest = head[0].slice(8).trim(), exists = fs.existsSync(path.join(root, dest));
  exists ? done++ : pending++;
  if (exists && !all) continue;
  const attach = head.find(l => l.startsWith('Adjuntar:'))?.slice(9).trim();
  const group = path.dirname(rel);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(`  ${exists ? '✓' : '·'} ${path.basename(rel)}${attach && !/^nada/i.test(attach) ? `  (adjuntar: ${attach})` : ''}`);
}
for (const [group, lines] of groups) console.log(group + '\n' + lines.join('\n'));
console.log(`\n${pending} pendientes · ${done} generados`);
