// Animación 3D de una viñeta (#51): funciones puras del trabajo anim3d, argumentos de ffmpeg, enqueue y, con un servidor hijo,
// /api/render-data (location del plano) y /api/storyboard-anim3d. Sin Chrome ni ffmpeg reales y sin fal.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {anim3dName,nextAnim3dVersion,anim3dEvents,anim3dGroups,anim3dButton,anim3dReady,stageSequence,shotRigIssues} from '../app/workflow.mjs';
import {ANIM3D_DIR,mixArgs,encodeArgs,readAnim3dIndex,appendAnim3dEntry,placeAnim3d} from '../lib/animacion3d.mjs';
const {create,save}=await import('../app/store.mjs');const {enqueue,jobs}=await import('../app/jobs.mjs');
const ROOT=path.resolve(import.meta.dirname,'..'),A={position:[1,1.6,6],target:[0,1.4,0],fov:30};
const sbOf=()=>({id:'sb',title:'SB',sequences:[{id:'sq',title:'S',shots:[{id:'v1',code:'A01',title:'Uno'},{id:'v2',code:'B 2/x',title:'Dos'},{id:'v3',code:'C3'},{id:'v4',code:'C3'},{id:'v5'}]}]});

test('anim3dName: el código saneado si es único; si no, el id',()=>{const sb=sbOf(),v=id=>sb.sequences[0].shots.find(t=>t.id===id);
 assert.equal(anim3dName(sb,v('v1')),'A01');assert.equal(anim3dName(sb,v('v2')),'B_2_x');assert.equal(anim3dName(sb,v('v3')),'v3');assert.equal(anim3dName(sb,v('v5')),'v5');assert.equal(anim3dName(sb,{id:'a b',code:''}),'a_b');});

test('nextAnim3dVersion: la mayor del índice (de ese nombre) y de los ficheros, incluidos los .part',()=>{
 assert.equal(nextAnim3dVersion([],[],'A01'),1);
 assert.equal(nextAnim3dVersion([{name:'A01',version:2},{name:'A02',version:7}],['A01-v01.mp4','A02-v09.mp4','A010-v05.mp4'],'A01'),3);
 assert.equal(nextAnim3dVersion([{name:'A01',version:2}],['A01-v04.part.mp4'],'A01'),5);});

test('anim3dEvents: sin audio por estimación; audio que se sale se recorta con aviso; fichero ausente en silencio; nunca lanza',()=>{
 const lines=[{id:'b',character:'bea',text:'Later line',start:3,estimatedDuration:1.5},{id:'a',character:'ana',text:'Hello there',start:.5,audio:'assets/a.mp3'},{id:'c',character:'ana',text:'Too long',start:6,audio:'assets/c.mp3'},{id:'d',character:'pa',text:'Missing',start:1,audio:'assets/d.mp3',channel:'pa'},{id:'e',character:'ana',text:'Default',start:7}];
 const r=anim3dEvents(lines,8,{a:1.25,c:4,d:null});
 assert.deepEqual(r.events.map(e=>[e.id,e.start,e.end]),[['a',.5,1.75],['d',1,4],['b',3,4.5],['c',6,8],['e',7,8]]);
 assert.deepEqual(r.clips,[{audio:'assets/a.mp3',start:.5},{audio:'assets/c.mp3',start:6}]);
 assert.equal(r.warnings.length,2);assert.match(r.warnings[0],/audio de «Too long» termina a 10\.00 s, fuera del plano \(8\.00 s\): se recorta/);assert.match(r.warnings[1],/Falta el audio de «Missing» \(assets\/d\.mp3\)/);
 assert.equal(r.events.find(e=>e.id==='d').offscreen,true,'canal pa: fuera de campo');assert.equal(r.events.find(e=>e.id==='a').text,'Hello there');
 for(const bad of [[null,undefined,{start:'x'},{id:'z',start:9,audio:'a'}],undefined])assert.doesNotThrow(()=>anim3dEvents(bad,8,undefined));
 assert.deepEqual(anim3dEvents([{id:'z',start:9,audio:'a.mp3'}],8,{z:2}),{events:[],clips:[],warnings:['El audio de «» termina a 11.00 s, fuera del plano (8.00 s): se recorta']});});

