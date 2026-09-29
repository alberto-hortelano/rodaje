// Migra un proyecto al modelo escaleta → story → planos (#56, docs/ARQUITECTURA.md): fichas de escaleta nuevas, enlaces story → ficha
// (outlineSequence, version), vigentes (currentStoryboard) y pruebas (test). No cambia ids de secuencia ni planos: aborta si cambia el digest de
// algún plano, si la secuencia de un lote deja de existir o si el resultado no valida. Idempotente: la segunda vez imprime «Sin cambios».
// Uso: node scripts/migrar-storys.mjs [--project id] [--spec fichero.json] [--plan]
//   --plan sin --spec: estado de la escaleta y spec sugerida (JSON). --plan con --spec: las operaciones, sin escribir. Sin --plan: escribe.
//   spec: {"fichas":[{"id","from","title"}], "enlaces":{"<story>":"<ficha>"}, "vigentes":{"<ficha>":"<story>"}, "pruebas":["<secuencia>"]}
import fs from 'node:fs';
import path from 'node:path';
import {load, save, validate, digest} from '../app/store.mjs';
import {storyMigrationPlan, outlineTree} from '../app/workflow.mjs';
import {listLotes} from '../lib/lotes.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/migrar-storys.mjs [--project id] [--spec fichero.json] [--plan]';
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const plan = flag('--plan');
const p0 = takeOption(args, '--project'), specFile = takeOption(args, '--spec');
const {project: projectId} = cliProject({usage: USAGE, opts: {project: p0}, args});
if (specFile === true) usageExit(USAGE, '--spec necesita un fichero');
if (args.length) usageExit(USAGE, 'Argumento no reconocido: ' + args[0]);
if (!plan && !specFile) usageExit(USAGE, 'Sin --spec solo se admite --plan (estado y spec sugerida)');

const shotIds = p => (p.episodes || []).flatMap(e => (e.sequences || []).flatMap(s => (s.shots || []).map(t => t.id)));
const seqIn = (p, episode, sequence) => !!p.episodes.find(e => e.id === episode)?.sequences.some(s => s.id === sequence);

function printState(p) {
  const tree = outlineTree(p);
  for (const a of tree.acts) {
    console.log(`${a.episode.title || a.episode.id}`);
    for (const r of a.sequences) {
      console.log(`  ${r.code} ${r.sequence.id} · ${r.sequence.title}${r.ownShots ? ` · ${r.ownShots} planos propios` : ''}${r.sequence.storyboard ? ` · planos del story ${r.sequence.storyboard} (sin enlazar)` : ''}`);
      for (const s of r.storys) console.log(`      v${s.version} ${s.storyboard.id}${s.current ? ' (vigente)' : ''}${s.container ? ` · planos en ${s.container.sequence.id}` : ''}`);
    }
  }
  if (tree.tests.length) console.log('Pruebas: ' + tree.tests.map(x => x.sequence.id).join(', '));
  if (tree.unlinked.length) console.log('Storys sin ficha: ' + tree.unlinked.map(u => u.storyboard.id + (u.container ? ` (planos en ${u.container.sequence.id})` : '')).join(', '));
}

try {
  const p = load(projectId);
  let spec = null;
  if (specFile) spec = JSON.parse(fs.readFileSync(path.resolve(specFile), 'utf8'));
  const r = storyMigrationPlan(p, spec);
  if (!spec) {
    printState(p);
    console.log('\nSpec sugerida (revísala antes de usarla con --spec):');
    console.log(JSON.stringify(r.suggested, null, 2));
    process.exit(0);
  }
  for (const w of r.warnings) console.error('Aviso: ' + w);
  if (r.errors.length) { for (const e of r.errors) console.error('Error: ' + e); process.exit(1); }
  if (!r.ops.length) { console.log('Sin cambios'); process.exit(0); }
  for (const o of r.ops) console.log(`[${o.kind}] ${o.text}`);
  // Seguridad: mismos planos con el mismo digest, las secuencias de los lotes siguen existiendo y el resultado valida.
  const before = shotIds(p), after = shotIds(r.next);
  if (before.join('\n') !== after.join('\n')) throw Error('La lista de planos cambiaría');
  const changed = before.filter(id => digest(p, id) !== digest(r.next, id));
  if (changed.length) throw Error(`Cambiaría el digest de ${changed.length} planos: ${changed.slice(0, 5).join(', ')}`);
  const lotes = listLotes(projectId), lost = lotes.filter(l => seqIn(p, l.episode, l.sequence) && !seqIn(r.next, l.episode, l.sequence));
  if (lost.length) throw Error('Perderían su secuencia los lotes: ' + lost.map(l => l.id).join(', '));
  validate(r.next);
  console.log(`Comprobado: ${before.length} planos con el mismo digest, ${lotes.length} lotes con su secuencia, proyecto válido.`);
  if (plan) { console.log(`Plan: ${r.ops.length} operaciones; no se escribe (sin --plan se aplica).`); process.exit(0); }
  save(r.next, p.revision);
  console.log(`Escrito: ${r.ops.length} operaciones · rev ${r.next.revision}`);
} catch (e) {
  console.error('migrar-storys: ' + e.message);
  process.exit(1);
}
