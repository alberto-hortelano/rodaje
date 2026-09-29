// Rellena una secuencia existente de un capítulo con las viñetas de un storyboard: un plano por viñeta, con su fotograma
// (storyboardRender), su duración y su diálogo. Repetirlo tras cambiar el storyboard (storyboardSequenceMerge) conserva de cada plano su id, cámara,
// staging, reparto y el audio de las líneas que no cambian; las colocaciones del reparto de la secuencia, y los planos sin viñeta (con aviso en stderr).
// Uso: node scripts/storyboard-a-secuencia.mjs [proyecto] <storyboard> <secuencia> [--project id] [--ambiente texto]
import {load, save} from '../app/store.mjs';
import {storyboardSequenceMerge} from '../app/workflow.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/storyboard-a-secuencia.mjs [proyecto] <storyboard> <secuencia> [--project id] [--ambiente texto]';
const args = process.argv.slice(2);
const amb = args.includes('--ambiente') ? args.splice(args.indexOf('--ambiente'), 2)[1] : null;
const p0 = takeOption(args, '--project');
if (args.length < 2) usageExit(USAGE);
const {project: projectId, args: [sbId, seqId]} = cliProject({usage: USAGE, opts: {project: p0}, args, positional: 2});
if (!seqId) usageExit(USAGE);
const p = load(projectId);
const sb = (p.storyboards || []).find(b => b.id === sbId);
if (!sb) throw Error('Storyboard no encontrado: ' + sbId);
const episode = p.episodes.find(e => e.sequences.some(s => s.id === seqId));
if (!episode) throw Error('Secuencia no encontrada: ' + seqId);
const i = episode.sequences.findIndex(s => s.id === seqId);
const {sequence: seq, warnings} = storyboardSequenceMerge(p, sb, episode.sequences[i]);
for (const w of warnings) console.error('Aviso: ' + w);
if (amb) seq.ambiencePrompt = amb;
episode.sequences[i] = seq;
save(p, p.revision);
const secs = seq.shots.reduce((n, t) => n + t.duration, 0);
console.log(`${episode.title} · ${seq.title}: ${seq.shots.length} planos, ${secs} s, ${seq.cast.length} en el reparto, ${seq.shots.filter(t => t.storyboardRender).length} con fotograma · rev ${p.revision}`);
