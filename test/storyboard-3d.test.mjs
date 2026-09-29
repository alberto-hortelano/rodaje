// Plano 3D de una viñeta (#51): borrador de plano, fusión con el plano existente (storyboard-3d y storyboard-a-secuencia), inserción,
// búsqueda de viñeta, fichero de cámaras y sus avisos; y el script scripts/storyboard-3d.mjs sobre un proyecto temporal.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {storyboardToEpisode,storyboardShotDraft,mergeStoryboardLines,mergeStoryboardShot,storyboardSequenceMerge,storyboardToSequence,castPlacements,storyboardInsertIndex,findStoryboardShot,parseShotCameras,cameraFileWarnings} from '../app/workflow.mjs';
import {validate} from '../app/store.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const A={position:[-459.02,5.3,62.6],target:[-459.23,4.94,53.6],fov:14},B={position:[1,2,3],target:[0,1,0],fov:30};
const project=()=>({id:'p',name:'P',type:'serie',language:'en',revision:1,ideas:[],locations:[{id:'loc',name:'Loc'},{id:'otro',name:'Otro'}],issues:[],
 characters:[{id:'ana',name:'Ana Pérez'},{id:'bea',name:'Bea'},{id:'cai',name:'Cai'},{id:'pa',name:'Megafonía',kind:'voice'}],
 storyboards:[{id:'sb',title:'SB',sequences:[{id:'sq1',title:'Uno',location:'loc',shots:[
  {id:'v1',code:'A01',title:'Mesa',duration:30,action:'Ana se sienta.',camera:'50 mm',render:'storyboards/sb/render/A01.png',cast:['ana','bea','pa'],dialogue:[{character:'ana',text:'Hi.'},{who:'Bea',text:'Yo.'},{who:'Megafonía',text:'Attention.',channel:'pa'},{who:'Nadie',text:'?'}]},
  {id:'v2',code:'A02',title:'Puerta',duration:4,cast:['bea'],dialogue:[]},
  {id:'v3',code:'A03',title:'Salida',cast:[],dialogue:[{character:'bea',text:'Bye.'}]}]}]}],
 episodes:[{id:'e1',title:'E1',synopsis:'',sequences:[{id:'s1',title:'S1',location:'loc',cast:[],shots:[],silent:true}]}]});
const counter=(prefix,n=0)=>()=>prefix+(n++);

test('storyboardShotDraft: los planos de storyboardToEpisode sin cambios, más cast (físicos) y staging vacío',()=>{
 const p=project(),sb=p.storyboards[0],e=storyboardToEpisode(p,sb,counter('g'));const next=counter('g',2);
 const drafts=sb.sequences[0].shots.map(t=>storyboardShotDraft(p,t,{newId:next}));
 assert.deepEqual(e.sequences[0].shots,drafts.map(({cast,staging,...rest})=>rest));
 const [t1,t2,t3]=drafts;assert.equal(t1.title,'A01 · Mesa');assert.equal(t1.description,'Ana se sienta.\nCámara: 50 mm');assert.equal(t1.duration,15);assert.equal(t3.duration,5);
 assert.deepEqual(t1.lines.map(l=>[l.character,l.channel,l.offscreen]),[['ana',undefined,true],['bea',undefined,true],['pa','pa',true]]);
 assert.deepEqual(t1.cast,['ana','bea']);assert.deepEqual(t1.staging,{});assert.equal(t1.storyboardRender,'storyboards/sb/render/A01.png');assert.equal(t2.storyboardRender,undefined);
 assert.deepEqual(t1.camera,{position:[4,2.5,7],target:[0,1,0],fov:45});assert.notEqual(t1.camera,t1.cameraEnd);
 const inCast=storyboardShotDraft(p,sb.sequences[0].shots[0],{newId:counter('x'),castIds:['ana']});assert.deepEqual(inCast.lines.map(l=>l.offscreen),[false,true,true]);});

