// Vista Animación (#50): voz del navegador por personaje, reloj y líneas, grabación y recorte de la pista, edición del rig, enlaces y fuentes.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {episodeSpeakers,ttsDefaultVoiceURI,ttsVoiceURI,ttsParams,TIMELINE_FPS,TRACK_SMOOTHING_DEFAULT,snapTime,clockTick,lineSchedule,lineToLaunch,activeLineAt,timelineMarks,roundCamera,recordSamples,trimTrack,recordedRig,rigFromShot,rigWithCamera,rigWithType,rigControls,applyShotCamera,storyboardAnimTargets,cameraAt,cameraRigIssues,patchShotField,projectChannels} from '../app/workflow.mjs';
import {validate,save,load,DATA} from '../app/store.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const A={position:[0,1.6,5],target:[0,1.4,0],fov:40},B={position:[2,2.6,3],target:[1,1.4,0],fov:60};
const near=(a,b,eps=1e-9)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=eps,`${a} ≠ ${b}`));};
const same=(c,d,eps=1e-9)=>{near(c.position,d.position,eps);near(c.target,d.target,eps);assert.ok(Math.abs(c.fov-d.fov)<=eps,`fov ${c.fov} ≠ ${d.fov}`);};

// ---- Voz del navegador
const voices=[{voiceURI:'v-es',lang:'es-ES'},{voiceURI:'v-en1',lang:'en-US'},{voiceURI:'v-en2',lang:'EN-gb'},{voiceURI:'v-eng',lang:'eng'}];
// La fórmula del Ensayo antes de #50, copiada tal cual.
const before=(voices,speakerIds,id,base)=>{const english=voices.filter(v=>new RegExp('^'+base+'\\b','i').test(v.lang));const i=speakerIds.indexOf(id);return english[i%Math.max(1,english.length)]?.voiceURI||'';};
test('ttsDefaultVoiceURI y ttsVoiceURI: la fórmula del Ensayo (3 hablantes, 2 voces); la guardada gana; vacía vuelve al defecto; sin voces ""',()=>{const ids=['ana','bea','cai'];
 assert.deepEqual(ids.map(id=>ttsDefaultVoiceURI(voices,ids,id,'en')),['v-en1','v-en2','v-en1']);for(const id of ids)assert.equal(ttsDefaultVoiceURI(voices,ids,id,'en'),before(voices,ids,id,'en'));
 assert.equal(ttsDefaultVoiceURI(voices,ids,'ana','es'),'v-es');assert.equal(ttsDefaultVoiceURI(voices,ids,'zoe','en'),'v-en1','desconocido → índice 0');
 assert.equal(ttsVoiceURI({voices,speakerIds:ids,id:'bea',saved:{bea:'v-es'},base:'en'}),'v-es');assert.equal(ttsVoiceURI({voices,speakerIds:ids,id:'bea',saved:{bea:''},base:'en'}),'v-en2');assert.equal(ttsVoiceURI({voices,speakerIds:ids,id:'bea',saved:undefined,base:'en'}),'v-en2');
 assert.equal(ttsVoiceURI({voices:[],speakerIds:ids,id:'ana',saved:{},base:'en'}),'');assert.equal(ttsDefaultVoiceURI([{voiceURI:'x',lang:'fr-FR'}],ids,'ana','en'),'');});
test('episodeSpeakers: hablantes sin repetir por primera aparición, a través de secuencias y planos',()=>{const e={sequences:[{shots:[{lines:[{character:'bea'},{character:'ana'}]},{lines:[{character:'bea'}]}]},{shots:[{lines:[]},{lines:[{character:'cai'},{character:'ana'}]}]}]};
 assert.deepEqual(episodeSpeakers(e),['bea','ana','cai']);assert.deepEqual(episodeSpeakers({sequences:[]}),[]);assert.deepEqual(episodeSpeakers(undefined),[]);});
test('ttsParams: texto hablado, idioma del proyecto, tono del personaje (1 por defecto) y velocidad',()=>{const speech={base:'en',locale:'en-GB'};
 assert.deepEqual(ttsParams({character:'pa',text:'Hola',spokenText:'Hello'},{speech,voicePitch:{pa:1.12},voiceURI:'v-en1',rate:1.1}),{text:'Hello',lang:'en-GB',pitch:1.12,rate:1.1,voiceURI:'v-en1'});
 assert.deepEqual(ttsParams({character:'ana',text:'Hi'},{speech,voicePitch:{pa:1.12},voiceURI:''}),{text:'Hi',lang:'en-GB',pitch:1,rate:1,voiceURI:''});assert.equal(ttsParams({character:'ana',text:'Hi'},{speech}).pitch,1);});

