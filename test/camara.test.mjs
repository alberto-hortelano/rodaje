// Cámara del plano (t.cameraRig, #49): cameraAt por tipo, actores en el tiempo, presets, validación, huella, prompt y stage-config.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {cameraAt,actorPositionAt,cameraContext,cameraRigIssues,cameraPresets,seedOf,moveStart,stagingIssues,patchShotField,blockPrompt,firstFrameCast,cameraLine,opticsLine,rigFovSpan,rigOpticsLine,strayNegatives,CAMERA_RIG_TYPES,CAMERA_EASINGS} from '../app/workflow.mjs';
import {validate,digest} from '../app/store.mjs';
import {conTextos} from './fixtures/ep01-s01-b02/datos.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');

// Cámara en z=5 mirando al origen (hacia −z): la derecha del cuadro es +x.
const A={position:[0,1.6,5],target:[0,1.4,0],fov:40},B={position:[2,2.6,3],target:[1,1.4,0],fov:60};
const near=(a,b,eps=1e-9)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=eps,`${a} ≠ ${b}`));};
const same=(c,d,eps=1e-9)=>{near(c.position,d.position,eps);near(c.target,d.target,eps);assert.ok(Math.abs(c.fov-d.fov)<=eps,`fov ${c.fov} ≠ ${d.fov}`);};
const seq=()=>({id:'s1',cast:[{character:'ana',x:0,z:0,yaw:0,pose:'standing'},{character:'bea',x:2,z:-1,yaw:0,pose:'seated'},{character:'cai',x:-2,z:-1,yaw:0,pose:'mounted'}]});
const shot=(extra={})=>({id:'p1',title:'P1',duration:4,camera:A,cameraEnd:A,lines:[],...extra});

test('fixed: start en el inicio, a mitad y al final, con arrays nuevos',()=>{const rig={type:'fixed',start:A};
 for(const t of [0,2,4,9])same(cameraAt(rig,t,4),A);const c=cameraAt(rig,0,4);assert.notEqual(c.position,A.position);assert.notEqual(c.target,A.target);c.position[0]=99;assert.equal(A.position[0],0);});

test('move: extremos, hold y las cuatro curvas (smooth por defecto)',()=>{const rig={type:'move',start:A,end:B};
 same(cameraAt(rig,0,4),A);same(cameraAt(rig,4,4),B);same(cameraAt(rig,-1,4),A);same(cameraAt(rig,8,4),B);
 const held={...rig,hold:[.2,.8]};same(cameraAt(held,.4,4),A);same(cameraAt(held,.8,4),A);same(cameraAt(held,3.2,4),B);same(cameraAt(held,3.9,4),B);
 const f=(easing)=>(cameraAt({...rig,easing},2,4).fov-A.fov)/(B.fov-A.fov);
 for(const [e,v] of [['linear',.5],['smooth',.5],['ease-in',.25],['ease-out',.75]])assert.ok(Math.abs(f(e)-v)<1e-9,e);
 assert.ok(Math.abs((cameraAt(rig,1,4).fov-A.fov)/(B.fov-A.fov)-.15625)<1e-9,'smoothstep(0,25) por defecto');assert.deepEqual(CAMERA_EASINGS,['linear','smooth','ease-in','ease-out']);});

test('follow: mira o acompaña al actor que anda, de forma determinista',()=>{const s=seq(),t=shot({staging:{moves:{ana:{kind:'walk',delta:[4,0,0]}}}}),ctx=cameraContext({shot:t,sequence:s});
 const look={type:'follow',start:A,follow:{character:'ana',mode:'look'}},track={...look,follow:{character:'ana',mode:'track'}};
 same(cameraAt(look,0,4,ctx),A);const l=cameraAt(look,3,4,ctx);near(l.position,A.position);assert.ok(l.target[0]>A.target[0]+1,'el objetivo sigue a ana hacia +x');assert.equal(l.fov,A.fov);
 const k=cameraAt(track,3,4,ctx);assert.ok(k.position[0]>1,'la cámara se desplaza con ana');near(k.target,l.target);
 const direct=cameraAt(track,2,4,ctx);for(let i=0;i<60;i++)cameraAt(track,i/15,4,ctx);same(cameraAt(track,2,4,ctx),direct,0);
 const raw={...look,follow:{character:'ana',mode:'look',smoothing:0}},p=a=>ctx.at('ana',a).position;near(cameraAt(raw,2,4,ctx).target,[A.target[0]+p(2)[0]-p(0)[0],A.target[1],A.target[2]]);
 assert.ok(cameraAt(look,2,4,ctx).target[0]<cameraAt(raw,2,4,ctx).target[0],'el suavizado va por detrás');
 const off={...track,follow:{character:'ana',mode:'track',offset:[0,.5,3],smoothing:0}},o=cameraAt(off,4,4,ctx);near(o.position,[p(4)[0],1.45+.5,3]);
 same(cameraAt({...look,follow:{character:'zoe',mode:'look'}},2,4,ctx),A);same(cameraAt(look,2,4,{}),A);});

