// Rellena una secuencia existente de un capítulo con las viñetas de un storyboard: un plano por viñeta, con su fotograma
// (storyboardRender), su duración y su diálogo. Repetirlo tras cambiar el storyboard (storyboardSequenceMerge) conserva de cada plano su id, cámara,
// staging, reparto y el audio de las líneas que no cambian; las colocaciones del reparto de la secuencia, y los planos sin viñeta (con aviso en stderr).
// <secuencia> se resuelve con storyPlansTarget (#56): si es la ficha de escaleta del story (outlineSequence), los planos van a su contenedor, que se
// crea al final del acto si no existe; nunca a la secuencia de planos de otro story.
// Uso: node scripts/storyboard-a-secuencia.mjs [proyecto] <storyboard> <secuencia> [--project id] [--ambiente texto]
import {load, save} from '../app/store.mjs';
import {applyStoryPlans} from '../app/workflow.mjs';
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
if (!(p.storyboards || []).some(b => b.id === sbId)) throw Error('Storyboard no encontrado: ' + sbId);
const {project: next, episodeId, sequence: seq, created, warnings} = applyStoryPlans(p, sbId, {sequence: seqId});
for (const w of warnings) console.error('Aviso: ' + w);
if (amb) seq.ambiencePrompt = amb;
save(next, p.revision);
const episode = next.episodes.find(e => e.id === episodeId), secs = seq.shots.reduce((n, t) => n + t.duration, 0);
console.log(`${episode.title} · ${seq.title}${created ? ` (secuencia nueva ${seq.id})` : ''}: ${seq.shots.length} planos, ${secs} s, ${seq.cast.length} en el reparto, ${seq.shots.filter(t => t.storyboardRender).length} con fotograma · rev ${next.revision}`);