test('anim3dGroups: por viñeta, de mayor a menor versión, sin ficheros ausentes ni viñetas que ya no están',()=>{
 const e=(v,version,extra={})=>({file:`storyboards/sb/animacion-3d/${v}-v0${version}.mp4`,name:v,version,storyboardShot:v==='A01'?'v1':'v2',at:'2026-09-2'+version,...extra});
 const idx={entries:[e('A01',1),e('A01',3),e('A01',2),e('B',1),e('A01',4,{storyboardShot:'borrada'}),{version:9},e('A01',5)]};
 const g=anim3dGroups(idx,sbOf(),f=>!f.endsWith('-v05.mp4'));
 assert.equal(g.storyboard,'sb');assert.deepEqual(Object.keys(g.shots),['v1','v2']);assert.deepEqual(g.shots.v1.list.map(x=>x.version),[3,2,1]);assert.equal(g.shots.v1.current.version,3);
 assert.deepEqual(anim3dGroups(null,sbOf()),{storyboard:'sb',shots:{}});});

test('anim3dButton: etiqueta y estado',()=>{
 assert.deepEqual(anim3dButton(null,[]),{label:'Renderizar vídeo',disabled:false});assert.deepEqual(anim3dButton(null,['x']),{label:'Renderizar vídeo',disabled:true});
 assert.deepEqual(anim3dButton({status:'queued'},[]),{label:'Renderizando… 0 %',disabled:true});assert.deepEqual(anim3dButton({status:'running',progress:45},[]),{label:'Renderizando… 45 %',disabled:true});
 for(const status of ['done','failed','interrupted'])assert.deepEqual(anim3dButton({status,progress:100},[]),{label:'Renderizar vídeo',disabled:false});});

test('mixArgs y encodeArgs: silencio de la duración con cada clip a su inicio; vídeo a 24 fps cortado al plano',()=>{
 const m=mixArgs({clips:[{audio:'assets/a.mp3',start:.5},{audio:'assets/c.mp3',start:6}],duration:8,base:'/p',out:'/t/audio.wav'});
 assert.deepEqual(m.slice(0,8),['-f','lavfi','-i','anullsrc=r=48000:cl=stereo:d=8','-i','/p/assets/a.mp3','-i','/p/assets/c.mp3']);
 assert.equal(m[m.indexOf('-filter_complex')+1],'[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=500:all=1[a0];[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay=6000:all=1[a1];[0:a][a0][a1]amix=inputs=3:normalize=0:duration=first,atrim=0:8[a]');
 assert.deepEqual(m.slice(-7),['-map','[a]','-t','8','-c:a','pcm_s16le','/t/audio.wav']);
 assert.equal(mixArgs({clips:[],duration:2.5,base:'/p',out:'o.wav'}).find(x=>String(x).includes('amix')),'[0:a]amix=inputs=1:normalize=0:duration=first,atrim=0:2.5[a]');
 const e=encodeArgs({framesDir:'/t',audio:'/t/audio.wav',duration:8,out:'/o/A01-v01.part.mp4'});
 assert.deepEqual(e,['-framerate','24','-i','/t/%05d.png','-i','/t/audio.wav','-map','0:v:0','-map','1:a:0','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-t','8','-movflags','+faststart','/o/A01-v01.part.mp4']);});

