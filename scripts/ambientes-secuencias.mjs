// Ambiente de las secuencias sin planos (#58, docs/ARQUITECTURA.md «Relaciones»): rellena sequence.location a partir de environments[].sequences,
// que queda como dato informativo. Solo toca secuencias sin planos, así que ningún digest cambia (aborta si cambiara o si el resultado no valida).
// Un entorno de varios ambientes necesita --elegir entorno=ambiente. Idempotente: la segunda vez imprime «Sin cambios».
// Uso: node scripts/ambientes-secuencias.mjs [--project id] [--elegir entorno=ambiente]... [--plan]
//   --plan imprime los cambios, los avisos y el resumen sin escribir. Sale con 2 por uso y con 1 si --elegir no vale.
import {load, save, validate, digest} from '../app/store.mjs';
import {sequenceLocationPlan} from '../app/workflow.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/ambientes-secuencias.mjs [--project id] [--elegir entorno=ambiente]... [--plan]';
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const plan = flag('--plan');
const p0 = takeOption(args, '--project'), choose = {};
for (let v; (v = takeOption(args, '--elegir')) !== undefined;) {
  const m = typeof v === 'string' ? /^([^=]+)=([^=]+)$/.exec(v) : null;
  if (!m) usageExit(USAGE, '--elegir necesita entorno=ambiente');
  choose[m[1]] = m[2];
}
const {project: projectId} = cliProject({usage: USAGE, opts: {project: p0}, args});
if (args.length) usageExit(USAGE, 'Argumento no reconocido: ' + args[0]);

const shotIds = p => (p.episodes || []).flatMap(e => (e.sequences || []).flatMap(s => (s.shots || []).map(t => t.id)));

try {
  const p = load(projectId);
  const r = sequenceLocationPlan(p, {choose});
  if (r.errors.length) { for (const e of r.errors) console.error('Error: ' + e); process.exit(1); }
  for (const o of r.ops) console.log(`${o.sequence} → ${o.location} (entorno ${o.environment})`);
  for (const w of r.warnings) console.log('Aviso: ' + w);
  if (r.warnings.some(w => w.includes('varios ambientes'))) console.log('Para un entorno de varios ambientes: --elegir <entorno>=<ambiente>.');
  if (!r.ops.length) { console.log(`Sin cambios · ${r.warnings.length} avisos`); process.exit(0); }
  const ids = shotIds(p), changed = ids.filter(id => digest(p, id) !== digest(r.next, id));
  if (changed.length) throw Error(`Cambiaría el digest de ${changed.length} planos: ${changed.slice(0, 5).join(', ')}`);
  validate(r.next);
  if (plan) { console.log(`Plan: ${r.ops.length} secuencias · ${r.warnings.length} avisos · ${ids.length} planos con el mismo digest; no se escribe (sin --plan se aplica).`); process.exit(0); }
  save(r.next, p.revision);
  console.log(`Escrito: ${r.ops.length} secuencias · ${r.warnings.length} avisos · rev ${r.next.revision}`);
} catch (e) {
  console.error('ambientes-secuencias: ' + e.message);
  process.exit(1);
}
