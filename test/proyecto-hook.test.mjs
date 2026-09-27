import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync,execFileSync} from 'node:child_process';
import {DATA,ROOT} from '../lib/paths.mjs';
import {HOOK_MARKER,shQuote,hookScript,planHook} from '../lib/proyecto-hook.mjs';

const which=bin=>execFileSync('sh',['-c','command -v '+bin],{encoding:'utf8'}).trim();
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-hook-'));
// Repo de proyecto: proyecto.json mínimo y un commit.
function repo(parent,id){const dir=path.join(parent,id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'proyecto.json'),`{"id":${JSON.stringify(id)}}`);
 execFileSync('git',['init','-q'],{cwd:dir});return dir;}
const cli=(...a)=>{const env={...process.env,RODAJE_DATA:DATA};delete env.RODAJE_PROJECT;return spawnSync(process.execPath,['scripts/proyecto-hook.mjs',...a],{cwd:ROOT,encoding:'utf8',env});};
// Ejecuta un hook con sh desde la carpeta del repo.
const SH=which('sh'),runHook=(dir,file,env={})=>spawnSync(SH,[file],{cwd:dir,encoding:'utf8',env:{...process.env,...env}});

test('hookScript: marcador y rutas con espacio y comilla',()=>{
 assert.equal(shQuote("a b/it's"),"'a b/it'\\''s'");
 const s=hookScript({root:"/r o/it's",node:'/n/node'});assert.ok(s.startsWith('#!/bin/sh\n'+HOOK_MARKER+' v1\n'));
 assert.ok(s.includes("RODAJE='/r o/it'\\''s'\n"));assert.ok(s.includes("NODE='/n/node'\n"));
 assert.equal(spawnSync('sh',['-n','-c',s]).status,0);});

test('planHook: instalar y desinstalar sin tocar hooks ajenos',()=>{const script=hookScript({root:'/r',node:'/n'}),old=hookScript({root:'/viejo',node:'/n'});
 assert.deepEqual(planHook({action:'install',existing:null,script}),{op:'write',reason:'nuevo'});
 assert.deepEqual(planHook({action:'install',existing:old,script}),{op:'write',reason:'actualizado'});
 assert.deepEqual(planHook({action:'install',existing:script,script}),{op:'none',reason:'sin cambios'});
 assert.deepEqual(planHook({action:'install',existing:'#!/bin/sh\nexit 0\n',script}),{op:'refuse',reason:'hook ajeno'});
 assert.deepEqual(planHook({action:'uninstall',existing:old,script}),{op:'remove',reason:'desinstalado'});
 assert.deepEqual(planHook({action:'uninstall',existing:'#!/bin/sh\n',script}),{op:'refuse',reason:'hook ajeno'});
 assert.deepEqual(planHook({action:'uninstall',existing:null,script}),{op:'none',reason:'no instalado'});
 assert.throws(()=>planHook({action:'x',existing:null,script}),/Acción/);});

test('proyecto-hook: install, idempotencia, hook ajeno, core.hooksPath y uninstall',()=>{const dir=repo(DATA,'hk-cli'),file=path.join(dir,'.git/hooks/pre-commit');
 let r=cli('install','hk-cli');assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/Proyecto: hk-cli \(argumento\)/);assert.match(r.stdout,/pre-commit nuevo/);
 assert.equal(fs.statSync(file).mode&0o777,0o755);assert.equal(fs.readFileSync(file,'utf8'),hookScript({root:ROOT,node:process.execPath}));
 r=cli('install','hk-cli');assert.equal(r.status,0);assert.match(r.stdout,/sin cambios/);
 r=cli('uninstall','hk-cli');assert.equal(r.status,0);assert.match(r.stdout,/desinstalado/);assert.equal(fs.existsSync(file),false);
 r=cli('uninstall','hk-cli');assert.equal(r.status,0);assert.match(r.stdout,/no instalado/);
 fs.writeFileSync(file,'#!/bin/sh\nexit 0\n');for(const a of ['install','uninstall']){r=cli(a,'hk-cli');assert.equal(r.status,1);assert.match(r.stderr,/hook ajeno/);assert.equal(fs.readFileSync(file,'utf8'),'#!/bin/sh\nexit 0\n');}
 fs.rmSync(file);execFileSync('git',['config','core.hooksPath','ganchos'],{cwd:dir});r=cli('install','hk-cli');assert.equal(r.status,0);assert.ok(fs.existsSync(path.join(dir,'ganchos/pre-commit')));
 fs.mkdirSync(path.join(DATA,'hk-sin-git'));fs.writeFileSync(path.join(DATA,'hk-sin-git','proyecto.json'),'{}');r=cli('install','hk-sin-git');assert.equal(r.status,2);assert.match(r.stderr,/no es la raíz de un repo git/);
 assert.equal(cli('otra','hk-cli').status,2);});

test('hook instalado: bloquea con errores, deja pasar limpio y avisa si falta rodaje, node o el id no vale',()=>{const dir=repo(DATA,'hk-run'),file=path.join(dir,'.git/hooks/pre-commit');
 assert.equal(cli('install','hk-run').status,0);
 let r=runHook(dir,file);assert.equal(r.status,0,r.stderr);
 fs.writeFileSync(path.join(dir,'suelto.js'),'');r=runHook(dir,file);assert.equal(r.status,1);assert.match(r.stderr,/R-code/);assert.match(r.stderr,/--no-verify/);
 // Rodaje en una ruta con espacio y comilla (enlace a scripts/): sigue funcionando.
 const odd=path.join(tmp(),"ro daje's");fs.mkdirSync(odd);fs.symlinkSync(path.join(ROOT,'scripts'),path.join(odd,'scripts'));
 const oddHook=path.join(tmp(),'pre-commit');fs.writeFileSync(oddHook,hookScript({root:odd,node:process.execPath}));r=runHook(dir,oddHook);assert.equal(r.status,1);assert.match(r.stderr,/R-code/);
 const other=(opts,env)=>{const f=path.join(tmp(),'pre-commit');fs.writeFileSync(f,hookScript({root:ROOT,node:process.execPath,...opts}));return runHook(dir,f,env);};
 r=other({root:'/no/existe'});assert.equal(r.status,0);assert.match(r.stderr,/no se encuentra \/no\/existe\/scripts\/proyecto-check\.mjs/);
 // node inexistente: prueba el de PATH.
 r=other({node:'/no/node'});assert.equal(r.status,1);assert.match(r.stderr,/R-code/);
 const bin=tmp();for(const b of ['git','basename','dirname'])fs.symlinkSync(which(b),path.join(bin,b));
 r=other({node:'/no/node'},{PATH:bin});assert.equal(r.status,0);assert.match(r.stderr,/no se encuentra node/);
 fs.rmSync(path.join(dir,'suelto.js'));
 const bad=repo(tmp(),'no válido');fs.writeFileSync(path.join(bad,'x.js'),'');r=runHook(bad,file);assert.equal(r.status,0);assert.match(r.stderr,/no pudo validar el proyecto \(código 2\)/);});