const chapter=(shot,{storyboards=[sbOf()],cast=[{character:'ana',x:0,z:0,yaw:0}]}={})=>({storyboards,episodes:[{id:'e1',sequences:[{id:'s1',location:'loc',cast,shots:[shot]}]}]});
test('anim3dReady, stageSequence y shotRigIssues',()=>{
 const t={id:'t1',duration:4,camera:A,cameraEnd:A,lines:[],storyboardShot:'v1',cameraRig:{type:'fixed',start:A}};
 let r=anim3dReady(chapter(t),'t1');assert.deepEqual(r.errors,[]);assert.equal(r.storyboard.id,'sb');assert.equal(r.storyboardShot.id,'v1');assert.equal(r.episode.id,'e1');assert.equal(r.sequence.id,'s1');assert.equal(r.shot,t);
 assert.deepEqual(anim3dReady(chapter(t),'nada').errors,['Plano no encontrado']);
 assert.deepEqual(anim3dReady(chapter({...t,storyboardShot:undefined}),'t1').errors,['El plano no está enlazado a una viñeta del storyboard']);
 assert.deepEqual(anim3dReady(chapter({...t,storyboardShot:'vx'}),'t1').errors,['La viñeta vx no está en ningún storyboard']);
 assert.deepEqual(anim3dReady(chapter({...t,duration:0}),'t1').errors,['La duración del plano debe ser positiva']);
 r=anim3dReady(chapter({...t,cameraRig:{type:'follow',start:A,follow:{character:'bea',mode:'look'}}}),'t1');assert.deepEqual(r.errors,['Cámara: follow.character «bea» no está en el reparto del plano','Cámara: follow.character «bea» no tiene colocación (reparto de la secuencia o staging.proxies)']);
 assert.deepEqual(anim3dReady(chapter({...t,cameraRig:undefined}),'t1').errors,[],'sin rig, la cámara fija de camera');
 const s={id:'s1',location:'loc',cast:[]};assert.equal(stageSequence(s,{}),s);assert.deepEqual(stageSequence(s,{location:'otro'}),{id:'s1',location:'otro',cast:[]});assert.equal(s.location,'loc');
 assert.deepEqual(shotRigIssues({cast:[{character:'bea'}]},{...t,cameraRig:{type:'follow',start:A,follow:{character:'bea'}}}),{errors:[],warnings:[]});
 assert.deepEqual(shotRigIssues({cast:[]},{...t,cast:['bea'],staging:{proxies:{bea:{}}},cameraRig:{type:'follow',start:A,follow:{character:'bea'}}}),{errors:[],warnings:[]});});

test('lib/animacion3d.mjs: índice atómico, relectura y colocado sin sobrescribir',()=>{
 const p=create('Anim3D índice'),dirA=path.join(process.env.RODAJE_DATA,p.id,ANIM3D_DIR('sb'));
 assert.deepEqual(readAnim3dIndex(p.id,'sb'),{storyboard:'sb',entries:[]});appendAnim3dEntry(p.id,'sb',{file:'x',name:'A01',version:1});appendAnim3dEntry(p.id,'sb',{file:'y',name:'A01',version:2});
 assert.deepEqual(readAnim3dIndex(p.id,'sb').entries.map(e=>e.version),[1,2]);
 fs.writeFileSync(path.join(dirA,'A01-v01.part.mp4'),'a');placeAnim3d(path.join(dirA,'A01-v01.part.mp4'),path.join(dirA,'A01-v01.mp4'));assert.equal(fs.readFileSync(path.join(dirA,'A01-v01.mp4'),'utf8'),'a');
 fs.writeFileSync(path.join(dirA,'A01-v01.part.mp4'),'b');assert.throws(()=>placeAnim3d(path.join(dirA,'A01-v01.part.mp4'),path.join(dirA,'A01-v01.mp4')),/Ya existe A01-v01\.mp4; no se sobrescribe/);
 assert.equal(fs.readFileSync(path.join(dirA,'A01-v01.mp4'),'utf8'),'a');assert.equal(fs.existsSync(path.join(dirA,'A01-v01.part.mp4')),false);});

test('enqueue anim3d: con errores lanza sin crear trabajo; un segundo del mismo plano en curso se rechaza',()=>{
 const p=create('Anim3D cola');p.characters=[{id:'ana',name:'Ana'}];p.storyboards=[sbOf()];
 p.episodes=[{id:'e1',title:'E',synopsis:'',sequences:[{id:'s1',title:'S',location:'',cast:[{character:'ana',x:0,z:0,yaw:0}],silent:true,shots:[{id:'t1',title:'T',description:'',duration:4,camera:A,cameraEnd:A,lines:[]},{id:'t2',title:'T2',description:'',duration:4,camera:A,cameraEnd:A,lines:[],storyboardShot:'v1'}]}]}];save(p);
 const before=jobs.size;assert.throws(()=>enqueue(p.id,'anim3d','t1'),/^Error: El plano no está enlazado a una viñeta del storyboard$/);assert.throws(()=>enqueue(p.id,'anim3d','nada'),/Plano no encontrado/);assert.equal(jobs.size,before);
 jobs.set('fake-anim3d',{id:'fake-anim3d',project:p.id,type:'anim3d',target:'t2',status:'running'});
 try{assert.throws(()=>enqueue(p.id,'anim3d','t2'),/Este trabajo ya está en curso/);assert.equal(jobs.size,before+1);}finally{jobs.delete('fake-anim3d');}});

