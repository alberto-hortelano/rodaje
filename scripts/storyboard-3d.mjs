// Plano 3D de una viñeta del storyboard (#51, docs/PROCESO.md «Animación 3D de una viñeta»): crea o actualiza en una secuencia del capítulo el plano
// enlazado a la viñeta (storyboardShot) con su duración, su diálogo, t.cast con su reparto, staging y, si el fichero de cámaras la trae, un cameraRig
// fijo y staging.environment.preset (formato en docs/scripts.md). Reejecutar es idempotente: conserva la cámara, el staging, el reparto y el audio
// de las líneas que no cambian; --force sustituye la cámara (y el preset si la entrada trae momento) por los del fichero. Sin coste.
// Uso: node scripts/storyboard-3d.mjs <storyboard> <viñeta> [--secuencia <id>] [--camaras fichero] [--force] [--plan] [--project id]
//   <viñeta>: código (A02) o id. --plan: imprime el plano resultante (JSON) sin escribir.
//   La secuencia se resuelve con storyPlansTarget (#56): sin --secuencia (o con la ficha de escaleta del story), el contenedor de planos del story,
//   que se crea al final del acto si no existe; un story sin outlineSequence necesita --secuencia.
//   Avisos por stderr; última línea de stdout: «A02 · creado · plano <id> · posición 2/56 · cámara fichero · preset camino».
import fs from 'node:fs';
import path from 'node:path';
import {load, save, dir} from '../app/store.mjs';
import {takeOption} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';
import {storyboardShotDraft, mergeStoryboardShot, storyboardInsertIndex, findStoryboardShot, storyPlansTarget, storyLocation, parseShotCameras, cameraFileWarnings, shotRigIssues, shotCastIssues, effectiveEnvironment, locationEnvironment} from '../app/workflow.mjs';

const USAGE = 'Uso: node scripts/storyboard-3d.mjs <storyboard> <viñeta> [--secuencia <id>] [--camaras fichero] [--force] [--plan] [--project id]';
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const plan = flag('--plan'), force = flag('--force');
const opt = name => { const v = takeOption(args, name); if (v === true) usageExit(USAGE, name + ' necesita un valor'); return v; };
const p0 = takeOption(args, '--project'), seqId = opt('--secuencia'), camaras = opt('--camaras');
const pos = args.filter(a => !a.startsWith('--'));
if (pos.length < 2) usageExit(USAGE);
const {project: projectId, args: [sbId, key]} = cliProject({usage: USAGE, opts: {project: p0}, args: pos});

try {
  const p = load(projectId);
  const sb = (p.storyboards || []).find(b => b.id === sbId);
  if (!sb) throw Error('Storyboard desconocido: ' + sbId);
  const v = findStoryboardShot(sb, key).shot, code = v.code || v.id;
  const target = storyPlansTarget(p, sbId, seqId || undefined);
  if (!target) usageExit(USAGE, `Falta --secuencia <id>: el story ${sbId} no tiene secuencia de escaleta (outlineSequence)`);
  if (target.errors.length) throw Error(target.errors[0]);
  const warn = w => console.error('Aviso: ' + w);
  target.warnings.forEach(warn);
  const seq = target.sequence;
  if (target.created) { seq.location = storyLocation(p, sb); target.episode.sequences.splice(target.index, 0, seq); warn(`secuencia nueva ${seq.id} para los planos del story, al final de ${target.episode.title || target.episode.id}`); }

  let entry = null, file = null;
  if (camaras) {
    file = parseShotCameras(JSON.parse(fs.readFileSync(path.resolve(camaras), 'utf8')));
    if (file.errors.length) throw Error('Fichero de cámaras no válido:\n' + file.errors.join('\n'));
    if (file.storyboard && file.storyboard !== sb.id) warn(`el fichero de cámaras es del storyboard ${file.storyboard}, no de ${sb.id}`);
    entry = file.byCode.get(v.code) || null;
    if (!entry) warn(`el fichero de cámaras no trae ${code}: se conserva la cámara del plano`);
  }

  const linked = seq.shots.filter(t => t.storyboardShot === v.id);
  if (linked.length > 1) warn(`${linked.length} planos de la secuencia enlazan ${code}: se actualiza el primero (${linked[0].id})`);
  const prev = linked[0] || null;
  const draft = storyboardShotDraft(p, v, {castIds: (seq.cast || []).map(a => a.character)});
  const {shot} = mergeStoryboardShot(prev, draft, {camera: entry?.camera || null, preset: entry?.momento || null, force});
  if (prev) seq.shots[seq.shots.indexOf(prev)] = shot;
  else seq.shots.splice(storyboardInsertIndex(seq.shots, (sb.sequences || []).flatMap(s => (s.shots || []).map(t => t.id)), v.id), 0, shot);

  if (entry) {
    const env = locationEnvironment(p, shot.location || seq.location);
    let presetIds = null;
    if (env?.data) try { presetIds = (JSON.parse(fs.readFileSync(path.join(dir(projectId), env.data), 'utf8')).presets || []).map(x => x.id); } catch {}
    cameraFileWarnings({envCfg: effectiveEnvironment(seq.environment, shot.staging?.environment), environmentId: env?.id || null, fileEnv: file.entorno, momento: entry.momento, presetIds}).forEach(warn);
  }
  shotCastIssues(shot, seq, {characters: p.characters.map(c => c.id)}).warnings.forEach(warn);
  const rig = shotRigIssues(seq, shot);
  for (const e of rig.errors) warn('cámara: ' + e);

  const fromFile = !!entry?.camera && (!prev || force || !prev.cameraRig);
  const preset = shot.staging?.environment?.preset;
  const summary = [code, prev ? 'actualizado' : 'creado', 'plano ' + shot.id, `posición ${seq.shots.indexOf(shot) + 1}/${seq.shots.length}`,
    'cámara ' + (fromFile ? 'fichero' : prev ? 'conservada' : 'por defecto'), preset ? 'preset ' + preset : 'sin preset'].join(' · ');
  if (plan) console.log(JSON.stringify(shot, null, 2));
  else save(p, p.revision);
  console.log(summary);
} catch (e) {
  console.error('storyboard-3d: ' + e.message);
  process.exit(1);
}