// ---- Reloj y líneas
test('snapTime: múltiplos de 1/24, dentro de [0, duración] y con 3 decimales',()=>{assert.equal(TIMELINE_FPS,24);assert.equal(snapTime(1.03,5),1.042);assert.equal(snapTime(1.02,5),1);assert.equal(snapTime(1/24*7,5),.292);assert.equal(snapTime(-3,5),0);assert.equal(snapTime(9,5),5);assert.equal(snapTime('2.5',5),2.5);assert.equal(snapTime(4.99,4.99),4.99);assert.equal(snapTime(0.03,5,10),0);});
test('clockTick: avanza; sin bucle se queda en la duración; con bucle vuelve a 0',()=>{assert.deepEqual(clockTick({time:1,duration:5,loop:false},.5),{time:1.5,ended:false,wrapped:false});
 assert.deepEqual(clockTick({time:4.9,duration:5,loop:false},.2),{time:5,ended:true,wrapped:false});assert.deepEqual(clockTick({time:4.9,duration:5,loop:true},.2),{time:0,ended:false,wrapped:true});assert.equal(clockTick({time:1,duration:5},-1).time,1);});
const lines=[{id:'l2',character:'bea',text:'Two',start:2,estimatedDuration:1.5},{id:'l0',character:'ana',text:'Zero',spokenText:'Zeró',start:0},{id:'lx',character:'ana',text:'sin inicio'},{id:'l3',character:'pa',text:'Off',start:3.5,channel:'pa'},{id:'l1',character:'ana',text:'Late',start:4.5,estimatedDuration:2}];
test('lineSchedule: ordenadas, fin acotado, texto hablado, fuera de campo y sin inicio descartadas',()=>{const S=lineSchedule(lines,5,projectChannels(null));
 assert.deepEqual(S.map(l=>l.id),['l0','l2','l3','l1']);assert.deepEqual(S.map(l=>l.end),[3,3.5,5,5]);assert.equal(S[0].text,'Zeró');assert.deepEqual(S.map(l=>l.offscreen),[false,false,true,false]);assert.deepEqual(Object.keys(S[0]),['id','character','start','end','text','offscreen']);});
test('lineToLaunch: la de 0 suena al arrancar, no se relanza, un salto grande lanza solo la última y tras el bucle vuelve la de 0',()=>{const S=lineSchedule(lines,5,projectChannels(null));
 assert.equal(lineToLaunch(S,0-1e-6,0)?.id,'l0');assert.equal(lineToLaunch(S,0,.04),null,'no se relanza');assert.equal(lineToLaunch(S,1.99,2)?.id,'l2');assert.equal(lineToLaunch(S,2,2.04),null);
 assert.equal(lineToLaunch(S,.5,4).id,'l3','salto grande: solo la última');assert.equal(lineToLaunch(S,-1e-6,0).id,'l0','tras el bucle');
 assert.equal(lineToLaunch(S,2-1e-6,2).id,'l2','arrancar en el inicio exacto de una línea');assert.equal(lineToLaunch([],0,5),null);});
test('activeLineAt y timelineMarks: la de mayor inicio en curso; marcas en %',()=>{const S=lineSchedule(lines,5,projectChannels(null));
 assert.equal(activeLineAt(S,0).id,'l0');assert.equal(activeLineAt(S,2.5).id,'l2','solapada con l0: gana la de mayor inicio');assert.equal(activeLineAt(S,3.2).id,'l2');assert.equal(activeLineAt(S,4.7).id,'l1');assert.equal(activeLineAt(lineSchedule([{id:'q',start:1,estimatedDuration:1}],5),2.5),null);assert.equal(activeLineAt(S,5),null);
 assert.deepEqual(timelineMarks(S,5),[{id:'l0',at:0,pct:0,label:'Zeró'},{id:'l2',at:2,pct:40,label:'Two'},{id:'l3',at:3.5,pct:70,label:'Off'},{id:'l1',at:4.5,pct:90,label:'Late'}]);assert.equal(timelineMarks(S,0)[1].pct,0);});

