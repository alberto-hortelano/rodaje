// Proyecto activo de la app: <DATA>/.activo.json = {project, at}. Lo escribe solo el servidor (abrir o crear un proyecto
// en la vista Proyectos); los scripts lo leen como última fuente del proyecto (lib/cli.mjs). Importarlo no toca el disco.
import fs from 'node:fs';
import path from 'node:path';
import {DATA, ID_RE} from './paths.mjs';
import {readJSON, writeJSON} from './json.mjs';

export const ACTIVE_FILE = '.activo.json';
const exists = (id, data) => fs.existsSync(path.join(data, id, 'proyecto.json'));

// Id del proyecto activo, o null si falta el fichero, está roto, el id no es válido o el proyecto ya no existe. Nunca lanza ni escribe.
export function readActiveProject(data = DATA) {
  try { const {project} = readJSON(path.join(data, ACTIVE_FILE)); return typeof project === 'string' && ID_RE.test(project) && exists(project, data) ? project : null; }
  catch { return null; }
}

export function writeActiveProject(id, data = DATA) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw Error('ID de proyecto no válido: ' + id);
  if (!exists(id, data)) throw Error('No existe el proyecto: ' + id);
  writeJSON(path.join(data, ACTIVE_FILE), {project: id, at: new Date().toISOString()});
  return id;
}
