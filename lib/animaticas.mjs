// Animáticas de un storyboard (#46): storyboards/<id>/animaticas/<paso>[.<secuencia>]-vNN.mp4 y su índice index.json.
// La línea de tiempo es pura (animaticTimeline en app/workflow.mjs); aquí se traduce a ffmpeg: un segmento por viñeta desde imagen fija
// (o placa negra), unidos sin recodificar por secuencia y entera. Nunca sobrescribe: cada ejecución y paso toma la siguiente vNN.
// Importa node:*, ./paths.mjs, ./json.mjs, ./media.mjs y ../app/workflow.mjs; nunca app/store.mjs. Sin fal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {projectDir, safe} from './paths.mjs';
import {readJSON, writeJSON} from './json.mjs';
import {ffmpeg, probeDuration, concatList} from './media.mjs';
import {ANIMATIC_STEPS, animaticTimeline, chapterSequenceFor, nextAnimaticVersion, animaticGroups, speechLocale} from '../app/workflow.mjs';

export const ANIM_DIR = id => `storyboards/${id}/animaticas`;
// La misma fuente que el montaje (scripts/bloques/montar.mjs).
export const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const W = 1280, H = 720, FPS = 24;

// Texto para drawtext='…', como en montar.mjs: \ doble, ' tipográfica, : y % escapados.
export const drawtextEscape = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '\\%');
const n3 = n => String(Math.round(n * 1000) / 1000);

// Argumentos de ffmpeg (sin -y/-v) del segmento de una viñeta de animaticTimeline. Entradas: la imagen en bucle (o una placa negra),
// los audios de las líneas (solo voces) y, la última, silencio estéreo de la duración del plano. Todos los segmentos salen con los
// mismos parámetros (1280×720, 24 fps, H.264, AAC 48 kHz estéreo) para unirlos con concat -c copy.
export function segmentArgs(shot, {base, font = FONT, step, out}) {
  const D = n3(shot.duration), args = [];
  if (shot.image) args.push('-loop', '1', '-framerate', String(FPS), '-t', D, '-i', path.join(base, shot.image));
  else args.push('-f', 'lavfi', '-i', `color=black:s=${W}x${H}:r=${FPS}:d=${D}`);
  const audios = step === 'voces' ? shot.lines.filter(l => l.audio) : [];
  for (const l of audios) args.push('-i', path.join(base, l.audio));
  const silence = audios.length + 1;
  args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${D}`);
  const text = (t, extra) => `drawtext=fontfile=${font}:text='${drawtextEscape(t)}':${extra}`;
  const vf = [`scale=${W}:${H}:force_original_aspect_ratio=decrease`, `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`, 'setsar=1', `fps=${FPS}`,
    text(shot.label, 'fontsize=26:fontcolor=white:borderw=2:x=20:y=20')];
  if (shot.slate) vf.push(text(shot.slate, 'fontsize=56:fontcolor=white@0.85:x=(w-text_w)/2:y=(h-text_h)/2'));
  for (const l of shot.lines) l.rows.forEach((row, i) => vf.push(text(row, `fontsize=30:fontcolor=white:borderw=2:box=1:boxcolor=black@0.45:boxborderw=6:x=(w-text_w)/2:y=h-${60 + 44 * (l.rows.length - 1 - i)}:enable='between(t,${n3(l.at)},${n3(l.end)})'`)));
  const f = [`[0:v]${vf.join(',')}[v]`];
  audios.forEach((l, i) => f.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(l.at * 1000)}:all=1[a${i}]`));
  f.push(`[${silence}:a]${audios.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audios.length + 1}:normalize=0:duration=first,atrim=0:${D}[a]`);
  return [...args, '-filter_complex', f.join(';'), '-map', '[v]', '-map', '[a]', '-t', D,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', out];
}