test('mergeStoryboardLines: conserva entera la anterior de mismo personaje y texto; las nuevas entran dentro del plano; las demás se descartan',()=>{
 const prev=[{id:'a',character:'ana',text:'Hi.',start:2,audio:'assets/a.mp3',offscreen:false},{id:'b',character:'bea',text:'Old.',start:3},{id:'c',character:'ana',text:'Hi.',start:6}];
 const next=[{id:'n1',character:'ana',text:'Hi.',start:.5},{id:'n2',character:'bea',text:'New.',start:9},{id:'n3',character:'ana',text:'Hi.',start:1},{id:'n4',character:'ana',text:'Hi.',start:1.5}];
 const out=mergeStoryboardLines(prev,next,4);
 assert.deepEqual(out,[prev[0],{id:'n2',character:'bea',text:'New.',start:3.5},prev[2],{id:'n4',character:'ana',text:'Hi.',start:1.5}]);
 assert.notEqual(out[0],prev[0],'copia, no el mismo objeto');assert.deepEqual(mergeStoryboardLines(undefined,[]),[]);});

test('mergeStoryboardShot: crear con cámara y preset; reejecutar conserva lo editado; --force sustituye cámara y preset',()=>{
 const p=project(),v=p.storyboards[0].sequences[0].shots[0],draft=()=>storyboardShotDraft(p,v,{newId:counter('d'),castIds:['ana','bea']});
 const c=mergeStoryboardShot(null,draft(),{camera:A,preset:'camino'});
 assert.deepEqual(c.shot.cameraRig,{type:'fixed',start:A});assert.deepEqual(c.shot.camera,A);assert.deepEqual(c.shot.cameraEnd,A);assert.deepEqual(c.shot.staging,{environment:{preset:'camino'}});assert.ok(c.changed.includes('cameraRig'));
 assert.notEqual(c.shot.cameraRig.start,c.shot.camera);
 // Edición a mano: cámara, staging, cast, audio de una línea y un campo propio.
 const edited=structuredClone(c.shot);edited.cameraRig={type:'move',start:B,end:A};edited.staging.environment.state={luz:'noche'};edited.staging.look='ana';edited.cast=['ana'];edited.lines[0].audio='assets/hi.mp3';edited.history=[{job:'j1'}];edited.allowOverlap=true;
 const again=mergeStoryboardShot(edited,draft(),{camera:A,preset:'otro'});
 assert.deepEqual(again.shot,edited,'sin force no cambia nada');assert.deepEqual(again.changed,[]);
 // La viñeta manda en título, duración, fotograma y texto del diálogo.
 const v2={...v,title:'Mesa larga',duration:6,render:undefined,dialogue:[{character:'ana',text:'Hi.'},{character:'bea',text:'Nuevo.'}]};
 const upd=mergeStoryboardShot(edited,storyboardShotDraft(p,v2,{newId:counter('u'),castIds:['ana','bea']}),{camera:A});
 assert.equal(upd.shot.title,'A01 · Mesa larga');assert.equal(upd.shot.duration,6);assert.equal(upd.shot.storyboardRender,undefined);assert.equal(upd.shot.id,edited.id);
 assert.deepEqual(upd.shot.lines[0],edited.lines[0]);assert.equal(upd.shot.lines[1].text,'Nuevo.');assert.equal(upd.shot.lines.length,2);
 assert.deepEqual(upd.shot.cameraRig,edited.cameraRig);assert.deepEqual(upd.shot.cast,['ana']);assert.equal(upd.shot.allowOverlap,true);assert.deepEqual(upd.shot.history,[{job:'j1'}]);
 assert.deepEqual(upd.changed.sort(),['duration','lines','storyboardRender','title']);
 const forced=mergeStoryboardShot(edited,draft(),{camera:B,preset:'otro',force:true});
 assert.deepEqual(forced.shot.cameraRig,{type:'fixed',start:B});assert.deepEqual(forced.shot.camera,B);assert.deepEqual(forced.shot.cameraEnd,B);
 assert.deepEqual(forced.shot.staging,{environment:{preset:'otro',state:{luz:'noche'}},look:'ana'});assert.deepEqual(forced.changed.sort(),['camera','cameraEnd','cameraRig','staging']);
 // Sin momento, --force no toca el preset.
 assert.equal(mergeStoryboardShot(edited,draft(),{camera:B,force:true}).shot.staging.environment.preset,'camino');});