// ---- Grabación y recorte
const camAt=t=>({position:[t*1.00001,1.6,5-t/3],target:[t/2,1.4,0],fov:40+t});
function simulate(fps,duration){let track=[],time=0;const dt=1/fps;track=recordSamples(track,0,camAt(0),{duration});while(true){const r=clockTick({time,duration,loop:false},dt);time=r.time;track=recordSamples(track,time,camAt(time),{duration});if(r.ended)break;}return track;}
test('recordSamples: a 60 y a 10 fps simulados, floor(d·24)+1 muestras con t = k/24, sin pasar de la duración y sin mutar',()=>{for(const d of [5,4.125,3.3])for(const fps of [60,10]){const k=simulate(fps,d);
  assert.equal(k.length,Math.floor(d*24)+1,`${d} s a ${fps} fps`);k.forEach((s,i)=>assert.equal(s.t,Math.round(i/24*1000)/1000));assert.ok(k.at(-1).t<=d);for(let i=1;i<k.length;i++)assert.ok(k[i].t>k[i-1].t);}
 const tr=[{t:0,...A}],r=recordSamples(tr,.1,B,{duration:5});assert.equal(tr.length,1);assert.equal(r.length,3);assert.deepEqual(r[2],{t:.083,...B});assert.deepEqual(recordSamples(r,.1,A,{duration:5}),r,'nada nuevo');
 assert.deepEqual(roundCamera({position:[1.23456,0,-.0004],target:[0,0,0],fov:40.00049}),{position:[1.235,0,-0],target:[0,0,0],fov:40});});
test('trimTrack: extremos interpolados, interiores sin desplazar, sin tiempos repetidos; error si from ≥ to',()=>{const k=simulate(24,2),T=trimTrack(k,.5,1.5,{duration:2});
 assert.equal(T[0].t,.5);assert.equal(T.at(-1).t,1.5);for(let i=1;i<T.length;i++)assert.ok(T[i].t>T[i-1].t);assert.ok(T.slice(1,-1).every(s=>k.some(x=>x.t===s.t)),'interiores con su tiempo');
 const odd=trimTrack(k,.51,1.49,{duration:2});same(odd[0],roundCamera(cameraAt({type:'track',start:k[0],track:k},.51,2)));assert.equal(odd[0].t,.51);
 assert.throws(()=>trimTrack(k,1,1,{duration:2}),/inicio anterior al final/);assert.throws(()=>trimTrack(k,1.5,1,{duration:2}));const whole=trimTrack(k,0,2,{duration:2});assert.equal(whole.length,k.length);});
test('recordedRig: track válido con start en la primera muestra y suavizado por defecto',()=>{const k=simulate(30,3),r=recordedRig(k);assert.equal(TRACK_SMOOTHING_DEFAULT,.5);
 assert.deepEqual(r.start,{position:k[0].position,target:k[0].target,fov:k[0].fov});assert.equal(r.type,'track');assert.equal(r.trackSmoothing,.5);assert.notEqual(r.track,k);assert.deepEqual(cameraRigIssues(r,{duration:3}),{errors:[],warnings:[]});assert.equal(recordedRig(k,{smoothing:0}).trackSmoothing,0);});

// ---- Edición del rig
test('rigFromShot: copia del rig o fijo con t.camera, sin compartir objetos',()=>{const t={id:'p1',camera:A,duration:4},r=rigFromShot(t);assert.deepEqual(r,{type:'fixed',start:A});r.start.position[0]=9;assert.equal(A.position[0],0);assert.equal(t.cameraRig,undefined);
 const w={camera:A,cameraRig:{type:'move',start:A,end:B}},c=rigFromShot(w);assert.deepEqual(c,w.cameraRig);assert.notEqual(c,w.cameraRig);});
test('rigWithCamera: inicio en todos menos track; fin: fijo → move smooth, move y handheld lo aceptan, follow y track no',()=>{const fixed={type:'fixed',start:A};
 assert.deepEqual(rigWithCamera(fixed,'start',B).rig,{type:'fixed',start:B});assert.deepEqual(rigWithCamera(fixed,'end',B).rig,{type:'move',start:A,end:B,easing:'smooth'});assert.deepEqual(fixed,{type:'fixed',start:A});
 assert.deepEqual(rigWithCamera({type:'move',start:A,end:A,easing:'linear'},'end',B).rig,{type:'move',start:A,end:B,easing:'linear'});assert.deepEqual(rigWithCamera({type:'handheld',start:A,shake:.1},'end',B).rig,{type:'handheld',start:A,shake:.1,end:B});
 const f={type:'follow',start:A,follow:{character:'ana',mode:'look'}};assert.deepEqual(rigWithCamera(f,'start',B).rig.start,B);assert.ok(rigWithCamera(f,'end',B).error);
 const tr={type:'track',start:A,track:[{t:0,...A}]};assert.ok(rigWithCamera(tr,'start',B).error);assert.ok(rigWithCamera(tr,'end',B).error);assert.ok(rigWithCamera(fixed,'medio',B).error);
 const r=rigWithCamera(fixed,'start',B).rig;r.start.position[0]=7;assert.equal(B.position[0],2);});