test('track: 0, 1 y N muestras; suavizado en ventana centrada',()=>{const c=(x,fov)=>({position:[x,1.6,5],target:[x,1.4,0],...(fov?{fov}:{})});
 same(cameraAt({type:'track',start:A,track:[]},2,4),A);same(cameraAt({type:'track',start:A,track:[{t:1,...c(3,50)}]},0,4),{...c(3),fov:50});
 const rig={type:'track',start:A,track:[{t:0,...c(0)},{t:1,...c(2,50)},{t:2,...c(2)},{t:4,...c(2)}]};
 same(cameraAt(rig,0,4),{...c(0),fov:40},1e-9);same(cameraAt(rig,.5,4),{...c(1),fov:45},1e-9);same(cameraAt(rig,1,4),{...c(2),fov:50},1e-9);same(cameraAt(rig,2,4),{...c(2),fov:50},1e-9);
 same(cameraAt({...rig,trackSmoothing:0},1,4),{...c(2),fov:50},1e-9);same(cameraAt(rig,9,4),{...c(2),fov:50});
 const sm={...rig,trackSmoothing:.5};assert.ok(Math.abs(cameraAt(sm,1,4).position[0]-2)>.01,'la esquina se redondea');near(cameraAt(sm,3,4).position,c(2).position,1e-9);near(cameraAt(sm,9,4).position,c(2).position,1e-9);});

test('handheld: temblor reproducible con semilla, acotado por shake y 0 sin temblor',()=>{const rig={type:'handheld',start:A,seed:7};
 same(cameraAt(rig,1.3,4),cameraAt(rig,1.3,4),0);assert.notDeepEqual(cameraAt(rig,1.3,4).position,cameraAt({...rig,seed:8},1.3,4).position);
 same(cameraAt({...rig,shake:0},1.3,4),A);for(let t=0;t<=4;t+=.1){const c=cameraAt({...rig,shake:.05},t,4);c.position.forEach((v,i)=>assert.ok(Math.abs(v-A.position[i])<=.05+1e-12));}
 const moving=cameraAt({type:'handheld',start:A,end:B,shake:0},4,4);same(moving,B);
 const noSeed={type:'handheld',start:A};same(cameraAt(noSeed,2,4,{seed:7}),cameraAt(rig,2,4),0);
 assert.equal(seedOf('ep01-s1-p1'),seedOf('ep01-s1-p1'));assert.notEqual(seedOf('a'),seedOf('b'));assert.equal(seedOf(''),0x811c9dc5);assert.ok(Number.isInteger(seedOf('x'))&&seedOf('x')>=0);});

test('actorPositionAt: t=0 es moveStart, walk acaba en su marca, glide-out sale de ella; giro hacia el avance',()=>{const pl={x:1,z:2,yaw:.3};
 for(const kind of ['walk','glide-in','glide-out','turn']){const m={kind,delta:[3,0,-4]},s=moveStart(1,2,m),p=actorPositionAt(pl,m,0,5);near(p.position,[s.x,0,s.z]);}
 near(actorPositionAt(pl,{kind:'walk',delta:[3,0,-4]},5,5).position,[1,0,2]);near(actorPositionAt(pl,{kind:'glide-out',delta:[3,0,-4]},5,5).position,[4,0,-2]);
 assert.equal(actorPositionAt(pl,{kind:'walk',delta:[3,0,-4]},2,5).yaw,Math.atan2(3,-4));assert.equal(actorPositionAt(pl,{kind:'turn',delta:[3,0,-4]},2,5).yaw,.3);
 assert.deepEqual(actorPositionAt(pl,undefined,2,5),{position:[1,0,2],yaw:.3});});