test('mergeStoryboardShot: sin cámara conserva la del plano (o la de por defecto); un plano sin cast toma el de la viñeta; el preset se añade si falta',()=>{
 const p=project(),v=p.storyboards[0].sequences[0].shots[0],d=storyboardShotDraft(p,v,{newId:counter('d')});
 const fresh=mergeStoryboardShot(null,d);assert.deepEqual(fresh.shot,d);assert.equal(fresh.shot.cameraRig,undefined);
 const old={id:'t0',title:'x',duration:3,camera:B,cameraEnd:B,lines:[],storyboardShot:'v1'};
 const m=mergeStoryboardShot(old,d,{preset:'camino'});assert.deepEqual(m.shot.camera,B);assert.equal(m.shot.cameraRig,undefined);assert.deepEqual(m.shot.cast,['ana','bea']);assert.deepEqual(m.shot.staging,{environment:{preset:'camino'}});
 const withRig=mergeStoryboardShot({...old,cameraRig:{type:'fixed',start:B}},d,{camera:A});assert.deepEqual(withRig.shot.cameraRig,{type:'fixed',start:B});
 const noRig=mergeStoryboardShot(old,d,{camera:A});assert.deepEqual(noRig.shot.cameraRig,{type:'fixed',start:A});assert.deepEqual(noRig.shot.camera,A);});

test('mergeStoryboardShot es idempotente: dos pasadas con borradores nuevos dan el mismo plano',()=>{
 const p=project();for(const v of p.storyboards[0].sequences[0].shots){const first=mergeStoryboardShot(null,storyboardShotDraft(p,v,{newId:counter('a'),castIds:['ana']}),{camera:A,preset:'camino'}).shot;
  const second=mergeStoryboardShot(first,storyboardShotDraft(p,v,{newId:counter('b'),castIds:['ana']}),{camera:A,preset:'camino'});assert.deepEqual(second.shot,first);assert.deepEqual(second.changed,[]);}});

test('storyboardInsertIndex: detrás del último plano cuya viñeta va antes; si no hay, al principio',()=>{
 const order=['v1','v2','v3','v4'],shots=[{id:'a',storyboardShot:'v1'},{id:'m'},{id:'c',storyboardShot:'v3'},{id:'x',storyboardShot:'otra'}];
 assert.equal(storyboardInsertIndex(shots,order,'v2'),1);assert.equal(storyboardInsertIndex(shots,order,'v4'),3);assert.equal(storyboardInsertIndex(shots,order,'v1'),0);assert.equal(storyboardInsertIndex([],order,'v3'),0);
 assert.equal(storyboardInsertIndex([{id:'c',storyboardShot:'v3'},{id:'a',storyboardShot:'v1'}],order,'v2'),2);});

test('findStoryboardShot: por id o por código; un código repetido es un error con los ids',()=>{
 const sb=project().storyboards[0];assert.equal(findStoryboardShot(sb,'A02').shot.id,'v2');assert.equal(findStoryboardShot(sb,'v3').sequence.id,'sq1');
 assert.throws(()=>findStoryboardShot(sb,'Z9'),/Viñeta no encontrada en el storyboard: Z9/);
 sb.sequences.push({id:'sq2',shots:[{id:'v9',code:'A02'}]});assert.throws(()=>findStoryboardShot(sb,'A02'),/A02 se repite en el storyboard \(v2, v9\)/);assert.equal(findStoryboardShot(sb,'v9').shot.code,'A02');});

