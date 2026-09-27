// Lotes de producción: <DATA>/<proyecto>/assets/<lote>/ con plan.json, lote.json, project-snapshot.json y un
// <bloque>/attempts.json por bloque. Lo comparten scripts/bloques/*.mjs y la vista Montaje (app/montaje.mjs).
// Solo lee y escribe ficheros (ni fal ni ffmpeg). Importa node:*, ./paths.mjs, ./json.mjs y ../app/workflow.mjs; nunca app/store.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {projectDir} from './paths.mjs';
import {readJSON, writeJSON} from './json.mjs';
import {parseMapa, parseRules, cutTimeline, direccionBlock} from '../app/workflow.mjs';

// Nombre de lote o de bloque: una sola carpeta. Rechaza '', '.', '..', barras y lo que no sea cadena.
export const LOTE_RE = /^[\w-][\w.-]*$/;
export const isLoteName = v => typeof v === 'string' && LOTE_RE.test(v);
export function checkName(v, what = 'Lote') { if (!isLoteName(v)) throw Error(what + ' no válido'); return v; }

function jsonOr(f, fallback) { return fs.existsSync(f) ? readJSON(f) : fallback; }

export function loteDir(project, lote) { return path.join(projectDir(project), 'assets', checkName(lote)); }

// Un lote vive en <proyecto>/assets/<lote>/ y congela su propio snapshot del proyecto.
export function lotePaths(project, lote) {
  const base = projectDir(project), out = loteDir(project, lote);
  return {base, out, plan: path.join(out, 'plan.json'), snapshot: path.join(out, 'project-snapshot.json'), meta: path.join(out, 'lote.json'), registry: path.join(base, 'registro.json'), uploads: path.join(out, 'uploads.json')};
}

export function loadLote(project, lote) {
  const paths = lotePaths(project, lote);
  if (!fs.existsSync(paths.plan)) throw Error(`No existe ${paths.plan}; ejecuta planificar.mjs`);
  const plan = readJSON(paths.plan), meta = readJSON(paths.meta), snapshot = readJSON(paths.snapshot);
  const registry = fs.existsSync(paths.registry) ? readJSON(paths.registry) : {assets: {}};
  const episode = snapshot.episodes.find(e => e.id === meta.episode);
  const sequence = episode.sequences.find(s => s.id === meta.sequence);
  const shots = Object.fromEntries(sequence.shots.map(t => [t.id, t]));
  return {paths, plan, meta, project: snapshot, registry, episode, sequence, shots, map: mapaFor(paths.base, registry, sequence.location), scene: sceneFor(paths.base, episode, sequence)};
}

// MAPA.md del ambiente, o del ambiente al que la plate del registro lo hace alias.
export function mapaFor(base, registry, locationId) {
  const direct = path.join(base, 'ambientes', locationId, 'MAPA.md');
  if (fs.existsSync(direct)) return parseMapa(fs.readFileSync(direct, 'utf8'));
  const plate = Object.values(registry.assets || {}).find(a => a.kind === 'location' && (a.aliases || []).includes(locationId));
  if (plate) { const f = path.join(base, 'ambientes', plate.location, 'MAPA.md'); if (fs.existsSync(f)) return parseMapa(fs.readFileSync(f, 'utf8')); }
  return null;
}

// Interpretación de la escena: capitulos/<episodio>/escenas/sNN.json, con NN = sourceScene del primer plano o el índice de la secuencia.
export function sceneNumber(episode, sequence) { const n = sequence.shots.find(t => t.sourceScene)?.sourceScene; return n || episode.sequences.indexOf(sequence) + 1; }
export function sceneFor(base, episode, sequence) {
  const f = path.join(base, 'capitulos', episode.id, 'escenas', `s${String(sceneNumber(episode, sequence)).padStart(2, '0')}.json`);
  return fs.existsSync(f) ? readJSON(f) : null;
}

// attempts.json de un bloque; out es la carpeta del lote (lotePaths().out o loteDir()).
export function attemptsPath(out, blockId) { return path.join(out, checkName(blockId, 'Bloque'), 'attempts.json'); }
export function loadAttempts(out, blockId) { const f = attemptsPath(out, blockId); return fs.existsSync(f) ? readJSON(f) : []; }
export function saveAttempts(out, blockId, list) { writeJSON(attemptsPath(out, blockId), list); }
// Lectura-modificación-escritura en un solo punto. fn recibe la lista y devuelve la nueva (o undefined si la mutó);
// si fn lanza, el disco no cambia. Sin bloqueo entre procesos (#23).
export function updateAttempts(out, blockId, fn) {
  const list = loadAttempts(out, blockId);
  const next = fn(list) ?? list;
  saveAttempts(out, blockId, next);
  return next;
}

// Reglas del proyecto (encabezados ### de REGLAS.md).
export function projectRules(project) {
  const f = path.join(projectDir(project), 'REGLAS.md');
  return parseRules(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
}

// Cortes montados: montaje/*.cut.json cuyo .mp4 existe.
export function loteCuts(project, lote) {
  const out = loteDir(project, lote), d = path.join(out, 'montaje');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.cut.json')).sort().map(f => {
    const c = readJSON(path.join(d, f)), base = f.replace(/\.cut\.json$/, '');
    return {name: base, file: `assets/${lote}/montaje/${base}.mp4`, at: c.at, duration: c.duration, blocks: cutTimeline(c, readJSON(path.join(out, 'plan.json')))};
  }).filter(c => fs.existsSync(path.join(projectDir(project), c.file)));
}

// Lotes con plan.json, del más reciente al más antiguo.
export function listLotes(project) {
  const base = path.join(projectDir(project), 'assets');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter(l => isLoteName(l) && fs.existsSync(path.join(base, l, 'plan.json'))).map(l => {
    const meta = jsonOr(path.join(base, l, 'lote.json'), {}), plan = readJSON(path.join(base, l, 'plan.json'));
    const c = loteCuts(project, l);
    return {id: l, episode: meta.episode, sequence: meta.sequence, created: meta.created, blocks: plan.length, cuts: c.map(({name, file, at, duration}) => ({name, file, at, duration}))};
  }).sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

// Dirección del lote (modo fotograma): assets/<lote>/direccion.json, o null si no hay. out: lotePaths().out o loteDir().
export function direccionFor(out) { return jsonOr(path.join(out, 'direccion.json'), null); }

// Detalle de un lote para la vista Montaje; montando lo aporta quien lleva los trabajos (app/montaje.mjs).
export function loteDetail(project, lote, montando = null) {
  const d = loteDir(project, lote);
  if (!fs.existsSync(path.join(d, 'plan.json'))) throw Error('Lote desconocido');
  const meta = jsonOr(path.join(d, 'lote.json'), {}), plan = readJSON(path.join(d, 'plan.json')), direccion = direccionFor(d);
  return {id: lote, meta, rules: projectRules(project), cuts: loteCuts(project, lote), montando, blocks: plan.map(b => ({id: b.id, length: b.length, duration: b.duration, mode: b.mode, shots: b.parts.map(x => x.shot), refs: jsonOr(path.join(d, b.id, 'refs.json'), null), attempts: jsonOr(path.join(d, b.id, 'attempts.json'), []), direccion: direccionBlock(direccion, b.id)}))};
}