test('rigWithType: conserva start y quita lo que el tipo no usa',()=>{const move={type:'move',start:A,end:B,easing:'ease-in',hold:[.2,.8]};
 assert.deepEqual(rigWithType(move,'fixed').rig,{type:'fixed',start:A});assert.deepEqual(rigWithType({type:'fixed',start:A},'move').rig,{type:'move',start:A,end:A});
 assert.deepEqual(rigWithType(move,'follow',{positioned:['bea','ana']}).rig,{type:'follow',start:A,follow:{character:'bea',mode:'look',smoothing:.5}});assert.ok(rigWithType(move,'follow').error);
 assert.deepEqual(rigWithType(move,'track').rig,{type:'track',start:A,track:[{t:0,...A}],trackSmoothing:.5});assert.deepEqual(rigWithType(move,'handheld').rig,{type:'handheld',start:A,end:B,easing:'ease-in',hold:[.2,.8],shake:.03});
 assert.deepEqual(rigWithType({type:'handheld',start:A,shake:.2,seed:4},'move').rig,{type:'move',start:A,end:A});assert.deepEqual(rigWithType({type:'track',start:A,track:[{t:0,...A}],trackSmoothing:.3},'fixed').rig,{type:'fixed',start:A});
 assert.ok(rigWithType(move,'zoom').error);const same=rigWithType(move,'move').rig;assert.deepEqual(same,move);assert.notEqual(same,move);
 for(const type of ['fixed','move','track','handheld'])assert.deepEqual(cameraRigIssues(rigWithType(move,type).rig,{duration:4}).errors,[],type);});
test('rigControls: controles por tipo',()=>{const off={end:false,easing:false,hold:false,follow:false,trackSmoothing:false,trim:false,shake:false};
 assert.deepEqual(rigControls('fixed'),off);assert.deepEqual(rigControls('move'),{...off,end:true,easing:true,hold:true});assert.deepEqual(rigControls('handheld'),{...off,end:true,easing:true,hold:true,shake:true});assert.deepEqual(rigControls('follow'),{...off,follow:true});assert.deepEqual(rigControls('track'),{...off,trackSmoothing:true,trim:true});});
test('applyShotCamera: sin rig, camera/cameraEnd como siempre; con rig, también start/end; follow sin fin; track remite a Animación',()=>{const t={id:'p1',camera:A,cameraEnd:A,duration:4};
 const s=applyShotCamera(t,'end',B).shot;assert.deepEqual(s.cameraEnd,B);assert.deepEqual(s.camera,A);assert.equal(s.cameraRig,undefined);assert.deepEqual(t.cameraEnd,A,'no muta');assert.deepEqual(applyShotCamera(t,'start',B).shot.camera,B);
 const fx=applyShotCamera({...t,cameraRig:{type:'fixed',start:A}},'end',B).shot;assert.deepEqual(fx.cameraRig,{type:'move',start:A,end:B,easing:'smooth'});assert.deepEqual(fx.cameraEnd,B);
 const mv=applyShotCamera({...t,cameraRig:{type:'move',start:A,end:A}},'start',B).shot;assert.deepEqual(mv.cameraRig.start,B);assert.deepEqual(mv.camera,B);
 const f={...t,cameraRig:{type:'follow',start:A,follow:{character:'ana'}}};assert.deepEqual(applyShotCamera(f,'start',B).shot.cameraRig.start,B);const fe=applyShotCamera(f,'end',B);assert.ok(fe.error);assert.equal(fe.anim,true);
 const tr={...t,cameraRig:{type:'track',start:A,track:[{t:0,...A}]}};for(const w of ['start','end']){const r=applyShotCamera(tr,w,B);assert.equal(r.anim,true);assert.ok(r.error);assert.equal(r.shot,undefined);}});
test('storyboardAnimTargets: ninguno, uno y dos planos enlazados a la viñeta',()=>{const p={episodes:[{id:'e1',sequences:[{id:'s1',shots:[{id:'a',storyboardShot:'v1'},{id:'b',storyboardShot:'v2'}]}]},{id:'e2',sequences:[{id:'s2',shots:[{id:'c',storyboardShot:'v2'}]}]}]};
 assert.deepEqual(storyboardAnimTargets(p,'v0'),[]);assert.deepEqual(storyboardAnimTargets(p,'v1'),[{episode:'e1',sequence:'s1',shot:'a'}]);assert.deepEqual(storyboardAnimTargets(p,'v2'),[{episode:'e1',sequence:'s1',shot:'b'},{episode:'e2',sequence:'s2',shot:'c'}]);assert.deepEqual(storyboardAnimTargets({},'v1'),[]);});

