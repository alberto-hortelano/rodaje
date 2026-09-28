// Lotes de producción: <DATA>/<proyecto>/assets/<lote>/ con plan.json, lote.json, project-snapshot.json y un
// <bloque>/attempts.json por bloque. Lo comparten scripts/bloques/*.mjs y la vista Montaje (app/montaje.mjs).
// Solo lee y escribe ficheros (ni fal ni ffmpeg); lee también docs/REGLAS.md. Importa node:*, ./paths.mjs, ./json.mjs y ../app/workflow.mjs; nunca app/store.mjs.
// attempts.json solo se escribe aquí (updateAttempts): enviar.mjs, estado.mjs y la vista Montaje releen y tocan solo su intento.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ROOT, projectDir} from './paths.mjs';
import {readJSON, writeJSON} from './json.mjs';
import {parseMapa, parseRules, cutTimeline, direccionBlock, reviewAttempt, blockStoryboardLinks, storyboardMedia} from '../app/workflow.mjs';

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
function writeAttempts(out, blockId, list) { writeJSON(attemptsPath(out, blockId), list); }
// Lectura-modificación-escritura en un solo punto. fn recibe la lista releída y devuelve la nueva (o undefined si la mutó);
// si fn lanza, el disco no cambia; si el resultado es igual a lo leído, no escribe (ni crea el fichero).
// Sin bloqueo entre procesos (#23): cada escritor relee justo antes y parchea su intento por n; la ventana es síncrona, de milisegundos.
export function updateAttempts(out, blockId, fn) {
  const f = attemptsPath(out, blockId), exists = fs.existsSync(f), list = exists ? readJSON(f) : [];
  const before = structuredClone(list), next = fn(list) ?? list;
  if (isDeepStrictEqual(next, before) && (exists || !next.length)) return next;
  writeAttempts(out, blockId, next);
  return next;
}
// Añade el intento n; si otro proceso ya registró intentos (n no es el siguiente), lanza. Puro.
export function appendAttempt(list, attempt) {
  if (attempt.n !== list.length + 1 || list.some(a => a.n === attempt.n)) throw Error(`Otro proceso registró intentos: attempts.json tiene ${list.length} y este sería el ${attempt.n}`);
  return [...list, attempt];
}
// Copia con la entrada n parcheada con fn(entrada); fn null/undefined deja la lista igual. Puro.
export function withAttempt(list, n, fn) {
  const next = structuredClone(list), a = next.find(x => x.n === n);
  if (!a) throw Error(`No existe el intento ${n}`);
  const patch = fn(a);
  if (patch) Object.assign(a, patch);
  return next;
}
export function registerAttempt(out, blockId, attempt) { return updateAttempts(out, blockId, l => appendAttempt(l, attempt)); }
// Parchea solo el intento n (el parche puede ser condicional: fn devuelve null si el intento ya no está como se esperaba). Devuelve la entrada tras el parche.
export function patchAttempt(out, blockId, n, fn) { return updateAttempts(out, blockId, l => withAttempt(l, n, fn)).find(a => a.n === n); }

export const GENERAL_RULES_FILE = path.join(ROOT, 'docs', 'REGLAS.md');
// Une reglas generales y propias, ordenadas por id (numérico: C01 < C02 < R01 < R02). Puro.
// Lanza Error('Regla X repetida …') si un id se repite dentro de una lista o entre las dos.
export function mergeRules(general, own) {
  const seen = new Map();
  for (const [list, where] of [[general, 'en docs/REGLAS.md'], [own, 'en el REGLAS.md del proyecto']]) {
    const mine = new Set();
    for (const r of list) {
      if (mine.has(r.id)) throw Error(`Regla ${r.id} repetida ${where}`);
      if (seen.has(r.id)) throw Error(`Regla ${r.id} repetida: ya es general (docs/REGLAS.md); quítala del REGLAS.md del proyecto`);
      mine.add(r.id);
    }
    for (const r of list) seen.set(r.id, {id: r.id, title: r.title});
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', {numeric: true}));
}
// docs/REGLAS.md + <dir>/REGLAS.md (sin él, solo las generales). Solo lee.
export function rulesAt(dir) {
  const read = f => parseRules(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  return mergeRules(read(GENERAL_RULES_FILE), read(path.join(dir, 'REGLAS.md')));
}
// Reglas vigentes de un proyecto (vista Montaje, estado.mjs --verdict).
export function projectRules(project) { return rulesAt(projectDir(project)); }

// Veredicto de un bloque (estado.mjs --verdict y vista Montaje): misma semántica en los dos (reviewAttempt).
// Sin attempt, el último intento de la lista releída. Devuelve {list, attempt, replaced: [n de las aceptadas que sustituye]}.
export function reviewBlock(project, lote, block, {attempt, verdict, rules, notes, range} = {}, now) {
  const d = loteDir(project, lote);
  checkName(block, 'Bloque');
  if (!fs.existsSync(path.join(d, 'plan.json'))) throw Error('Lote desconocido');
  const b = readPlan(path.join(d, 'plan.json')).find(x => x.id === block);
  if (!b) throw Error(`El bloque ${block} no está en el plan del lote ${lote}`);
  if (!loadAttempts(d, block).length) throw Error('El bloque no tiene intentos');
  const known = projectRules(project).map(r => r.id);
  let n, replaced = [];
  const list = updateAttempts(d, block, l => {
    if (!l.length) throw Error('El bloque no tiene intentos');
    n = attempt === undefined || attempt === null || attempt === '' ? l.at(-1).n : Number(attempt);
    const next = reviewAttempt(l, {attempt: n, verdict, rules, notes, range, length: b.length, known}, now);
    replaced = next.filter((x, i) => x.replacedBy === n && l[i]?.verdict === 'accepted' && x.verdict !== 'accepted').map(x => x.n);
    return next;
  });
  return {list, attempt: list.find(a => a.n === n), replaced};
}

// Cortes montados: montaje/*.cut.json cuyo .mp4 existe. Si el cut.json trae sequences (montaje por secuencia del storyboard, #45),
// se añaden con file relativo al proyecto, sin las que no tienen su mp4.
export function loteCuts(project, lote) {
  const out = loteDir(project, lote), d = path.join(out, 'montaje'), exists = f => fs.existsSync(path.join(projectDir(project), f));
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.cut.json')).sort().map(f => {
    const c = readJSON(path.join(d, f)), base = f.replace(/\.cut\.json$/, '');
    const sequences = Array.isArray(c.sequences) ? {sequences: c.sequences.filter(s => isLoteName(s?.file)).map(s => ({...s, file: `assets/${lote}/montaje/${s.file}`})).filter(s => exists(s.file))} : {};
    return {name: base, file: `assets/${lote}/montaje/${base}.mp4`, at: c.at, duration: c.duration, blocks: cutTimeline(c, readJSON(path.join(out, 'plan.json'))), ...sequences};
  }).filter(c => exists(c.file));
}

