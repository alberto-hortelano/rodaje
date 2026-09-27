// scripts/registro.mjs textos (#42): imprime y aplica los textos de prompt del registro sin tocar REGISTRO.md.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'..');
const project=()=>({id:'demo',name:'Demo',type:'serie',language:'en',ideas:[],characters:[{id:'ana',name:'Ana'}],locations:[],revision:1,
 stage:{variants:[{id:'day',label:'Día'},{id:'night',label:'Noche'}],defaultVariant:'day'},episodes:[{id:'e1',title:'E1',sequences:[{id:'s1',title:'S1',cast:[],shots:[]}]}]});
const registry={version:1,summary:'Drama.',lighting:{day:'Sun.',night:'Moon.'},assets:{ANA_BASE:{kind:'character',character:'ana',variant:'',file:'',descriptor:'ANA: a woman. 100% matches the reference.',status:'draft'}}};
function setup(){const data=fs.mkdtempSync(path.join(os.tmpdir(),'registro-textos-'));const dir=path.join(data,'demo');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'proyecto.json'),JSON.stringify(project(),null,2)+'\n');fs.writeFileSync(path.join(dir,'registro.json'),JSON.stringify(registry,null,2)+'\n');return {data,dir,reg:path.join(dir,'registro.json')};}
const run=(data,...args)=>spawnSync(process.execPath,[path.join(ROOT,'scripts/registro.mjs'),...args],{cwd:ROOT,encoding:'utf8',timeout:30000,env:{...process.env,RODAJE_DATA:data,RODAJE_PROJECT:''}});
const patch=(data,v)=>{const f=path.join(data,'parche.json');fs.writeFileSync(f,JSON.stringify(v));return f;};
const text=f=>fs.readFileSync(f,'utf8');
const TEXTS={sound:{day:'Birds.',night:'Crickets.'},constraints:{night:'Torches stay lit.'},texts:{people:'the villagers',physics:{normal:'Feet on the ground.'}}};

test('textos sin --desde imprime sound, constraints y texts, con null si faltan',()=>{const {data}=setup();const r=run(data,'textos','demo');assert.equal(r.status,0,r.stderr);
 assert.deepEqual(JSON.parse(r.stdout),{sound:null,constraints:null,texts:null});assert.match(r.stderr,/Proyecto: demo \(argumento\)/);});

test('textos --desde escribe tras lighting sin tocar REGISTRO.md; --simular no escribe; null borra',()=>{const {data,dir,reg}=setup();
 assert.equal(run(data,'render','demo').status,0);const md=text(path.join(dir,'REGISTRO.md')),before=text(reg);
 const sim=run(data,'textos','demo','--desde',patch(data,TEXTS),'--simular');assert.equal(sim.status,0,sim.stderr);assert.match(sim.stdout,/cambiaría sound, constraints, texts/);assert.equal(text(reg),before);
 const r=run(data,'textos','demo','--desde',patch(data,TEXTS));assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/sound, constraints, texts actualizados/);
 const after=JSON.parse(text(reg));assert.deepEqual(Object.keys(after),['version','summary','lighting','sound','constraints','texts','assets']);assert.deepEqual(after.texts,TEXTS.texts);assert.equal(text(reg),JSON.stringify(after,null,2)+'\n');
 assert.deepEqual(JSON.parse(run(data,'textos','demo').stdout),TEXTS);
 assert.equal(run(data,'render','demo').status,0);assert.equal(text(path.join(dir,'REGISTRO.md')),md);
 assert.match(run(data,'textos','demo','--desde',patch(data,TEXTS)).stdout,/sin cambios/);
 const del=run(data,'textos','demo','--desde',patch(data,{constraints:null}));assert.equal(del.status,0,del.stderr);assert.equal(Object.hasOwn(JSON.parse(text(reg)),'constraints'),false);});

test('textos --desde inválido sale con 1 sin escribir',()=>{const {data,reg}=setup(),before=text(reg);
 for(const v of [{sound:{day:''}},{assets:{}},{texts:{crowd:'x'}}]){const r=run(data,'textos','demo','--desde',patch(data,v));assert.equal(r.status,1,JSON.stringify(v));assert.match(r.stderr,/registro\.json: /);assert.equal(text(reg),before);}
 assert.equal(run(data,'textos','demo','--desde',path.join(data,'no-existe.json')).status,1);assert.equal(run(data,'render','demo','--simular').status,2);});

test('check avisa de claves por zona fuera del catálogo y de variantes sin sonido sin fallar; falla con textos inválidos',()=>{const {data,reg}=setup();
 run(data,'textos','demo','--desde',patch(data,{sound:{day:'Birds.',dusk:'Bats.'}}));const r=run(data,'check','demo');assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/aviso: registro\.json: sound: «dusk» no es una variante del catálogo/);assert.match(r.stdout,/aviso: registro\.json: variante «night» sin sound ni sound\.default/);assert.match(r.stdout,/check: sin errores/);
 const bad=JSON.parse(text(reg));bad.texts={people:''};fs.writeFileSync(reg,JSON.stringify(bad,null,2)+'\n');const f=run(data,'check','demo');assert.equal(f.status,1);assert.match(f.stderr,/registro\.json: texts\.people debe ser un texto no vacío/);});