test('cameraContext: foco de pie, sentado y a caballo, proxies y null si no está colocado',()=>{const t=shot({id:'p9',staging:{proxies:{dan:{x:5,z:-5}},placements:{ana:{x:1}}}}),ctx=cameraContext({shot:t,sequence:seq(),R:null});
 assert.equal(ctx.seed,seedOf('p9'));assert.deepEqual(ctx.at('ana',0),{position:[1,0,0],focus:1.45});assert.equal(ctx.at('bea',0).focus,1.2);assert.equal(ctx.at('cai',0).focus,1.95);
 assert.equal(cameraContext({shot:t,sequence:seq(),R:{mounts:{cai:{kind:'mule'}}}}).at('cai',0).focus,1.75);assert.deepEqual(ctx.at('dan',3),{position:[5,0,-5],focus:1.45});assert.equal(ctx.at('zoe',0),null);});

test('cameraPresets: ids y etiquetas, rigs válidos, dos de seguimiento por personaje',()=>{const P=cameraPresets(A,{characters:['ana',{id:'bea',name:'Bea'}]});
 assert.deepEqual(P.map(p=>p.id),['fixed','truck-right','truck-left','dolly-in','dolly-out','pan-follow:ana','follow:ana','pan-follow:bea','follow:bea','handheld','free']);
 assert.deepEqual(P.map(p=>p.label),['Plano fijo','Travelling lateral a la derecha','Travelling lateral a la izquierda','Acercamiento','Alejamiento','Panorámica siguiendo a ana','Acompañar a ana','Panorámica siguiendo a Bea','Acompañar a Bea','Cámara en mano','Grabación libre']);
 for(const p of P){assert.deepEqual(cameraRigIssues(p.rig,{duration:4,cast:['ana','bea'],positioned:['ana','bea']}),{errors:[],warnings:[]},p.id);assert.ok(CAMERA_RIG_TYPES.includes(p.rig.type));}
 const right=P.find(p=>p.id==='truck-right').rig;near(right.end.position,[1.5,1.6,5]);near(right.end.target,[1.5,1.4,0]);near(P.find(p=>p.id==='truck-left').rig.end.position,[-1.5,1.6,5]);
 near(P.find(p=>p.id==='dolly-in').rig.end.position,[0,1.6-.2*.35,5-5*.35]);near(P.find(p=>p.id==='dolly-out').rig.end.position,[0,1.7,7.5]);
 assert.deepEqual(P.find(p=>p.id==='free').rig.track,[{t:0,...A}]);assert.equal(P.find(p=>p.id==='handheld').rig.shake,.03);assert.notEqual(P[0].rig.start.position,A.position);assert.equal(cameraPresets(A).length,7);});