// Servidor hijo: un trabajo anim3d ya hecho en trabajos/ y un índice de prueba con mp4 falsos.
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-anim3d-')),DATA=path.join(TMP,'data'),id='a3d-'+process.pid,base=path.join(DATA,id);
const w=(rel,v)=>{const f=path.join(base,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
const shotT={id:'t1',title:'A01',description:'',duration:4,camera:A,cameraEnd:A,lines:[],storyboardShot:'v1',location:'otro',cameraRig:{type:'fixed',start:A}};
const live={id,name:'A3D',type:'serie',language:'en',revision:1,ideas:[],issues:[],characters:[{id:'ana',name:'Ana'}],locations:[{id:'loc',name:'Loc'},{id:'otro',name:'Otro'}],storyboards:[sbOf()],
 episodes:[{id:'e1',title:'E',synopsis:'',sequences:[{id:'s1',title:'S',location:'loc',cast:[{character:'ana',x:0,z:0,yaw:0}],silent:true,shots:[shotT,{...shotT,id:'t2',storyboardShot:'v2',cameraRig:{type:'follow',start:A,follow:{character:'bea'}}}]}]}]};
w('proyecto.json',live);
for(const [job,type] of [['job-a3d','anim3d'],['job-prev','preview']])w(`trabajos/${job}.json`,{id:job,project:id,type,target:'t1',status:'done',created:'2026-09-29T00:00:00.000Z',snapshot:live,events:[{id:'l',start:0,end:1}]});
const entry=(v,version,shot='v1')=>({file:`${ANIM3D_DIR('sb')}/${v}-v0${version}.mp4`,name:v,version,at:'2026-09-29T0'+version+':00:00.000Z',duration:4,storyboardShot:shot,episode:'e1',sequence:'s1',shot:'t1',job:'j'+version,warnings:[]});
w(ANIM3D_DIR('sb')+'/index.json',{storyboard:'sb',entries:[entry('A01',1),entry('A01',2),entry('A01',3),entry('B_2_x',1,'v2')]});
for(const f of ['A01-v01.mp4','A01-v02.mp4','B_2_x-v01.mp4'])w(ANIM3D_DIR('sb')+'/'+f,'mp4');
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const env={...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:'',RODAJE_CONFIG_DIR:fs.mkdtempSync(path.join(TMP,'config-')),PATH:[path.join(ROOT,'test/fixtures/bin'),path.dirname(process.execPath),process.env.PATH].join(path.delimiter)};delete env.FAL_KEY;delete env.RODAJE_PROJECT;
let child;const origin=`http://127.0.0.1:${port}`;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(TMP,{recursive:true,force:true});});
const get=u=>fetch(origin+u).then(async r=>({status:r.status,body:await r.json()}));

test('GET /api/render-data: anim3d ve la location del plano; preview, la de la secuencia',async()=>{
 const a=await get('/api/render-data?job=job-a3d');assert.equal(a.status,200);assert.equal(a.body.sequence.location,'otro');assert.equal(a.body.shot.id,'t1');assert.deepEqual(a.body.events,[{id:'l',start:0,end:1}]);
 const p=await get('/api/render-data?job=job-prev');assert.equal(p.body.sequence.location,'loc');});

test('GET /api/storyboard-anim3d: vídeos por viñeta sin los ficheros ausentes; 400 con un storyboard desconocido',async()=>{
 const r=await get(`/api/storyboard-anim3d?project=${id}&storyboard=sb`);assert.equal(r.status,200);assert.equal(r.body.storyboard,'sb');
 assert.deepEqual(r.body.shots.v1.list.map(x=>x.version),[2,1]);assert.equal(r.body.shots.v1.current.file,'storyboards/sb/animacion-3d/A01-v02.mp4');assert.equal(r.body.shots.v2.current.name,'B_2_x');
 const bad=await get(`/api/storyboard-anim3d?project=${id}&storyboard=nada`);assert.equal(bad.status,400);assert.equal(bad.body.error,'Storyboard desconocido');});

test('POST /api/job anim3d con la cámara con errores: 400 y sin trabajo nuevo',async()=>{
 const state=await get('/api/state'),n=state.body.jobs.length;
 const r=await fetch(origin+'/api/job',{method:'POST',headers:{'Content-Type':'application/json','x-rodaje-token':state.body.token},body:JSON.stringify({project:id,type:'anim3d',target:'t2'})});
 assert.equal(r.status,400);assert.match((await r.json()).error,/^Cámara: follow\.character «bea» no está en el reparto del plano/);assert.equal((await get('/api/state')).body.jobs.length,n);});
