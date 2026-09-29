// scripts/stage-config.mjs staging y check (#21): parches de staging sobre el proyecto o la instantánea de un lote, sin escribir si hay errores.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'..');
const cam={position:[0,2,5],target:[0,1,0],fov:50},sh=(id,extra={})=>({id,title:id.toUpperCase(),duration:4,camera:cam,cameraEnd:cam,lines:[],...extra});
const project=()=>({id:'demo',name:'Demo',type:'serie',language:'en',ideas:[],characters:[{id:'ana',name:'Ana'},{id:'bea',name:'Bea'}],locations:[],revision:3,
 stage:{rehearsal:{lookTargets:{box:[0,1,0]}}},
 episodes:[{id:'e1',title:'E1',sequences:[{id:'s1',title:'S1',cast:[{character:'ana',x:0,z:0,yaw:0,pose:'standing'},{character:'bea',x:1,z:0,yaw:0,pose:'standing'}],shots:[
  sh('p1',{staging:{scene:1,shot:1,props:['cart'],potatoes:'none',look:null}}),sh('p2',{staging:{scene:1,shot:2,props:[],potatoes:'cloud',look:'mug'}}),sh('p3')]}]}]});
function setup(){const data=fs.mkdtempSync(path.join(os.tmpdir(),'stage-config-'));const dir=path.join(data,'demo');fs.mkdirSync(path.join(dir,'assets','l1'),{recursive:true});
 fs.writeFileSync(path.join(dir,'proyecto.json'),JSON.stringify(project(),null,2)+'\n');const snap=project();delete snap.stage;fs.writeFileSync(path.join(dir,'assets','l1','project-snapshot.json'),JSON.stringify(snap,null,2)+'\n');return {data,dir};}
const run=(data,...args)=>spawnSync(process.execPath,[path.join(ROOT,'scripts/stage-config.mjs'),...args],{cwd:ROOT,encoding:'utf8',timeout:30000,env:{...process.env,RODAJE_DATA:data,RODAJE_PROJECT:''}});
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const patches=(data,v)=>{const f=path.join(data,'parches.json');fs.writeFileSync(f,JSON.stringify(v));return f;};

test('staging --simular lista los planos que cambiarían y no escribe',()=>{const {data,dir}=setup(),before=fs.readFileSync(path.join(dir,'proyecto.json'),'utf8');
 const r=run(data,'staging','demo','--desde',patches(data,{shots:{p1:{carrier:'bea'}}}),'--simular');assert.equal(r.status,0,r.stderr);
 assert.deepEqual(r.stdout.trim().split('\n').slice(0,2),['p1','p2']);assert.match(r.stdout,/2 planos cambiarían/);assert.match(r.stderr,/aviso: p2: look «mug»/);assert.equal(fs.readFileSync(path.join(dir,'proyecto.json'),'utf8'),before);});
test('staging aborta sin escribir con ids desconocidos o errores de staging',()=>{const {data,dir}=setup(),before=fs.readFileSync(path.join(dir,'proyecto.json'),'utf8');
 for(const [p,msg] of [[{shots:{p9:{look:'box'}}},/p9: no hay plano/],[{shots:{p3:{look:'box'}}},/p3: no hay plano/],[{shots:{p1:{carrier:'zoe'}}},/carrier «zoe»/],[{shots:{p1:{swarm:'fog'}}},/swarm debe/],[{shots:{p1:{propMoves:{cargo:{at:[0,0]}}}}},/propMoves\.cargo\.at/]]){
  const r=run(data,'staging','demo','--desde',patches(data,p));assert.equal(r.status,1,JSON.stringify(p));assert.match(r.stderr,msg);assert.match(r.stderr,/No se guarda/);}
 assert.equal(fs.readFileSync(path.join(dir,'proyecto.json'),'utf8'),before);});
test('staging guarda con store.save: potatoes → swarm en todos, parche aplicado y null borra',()=>{const {data,dir}=setup();
 const r=run(data,'staging','demo','--desde',patches(data,{shots:{p1:{carrier:'bea',look:null},p2:{propMoves:{cargo:{at:[0,0,-2.5]}}}}}));assert.equal(r.status,0,r.stderr);
 const p=read(path.join(dir,'proyecto.json')),[t1,t2]=p.episodes[0].sequences[0].shots;assert.equal(p.revision,4);
 assert.deepEqual(t1.staging,{scene:1,shot:1,props:['cart'],swarm:'none',carrier:'bea'});assert.deepEqual(Object.keys(t2.staging),['scene','shot','props','swarm','look','propMoves']);
 const again=run(data,'staging','demo','--desde',patches(data,{shots:{p1:{carrier:'bea'}}}));assert.equal(again.status,0);assert.match(again.stdout,/sin cambios/);assert.equal(read(path.join(dir,'proyecto.json')).revision,4);});