test('parseShotCameras: cámaras por código, momento opcional, campos extra ignorados y errores',()=>{
 const r=parseShotCameras({version:1,storyboard:'sb',entorno:'cruce',nota:'x',planos:[{code:'A01',momento:'camino',title:'T',lens:85,camera:{...A,extra:1},dialogue:[]},{code:'A02'},{code:'A03',camera:B}]});
 assert.deepEqual(r.errors,[]);assert.equal(r.entorno,'cruce');assert.equal(r.storyboard,'sb');assert.deepEqual([...r.byCode.keys()],['A01','A02','A03']);
 assert.deepEqual(r.byCode.get('A01'),{camera:A,momento:'camino'});assert.deepEqual(r.byCode.get('A02'),{camera:null,momento:null});assert.deepEqual(r.byCode.get('A03'),{camera:B,momento:null});
 const bad=parseShotCameras({planos:[{code:'A01',camera:{position:[0,1],target:[0,0,0],fov:40}},{code:'A02',camera:{...B,fov:0}},{code:'A03',camera:{...B,fov:150}},{camera:B},{code:'A04',camera:B},{code:'A04',camera:B},{code:'A05',momento:3}]});
 assert.equal(bad.errors.length,6);assert.match(bad.errors[0],/^A01: camera necesita position y target de 3 números y fov entre 1 y 100$/);assert.match(bad.errors[3],/planos\[3\]: falta code/);assert.match(bad.errors[4],/A04 repetido/);assert.match(bad.errors[5],/A05: momento/);
 assert.deepEqual([...bad.byCode.keys()],['A04']);assert.deepEqual(parseShotCameras([]).errors,['El fichero de cámaras necesita una lista «planos»']);assert.equal(parseShotCameras({planos:[]}).entorno,null);});

test('cameraFileWarnings: spot o rotation, momento fuera de los presets, entorno distinto y ambiente sin entorno',()=>{
 assert.deepEqual(cameraFileWarnings({envCfg:undefined,environmentId:'cruce',fileEnv:'cruce',momento:'camino',presetIds:['camino']}),[]);
 assert.deepEqual(cameraFileWarnings({envCfg:{preset:'x'},environmentId:'cruce',fileEnv:null,momento:null,presetIds:null}),[]);
 const w=cameraFileWarnings({envCfg:{spot:'arbol',rotation:90},environmentId:'cruce',fileEnv:'caseron',momento:'noche',presetIds:['camino','cresta']});
 assert.equal(w.length,3);assert.match(w[0],/fichero es del entorno caseron y el plano usa cruce/);assert.match(w[1],/spot arbol y rotation 90: las coordenadas/);assert.match(w[2],/momento noche no es un preset del entorno \(camino, cresta\)/);
 assert.match(cameraFileWarnings({environmentId:null,fileEnv:'cruce'})[0],/no tiene entorno 3D/);});

test('castPlacements: conserva las colocaciones y coloca en semicírculo solo a los que faltan',()=>{
 const fresh=castPlacements([],['ana','bea']);assert.deepEqual(fresh,[{character:'ana',x:2.12,z:-1.41,yaw:0},{character:'bea',x:-2.12,z:-1.41,yaw:0}]);
 const kept=castPlacements([{character:'bea',x:9,z:9,yaw:1,pose:'seated'},{character:'zed',x:0,z:0,yaw:0}],['ana','bea']);
 assert.deepEqual(kept,[{character:'bea',x:9,z:9,yaw:1,pose:'seated'},{character:'zed',x:0,z:0,yaw:0},{character:'ana',x:2.12,z:-1.41,yaw:0}]);});

