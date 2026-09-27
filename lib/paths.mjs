// Rutas del repositorio y de los datos, y resolución del proyecto activo. Importarlo no toca el disco
// (la carpeta DATA la crea app/store.mjs). Sin imports de app/.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
// Carpeta de proyectos: RODAJE_DATA o <ROOT>/proyectos. Constante fijada al importar (los tests la fijan en test/setup.mjs).
export const DATA = process.env.RODAJE_DATA ? path.resolve(process.env.RODAJE_DATA) : path.join(ROOT, 'proyectos');
export const ID_RE = /^[a-zA-Z0-9_-]+$/;

// Ruta relativa dentro de root: rechaza '..', absolutas y enlaces simbólicos que salgan de root.
export function safe(root,rel){if(typeof rel!=='string'||path.isAbsolute(rel)||rel.split(/[\\/]/).includes('..'))throw Error('Ruta no válida');const p=path.resolve(root,rel);if(!p.startsWith(root+path.sep))throw Error('Ruta no válida');let cursor=p;while(!fs.existsSync(cursor))cursor=path.dirname(cursor);if(!fs.realpathSync(cursor).startsWith(fs.realpathSync(root)+path.sep)&&cursor!==root)throw Error('Enlace fuera del proyecto');return p;}
export function projectDir(id){if(!ID_RE.test(id))throw Error('ID no válido');return safe(DATA,id);}
export const dir = projectDir;

// Carga ROOT/.env una sola vez; nunca lanza ni exige variables.
let envLoaded = false;
export function loadEnv() { if (envLoaded) return; envLoaded = true; try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {} }

// Proyecto activo: --project > primer posicional (se consume) > RODAJE_PROJECT. Sin ninguno, project null.
export function resolveProject({opts = {}, args = [], env = {}} = {}) {
  let project = null, rest = args;
  if (opts.project !== undefined) { if (typeof opts.project !== 'string') throw Object.assign(Error('--project necesita un id de proyecto'), {usage: true}); project = opts.project; }
  else if (args.length) { project = args[0]; rest = args.slice(1); }
  else if (env.RODAJE_PROJECT) project = env.RODAJE_PROJECT;
  if (project !== null && !ID_RE.test(project)) throw Error('ID de proyecto no válido: ' + project);
  return {project, args: rest};
}