const indexFile = (project, sbId) => path.join(projectDir(project), ANIM_DIR(sbId), 'index.json');
export function readAnimaticIndex(project, sbId) {
  const f = indexFile(project, sbId);
  const idx = fs.existsSync(f) ? readJSON(f) : null;
  return {storyboard: sbId, entries: Array.isArray(idx?.entries) ? idx.entries : []};
}
// Relee y añade (escritura atómica): el índice es texto versionado en el repositorio del proyecto; los mp4 los ignora git.
export function appendAnimaticEntries(project, sbId, entries) {
  const idx = readAnimaticIndex(project, sbId);
  idx.entries.push(...entries);
  writeJSON(indexFile(project, sbId), idx);
  return idx;
}
const animFiles = dir => fs.existsSync(dir) ? fs.readdirSync(dir) : [];
// Deja un .part.mp4 en su nombre final solo si ese nombre está libre.
export function place(part, dest) {
  if (fs.existsSync(dest)) { fs.rmSync(part, {force: true}); throw Error('Ya existe ' + path.basename(dest) + '; no se sobrescribe'); }
  fs.renameSync(part, dest);
}
function concatInto(files, dest, tmp) {
  const list = path.join(tmp, 'concat-' + path.basename(dest) + '.txt'), part = dest.replace(/\.mp4$/, '.part.mp4');
  fs.writeFileSync(list, concatList(files, tmp));
  try { ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', part]); } catch (e) { fs.rmSync(part, {force: true}); throw e; }
  place(part, dest);
}

// Genera las animáticas de los pasos pedidos y las añade al índice; devuelve las entradas nuevas (una por secuencia y la entera).
// sequence: solo esa secuencia del storyboard (sin animática entera). chapterSequence: fuerza la secuencia de capítulo enlazada.
export function renderAnimatics(project, live, sbId, {steps = ANIMATIC_STEPS, sequence = null, chapterSequence = null, log = console.log} = {}) {
  const sb = (live?.storyboards || []).find(b => b.id === sbId);
  if (!sb) throw Error('Storyboard desconocido');
  for (const s of steps) if (!ANIMATIC_STEPS.includes(s)) throw Error('Paso no válido: ' + s + ' (3d, fotogramas o voces)');
  if (!fs.existsSync(FONT)) throw Error('Falta la fuente ' + FONT + ' (fonts-dejavu-core)');
  const base = projectDir(project), outDir = path.join(base, ANIM_DIR(sbId)), rel = f => ANIM_DIR(sbId) + '/' + f;
  const has = f => { try { return fs.existsSync(safe(base, f)); } catch { return false; } };
  const source = chapterSequenceFor(live, sb, {override: chapterSequence || undefined});
  const subtitles = speechLocale(live.language).base, at = new Date().toISOString(), all = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rodaje-animatica-'));
  try {
    for (const step of steps) {
      const tl = animaticTimeline(live, sb, {step, source, sequence, has});
      fs.mkdirSync(outDir, {recursive: true});
      const version = nextAnimaticVersion(readAnimaticIndex(project, sbId).entries, animFiles(outDir), step), vv = 'v' + String(version).padStart(2, '0');
      const common = {step, version, at, source: tl.source, subtitles, audio: step === 'voces', imported: false, note: ''};
      const entries = [], seqFiles = [];
      for (const s of tl.sequences) {
        const segs = s.shots.map((t, i) => {
          const out = path.join(tmp, `${step}-${s.file}-${String(i).padStart(3, '0')}.mp4`);
          ffmpeg(segmentArgs(t, {base, step, out}));
          return out;
        });
        const name = `${step}.${s.file}-${vv}.mp4`, dest = path.join(outDir, name);
        log(`${step} ${vv}: ${s.id} (${s.shots.length} viñetas, ${s.duration} s)`);
        concatInto(segs, dest, tmp);
        seqFiles.push(dest);
        entries.push({file: rel(name), ...common, sequence: s.id, duration: s.duration, shots: s.shots.length, incomplete: s.missing.length > 0, missing: s.missing, warnings: s.warnings});
      }
      if (!sequence && seqFiles.length) {
        const name = `${step}-${vv}.mp4`;
        concatInto(seqFiles, path.join(outDir, name), tmp);
        entries.push({file: rel(name), ...common, sequence: null, duration: tl.duration, shots: tl.sequences.reduce((n, s) => n + s.shots.length, 0), incomplete: tl.incomplete, missing: tl.missing, warnings: tl.warnings});
      }
      appendAnimaticEntries(project, sbId, entries);
      all.push(...entries);
    }
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  return all;
}

// Incorpora una animática hecha a mano (storyboards/<id>/<file>) como <paso>-vNN.mp4 entera: la mueve (no copia) y la indexa.
export function importAnimatic(project, sbId, {file, step, subtitles, audio = false, note = ''}) {
  if (!ANIMATIC_STEPS.includes(step)) throw Error('Paso no válido: ' + step + ' (3d, fotogramas o voces)');
  const base = projectDir(project), live = readJSON(path.join(base, 'proyecto.json'));
  const sb = (live.storyboards || []).find(b => b.id === sbId);
  if (!sb) throw Error('Storyboard desconocido');
  const src = safe(path.join(base, 'storyboards', sbId), String(file || ''));
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) throw Error('No existe ' + path.relative(base, src));
  const outDir = path.join(base, ANIM_DIR(sbId));
  fs.mkdirSync(outDir, {recursive: true});
  const version = nextAnimaticVersion(readAnimaticIndex(project, sbId).entries, animFiles(outDir), step);
  const name = `${step}-v${String(version).padStart(2, '0')}.mp4`, dest = path.join(outDir, name);
  if (fs.existsSync(dest)) throw Error('Ya existe ' + name + '; no se sobrescribe');
  const duration = Math.round(probeDuration(src) * 1000) / 1000, at = fs.statSync(src).mtime.toISOString();
  fs.renameSync(src, dest);
  const entry = {file: ANIM_DIR(sbId) + '/' + name, step, version, sequence: null, at, duration, shots: (sb.sequences || []).reduce((n, s) => n + (s.shots || []).length, 0), incomplete: false, missing: [], warnings: [], source: null, subtitles: subtitles || speechLocale(live.language).base, audio: !!audio, imported: true, note: String(note || '')};
  appendAnimaticEntries(project, sbId, [entry]);
  return entry;
}

// Animáticas de un storyboard para la vista (solo lectura): animaticGroups sobre el índice, sin los ficheros que ya no están.
export function listAnimatics(project, live, sbId) {
  const sb = (live?.storyboards || []).find(b => b.id === sbId);
  if (!sb) throw Error('Storyboard desconocido');
  const base = projectDir(project);
  return animaticGroups(readAnimaticIndex(project, sbId), sb, f => { try { return fs.existsSync(safe(base, f)); } catch { return false; } });
}