test('storyboardSequenceMerge: reejecutar conserva cámara, staging, cast, audio, colocaciones y planos a mano, con avisos',()=>{
 const p=project(),sb=p.storyboards[0],seq=p.episodes[0].sequences[0];
 const first=storyboardSequenceMerge(p,sb,seq,counter('f'));assert.deepEqual(first.warnings,[]);assert.deepEqual(first.sequence.shots.map(t=>t.storyboardShot),['v1','v2','v3']);
 assert.deepEqual(first.sequence,storyboardToSequence(p,sb,seq,counter('f')));Object.assign(seq,first.sequence);assert.doesNotThrow(()=>validate(p));
 // Ediciones: rig, staging y cast del plano de v1, audio de su primera línea, colocación de ana, un plano a mano tras v1 y otro de una viñeta que se borra.
 const [t1,t2,t3]=seq.shots;t1.cameraRig={type:'fixed',start:A};t1.staging={environment:{preset:'camino'}};t1.cast=['ana'];t1.lines[0].audio='assets/hi.mp3';t1.lines[0].audioDuration=1.2;
 seq.cast.find(a=>a.character==='ana').x=7;const manual={id:'manual',title:'Inserto',duration:2,camera:B,cameraEnd:B,lines:[]};seq.shots.splice(1,0,manual);
 sb.sequences[0].shots.push({id:'v4',code:'A04',title:'Coda',cast:['cai']});const again0=storyboardSequenceMerge(p,sb,seq,counter('g')).sequence;Object.assign(seq,again0);
 sb.sequences[0].shots=sb.sequences[0].shots.filter(v=>v.id!=='v2');
 const {sequence:out,warnings}=storyboardSequenceMerge(p,sb,seq,counter('h'));
 assert.deepEqual(out.shots.map(t=>t.id),[t1.id,'manual',t2.id,t3.id,again0.shots[4].id]);
 assert.deepEqual(warnings,[`«Inserto» (manual) no viene del storyboard: se conserva en su sitio`,`«A02 · Puerta» (${t2.id}): su viñeta v2 ya no está en el storyboard; se conserva en su sitio`]);
 const o1=out.shots[0];assert.deepEqual(o1.cameraRig,{type:'fixed',start:A});assert.deepEqual(o1.staging,{environment:{preset:'camino'}});assert.deepEqual(o1.cast,['ana']);assert.equal(o1.lines[0].audio,'assets/hi.mp3');assert.equal(o1.lines[0].id,t1.lines[0].id);
 assert.equal(out.cast.find(a=>a.character==='ana').x,7);assert.ok(out.cast.some(a=>a.character==='cai'));assert.deepEqual(out.shots[1],manual);
 Object.assign(seq,out);assert.doesNotThrow(()=>validate(p));
 // Una tercera pasada no cambia nada.
 assert.deepEqual(storyboardSequenceMerge(p,sb,seq,counter('i')).sequence,out);});

test('storyboardSequenceMerge: dos planos de la misma viñeta; el primero se actualiza y el otro se conserva aparte',()=>{
 const p=project(),sb=p.storyboards[0],seq=p.episodes[0].sequences[0];Object.assign(seq,storyboardToSequence(p,sb,seq,counter('f')));
 const copy={...structuredClone(seq.shots[0]),id:'copia'};seq.shots.push(copy);
 const {sequence,warnings}=storyboardSequenceMerge(p,sb,seq,counter('g'));assert.deepEqual(sequence.shots.map(t=>t.id),[seq.shots[0].id,seq.shots[1].id,seq.shots[2].id,'copia']);assert.match(warnings[0],/\(copia\) repite la viñeta v1/);});

