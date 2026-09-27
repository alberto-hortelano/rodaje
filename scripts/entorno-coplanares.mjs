// Busca caras coplanarias solapadas (z-fighting, parpadeo) entre las cajas alineadas de un entorno 3D con constructor.
// Uso: node scripts/entorno-coplanares.mjs [proyecto] <entorno> [preset|--todos] [--project id]
// Sin proyecto posicional se usa --project, RODAJE_PROJECT o el activo en la app; con preset, el proyecto va como posicional o con --project.
// Ignora las caras que miran hacia abajo a ras de suelo o bajo tierra. Sale con código 1 si encuentra alguna.
import {loadEnvironment, coplanarReport} from '../lib/entorno3d.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/entorno-coplanares.mjs [proyecto] <entorno> [preset|--todos] [--project id]';
const argv = process.argv.slice(2), p0 = takeOption(argv, '--project'), todos = argv.includes('--todos');
const rest = argv.filter(a => a !== '--todos');
if (!rest.length) usageExit(USAGE);
const {project: projectId, args: [envId, preset]} = cliProject({usage: USAGE, opts: {project: p0}, args: rest, positional: 1});
if (!envId) usageExit(USAGE);
const {total, pares} = coplanarReport(await loadEnvironment(projectId, envId), todos ? '--todos' : preset);
for (const [id, found] of pares) {
  console.log(`${id}: ${found.size} pares coplanarios`);
  for (const [k, n] of found) console.log('  ' + k + (n > 1 ? ' ×' + n : ''));
}
process.exitCode = total ? 1 : 0;
