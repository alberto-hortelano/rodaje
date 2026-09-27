#!/usr/bin/env node
// Reescribe las rutas absolutas de los datos de un proyecto: dentro del proyecto → relativas; fuera → origen:<nombre>/… (docs/scripts.md).
//   node scripts/proyecto-rutas.mjs [proyecto] [--project id] [--origen nombre=/ruta/abs]... [--aplicar] [--forzar]
// Sin --aplicar es un simulacro: no escribe; imprime el plan por fichero, un ejemplo por prefijo y los tokens sin resolver.
// --aplicar exige el repo del proyecto limpio (--forzar lo salta): proyecto.json con store.save (regenera los derivados) y el resto de
// .json/.md/.txt por sustitución de los tokens, byte a byte. Salida: 0 todo resuelto · 1 queda algo sin resolver · 2 uso o árbol sucio.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {load,save,generatedFiles} from '../app/store.mjs';
import {ROOT,projectDir,safe} from '../lib/paths.mjs';
import {parseArgs,takeOption} from '../lib/args.mjs';
import {cliProject,usageExit} from '../lib/cli.mjs';
import {readJSON} from '../lib/json.mjs';
import {checkProject} from '../lib/proyecto-check.mjs';
import {listProjectFiles} from '../lib/proyecto-ficheros.mjs';
import {makeResolver,rewriteText,rewriteValue} from '../lib/rutas-abs.mjs';

const USAGE = 'Uso: node scripts/proyecto-rutas.mjs [proyecto] [--project id] [--origen nombre=/ruta/abs]... [--aplicar] [--forzar]';
const TEXT_RE = /\.(json|md|txt)$/i;
const argv = process.argv.slice(2), origins = {};
for (let o; (o = takeOption(argv, '--origen')) !== undefined;) {
  const m = typeof o === 'string' && /^([^=]+)=(\/.*)$/.exec(o);
  if (!m) usageExit(USAGE, '--origen necesita nombre=/ruta/abs');
  origins[m[1]] = m[2];
}
// takeOption es voraz: un valor tras --aplicar o --forzar es el proyecto.
const flag = name => { const v = takeOption(argv, name); if (typeof v === 'string') argv.push(v); return v !== undefined; };
const apply = flag('--aplicar'), force = flag('--forzar');
const {args, opts} = parseArgs(argv);
const {project: id} = cliProject({usage: USAGE, opts, args, positional: 0});
const dir = projectDir(id);
let resolve;
try { resolve = makeResolver({roots: [...new Set([path.join(ROOT, 'proyectos', id), dir, fs.realpathSync(dir)])], origins}); } catch (e) { usageExit(USAGE, e.message); }

if (apply) {
  let clean = false;
  try { clean = execFileSync('git', ['status', '--porcelain'], {cwd: dir, encoding: 'utf8'}).trim() === ''; } catch {}
  if (!clean && !force) { console.error(`${id}: el repo del proyecto no está limpio (o no es un repo git). Haz commit antes o usa --forzar.`); process.exit(2); }
}

// Plan: proyecto.json por valor; el resto de texto (sin los generados, que save regenera) por sustitución.
const p = load(id), manifest = rewriteValue(p, {resolve});
const skip = new Set(['proyecto.json', ...generatedFiles(p)]);
const texts = listProjectFiles(dir).filter(f => TEXT_RE.test(f) && !skip.has(f)).map(f => {
  const before = fs.readFileSync(safe(dir, f), 'utf8');
  return {file: f, before, ...rewriteText(before, {file: f, resolve})};
});
const plan = [{file: 'proyecto.json', changes: manifest.changes, unresolved: manifest.unresolved.map(u => ({...u, line: u.path}))}, ...texts];
const examples = new Map();
for (const f of plan) for (const c of f.changes) { const r = resolve(c.from), key = c.kind + ' ' + (r.base || '') + (c.to !== r.value ? ' lista' : ''); if (!examples.has(key)) examples.set(key, c); }
const unresolved = plan.flatMap(f => f.unresolved.map(u => ({file: f.file, ...u})));

const byKind = changes => Object.entries(Object.groupBy(changes, c => c.kind)).sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => `${k} ${l.length}`).join(', ');
const changed = plan.filter(f => f.changes.length);
console.log(`${id} · ${apply ? 'aplicar' : 'simulacro'} · ${changed.reduce((n, f) => n + f.changes.length, 0)} cambios en ${changed.length} ficheros, ${unresolved.length} sin resolver`);
for (const f of changed) console.log(`  ${f.file}: ${f.changes.length} (${byKind(f.changes)})${f.file === 'proyecto.json' ? ' · store.save regenera los derivados' : ''}`);
if (examples.size) { console.log('Ejemplos:'); for (const c of examples.values()) console.log(`  ${c.from}\n    → ${c.to}`); }
if (unresolved.length) { console.log('Sin resolver:'); for (const u of unresolved) console.log(`  ${u.file}:${u.line}  ${u.token} (${u.kind})`); }

if (apply) {
  if (manifest.changes.length) { const saved = save(manifest.value, p.revision); console.log(`proyecto.json guardado (revisión ${saved.revision})`); }
  for (const f of texts) if (f.changes.length) fs.writeFileSync(safe(dir, f.file), f.text);
  const files = listProjectFiles(dir), left = checkProject({manifest: readJSON(path.join(dir, 'proyecto.json')), files, read: f => fs.readFileSync(safe(dir, f), 'utf8')}).filter(x => x.rule === 'R-abs');
  console.log(left.length ? `R-abs restantes: ${left.length}` : 'R-abs restantes: ninguno');
  for (const x of left) console.log(`  ${x.file}${x.line ? ':' + x.line : ''}  ${x.detail}`);
}
process.exitCode = unresolved.length ? 1 : 0;