test('staging --lote reescribe solo la instantánea del lote y valida con el stage del vivo',()=>{const {data,dir}=setup(),before=fs.readFileSync(path.join(dir,'proyecto.json'),'utf8');
 const r=run(data,'staging','demo','--desde',patches(data,{shots:{p2:{look:'box'}}}),'--lote','l1');assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stderr,/aviso: p2/,'lookTargets del vivo');
 const snap=read(path.join(dir,'assets','l1','project-snapshot.json'));assert.equal(snap.revision,3);assert.equal(snap.stage,undefined);assert.equal(snap.episodes[0].sequences[0].shots[1].staging.look,'box');assert.equal(snap.episodes[0].sequences[0].shots[1].staging.swarm,'cloud');
 assert.equal(fs.readFileSync(path.join(dir,'proyecto.json'),'utf8'),before);});
test('staging --lote conserva el formato compacto de la instantánea',()=>{const {data,dir}=setup(),f=path.join(dir,'assets','l1','project-snapshot.json'),snap=read(f);fs.writeFileSync(f,JSON.stringify(snap));
 const r=run(data,'staging','demo','--desde',patches(data,{shots:{p2:{look:'box'}}}),'--lote','l1');assert.equal(r.status,0,r.stderr);const text=fs.readFileSync(f,'utf8');assert.ok(!text.includes('\n'));assert.equal(JSON.parse(text).episodes[0].sequences[0].shots[1].staging.look,'box');});
test('check: avisos de staging sin cambiar el código de salida; ids de gear contra los personajes',()=>{const {data,dir}=setup();
 let r=run(data,'check','demo');assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/aviso: p1: clave heredada potatoes/);assert.match(r.stderr,/aviso: p2: look «mug»/);
 const p=read(path.join(dir,'proyecto.json'));p.stage.rehearsal.gear={red:{kind:'helmet',except:['zoe']}};p.episodes[0].sequences[0].shots[0].staging.carrier='zoe';fs.writeFileSync(path.join(dir,'proyecto.json'),JSON.stringify(p));
 r=run(data,'check','demo');assert.equal(r.status,1);assert.match(r.stderr,/gear\.red\.except: «zoe»/);assert.match(r.stderr,/p1: carrier «zoe»/);});

// catalogo (#41): variantes, zonas y canales del proyecto en proyecto.stage.
const catalogo=(data,v)=>{const f=path.join(data,'catalogo.json');fs.writeFileSync(f,JSON.stringify(v));return f;};
const CAT={variants:[{id:'day',label:'Día'}],defaultVariant:'day',zones:[{id:'sea',label:'Mar',color:'#123456',variant:'day'}],channels:[{id:'tv',label:'TV',offscreen:true}]};
test('catalogo sin --desde imprime las cuatro claves, null si faltan',()=>{const {data}=setup();const r=run(data,'catalogo','demo');assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{variants:null,zones:null,channels:null,defaultVariant:null});});
test('catalogo --desde válido guarda con store.save, conserva rehearsal y sube la revisión; --simular no escribe',()=>{const {data,dir}=setup(),f=path.join(dir,'proyecto.json'),before=fs.readFileSync(f,'utf8');
 let r=run(data,'catalogo','demo','--desde',catalogo(data,CAT),'--simular');assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/4 claves del catálogo cambiarían/);assert.equal(fs.readFileSync(f,'utf8'),before);
 r=run(data,'catalogo','demo','--desde',catalogo(data,CAT));assert.equal(r.status,0,r.stderr);const p=read(f);assert.equal(p.revision,4);assert.deepEqual(p.stage.rehearsal,{lookTargets:{box:[0,1,0]}});for(const k of Object.keys(CAT))assert.deepEqual(p.stage[k],CAT[k]);
 r=run(data,'catalogo','demo');assert.deepEqual(JSON.parse(r.stdout),CAT);
 r=run(data,'catalogo','demo','--desde',catalogo(data,{channels:null,defaultVariant:null}));assert.equal(r.status,0,r.stderr);const q=read(f);assert.equal(q.revision,5);assert.equal(q.stage.channels,undefined);assert.equal(q.stage.defaultVariant,undefined);assert.deepEqual(q.stage.zones,CAT.zones);
 r=run(data,'catalogo','demo','--desde',catalogo(data,{zones:CAT.zones}));assert.match(r.stdout,/sin cambios/);assert.equal(read(f).revision,5);});
test('catalogo --desde inválido o con claves ajenas sale con 1 sin escribir',()=>{const {data,dir}=setup(),f=path.join(dir,'proyecto.json'),before=fs.readFileSync(f,'utf8');
 for(const [v,msg] of [[{channels:[{id:'tv-2',label:'TV'}]},/channels\[0\]\.id/],[{zones:[{id:'sea',label:'Mar',variant:'night'}]},/zones\[0\]\.variant/],[{rehearsal:{}},/clave «rehearsal» fuera del catálogo/],[[1],/necesita/]]){
  const r=run(data,'catalogo','demo','--desde',catalogo(data,v));assert.equal(r.status,1,JSON.stringify(v));assert.match(r.stderr,msg);}
 assert.equal(fs.readFileSync(f,'utf8'),before);});
