import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
const paths=await import('../lib/paths.mjs'),json=await import('../lib/json.mjs'),argsLib=await import('../lib/args.mjs'),store=await import('../app/store.mjs'),bloques=await import('../scripts/bloques/lib.mjs');
const {DATA,safe,projectDir,resolveProject}=paths;
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-lib-'));
const leftovers=d=>fs.readdirSync(d).filter(f=>f.endsWith('.tmp'));

test('importar lib/paths no toca el disco',()=>{const missing=path.join(tmp(),'no','existe');execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL('../lib/paths.mjs',import.meta.url).href)})`],{env:{...process.env,RODAJE_DATA:missing}});assert.equal(fs.existsSync(missing),false);});
test('store y bloques reexportan las mismas funciones de lib/',()=>{assert.equal(paths.DATA,store.DATA);assert.equal(paths.ROOT,store.ROOT);assert.equal(store.dir,paths.projectDir);assert.equal(paths.dir,paths.projectDir);assert.equal(store.safe,paths.safe);assert.equal(store.read,json.readJSON);assert.equal(store.write,json.writeJSON);assert.equal(bloques.parseArgs,argsLib.parseArgs);assert.equal(typeof bloques.cliProject,'function');assert.equal(typeof bloques.usageExit,'function');assert.equal(bloques.writeJSON,json.writeJSON);assert.equal(bloques.readJSON,json.readJSON);assert.equal(bloques.ROOT,paths.ROOT);for(const k of ['lotePaths','loadLote','mapaFor','sceneFor','sceneNumber','attemptsPath','loadAttempts','saveAttempts','acceptedAttempt'])assert.equal(bloques[k],undefined,k);});
test('safe rechaza rutas que salen de la raíz y acepta rutas nuevas dentro',()=>{assert.throws(()=>safe(DATA,'../x'),/Ruta no válida/);assert.throws(()=>safe(DATA,'/etc'),/Ruta no válida/);assert.throws(()=>safe(DATA,42),/Ruta no válida/);const link=path.join(DATA,'enlace-fuera');if(!fs.existsSync(link))fs.symlinkSync(os.tmpdir(),link);assert.throws(()=>safe(DATA,'enlace-fuera/x.json'),/Enlace fuera del proyecto/);assert.equal(safe(DATA,'a/b.json'),path.join(DATA,'a','b.json'));});
test('projectDir valida el id',()=>{assert.throws(()=>projectDir('a/b'),/ID no válido/);assert.throws(()=>projectDir('x y'),/ID no válido/);assert.equal(projectDir('ok-1'),path.join(DATA,'ok-1'));});
test('resolveProject: prioridad --project > posicional > RODAJE_PROJECT > activo, con su fuente',()=>{
 const env={RODAJE_PROJECT:'p3'};
 assert.deepEqual(resolveProject({opts:{project:'p1'},args:['p2','x'],env,positional:0,active:'p4'}),{project:'p1',source:'--project',args:['p2','x']});
 assert.deepEqual(resolveProject({args:['p2','x'],env,positional:0,active:'p4'}),{project:'p2',source:'argumento',args:['x']});
 assert.deepEqual(resolveProject({args:['x'],env,positional:1,active:'p4'}),{project:'p3',source:'RODAJE_PROJECT',args:['x']});
 assert.deepEqual(resolveProject({args:['x'],positional:1,active:'p4'}),{project:'p4',source:'app',args:['x']});
 assert.deepEqual(resolveProject({active:()=>'p4'}),{project:'p4',source:'app',args:[]});
 assert.deepEqual(resolveProject(),{project:null,source:null,args:[]});
 assert.deepEqual(resolveProject({env:{RODAJE_PROJECT:''}}),{project:null,source:null,args:[]});});
test('resolveProject: posicional none, n, predicado; con --project nunca se consume',()=>{
 assert.deepEqual(resolveProject({args:['p2','x']}),{project:null,source:null,args:['p2','x']});
 assert.equal(resolveProject({args:['p2','x'],positional:'none'}).project,null);
 assert.equal(resolveProject({args:['a'],positional:1}).project,null);
 assert.deepEqual(resolveProject({args:['p','a'],positional:1}),{project:'p',source:'argumento',args:['a']});
 assert.equal(resolveProject({args:['a','b'],positional:2}).project,null);
 const upper=a=>a.length>0&&!/^[A-Z0-9_]+$/.test(a[0]);
 assert.equal(resolveProject({args:['ROZ_BASE'],positional:upper}).project,null);
 assert.deepEqual(resolveProject({args:['p1','ROZ_BASE'],positional:upper}),{project:'p1',source:'argumento',args:['ROZ_BASE']});
 assert.deepEqual(resolveProject({opts:{project:'p1'},args:['p2','x'],positional:0}),{project:'p1',source:'--project',args:['p2','x']});
 assert.deepEqual(resolveProject({opts:{project:'p1'},args:['p2','x'],positional:()=>true}),{project:'p1',source:'--project',args:['p2','x']});});
test('resolveProject: el activo solo se consulta si hace falta y uno no válido se ignora',()=>{
 let calls=0;const active=()=>{calls++;return 'p4';};
 resolveProject({opts:{project:'p1'},active});resolveProject({args:['p2'],positional:0,active});resolveProject({env:{RODAJE_PROJECT:'p3'},active});assert.equal(calls,0);
 resolveProject({active});assert.equal(calls,1);
 for(const a of ['a/b','../x','',null,42,()=>'x y',()=>null])assert.deepEqual(resolveProject({active:a}),{project:null,source:null,args:[]});});
test('resolveProject: errores y sin mutar la entrada',()=>{
 assert.throws(()=>resolveProject({opts:{project:true}}),e=>e.usage===true&&/--project necesita un id de proyecto/.test(e.message));
 for(const input of [{opts:{project:'a/b'}},{args:['a b'],positional:0},{env:{RODAJE_PROJECT:'../x'}}])assert.throws(()=>resolveProject(input),/ID de proyecto no válido: /);
 const input={opts:{project:'p1'},args:['a','b'],env:{RODAJE_PROJECT:'p3'}},copy=structuredClone(input);resolveProject(input);resolveProject({args:input.args,positional:0});resolveProject({args:input.args,env:input.env});assert.deepEqual(input,copy);});
test('takeOption saca la opción de argv y no es voraz con otra --opción',()=>{const {takeOption}=argsLib;
 let a=['x','--project','p1','y'];assert.equal(takeOption(a,'--project'),'p1');assert.deepEqual(a,['x','y']);
 a=['x','--project'];assert.equal(takeOption(a,'--project'),true);assert.deepEqual(a,['x']);
 a=['--project','--todos','x'];assert.equal(takeOption(a,'--project'),true);assert.deepEqual(a,['--todos','x']);
 a=['x','y'];assert.equal(takeOption(a,'--project'),undefined);assert.deepEqual(a,['x','y']);});
test('importar app/store, app/montaje, lib/proyecto-activo, lib/cli y lib/lotes no toca el disco',()=>{const missing=path.join(tmp(),'no','existe');for(const m of ['../app/store.mjs','../lib/proyecto-activo.mjs','../lib/cli.mjs','../lib/lotes.mjs','../app/montaje.mjs','../scripts/bloques/lib.mjs'])execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL(m,import.meta.url).href)})`],{env:{...process.env,RODAJE_DATA:missing}});assert.equal(fs.existsSync(path.dirname(missing)),false);assert.equal(fs.existsSync(missing),false);});
test('loadEnv es idempotente y no lanza',()=>{paths.loadEnv();paths.loadEnv();});
test('writeJSON escribe de forma atómica y readJSON lee lo escrito',()=>{const d=tmp(),f=path.join(d,'sub','dir','x.json');json.writeJSON(f,{a:1});assert.equal(fs.readFileSync(f,'utf8'),'{\n  "a": 1\n}\n');
 json.writeJSON(f,{big:'x'.repeat(10000)});json.writeJSON(f,[1]);assert.equal(fs.readFileSync(f,'utf8'),'[\n  1\n]\n');assert.deepEqual(leftovers(path.dirname(f)),[]);
 const c={};c.c=c;assert.throws(()=>json.writeJSON(f,c),TypeError);assert.equal(fs.readFileSync(f,'utf8'),'[\n  1\n]\n');assert.deepEqual(leftovers(path.dirname(f)),[]);
 const v={s:'ñ',n:[1,{b:null}]};json.writeJSON(f,v);assert.deepEqual(json.readJSON(f),v);});
test('parseArgs es voraz: --clave toma el siguiente argumento que no empiece por --',()=>{const {parseArgs}=argsLib;assert.deepEqual(parseArgs(['a','--x','1','--y','b','c']),{args:['a','c'],opts:{x:'1',y:'b'}});assert.deepEqual(parseArgs(['--f']),{args:[],opts:{f:true}});assert.deepEqual(parseArgs(['--a','--b']),{args:[],opts:{a:true,b:true}});assert.deepEqual(parseArgs(['--x','']),{args:[''],opts:{x:true}});});
