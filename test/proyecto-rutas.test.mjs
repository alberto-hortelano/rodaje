import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync,execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {DATA,ROOT} from '../lib/paths.mjs';
import {ABS_RE} from '../lib/proyecto-check.mjs';
const store=await import('../app/store.mjs');

const ORIG='/home/rodaje-test/fuente';
const git=(dir,...a)=>execFileSync('git',['-c','user.name=t','-c','user.email=t@t','-C',dir,...a],{encoding:'utf8'});
const run=(...a)=>{const env={...process.env,RODAJE_DATA:DATA};delete env.RODAJE_PROJECT;return spawnSync(process.execPath,['scripts/proyecto-rutas.mjs',...a],{cwd:ROOT,encoding:'utf8',env});};
const hashes=dir=>Object.fromEntries(fs.readdirSync(dir,{recursive:true}).filter(f=>!f.startsWith('.git')&&fs.statSync(path.join(dir,f)).isFile()).sort().map(f=>[f,createHash('sha1').update(fs.readFileSync(path.join(dir,f))).digest('hex')]));

// Proyecto con: personaje con referencia de origen (no sale en ningún plano), idea con la raíz de origen, lista concat, probe e informe.
function fixture(){const p=store.create('Rutas');const dir=store.dir(p.id),t=store.newShot();
 p.characters=[{id:'bert',name:'Bert',description:'d',imageReferences:[{sourceFile:ORIG+'/personajes/bert/ref-A.png',refs:[ORIG+'/personajes/bert/ref-B.png']}]},{id:'ana',name:'Ana',description:'a'}];
 p.ideas=[{id:'idea',title:'Idea',text:`Material en ${ORIG}.`}];
 p.episodes=[{id:'ep',title:'E',sequences:[{id:'seq',cast:[{character:'ana',x:0,z:0,yaw:0}],shots:[t]}]}];
 store.save(p,p.revision);
 const w=(f,s)=>{fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),s);};
 w('assets/l/montaje/concat.txt',`file 'file://${dir}/assets/l/b01/edit.mp4'\nfile 'file://${dir}/assets/l/b02/edit.mp4'\n`);
 w('assets/l/probe.json',`{\n  "filename": "file://${dir}/assets/l/b01/edit.mp4"\n}\n`);
 w('informe.txt',`Guardado bajo file://${dir}/.\n`);w('.gitignore','versiones/\ntrabajos/\n');
 git(dir,'init','-q');git(dir,'add','-A');git(dir,'commit','-qm','inicio');
 return {id:p.id,dir,shot:t.id};}

test('proyecto-rutas: simulacro sin escribir, --aplicar, idempotencia y árbol sucio',()=>{const {id,dir,shot}=fixture(),before=hashes(dir),digest=store.digest(store.load(id),shot),revision=store.load(id).revision;
 let r=run(id,'--origen','fuente='+ORIG);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,new RegExp(`Proyecto: ${id} \\(argumento\\)`));
 assert.deepEqual(hashes(dir),before);assert.match(r.stdout,/simulacro/);assert.match(r.stdout,/proyecto\.json: 3 \(origen 2, origen-raiz 1\)/);
 assert.match(r.stdout,/assets\/l\/montaje\/concat\.txt: 2 \(proyecto 2\)/);assert.match(r.stdout,/→ origen:fuente\/personajes\/bert\/ref-A\.png/);
 assert.match(r.stdout,/Sin resolver:\n  informe\.txt:1  file:\/\/.*\/ \(raiz-proyecto\)/);
 // Árbol sucio: sin --forzar no escribe.
 fs.writeFileSync(path.join(dir,'suelto.md'),'x');r=run(id,'--aplicar','--origen','fuente='+ORIG);assert.equal(r.status,2);assert.match(r.stderr,/no está limpio/);
 fs.rmSync(path.join(dir,'suelto.md'));assert.deepEqual(hashes(dir),before);
 r=run('--aplicar',id,'--origen','fuente='+ORIG);assert.equal(r.status,1,r.stderr);
 const p=store.load(id);assert.equal(p.revision,revision+1);
 assert.deepEqual(p.characters[0].imageReferences,[{sourceFile:'origen:fuente/personajes/bert/ref-A.png',refs:['origen:fuente/personajes/bert/ref-B.png']}]);assert.equal(p.ideas[0].text,'Material en origen:fuente.');
 const read=f=>fs.readFileSync(path.join(dir,f),'utf8');
 assert.deepEqual(JSON.parse(read('personajes/bert/personaje.json')),p.characters[0]);assert.equal(read('ideas/idea.md'),'# Idea\n\nMaterial en origen:fuente.');
 assert.equal(read('assets/l/montaje/concat.txt'),"file '../b01/edit.mp4'\nfile '../b02/edit.mp4'\n");assert.equal(read('assets/l/probe.json'),'{\n  "filename": "assets/l/b01/edit.mp4"\n}\n');
 assert.equal(read('informe.txt'),`Guardado bajo file://${dir}/.\n`);assert.match(r.stdout,/R-abs restantes: 1\n  informe\.txt:1/);
 for(const f of ['proyecto.json','personajes/bert/personaje.json','ideas/idea.md','assets/l/montaje/concat.txt','assets/l/probe.json'])assert.doesNotMatch(read(f),ABS_RE,f);
 assert.equal(store.digest(p,shot),digest);
 r=run(id,'--origen','fuente='+ORIG);assert.equal(r.status,1);assert.match(r.stdout,/· 0 cambios en 0 ficheros, 1 sin resolver/);});

test('proyecto-rutas: sin --origen, la referencia externa queda sin resolver',()=>{const {id}=fixture();
 const r=run(id);assert.equal(r.status,1);assert.match(r.stdout,/proyecto\.json:characters\.0\.imageReferences\.0\.sourceFile  \/home\/rodaje-test\/fuente\/personajes\/bert\/ref-A\.png \(desconocida\)/);
 assert.equal(run(id,'--origen','Mal=/x').status,2);assert.equal(run(id,'--origen','sin-ruta').status,2);});

test('generatedFiles: lo que save regenera',()=>{const p=store.create('Generados');const dir=store.dir(p.id);
 p.ideas=[{id:'i',title:'I',text:'t'}];p.characters=[{id:'c',name:'C',description:'d'}];p.locations=[{id:'l',name:'L',description:'d'}];
 p.episodes=[{id:'e',title:'E',sequences:[]}];p.storyboards=[{id:'b',title:'B',sequences:[]}];
 const list=dir=>fs.readdirSync(dir,{recursive:true}).filter(f=>fs.statSync(path.join(dir,f)).isFile()&&!f.startsWith('versiones')).map(f=>f.split(path.sep).join('/'));
 const old=new Set(list(dir));store.save(p,p.revision);
 const gen=store.generatedFiles(p);for(const f of gen)assert.ok(fs.existsSync(path.join(dir,f)),f);
 const written=list(dir).filter(f=>!old.has(f)&&f!=='proyecto.json');assert.deepEqual(written.sort(),[...gen].sort());
 assert.deepEqual(gen,['ideas/i.md','personajes/c/hoja.md','personajes/c/personaje.json','ambientes/l/escenario.json','capitulos/e/capitulo.json','storyboards/b/storyboard.json']);});