// ---- Ida y vuelta: pista sintética → recorte → rig → proyecto → validate, JSON, store.save y planificar.mjs.
const shot=(extra={})=>({id:'p1',title:'P1',description:'',duration:4,camera:A,cameraEnd:A,lines:[{id:'l1',character:'ana',text:'Hello there.',start:.5,estimatedDuration:1.5,channel:'direct'}],...extra});
const project=()=>({id:'anim-demo',name:'Demo',type:'serie',language:'en',ideas:[],characters:[{id:'ana',name:'Ana',description:''},{id:'bea',name:'Bea',description:''}],locations:[],revision:0,episodes:[{id:'e1',title:'E1',synopsis:'',sequences:[{id:'s1',title:'S1',location:'',cast:[{character:'ana',x:0,z:0,yaw:0,pose:'standing'},{character:'bea',x:1,z:0,yaw:0,pose:'standing'}],shots:[shot(),shot({id:'p2'})]}]}]});
test('ida y vuelta: la pista recortada se guarda, se valida y planificar.mjs la congela igual en el lote',()=>{const d=4,k=simulate(24,d),rig=recordedRig(trimTrack(k,.25,3.5,{duration:d}));
 const {project:p,changed}=patchShotField(project(),'cameraRig',{p1:rig});assert.deepEqual(changed,['p1']);assert.doesNotThrow(()=>validate(p));const back=JSON.parse(JSON.stringify(p)).episodes[0].sequences[0].shots[0].cameraRig;assert.deepEqual(back,rig);
 for(const t of [0,d/2,d])same(cameraAt(back,t,d),cameraAt(rig,t,d),0);assert.equal(p.episodes[0].sequences[0].shots[1].cameraRig,undefined);
 save(p);assert.deepEqual(load('anim-demo').episodes[0].sequences[0].shots[0].cameraRig,rig);
 const r=spawnSync(process.execPath,[path.join(ROOT,'scripts/bloques/planificar.mjs'),'lote-anim','e1','s1','--project','anim-demo'],{cwd:ROOT,encoding:'utf8',timeout:30000,env:{...process.env,RODAJE_DATA:DATA,RODAJE_PROJECT:''}});assert.equal(r.status,0,r.stderr);
 const snap=JSON.parse(fs.readFileSync(path.join(DATA,'anim-demo','assets','lote-anim','project-snapshot.json'),'utf8'));const t=snap.episodes[0].sequences[0].shots[0];assert.deepEqual(t.cameraRig,rig);for(const x of [0,d/2,d])same(cameraAt(t.cameraRig,x,d),cameraAt(rig,x,d),0);});

// ---- Fuentes de la interfaz
test('anim.source.js usa cameraAt, cameraContext, pose sin cámara y orbit; Ensayo y Animación comparten la voz; stage.js expone orbit',()=>{const anim=src('app/anim.source.js'),reh=src('app/rehearsal.source.js'),stage=src('app/stage.js');
 for(const x of ['cameraAt(','cameraContext(','.orbit(','recordSamples(','shotRigIssues(','stageSequence(','anim3dButton('])assert.ok(anim.includes(x),x);assert.match(anim,/stage\.pose\(time,false\)/);assert.doesNotMatch(anim,/stage\.pose\([^)]*,true\)|stage\.pose\(time\)/);
 for(const f of [anim,reh]){assert.match(f,/import \{[^}]*\bttsVoiceURI\b[^}]*\} from '\.\/workflow\.mjs'/);assert.match(f,/import \{[^}]*\bttsParams\b[^}]*\} from '\.\/workflow\.mjs'/);assert.match(f,/from '\.\/tts\.source\.js'/);}
 assert.doesNotMatch(reh,/localStorage|english\[/,'el Ensayo ya no calcula voces ni preferencias por su cuenta');assert.match(stage,/orbit\(on\)\{controls\.enabled=!!on;\}/);
 const app=src('app/app.source.js');assert.match(app,/import \{mountAnim\} from '\.\/anim\.source\.js'/);assert.match(app,/applyShotCamera\(t,/);assert.match(app,/'montaje','anim'\]\.includes\(routeView/);});
