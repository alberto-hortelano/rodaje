// Animación 3D de una viñeta (#51): storyboards/<id>/animacion-3d/<nombre>-vNN.mp4 y su índice index.json (versionado; los mp4 los ignora git).
// El trabajo anim3d de app/jobs.mjs captura los fotogramas con render.html; aquí, la mezcla de voces, la codificación, el colocado sin
// sobrescribir y la lectura para la vista. Importa node:*, ./paths.mjs, ./json.mjs, ./animaticas.mjs y ../app/workflow.mjs; nunca app/store.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {projectDir, safe} from './paths.mjs';
import {readJSON, writeJSON} from './json.mjs';
import {place} from './animaticas.mjs';
import {anim3dGroups} from '../app/workflow.mjs';

export const ANIM3D_DIR = id => `storyboards/${id}/animacion-3d`;
export const ANIM3D_FPS = 24;
const n3 = n => String(Math.round(n * 1000) / 1000);

const indexFile = (project, sbId) => path.join(projectDir(project), ANIM3D_DIR(sbId), 'index.json');
export function readAnim3dIndex(project, sbId) {
  const f = indexFile(project, sbId);
  const idx = fs.existsSync(f) ? readJSON(f) : null;
  return {storyboard: sbId, entries: Array.isArray(idx?.entries) ? idx.entries : []};
}
// Relee y añade una entrada {file, name, version, at, duration, storyboardShot, episode, sequence, shot, job, warnings} (escritura atómica).
export function appendAnim3dEntry(project, sbId, entry) {
  const idx = readAnim3dIndex(project, sbId);
  idx.entries.push(entry);
  writeJSON(indexFile(project, sbId), idx);
  return idx;
}

// Pista de audio del plano (sin -y/-v): silencio estéreo 48 kHz de la duración y cada clip {audio, start} retrasado a su inicio; nada de ambiente.
export function mixArgs({clips = [], duration, base, out}) {
  const D = n3(duration), args = ['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${D}`], f = [];
  clips.forEach((c, i) => {
    args.push('-i', path.join(base, c.audio));
    f.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(c.start * 1000)}:all=1[a${i}]`);
  });
  f.push(`[0:a]${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length + 1}:normalize=0:duration=first,atrim=0:${D}[a]`);
  return [...args, '-filter_complex', f.join(';'), '-map', '[a]', '-t', D, '-c:a', 'pcm_s16le', out];
}
// Vídeo final (sin -y/-v): los PNG %05d.png a 24 fps con la pista mezclada, H.264 y AAC, cortado a la duración del plano.
export function encodeArgs({framesDir, audio, duration, out}) {
  return ['-framerate', String(ANIM3D_FPS), '-i', path.join(framesDir, '%05d.png'), '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', n3(duration), '-movflags', '+faststart', out];
}
// Deja <nombre>-vNN.part.mp4 en su nombre final solo si está libre (como las animáticas).
export const placeAnim3d = (part, dest) => place(part, dest);

// Vídeos 3D de un storyboard para la vista (solo lectura): anim3dGroups sobre el índice, sin los ficheros que ya no están.
export function listAnim3d(project, live, sbId) {
  const sb = (live?.storyboards || []).find(b => b.id === sbId);
  if (!sb) throw Error('Storyboard desconocido');
  const base = projectDir(project);
  return anim3dGroups(readAnim3dIndex(project, sbId), sb, f => { try { return fs.existsSync(safe(base, f)); } catch { return false; } });
}
