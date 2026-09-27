#!/usr/bin/env node
// Instala o quita en el repo git de un proyecto el hook pre-commit que pasa proyecto-check (lib/proyecto-hook.mjs).
//   node scripts/proyecto-hook.mjs install|uninstall [proyecto] [--project id]
// Respeta core.hooksPath. No toca un pre-commit ajeno (sale con 1). Salida 2: uso o el proyecto no es un repo git.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT,projectDir} from '../lib/paths.mjs';
import {parseArgs} from '../lib/args.mjs';
import {cliProject,usageExit} from '../lib/cli.mjs';
import {hookScript,planHook} from '../lib/proyecto-hook.mjs';

const USAGE = 'Uso: node scripts/proyecto-hook.mjs install|uninstall [proyecto] [--project id]';
const {args: [action, ...rest], opts} = parseArgs(process.argv.slice(2));
if (!['install', 'uninstall'].includes(action)) usageExit(USAGE);
const {project: id} = cliProject({usage: USAGE, opts, args: rest, positional: 0});
const dir = projectDir(id), git = (...a) => execFileSync('git', ['-C', dir, ...a], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
// El proyecto tiene que ser la raíz de su propio repo (no una carpeta dentro de otro).
let top = null;
try { top = fs.realpathSync(git('rev-parse', '--show-toplevel')); } catch {}
if (top !== fs.realpathSync(dir)) { console.error(`${id}: la carpeta del proyecto no es la raíz de un repo git.`); process.exit(2); }
const file = path.resolve(dir, git('rev-parse', '--git-path', 'hooks/pre-commit'));
const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null, script = hookScript({root: ROOT, node: process.execPath});
const plan = planHook({action, existing, script});
if (plan.op === 'refuse') { console.error(`${id}: ${file} es un hook ajeno; no se toca.`); process.exit(1); }
if (plan.op === 'write') { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, script); fs.chmodSync(file, 0o755); }
if (plan.op === 'remove') fs.rmSync(file);
console.log(`${id}: pre-commit ${plan.reason} (${file})`);