test('check avisa de un canal fuera del catálogo sin cambiar el código de salida y da error con un catálogo mal formado',()=>{const {data,dir}=setup(),f=path.join(dir,'proyecto.json'),p=read(f);
 p.episodes[0].sequences[0].shots[2].lines=[{id:'l1',character:'ana',text:'Hola.',start:0,channel:'phone'}];fs.writeFileSync(f,JSON.stringify(p));
 let r=run(data,'check','demo');assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/aviso: canal de línea «phone» fuera del catálogo \(1\)/);
 p.stage.channels=[{id:'phone',label:'Teléfono',speakLight:'sí'}];fs.writeFileSync(f,JSON.stringify(p));r=run(data,'check','demo');assert.equal(r.status,1);assert.match(r.stderr,/channels\[0\]\.speakLight debe ser true o false/);assert.doesNotMatch(r.stderr,/«phone» fuera/);});
test('check: poses del reparto (#47): montura sin configurar avisa una vez por secuencia; pose desconocida es error',()=>{const {data,dir}=setup(),f=path.join(dir,'proyecto.json'),p=read(f);
 p.episodes[0].sequences[0].cast[0].pose='mounted';fs.writeFileSync(f,JSON.stringify(p));let r=run(data,'check','demo');assert.equal(r.status,0,r.stderr);assert.equal(r.stderr.match(/«ana» lleva montura sin configurar/g)?.length,1);
 p.stage.rehearsal.mounts={ana:{kind:'mule'}};p.episodes[0].sequences[0].cast[1].pose='kneeling';fs.writeFileSync(f,JSON.stringify(p));r=run(data,'check','demo');assert.equal(r.status,1);assert.match(r.stderr,/s1: pose «kneeling» de «bea»/);assert.doesNotMatch(r.stderr,/sin configurar/);});
test('staging con cast (#48): escribe y borra t.cast en cualquier plano, también con --lote; ids desconocidos no escriben',()=>{const {data,dir}=setup(),f=path.join(dir,'proyecto.json');
 let r=run(data,'staging','demo','--desde',patches(data,{cast:{p3:['ana'],p1:['bea']}}));assert.equal(r.status,0,r.stderr);let p=read(f),ts=p.episodes[0].sequences[0].shots;assert.deepEqual(ts[2].cast,['ana']);assert.deepEqual(ts[0].cast,['bea']);
 r=run(data,'staging','demo','--desde',patches(data,{cast:{p3:null}}));assert.equal(r.status,0,r.stderr);assert.equal(read(f).episodes[0].sequences[0].shots[2].cast,undefined);
 const before=fs.readFileSync(f,'utf8');for(const [c,msg] of [[{p9:['ana']},/p9: no hay plano con ese id/],[{p1:['zoe']},/p1: cast: «zoe» no es un personaje/],[{p1:'ana'},/p1: cast debe ser una lista/]]){r=run(data,'staging','demo','--desde',patches(data,{cast:c}));assert.equal(r.status,1,JSON.stringify(c));assert.match(r.stderr,msg);}
 assert.equal(fs.readFileSync(f,'utf8'),before);
 r=run(data,'staging','demo','--desde',patches(data,{cast:{p2:['ana']}}),'--lote','l1');assert.equal(r.status,0,r.stderr);assert.deepEqual(read(path.join(dir,'assets','l1','project-snapshot.json')).episodes[0].sequences[0].shots[1].cast,['ana']);assert.equal(fs.readFileSync(f,'utf8'),before);});
test('fondo (#48): guarda location.background, null lo borra y un valor desconocido no escribe; check valida la clave',()=>{const {data,dir}=setup(),f=path.join(dir,'proyecto.json'),p0=read(f);p0.locations=[{id:'patio',name:'Patio'}];fs.writeFileSync(f,JSON.stringify(p0));
 let r=run(data,'fondo','demo','--location','patio','--background','people');assert.equal(r.status,0,r.stderr);assert.equal(read(f).locations[0].background,'people');
 r=run(data,'fondo','demo','--location','patio','--background','crowd');assert.equal(r.status,1);assert.equal(read(f).locations[0].background,'people');
 r=run(data,'fondo','demo','--location','nada','--background','none');assert.equal(r.status,1);assert.match(r.stderr,/Ambiente desconocido/);
 r=run(data,'fondo','demo','--location','patio','--background','null');assert.equal(r.status,0,r.stderr);assert.equal(Object.hasOwn(read(f).locations[0],'background'),false);
 const p=read(f);p.locations[0].background='crowd';fs.writeFileSync(f,JSON.stringify(p));r=run(data,'check','demo');assert.equal(r.status,1);assert.match(r.stderr,/ambiente patio: background debe ser none o people/);});
