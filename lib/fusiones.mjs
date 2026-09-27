// Registro de fusiones de scripts/fusionar.mjs: <DATA>/<proyecto>/fusiones.json con claves, original y cruda
// relativas a la carpeta del proyecto. migrarFusiones reparte el antiguo <DATA>/fusiones.json (rutas con el id delante).
// Importarlo no toca disco. Solo importa node:fs, node:path, ./json.mjs y ./paths.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {writeJSON} from './json.mjs';
import {ID_RE} from './paths.mjs';

const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const text = v => JSON.stringify(v, null, 2) + '\n';
const readOr = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const parse = (f, t) => { let v; try { v = JSON.parse(t); } catch (e) { throw Error(`JSON inválido en ${f}: ${e.message}`); } if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error(`${f} no es un objeto`); return v; };

// 'p1/assets/x.png' → {project: 'p1', clave: 'assets/x.png'}; null si absoluta, con '..', id no válido o sin resto.
export function claveFusion(rel) {
  if (typeof rel !== 'string' || path.isAbsolute(rel) || /^[\\/]/.test(rel)) return null;
  const parts = rel.split(/[\\/]/);
  if (parts.includes('..') || !ID_RE.test(parts[0])) return null;
  const clave = parts.slice(1).join('/');
  return clave ? {project: parts[0], clave} : null;
}

// Reparte un registro con rutas relativas a DATA entre los proyectos; lo que no encaja queda en huerfanas con su clave original.
export function splitFusiones(log, projectIds) {
  const ids = new Set(projectIds), porProyecto = {}, huerfanas = {};
  for (const [k, e] of Object.entries(log || {})) {
    const a = claveFusion(k), o = claveFusion(e?.original), c = claveFusion(e?.cruda);
    if (a && o && c && a.project === o.project && a.project === c.project && ids.has(a.project)) (porProyecto[a.project] ||= {})[a.clave] = {...e, original: o.clave, cruda: c.clave};
    else huerfanas[k] = e;
  }
  for (const id of Object.keys(porProyecto)) porProyecto[id] = sorted(porProyecto[id]);
  return {porProyecto: sorted(porProyecto), huerfanas: sorted(huerfanas)};
}

// Unión clave a clave: en colisión gana la fecha ISO mayor; sin fecha pierde; empate conserva la actual.
export function mergeFusiones(actual = {}, nuevo = {}) {
  const out = {...actual};
  for (const [k, e] of Object.entries(nuevo)) {
    const a = out[k]?.fecha, n = e?.fecha;
    if (!(k in out) || (typeof n === 'string' && (typeof a !== 'string' || n > a))) out[k] = e;
  }
  return sorted(out);
}

export const fusionesPath = (dataDir, project) => path.join(dataDir, project, 'fusiones.json');

export function leerFusiones(dataDir, project) {
  const f = fusionesPath(dataDir, project), t = readOr(f);
  return t === null ? {} : parse(f, t);
}

// Rutas absolutas dentro de dataDir. Sin await entre leer y escribir: dos guardados en el mismo proceso no se pisan.
export function registrarFusion(dataDir, {editada, original, cruda}, fecha = new Date().toISOString()) {
  const rel = f => path.relative(dataDir, f).split(path.sep).join('/');
  const a = claveFusion(rel(editada)), o = claveFusion(rel(original)), c = claveFusion(rel(cruda));
  if (!a || !fs.existsSync(path.join(dataDir, a.project, 'proyecto.json'))) throw Error('La editada no está en un proyecto: ' + editada);
  if (!o || !c || o.project !== a.project || c.project !== a.project) throw Error('Original y cruda deben ser del mismo proyecto que la editada');
  const log = leerFusiones(dataDir, a.project);
  log[a.clave] = {original: o.clave, cruda: c.clave, fecha};
  writeJSON(fusionesPath(dataDir, a.project), sorted(log));
  return {project: a.project, clave: a.clave};
}

// Idempotente. Lee todo antes de escribir; verifica releyendo antes de retirar el raíz. Las huérfanas se quedan en el raíz.
export function migrarFusiones(dataDir) {
  const root = path.join(dataDir, 'fusiones.json'), rootText = readOr(root);
  if (rootText === null) return {raiz: 'ausente', movidas: {}, huerfanas: []};
  const log = parse(root, rootText);
  const projectIds = fs.readdirSync(dataDir, {withFileTypes: true}).filter(e => e.isDirectory() && fs.existsSync(path.join(dataDir, e.name, 'proyecto.json'))).map(e => e.name);
  const {porProyecto, huerfanas} = splitFusiones(log, projectIds);
  const plan = Object.entries(porProyecto).map(([id, parte]) => ({id, parte, merged: mergeFusiones(leerFusiones(dataDir, id), parte)}));
  const movidas = {};
  for (const {id, parte, merged} of plan) {
    const f = fusionesPath(dataDir, id);
    if (readOr(f) !== text(merged)) writeJSON(f, merged);
    if (readOr(f) !== text(merged)) throw Error('No se pudo verificar ' + f);
    movidas[id] = Object.keys(parte).length;
  }
  const claves = Object.keys(huerfanas);
  if (!claves.length) { fs.rmSync(root); return {raiz: 'borrado', movidas, huerfanas: []}; }
  if (rootText !== text(huerfanas)) writeJSON(root, huerfanas);
  return {raiz: 'huerfanas', movidas, huerfanas: claves};
}