test('cameraRigIssues: cada error y un rig válido por tipo',()=>{const ok=r=>assert.deepEqual(cameraRigIssues(r,{duration:4,cast:['ana'],positioned:['ana']}),{errors:[],warnings:[]},JSON.stringify(r));
 ok({type:'fixed',start:A});ok({type:'move',start:A,end:B,easing:'ease-in',hold:[0,.5]});ok({type:'follow',start:A,follow:{character:'ana',mode:'track',offset:[0,0,2],smoothing:.8}});ok({type:'track',start:A,track:[{t:0,...A},{t:4,position:B.position,target:B.target}],trackSmoothing:.5});ok({type:'handheld',start:A,end:B,shake:.1,seed:3});
 const err=(r,re,o={duration:4,cast:['ana'],positioned:['ana']})=>{const e=cameraRigIssues(r,o).errors;assert.ok(e.some(x=>re.test(x)),`${JSON.stringify(r)} → ${e}`);};
 err(null,/debe ser un objeto/);err({type:'zoom',start:A},/type debe ser fixed, move/);err({type:'fixed'},/falta start/);err({type:'fixed',start:{...A,position:[0,1]}},/start\.position debe tener 3/);err({type:'fixed',start:{...A,fov:120}},/start\.fov debe estar entre 1 y 100/);
 err({type:'move',start:A},/move necesita end/);err({type:'move',start:A,end:{...B,target:null}},/end\.target/);err({type:'move',start:A,end:B,easing:'bounce'},/easing debe ser/);
 for(const hold of [[.5,.5],[.8,.2],[-.1,.5],[0,1.2],[0],'x'])err({type:'move',start:A,end:B,hold},/hold debe ser/);
 err({type:'follow',start:A},/follow necesita/);err({type:'follow',start:A,follow:{mode:'look'}},/follow\.character/);err({type:'follow',start:A,follow:{character:'ana',mode:'orbit'}},/follow\.mode/);err({type:'follow',start:A,follow:{character:'ana',offset:[1]}},/follow\.offset/);err({type:'follow',start:A,follow:{character:'ana',smoothing:2}},/follow\.smoothing/);
 err({type:'follow',start:A,follow:{character:'zoe'}},/«zoe» no está en el reparto del plano/);err({type:'follow',start:A,follow:{character:'zoe'}},/«zoe» no tiene colocación/,{positioned:['ana']});
 err({type:'track',start:A},/track necesita/);err({type:'track',start:A,track:[]},/al menos una muestra/);err({type:'track',start:A,track:[{t:1,...A},{t:1,...A}]},/track\[1\]\.t debe ser mayor/);err({type:'track',start:A,track:[{t:-1,...A}]},/track\[0\]\.t debe ser un número ≥ 0/);
 err({type:'track',start:A,track:[{t:5,...A}]},/pasa de la duración/);err({type:'track',start:A,track:[{t:0,position:[0],target:A.target}]},/track\[0\]\.position/);err({type:'track',start:A,track:[{t:0,...A,fov:.5}]},/track\[0\]\.fov/);
 err({type:'track',start:A,track:[{t:0,...A}],trackSmoothing:2},/trackSmoothing debe estar entre 0 y 1/);err({type:'handheld',start:A,shake:1},/shake debe estar entre 0 y 0,5/);err({type:'handheld',start:A,seed:1.5},/seed debe ser un entero/);
 assert.deepEqual(cameraRigIssues({type:'track',start:A,track:[{t:9,...A}]}).errors,[],'sin duración no se comprueba el límite');
 assert.deepEqual(cameraRigIssues({type:'fixed',start:A,zoom:2}).warnings,['zoom: clave desconocida']);});

test('stagingIssues valida cameraRig aunque el plano no tenga staging y avisa de lo que ignora',()=>{const s=seq();
 const bad=stagingIssues(shot({cameraRig:{type:'move',start:A}}),s,null);assert.deepEqual(bad.errors,['p1: cameraRig: move necesita end']);
 assert.deepEqual(stagingIssues(shot({cameraRig:{type:'follow',start:A,follow:{character:'dan'}}}),s,null).errors,['p1: cameraRig: follow.character «dan» no está en el reparto del plano','p1: cameraRig: follow.character «dan» no tiene colocación (reparto de la secuencia o staging.proxies)']);
 assert.deepEqual(stagingIssues(shot({cameraRig:{type:'follow',start:A,follow:{character:'dan'}},staging:{proxies:{dan:{x:0,z:-3}}}}),s,null).errors,[]);
 const w=stagingIssues(shot({cameraRig:{type:'fixed',start:A},coverage:[{start:0,camera:A}],cameraMotion:'establishing-reveal'}),s,null);assert.deepEqual(w,{errors:[],warnings:['p1: cameraRig manda: se ignoran coverage y cameraMotion']});
 assert.deepEqual(stagingIssues(shot({coverage:[]}),s,null),{errors:[],warnings:[]});});

const project=()=>({id:'demo',name:'Demo',type:'serie',language:'en',ideas:[],characters:[{id:'ana',name:'Ana'},{id:'bea',name:'Bea'}],locations:[],revision:1,episodes:[{id:'e1',title:'E1',sequences:[{id:'s1',title:'S1',cast:[{character:'ana',x:0,z:0,yaw:0},{character:'bea',x:1,z:0,yaw:0}],shots:[shot(),shot({id:'p2'})]}]}]});
test('store.validate rechaza un cameraRig mal formado y acepta uno bueno',()=>{const p=project();assert.doesNotThrow(()=>validate(p));
 p.episodes[0].sequences[0].shots[0].cameraRig={type:'fixed',start:A};assert.doesNotThrow(()=>validate(p));
 p.episodes[0].sequences[0].shots[0].cameraRig={type:'fixed',start:{...A,fov:.5}};assert.throws(()=>validate(p),/^Error: Cámara del plano no válida: start\.fov debe estar entre 1 y 100$/);});
