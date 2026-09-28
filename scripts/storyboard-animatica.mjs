// Animáticas de un storyboard por paso (#46, docs/PROCESO.md «Animáticas»): ensayo 3D, fotogramas y fotogramas con voces, por secuencia
// del storyboard y entera, con subtítulos y rótulo de plano. ffmpeg local, sin coste. Nunca sobrescribe: cada ejecución y paso es una vNN nueva.
// Uso: node scripts/storyboard-animatica.mjs [proyecto] <storyboard> [--project id] [--paso 3d|fotogramas|voces] [--secuencia <id>]
//        [--capitulo-secuencia <id>] [--plan] [--importar <fichero> --paso <paso> [--subtitulos es] [--nota texto]]
//   Salida: storyboards/<id>/animaticas/<paso>[.<secuencia>]-vNN.mp4 e index.json. Sin --paso, los tres.
//   --plan: imprime la línea de tiempo y lo que falta (JSON), sin codificar ni escribir.
//   --importar: mueve una animática hecha a mano (storyboards/<id>/<fichero>) a <paso>-vNN.mp4 y la añade al índice.
//   Última línea de stdout: el resumen («3d v02 · 425.0 s · 4 secuencias · completa | …»).
import fs from 'node:fs';
import path from 'node:path';
import {load, dir} from '../app/store.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';
import {ANIMATIC_STEPS, animaticTimeline, chapterSequenceFor} from '../app/workflow.mjs';
import {renderAnimatics, importAnimatic} from '../lib/animaticas.mjs';

const USAGE = 'Uso: node scripts/storyboard-animatica.mjs [proyecto] <storyboard> [--project id] [--paso 3d|fotogramas|voces] [--secuencia <id>] [--capitulo-secuencia <id>] [--plan] [--importar <fichero> --paso <paso> [--subtitulos es] [--nota texto]]';
const args = process.argv.slice(2);
const plan = args.includes('--plan');
if (plan) args.splice(args.indexOf('--plan'), 1);
const opt = name => { const v = takeOption(args, name); if (v === true) usageExit(USAGE, name + ' necesita un valor'); return v; };
const p0 = takeOption(args, '--project'), paso = opt('--paso'), secuencia = opt('--secuencia'), capSeq = opt('--capitulo-secuencia');
const importar = opt('--importar'), subtitulos = opt('--subtitulos'), nota = opt('--nota');
const pos = args.filter(a => !a.startsWith('--'));
if (!pos.length) usageExit(USAGE);
const {project: projectId, args: [sbId]} = cliProject({usage: USAGE, opts: {project: p0}, args: pos, positional: 1});
if (!sbId) usageExit(USAGE);
if (paso !== undefined && !ANIMATIC_STEPS.includes(paso)) usageExit(USAGE, 'Paso no válido: ' + paso);
if (importar !== undefined && !paso) usageExit(USAGE, '--importar necesita --paso');

const KINDS = {'foto-3d': ['viñeta sin foto 3D', 'viñetas sin foto 3D'], fotograma: ['viñeta sin fotograma', 'viñetas sin fotograma'], plano: ['viñeta sin plano', 'viñetas sin plano'], audio: ['línea sin audio', 'líneas sin audio']};
const state = missing => {
  if (!missing.length) return 'completa';
  const by = {};
  for (const m of missing) by[m.kind] = (by[m.kind] || 0) + 1;
  return `incompleta (${Object.entries(by).map(([k, n]) => `${n} ${(KINDS[k] || [k, k])[n === 1 ? 0 : 1]}`).join(', ')})`;
};
const summary = (step, version, duration, sequences, missing) => `${step}${version ? ' v' + String(version).padStart(2, '0') : ''} · ${duration.toFixed(1)} s · ${sequences} ${sequences === 1 ? 'secuencia' : 'secuencias'} · ${state(missing)}`;

try {
  const p = load(projectId);
  const sb = (p.storyboards || []).find(b => b.id === sbId);
  if (!sb) throw Error('Storyboard desconocido: ' + sbId);
  const steps = paso ? [paso] : ANIMATIC_STEPS;
  if (importar !== undefined) {
    const e = importAnimatic(projectId, sbId, {file: importar, step: paso, subtitles: subtitulos, audio: false, note: nota || ''});
    console.log(`importada: ${e.file} · ${e.step} v${String(e.version).padStart(2, '0')} · ${e.duration.toFixed(1)} s · subtítulos ${e.subtitles}`);
  } else if (plan) {
    const base = dir(projectId), has = f => fs.existsSync(path.join(base, f));
    const source = chapterSequenceFor(p, sb, {override: capSeq || undefined});
    const timelines = steps.map(step => animaticTimeline(p, sb, {step, source, sequence: secuencia || null, has}));
    console.log(JSON.stringify(timelines, null, 2));
    console.error(`Secuencia de capítulo: ${source ? `${source.sequence.id} (${source.candidates} candidata${source.candidates === 1 ? '' : 's'})` : 'ninguna enlazada: duraciones de viñeta y diálogo repartido'}`);
    console.log(timelines.map(t => summary(t.step, null, t.duration, t.sequences.length, t.missing)).join(' | '));
  } else {
    const entries = renderAnimatics(projectId, p, sbId, {steps, sequence: secuencia || null, chapterSequence: capSeq || null});
    console.log(steps.map(step => {
      const list = entries.filter(e => e.step === step), whole = list.find(e => e.sequence === null), seqs = list.filter(e => e.sequence !== null);
      const missing = whole ? whole.missing : seqs.flatMap(e => e.missing);
      return summary(step, list[0]?.version, whole ? whole.duration : seqs.reduce((n, e) => n + e.duration, 0), seqs.length, missing);
    }).join(' | '));
  }
} catch (e) {
  console.error('storyboard-animatica: ' + e.message);
  process.exit(1);
}
