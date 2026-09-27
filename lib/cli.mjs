// Proyecto de un script de línea de órdenes: --project > posicional (donde ya existía) > RODAJE_PROJECT > activo de la app.
// Imprime en stderr «Proyecto: X (fuente)». Sin proyecto válido, uso y código 2 sin traza, antes de tocar el disco.
import fs from 'node:fs';
import path from 'node:path';
import {DATA, resolveProject} from './paths.mjs';
import {readActiveProject} from './proyecto-activo.mjs';

const SOURCES = {'--project': '--project', argumento: 'argumento', RODAJE_PROJECT: 'RODAJE_PROJECT', app: 'activo en la app'};

export function usageExit(usage, message) {
  if (message) console.error(message);
  console.error(usage);
  process.exit(2);
}

// RODAJE_PROJECT solo del entorno real (no se carga .env). Devuelve {project, source, args} (args sin el posicional consumido).
export function cliProject({usage, opts = {}, args = [], positional = 'none', env = process.env}) {
  let r;
  try { r = resolveProject({opts, args, env, positional, active: () => readActiveProject()}); } catch (e) { usageExit(usage, e.message); }
  if (!r.project) usageExit(usage, 'Falta el proyecto: --project <id>, RODAJE_PROJECT o abre uno en la app (vista Proyectos).');
  if (!fs.existsSync(path.join(DATA, r.project, 'proyecto.json'))) usageExit(usage, 'No existe el proyecto: ' + r.project);
  console.error(`Proyecto: ${r.project} (${SOURCES[r.source]})`);
  return r;
}