test('digest: sin cameraRig no cambia; con él, sí',()=>{const p=project(),before=digest(p,'p1');assert.equal(digest(structuredClone(p),'p1'),before);
 const q=structuredClone(p);q.episodes[0].sequences[0].shots[0].cameraRig={type:'fixed',start:A};const d=digest(q,'p1');assert.notEqual(d,before);delete q.episodes[0].sequences[0].shots[0].cameraRig;assert.equal(digest(q,'p1'),before);
 const r=structuredClone(p);r.episodes[0].sequences[0].shots[0].cameraRig={type:'fixed',start:B};assert.notEqual(digest(r,'p1'),d);});

// Prompt: b02 con cameraRig en su primer plano.
const {sequence,shots,block,registry,map,scene}=conTextos,first=block.parts[0].shot;
const withRig=rig=>({...shots,[first]:{...shots[first],cameraRig:rig}}),promptOf=rig=>blockPrompt({project:conTextos.project,sequence,shots:rig?withRig(rig):shots,block,registry,map,scene}).prompt;
const line=(prompt,k)=>prompt.split('\n').find(l=>l.startsWith(k+':'));
test('blockPrompt: sin rig, idéntico a la referencia; CAMERA y OPTICS según el tipo de rig',()=>{
 assert.equal(promptOf(null),fs.readFileSync(path.join(import.meta.dirname,'fixtures/ep01-s01-b02/prompt-ref-41.txt'),'utf8'));
 assert.match(line(promptOf({type:'fixed',start:A}),'CAMERA'),/^CAMERA: Locked-off camera at 1\.6 m/);
 const mv=line(promptOf({type:'move',start:A,end:{...A,position:[0,1.6,2]},hold:[.25,1]}),'CAMERA');assert.match(mv,/dolly/);assert.match(mv,/ending closer to the subject/);assert.match(mv,/waits still until/);assert.doesNotMatch(mv,/Locked-off|handheld|sway/);
 assert.match(line(promptOf({type:'handheld',start:A}),'CAMERA'),/continuous handheld move/);
 const who=sequence.cast[0].character,name=line(promptOf({type:'follow',start:A,follow:{character:who,mode:'look'}}),'CAMERA');assert.match(name,/pans and tilts to keep [A-Z]+ in frame/);assert.doesNotMatch(name,new RegExp(who));
 assert.match(line(promptOf({type:'follow',start:A,follow:{character:who,mode:'track'}}),'CAMERA'),/travels with [A-Z]+/);
 assert.match(line(promptOf({type:'track',start:A,track:[{t:0,...A},{t:4,...A,position:[0,2.6,5]}]}),'CAMERA'),/recorded path of Video 1, rising/);
 const rig={type:'move',start:{...A,fov:70},end:{...B,fov:70}};assert.notEqual(shots[first].camera.fov,70);assert.equal(line(promptOf(rig),'OPTICS'),'OPTICS: '+opticsLine(70));
 for(const r of [{type:'fixed',start:A},{type:'move',start:A,end:B},{type:'follow',start:A,follow:{character:who,mode:'look'}}])assert.deepEqual(blockPrompt({project:conTextos.project,sequence,shots:withRig(r),block,registry,map,scene}).warnings,blockPrompt({project:conTextos.project,sequence,shots,block,registry,map,scene}).warnings,r.type);});
