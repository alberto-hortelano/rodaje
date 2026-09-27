// Rutas del repositorio y de los datos, y resolución del proyecto activo. Importarlo no toca el disco
// (la carpeta DATA la crean app/jobs.mjs al arrancar el servidor y store.create/save al escribir). Sin imports de app/.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
// Bajo node --test (con o sin aislamiento) o al ejecutar un .test.mjs suelto. En producción siempre false.
export const underTest=()=>!!(process.env.NODE_TEST_CONTEXT||process.execArgv.includes('--test')||/\.test\.mjs$/.test(process.argv[1]||''));
// Sin RODAJE_DATA, un test escribiría en los proyectos reales: se lanza en vez de caer en <ROOT>/proyectos.
if(underTest()&&!process.env.RODAJE_DATA)throw Error('RODAJE_DATA no definido bajo node --test: usa npm test o --import ./test/setup.mjs');
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

// Proyecto: --project > posicional > RODAJE_PROJECT > activo de la app. Sin ninguno, project y source null. No muta nada.
// positional: 'none' | n (args[0] es el proyecto si hay más de n argumentos) | fn(args) → bool. Con --project nunca se consume.
// active: id | null | () => id|null; la función solo se llama si hace falta y un activo con id no válido se ignora.
export function resolveProject({opts = {}, args = [], env = {}, positional = 'none', active = null} = {}) {
  const valid = id => { if (!ID_RE.test(id)) throw Error('ID de proyecto no válido: ' + id); return id; };
  if (opts.project !== undefined) {
    if (typeof opts.project !== 'string') throw Object.assign(Error('--project necesita un id de proyecto'), {usage: true});
    return {project: valid(opts.project), source: '--project', args};
  }
  const takes = positional === 'none' ? false : typeof positional === 'function' ? !!positional(args) : args.length > positional;
  if (takes) return {project: valid(args[0]), source: 'argumento', args: args.slice(1)};
  if (env.RODAJE_PROJECT) return {project: valid(env.RODAJE_PROJECT), source: 'RODAJE_PROJECT', args};
  const a = typeof active === 'function' ? active() : active;
  if (typeof a === 'string' && ID_RE.test(a)) return {project: a, source: 'app', args};
  return {project: null, source: null, args};
}
