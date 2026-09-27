// Planta editable de un entorno 3D: vive en los datos del entorno (environment.data) → dims.planta. La lee y guarda /api/planta.
// La ruta sale siempre de proyecto.json (nunca del cliente) y al guardar solo cambia el tramo de texto de dims.planta.
import fs from 'node:fs';
import path from 'node:path';
import {dir, safe} from './paths.mjs';
import {readJSON, jsonValueSpan, replaceJsonValue, writeFileAtomic} from './json.mjs';
import {validarPlanta} from '../viewer/planta.mjs';

const fail = (message, status) => Object.assign(Error(message), {status});
const KEYS = ['dims', 'planta'];

export function plantaFile(projectId, envId) {
  const base = dir(projectId), project = readJSON(path.join(base, 'proyecto.json'));
  const env = (project.environments || []).find(e => e.id === envId);
  if (!env) throw fail('Entorno no encontrado: ' + envId, 404);
  if (typeof env.data !== 'string' || !env.data.endsWith('.json')) throw fail('El entorno no tiene datos en JSON (data): ' + envId, 404);
  return {file: safe(base, env.data), env};
}

export function readPlanta(projectId, envId) {
  const {file, env} = plantaFile(projectId, envId), planta = readJSON(file)?.dims?.planta;
  if (!planta) throw fail(`Este entorno no tiene planta (dims.planta en ${env.data})`, 404);
  return {planta, revision: planta.revision ?? 0, environment: {id: env.id, name: env.name || env.id}};
}

// Texto nuevo del fichero con la planta guardada: exige la revisión del disco, valida y sube la revisión en uno.
export function replacePlantaText(text, {revision, planta}) {
  const actual = JSON.parse(text)?.dims?.planta;
  if (!actual || !jsonValueSpan(text, KEYS)) throw fail('Este entorno no tiene planta (dims.planta)', 404);
  const disco = actual.revision ?? 0;
  if (revision !== disco) throw fail(`La planta cambió (revisión ${disco} en disco, ${revision} en el editor). Descarga tu copia y recarga.`, 409);
  const errores = validarPlanta(planta, actual);
  if (errores.length) throw fail(errores.join(' '), 400);
  const nueva = {...planta, revision: disco + 1};
  return {text: replaceJsonValue(text, KEYS, nueva), revision: disco + 1, planta: nueva};
}

export function savePlanta(projectId, envId, {revision, planta}) {
  const {file} = plantaFile(projectId, envId);
  const r = replacePlantaText(fs.readFileSync(file, 'utf8'), {revision, planta});
  writeFileAtomic(file, r.text);
  return {revision: r.revision, planta: r.planta};
}