test('firstFrameCast y cameraLine con rig: la cámara de cameraAt en el inicio del bloque, por delante de la cobertura',()=>{const s=seq(),t=shot({coverage:[{start:0,camera:B}],cameraRig:{type:'move',start:A,end:B,easing:'linear'}});
 same(firstFrameCast({sequence:s,shot:t}).camera,A);same(firstFrameCast({sequence:s,shot:t,block:{parts:[{shot:'p1',from:2}]},shots:{p1:t}}).camera,cameraAt(t.cameraRig,2,4));
 assert.equal(firstFrameCast({sequence:s,shot:shot({coverage:[{start:0,camera:B}]})}).camera,B);
 assert.match(cameraLine({...shot(),cameraRig:{type:'follow',start:A,follow:{character:'ana',mode:'look'}}},{nameOf:id=>id.toUpperCase()}),/keep ANA in frame/);
 assert.match(cameraLine({camera:A,cameraEnd:{...A,position:[0,1.6,2]}}),/^One continuous handheld move exactly as in Video 1, ending closer to the subject: operator on foot/);});

test('stage.js: usa cameraAt, actorPositionAt y cameraContext; la rama de cameraRig va antes de cameraMotion y del seguimiento',()=>{const src=fs.readFileSync(path.join(ROOT,'app/stage.js'),'utf8'),imp=src.split('\n')[0];
 for(const f of ['cameraAt','actorPositionAt','cameraContext'])assert.ok(imp.includes(f),f);const rig=src.indexOf('if(moveCamera&&t.cameraRig)'),motion=src.indexOf("t.cameraMotion==='establishing-reveal'");assert.ok(rig>0&&rig<motion);
 assert.match(src,/if\(t\.cameraRig\)setCamera\(cameraAt\(t\.cameraRig,0,t\.duration,rigContext\)\);else\{setCamera\(t\.camera\);/);assert.doesNotMatch(src,/addScaledVector\(delta/);});

test('patchShotField: pone, borra con null y lista cambiados y desconocidos sin tocar el original',()=>{const p=project(),rig={type:'fixed',start:A};
 const r=patchShotField(p,'cameraRig',{p1:rig,p9:rig});assert.deepEqual(r.changed,['p1']);assert.deepEqual(r.unknown,['p9']);assert.deepEqual(r.project.episodes[0].sequences[0].shots[0].cameraRig,rig);assert.equal(p.episodes[0].sequences[0].shots[0].cameraRig,undefined);
 assert.notEqual(r.project.episodes[0].sequences[0].shots[0].cameraRig,rig);const again=patchShotField(r.project,'cameraRig',{p1:rig,p2:null});assert.deepEqual(again.changed,[]);
 const del=patchShotField(r.project,'cameraRig',{p1:null});assert.deepEqual(del.changed,['p1']);assert.equal(Object.hasOwn(del.project.episodes[0].sequences[0].shots[0],'cameraRig'),false);assert.deepEqual(patchShotField(p,'cast',null),{project:p,changed:[],unknown:[]});});

function setup(){const data=fs.mkdtempSync(path.join(os.tmpdir(),'camara-'));const dir=path.join(data,'demo');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'proyecto.json'),JSON.stringify(project(),null,2)+'\n');return {data,dir};}
const run=(data,...args)=>spawnSync(process.execPath,[path.join(ROOT,'scripts/stage-config.mjs'),...args],{cwd:ROOT,encoding:'utf8',timeout:30000,env:{...process.env,RODAJE_DATA:data,RODAJE_PROJECT:''}});
const patches=(data,v)=>{const f=path.join(data,'parches.json');fs.writeFileSync(f,JSON.stringify(v));return f;};
test('stage-config staging con cameraRig: válido, inválido, null e id desconocido',()=>{const {data,dir}=setup(),file=path.join(dir,'proyecto.json'),before=fs.readFileSync(file,'utf8');
 let r=run(data,'staging','demo','--desde',patches(data,{cameraRig:{p1:{type:'fixed',start:A}}}),'--simular');assert.equal(r.status,0,r.stderr);assert.deepEqual(r.stdout.trim().split('\n'),['p1','proyecto.json: 1 planos cambiarían (simulación, sin escribir)']);
 r=run(data,'staging','demo','--desde',patches(data,{cameraRig:{p1:{type:'move',start:A}}}),'--simular');assert.equal(r.status,1);assert.match(r.stderr,/p1: cameraRig: move necesita end/);assert.match(r.stderr,/No se guarda/);
 r=run(data,'staging','demo','--desde',patches(data,{cameraRig:{p9:{type:'fixed',start:A}}}),'--simular');assert.equal(r.status,1);assert.match(r.stderr,/p9: no hay plano con ese id en proyecto\.json/);
 r=run(data,'staging','demo','--desde',patches(data,{cameraRig:{p1:null}}),'--simular');assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/0 planos cambiarían/);assert.equal(fs.readFileSync(file,'utf8'),before);
 r=run(data,'staging','demo','--desde',patches(data,{cameraRig:{p1:{type:'fixed',start:A}},cast:{p2:['ana']}}));assert.equal(r.status,0,r.stderr);const saved=JSON.parse(fs.readFileSync(file,'utf8')).episodes[0].sequences[0].shots;assert.deepEqual(saved[0].cameraRig,{type:'fixed',start:A});assert.deepEqual(saved[1].cast,['ana']);
 r=run(data,'staging','demo','--desde',patches(data,{cameraRig:{p1:null}}));assert.equal(r.status,0,r.stderr);assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(file,'utf8')).episodes[0].sequences[0].shots[0],'cameraRig'),false);
 r=run(data,'staging','demo','--desde',patches(data,{cameraRig:[1]}));assert.equal(r.status,1);assert.match(r.stderr,/cameraRig/);
 fs.rmSync(data,{recursive:true,force:true});});