// plan.json de un lote: lista de bloques con id y parts. Los lotes antiguos con otro formato (#26) lanzan.
export function readPlan(file) {
  let plan; try { plan = readJSON(file); } catch { plan = null; }
  if (!Array.isArray(plan) || !plan.every(b => b && b.id && Array.isArray(b.parts))) throw Error('Lote no válido: plan.json no es una lista de bloques');
  return plan;
}

// Lotes con plan.json válido, del más reciente al más antiguo; los que no tienen fecha, al final. Los no válidos se omiten con aviso.
export function listLotes(project) {
  const base = path.join(projectDir(project), 'assets');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter(l => isLoteName(l) && fs.existsSync(path.join(base, l, 'plan.json'))).flatMap(l => {
    let plan; try { plan = readPlan(path.join(base, l, 'plan.json')); } catch (e) { console.warn(`Lote ${l} omitido: ${e.message}`); return []; }
    const meta = jsonOr(path.join(base, l, 'lote.json'), {}), c = loteCuts(project, l);
    return [{id: l, episode: meta.episode, sequence: meta.sequence, created: meta.created, blocks: plan.length, cuts: c.map(({name, file, at, duration}) => ({name, file, at, duration}))}];
  }).sort((a, b) => !a.created - !b.created || String(b.created ?? '').localeCompare(String(a.created ?? '')));
}

// Planos de la secuencia de un lote (lote.json: episode, sequence) en un proyecto (instantánea o vivo), como mapa id→plano; {} si no está.
function loteShots(project, meta) { return Object.fromEntries((project?.episodes?.find(e => e.id === meta.episode)?.sequences?.find(s => s.id === meta.sequence)?.shots || []).map(t => [t.id, t])); }

// Vídeo de un storyboard del proyecto vivo en la vista Storyboards (storyboardMedia): tomas por viñeta, montajes por secuencia y cortes.
// Recorre listLotes; un lote sin instantánea o sin su secuencia enlaza solo por el vivo; los que no enlazan este storyboard se omiten.
export function storyboardMediaFor(project, live, storyboardId) {
  const sb = (live?.storyboards || []).find(b => b.id === storyboardId);
  if (!sb) throw Error('Storyboard desconocido');
  const ids = new Set((sb.sequences || []).flatMap(s => (s.shots || []).map(t => t.id)));
  const lotes = listLotes(project).flatMap(l => {
    const d = loteDir(project, l.id), meta = jsonOr(path.join(d, 'lote.json'), {});
    let snapshot = null; try { snapshot = jsonOr(path.join(d, 'project-snapshot.json'), null); } catch {}
    const links = Object.fromEntries(Object.entries(blockStoryboardLinks(readPlan(path.join(d, 'plan.json')), loteShots(snapshot, meta), loteShots(live, meta))).filter(([, x]) => ids.has(x)));
    if (!Object.keys(links).length) return [];
    return [{id: l.id, created: l.created, links, attempts: Object.fromEntries(Object.keys(links).map(b => [b, loadAttempts(d, b)])), cuts: loteCuts(project, l.id)}];
  });
  return storyboardMedia(sb, lotes, (lote, block, a) => fs.existsSync(path.join(loteDir(project, lote), block, a.video)));
}

// Dirección del lote (modo fotograma): assets/<lote>/direccion.json, o null si no hay. out: lotePaths().out o loteDir().
export function direccionFor(out) { return jsonOr(path.join(out, 'direccion.json'), null); }

// Detalle de un lote para la vista Montaje; montando lo aporta quien lleva los trabajos (app/montaje.mjs).
export function loteDetail(project, lote, montando = null) {
  const d = loteDir(project, lote);
  if (!fs.existsSync(path.join(d, 'plan.json'))) throw Error('Lote desconocido');
  const plan = readPlan(path.join(d, 'plan.json')), meta = jsonOr(path.join(d, 'lote.json'), {}), direccion = direccionFor(d);
  return {id: lote, meta, rules: projectRules(project), cuts: loteCuts(project, lote), montando, blocks: plan.map(b => ({id: b.id, length: b.length, duration: b.duration, mode: b.mode, shots: b.parts.map(x => x.shot), refs: jsonOr(path.join(d, b.id, 'refs.json'), null), attempts: jsonOr(path.join(d, b.id, 'attempts.json'), []), direccion: direccionBlock(direccion, b.id)}))};
}
