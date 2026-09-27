// Rellena una secuencia existente de un capítulo con las viñetas de un storyboard: un plano por viñeta, con su fotograma
// (storyboardRender), su duración y su diálogo. Repetirlo tras cambiar el storyboard conserva el id de los planos.
// Uso: node scripts/storyboard-a-secuencia.mjs <proyecto> <storyboard> <secuencia> [--ambiente texto]
import {load, save} from '../app/store.mjs';
import {storyboardToSequence} from '../app/workflow.mjs';

const args = process.argv.slice(2);
const amb = args.includes('--ambiente') ? args.splice(args.indexOf('--ambiente'), 2)[1] : null;
const [projectId, sbId, seqId] = args;
if (!seqId) throw Error('Uso: node scripts/storyboard-a-secuencia.mjs <proyecto> <storyboard> <secuencia> [--ambiente texto]');
const p = load(projectId);
const sb = (p.storyboards || []).find(b => b.id === sbId);
if (!sb) throw Error('Storyboard no encontrado: ' + sbId);
const episode = p.episodes.find(e => e.sequences.some(s => s.id === seqId));
if (!episode) throw Error('Secuencia no encontrada: ' + seqId);
const i = episode.sequences.findIndex(s => s.id === seqId);
const seq = storyboardToSequence(p, sb, episode.sequences[i]);
if (amb) seq.ambiencePrompt = amb;
episode.sequences[i] = seq;
save(p, p.revision);
const secs = seq.shots.reduce((n, t) => n + t.duration, 0);
console.log(`${episode.title} · ${seq.title}: ${seq.shots.length} planos, ${secs} s, ${seq.cast.length} en el reparto, ${seq.shots.filter(t => t.storyboardRender).length} con fotograma · rev ${p.revision}`);