// El script sobre un proyecto temporal (sin coste): --plan no escribe; crear, reejecutar sin y con --force.
const run=(data,args)=>spawnSync(process.execPath,[path.join(ROOT,'scripts/storyboard-3d.mjs'),...args],{cwd:ROOT,encoding:'utf8',timeout:30000,env:{...process.env,RODAJE_DATA:data}});
test('scripts/storyboard-3d.mjs: --plan, crear en su sitio, conservar la cámara editada y --force',()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-sb3d-')),base=path.join(data,'p'),file=path.join(data,'camaras.json');fs.mkdirSync(base);const p=project();
 p.environments=[{id:'cruce',builder:'3d/b.js',data:'3d/m.json'}];p.locations[0].environment='cruce';p.episodes[0].sequences[0].cast=[{character:'ana',x:0,z:0,yaw:0},{character:'bea',x:1,z:0,yaw:0}];
 p.episodes[0].sequences[0].shots=[{id:'m1',title:'Uno',duration:3,camera:B,cameraEnd:B,lines:[],storyboardShot:'v1'},{id:'m3',title:'Tres',duration:3,camera:B,cameraEnd:B,lines:[],storyboardShot:'v3'}];
 fs.writeFileSync(path.join(base,'proyecto.json'),JSON.stringify(p));fs.mkdirSync(path.join(base,'3d'));fs.writeFileSync(path.join(base,'3d/m.json'),JSON.stringify({presets:[{id:'camino'}]}));
 fs.writeFileSync(file,JSON.stringify({version:1,storyboard:'sb',entorno:'cruce',planos:[{code:'A02',camera:A,momento:'camino',title:'ignorado'},{code:'A01',camera:A,momento:'noche'}]}));
 const read=()=>JSON.parse(fs.readFileSync(path.join(base,'proyecto.json'),'utf8')),shots=()=>read().episodes[0].sequences[0].shots;
 const before=fs.readFileSync(path.join(base,'proyecto.json'),'utf8');
 let r=run(data,['sb','A02','--secuencia','s1','--camaras',file,'--project','p','--plan']);assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/^Proyecto: p \(--project\)$/m);
 const lines=r.stdout.trim().split('\n'),planned=JSON.parse(lines.slice(0,-1).join('\n'));assert.equal(lines.at(-1),`A02 · creado · plano ${planned.id} · posición 2/3 · cámara fichero · preset camino`);assert.deepEqual(planned.cameraRig,{type:'fixed',start:A});
 assert.equal(fs.readFileSync(path.join(base,'proyecto.json'),'utf8'),before,'--plan no escribe');
 r=run(data,['sb','A02','--secuencia','s1','--camaras',file,'--project','p']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/^A02 · creado · plano \S+ · posición 2\/3 · cámara fichero · preset camino$/m);
 let t=shots()[1];assert.equal(t.storyboardShot,'v2');assert.deepEqual(t.cameraRig,{type:'fixed',start:A});assert.deepEqual(t.cast,['bea']);assert.deepEqual(t.staging,{environment:{preset:'camino'}});assert.equal(t.duration,4);assert.equal(read().revision,2);
 const edited=read();edited.episodes[0].sequences[0].shots[1].cameraRig.start.fov=20;fs.writeFileSync(path.join(base,'proyecto.json'),JSON.stringify(edited));
 r=run(data,['sb','A02','--secuencia','s1','--camaras',file,'--project','p']);assert.match(r.stdout,/A02 · actualizado · plano \S+ · posición 2\/3 · cámara conservada · preset camino/);assert.equal(shots()[1].cameraRig.start.fov,20);assert.equal(shots().length,3);
 r=run(data,['sb','A02','--secuencia','s1','--camaras',file,'--project','p','--force']);assert.match(r.stdout,/cámara fichero/);assert.equal(shots()[1].cameraRig.start.fov,14);
 // A01 ya existe sin rig: toma la cámara; su momento no es un preset (aviso). A03 no está en el fichero: aviso y cámara conservada.
 r=run(data,['sb','A01','--secuencia','s1','--camaras',file,'--project','p']);assert.match(r.stderr,/momento noche no es un preset/);assert.match(r.stdout,/A01 · actualizado · plano m1 · posición 1\/3 · cámara fichero · preset noche/);
 r=run(data,['sb','v3','--secuencia','s1','--camaras',file,'--project','p']);assert.match(r.stderr,/no trae A03: se conserva la cámara/);assert.match(r.stdout,/A03 · actualizado · plano m3 · posición 3\/3 · cámara conservada · sin preset/);
 r=run(data,['sb','A09','--secuencia','s1','--project','p']);assert.equal(r.status,1);assert.match(r.stderr,/storyboard-3d: Viñeta no encontrada/);
 r=run(data,['sb','A02','--project','p']);assert.equal(r.status,2);assert.match(r.stderr,/Falta --secuencia/);
 fs.rmSync(data,{recursive:true,force:true});});