test('follow track con offset: la cámara va a actor+offset y mira al punto seguido; sin offset, como antes',()=>{const s=seq(),t=shot({staging:{moves:{ana:{kind:'walk',delta:[4,0,0]}}}}),ctx=cameraContext({shot:t,sequence:s});
 for(const time of [0,1.5,4]){const p=ctx.at('ana',time).position,c=cameraAt({type:'follow',start:A,follow:{character:'ana',mode:'track',offset:[0,.5,3],smoothing:0}},time,4,ctx);near(c.position,[p[0],1.95,p[2]+3]);near(c.target,[p[0],1.45,p[2]]);}
 const plain=cameraAt({type:'follow',start:A,follow:{character:'ana',mode:'track',smoothing:0}},4,4,ctx),d=ctx.at('ana',4).position[0]-ctx.at('ana',0).position[0];near(plain.position,[A.position[0]+d,A.position[1],A.position[2]]);near(plain.target,[A.target[0]+d,A.target[1],A.target[2]]);});

test('zum: rigFovSpan, OPTICS con zum continuo y aviso en stagingIssues; sin variación, la línea de siempre',()=>{const zoom={type:'move',start:A,end:{...A,fov:25}};
 const z=rigFovSpan(zoom,4);assert.equal(z.zoom,true);assert.equal(z.start,40);assert.equal(z.end,25);assert.equal(rigFovSpan({type:'move',start:A,end:{...A,fov:40.4}},4).zoom,false);assert.equal(rigFovSpan({type:'handheld',start:A},4).zoom,false);
 const tr={type:'track',start:A,track:[{t:0,...A},{t:1,...A,fov:50},{t:4,...A,fov:40}]};assert.deepEqual([rigFovSpan(tr,4).zoom,rigFovSpan(tr,4).max],[true,50]);
 const o=rigOpticsLine(zoom,4);assert.match(o,/^66° to 43° horizontal field of view .*one slow continuous zoom in from the first frame to the last/);assert.doesNotMatch(o,/One lens|no zoom/);assert.deepEqual(strayNegatives(o),[]);assert.match(rigOpticsLine({type:'move',start:{...A,fov:25},end:A},4),/zoom out/);
 assert.equal(rigOpticsLine({type:'fixed',start:A},4),opticsLine(40));assert.equal(rigOpticsLine(zoom,4,4,4),opticsLine(25),'tramo sin variación');
 assert.equal(line(promptOf(zoom),'OPTICS'),'OPTICS: '+rigOpticsLine(zoom,shots[first].duration,block.parts[0].from??0,block.parts[0].to));
 assert.deepEqual(stagingIssues(shot({cameraRig:zoom}),seq(),null).warnings,['p1: cameraRig: la cámara hace zum (fov vertical de 40.0° a 25.0°): OPTICS lo describe como un zum continuo']);
 assert.deepEqual(stagingIssues(shot({cameraRig:{type:'move',start:A,end:B}}),seq(),null).warnings.length,1);assert.deepEqual(stagingIssues(shot({cameraRig:{type:'move',start:A,end:{...B,fov:40}}}),seq(),null).warnings,[]);});
