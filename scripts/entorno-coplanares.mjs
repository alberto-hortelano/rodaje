// Busca caras coplanarias solapadas (z-fighting, parpadeo) entre las cajas alineadas de un entorno 3D con constructor.
// Uso: node scripts/entorno-coplanares.mjs <proyecto> <entorno> [preset|--todos]
// Ignora las caras que miran hacia abajo a ras de suelo o bajo tierra. Sale con código 1 si encuentra alguna.
import {loadEnvironment, coplanarReport} from '../lib/entorno3d.mjs';

const [projectId, envId, which] = process.argv.slice(2);
if (!projectId || !envId) throw Error('Uso: node scripts/entorno-coplanares.mjs <proyecto> <entorno> [preset|--todos]');
const {total, pares} = coplanarReport(await loadEnvironment(projectId, envId), which);
for (const [id, found] of pares) {
  console.log(`${id}: ${found.size} pares coplanarios`);
  for (const [k, n] of found) console.log('  ' + k + (n > 1 ? ' ×' + n : ''));
}
process.exitCode = total ? 1 : 0;
