// Ensayo 3D a caballo y entorno por plano (#47): perfiles de pose, montura, pesos de clips, colocación y entorno efectivos, clave de reutilización, validación y digest.
import test from 'node:test';import assert from 'node:assert/strict';
import {poseProfile,mountRig,mountFor,mountPose,upperBodyClip,actorWeights,effectivePlacement,effectiveEnvironment,stagePoseKey,stageReuseKey,castIssues,stagingIssues,rehearsalConfig,rehearsalStageErrors,POSES,NEUTRAL_MOUNT_COLOR} from '../app/workflow.mjs';
const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} ≠ ${b}`);

test('poseProfile: de pie y sentado con las alturas de siempre; sin pose o desconocida, perfil legado',()=>{
 assert.deepEqual(poseProfile('standing'),{body:'standing',upperOnly:false,footLock:true,hipY:1,label:2.05,chest:1.38,focus:1.45});
 assert.deepEqual(poseProfile('seated'),{body:'seated',upperOnly:true,footLock:false,hipY:.6,label:1.65,chest:1.02,focus:1.2});
 for(const p of [undefined,'foo',null])assert.deepEqual(poseProfile(p),{body:'legacy',upperOnly:false,footLock:false,hipY:.6,label:2.05,chest:1.38,focus:1.45},String(p));
 assert.deepEqual(POSES,['standing','seated','mounted']);});
test('poseProfile: a caballo la cadera va a la silla, la mula es más baja y la etiqueta queda sobre la cabeza del jinete',()=>{
 const h=poseProfile('mounted',{kind:'horse'}),m=poseProfile('mounted','mule');
 assert.equal(h.body,'mounted');assert.equal(h.upperOnly,true);assert.equal(h.footLock,false);
 close(h.hipY,mountRig('horse').saddleY,.05);close(m.hipY,mountRig('mule').saddleY,.05);assert.ok(m.hipY<h.hipY);
 for(const p of [h,m]){assert.ok(p.label>p.hipY+.8,'etiqueta sobre la cabeza');assert.ok(p.chest>p.hipY&&p.chest<p.label);assert.ok(p.focus>p.chest&&p.focus<p.label);}
 assert.deepEqual(poseProfile('mounted'),h,'sin montura, caballo');});
test('mountRig: caballo de silla, mula proporcionalmente más baja, tipo desconocido = caballo; copia nueva cada vez',()=>{
 const h=mountRig('horse'),m=mountRig('mule');close(h.saddleY,1.35);close(h.legLen,.85);close(m.saddleY,1.15);
 assert.ok(m.legLen<h.legLen&&m.body[1]<=h.body[1]&&m.stride<h.stride);assert.deepEqual(mountRig('zebra'),h);assert.deepEqual(mountRig(),h);
 for(const r of [h,m]){assert.ok(r.bodyY+r.body[1]/2<r.saddleY,'el lomo queda bajo la cadera del jinete');assert.ok(r.bodyY-r.body[1]/2<r.legLen,'las patas arrancan dentro del cuerpo');assert.ok(r.legZ[0]>0&&r.legZ[1]<0);}
 h.saddleY=9;assert.equal(mountRig('horse').saddleY,1.35);});
test('mountFor: la configurada del proyecto o un caballo neutro sin configurar',()=>{
 const R=rehearsalConfig({stage:{rehearsal:{mounts:{ana:{kind:'mule',color:'#553322'},bea:{}}}}});
 assert.deepEqual(mountFor(R,'ana'),{kind:'mule',color:'#553322',configured:true});assert.deepEqual(mountFor(R,'bea'),{kind:'horse',color:NEUTRAL_MOUNT_COLOR,configured:true});
 assert.deepEqual(mountFor(R,'zoe'),{kind:'horse',color:NEUTRAL_MOUNT_COLOR,configured:false});assert.deepEqual(mountFor(null,'ana').configured,false);assert.equal(mountFor(R,'toString').configured,false);});
test('mountPose: quieta sin mover patas y respiración acotada; al paso, cuatro tiempos periódicos y deterministas',()=>{
 for(let t=0;t<20;t+=.37){const q=mountPose({time:t,seed:2});assert.deepEqual(q.legs,[0,0,0,0]);assert.ok(Math.abs(q.breathe-1)<=.01+1e-12);assert.ok(Math.abs(q.neck)<.1&&Math.abs(q.head)<.1);}
 assert.notDeepEqual(mountPose({time:3,seed:0}),mountPose({time:3,seed:1}),'la semilla desfasa a cada montura');
 const stride=mountRig().stride;
 for(let d=0;d<4;d+=.29){const a=mountPose({distance:d,moving:true}),b=mountPose({distance:d+stride,moving:true});a.legs.forEach((v,k)=>close(v,b.legs[k],1e-9));assert.deepEqual(a,mountPose({distance:d,moving:true,time:99,seed:5}),'no depende del tiempo');
  const [lf,rf,lh,rh]=a.legs;close(lf,-rf);close(lh,-rh);assert.ok(a.legs.every(v=>Math.abs(v)<=.35+1e-12));assert.equal(a.breathe,1);}
 const [lf,,lh]=mountPose({distance:stride/4,moving:true}).legs;close(lh,.35);close(lf,0,1e-12);
 assert.ok(mountPose({distance:.4,moving:true}).legs.some(v=>Math.abs(v)>.1),'en movimiento las patas se mueven');
 const mule=mountRig('mule').stride,a=mountPose({distance:.3,moving:true,stride:mule}).legs,b=mountPose({distance:.3+mule,moving:true,stride:mule}).legs;a.forEach((v,k)=>close(v,b[k]));});
test('upperBodyClip y actorWeights: sin montar como siempre; montado no anda y habla con el tren superior',()=>{
 for(const pose of [undefined,'standing','foo'])assert.equal(upperBodyClip('idle',pose),false);assert.equal(upperBodyClip('talk','standing'),true);
 for(const r of ['idle','talk','walk'])assert.equal(upperBodyClip(r,'seated'),true),assert.equal(upperBodyClip(r,'mounted'),true);
 for(const pose of [undefined,'standing','seated'])for(const walking of [false,true])for(const talking of [false,true])assert.deepEqual(actorWeights({pose,walking,talking}),[walking?0:1,!walking&&talking?.28:0,walking?1:0]);
 assert.deepEqual(actorWeights({pose:'mounted',walking:true,talking:false}),[1,0,0]);assert.deepEqual(actorWeights({pose:'mounted',walking:true,talking:true}),[1,.28,0]);assert.deepEqual(actorWeights({pose:'mounted',walking:false,talking:true}),[1,.28,0]);});
test('effectivePlacement: el plano pisa la secuencia; montura por defecto none; pose tal cual',()=>{
 const c={character:'ana',x:1,z:2,yaw:.5,pose:'mounted'},before=structuredClone(c);
 assert.deepEqual(effectivePlacement(c),{...c,mount:'none'});assert.deepEqual(effectivePlacement(c,{pose:'standing',x:3}),{character:'ana',x:3,z:2,yaw:.5,pose:'standing',mount:'none'});
 assert.deepEqual(effectivePlacement(c,{pose:'standing',mount:'led'}).mount,'led');assert.equal(effectivePlacement({character:'b',x:0,z:0,yaw:0}).pose,undefined);assert.deepEqual(effectivePlacement(c,'x'),{...c,mount:'none'});assert.deepEqual(c,before);});
test('effectiveEnvironment: sin entorno de plano, la misma referencia; mezcla superficial y state clave a clave; null borra',()=>{
 const seq={preset:'dia',spot:'plaza',state:{luz:'sol',figuras:true}};
 assert.equal(effectiveEnvironment(seq),seq);assert.equal(effectiveEnvironment(seq,null),seq);assert.equal(effectiveEnvironment(seq,'noche'),seq);assert.equal(effectiveEnvironment(undefined,undefined),undefined);
 assert.deepEqual(effectiveEnvironment(seq,{preset:'noche'}),{preset:'noche',spot:'plaza',state:{luz:'sol',figuras:true}});
 assert.deepEqual(effectiveEnvironment(seq,{state:{figuras:null,niebla:1}}),{preset:'dia',spot:'plaza',state:{luz:'sol',niebla:1}});
 assert.deepEqual(effectiveEnvironment({preset:'dia'},{spot:'x'}),{preset:'dia',spot:'x'},'sin state en ninguno, no aparece');
 assert.deepEqual(effectiveEnvironment(undefined,{state:{a:1}}),{state:{a:1}});assert.deepEqual(seq,{preset:'dia',spot:'plaza',state:{luz:'sol',figuras:true}});});
const seq=()=>({id:'s1',location:'campo',variant:'v',environment:{preset:'dia'},cast:[{character:'ana',x:0,z:0,yaw:0,pose:'mounted'},{character:'bea',x:1,z:0,yaw:0,pose:'standing'},{character:'cai',x:2,z:0,yaw:0}]});
test('stagePoseKey: solo los personajes a los que el plano cambia pose o montura',()=>{const s=seq();
 assert.equal(stagePoseKey(s,{id:'p'}),null);assert.equal(stagePoseKey(s,{staging:{placements:{ana:{x:4,pose:'mounted'},bea:{yaw:1}}}}),null);
 assert.deepEqual(stagePoseKey(s,{staging:{placements:{ana:{pose:'standing'},cai:{mount:'led'}}}}),{ana:{pose:'standing',mount:'none'},cai:{pose:null,mount:'led'}});});
test('stageReuseKey: sin datos nuevos, idéntica a la de siempre; desmontar o cambiar el entorno del plano la cambian; el mismo cambio comparte',()=>{const s=seq(),p={};
 const plain={id:'p1',staging:{placements:{bea:{x:3}}}};assert.equal(stageReuseKey(p,s,plain),JSON.stringify(['s1','campo','v',false,null]));assert.equal(stageReuseKey(p,s,{id:'p0'}),JSON.stringify(['s1','campo','v',false,null]));
 const down={id:'p2',staging:{placements:{ana:{pose:'standing'}}}},down2={id:'p3',staging:{placements:{ana:{pose:'standing',x:2}}}};
 assert.notEqual(stageReuseKey(p,s,down),stageReuseKey(p,s,plain));assert.equal(stageReuseKey(p,s,down),stageReuseKey(p,s,down2));
 const night={id:'p4',staging:{environment:{preset:'noche'}}},night2={id:'p5',staging:{environment:{preset:'noche'}}};
 assert.notEqual(stageReuseKey(p,s,night),stageReuseKey(p,s,plain));assert.equal(stageReuseKey(p,s,night),stageReuseKey(p,s,night2));assert.notEqual(stageReuseKey(p,s,night),stageReuseKey(p,s,{id:'p6',staging:{environment:{preset:'dia',state:{x:1}}}}));
 assert.deepEqual(JSON.parse(stageReuseKey(p,s,night)).at(-1),{poses:null,environment:{preset:'noche'}});});
test('castIssues: pose desconocida es error; a caballo o con montura llevada sin configurar, aviso',()=>{const s=seq();
 const R=rehearsalConfig({stage:{rehearsal:{mounts:{ana:{kind:'horse',color:'#6b4a2f'}}}}}),bare=rehearsalConfig({});
 assert.deepEqual(castIssues(s,R),{errors:[],warnings:[]});const w=castIssues(s,bare);assert.equal(w.errors.length,0);assert.equal(w.warnings.length,1);assert.match(w.warnings[0],/s1: «ana».*caballo neutro/);
 const bad=castIssues({id:'s2',cast:[{character:'x',pose:'kneeling'},{character:'y',mount:'horse'},{character:'z',mount:'led'}]},bare);
 assert.equal(bad.errors.length,2);assert.match(bad.errors[0],/pose «kneeling» de «x»/);assert.match(bad.errors[1],/mount «horse» de «y»/);assert.equal(bad.warnings.length,1);assert.match(bad.warnings[0],/«z»/);
 assert.deepEqual(castIssues({id:'s3',cast:[{character:'a'},{character:'b',pose:'seated'}]},bare),{errors:[],warnings:[]});});
test('stagingIssues: placements y environment del plano',()=>{const s=seq(),R=rehearsalConfig({stage:{rehearsal:{mounts:{ana:{}}}}});
 assert.deepEqual(stagingIssues({id:'p',staging:{placements:{ana:{pose:'standing',x:1,z:-2,yaw:.3},bea:{pose:'mounted'}},environment:{preset:'noche',spot:'puerta',rotation:90,state:{a:null}}}},s,R),{errors:[],warnings:['p: placements.bea: montura sin configurar en stage.rehearsal.mounts: caballo neutro']});
 const r=stagingIssues({id:'p',staging:{placements:{zoe:{},ana:{pose:'flying',mount:'horse',x:'1',yaw:NaN},bea:3,cai:{mount:'led'}},environment:{preset:1,spot:[],state:[],rotation:'90',time:'x'}}},s,R);
 for(const m of ['placements.zoe: «zoe» no está en el reparto','placements.ana.pose debe ser','placements.ana.mount debe ser led o none','placements.ana.x debe ser un número','placements.ana.yaw debe ser un número','placements.bea debe ser un objeto','environment.preset debe ser texto','environment.spot debe ser texto','environment.state debe ser un objeto','environment.rotation debe ser un número'])assert.ok(r.errors.some(e=>e.includes(m)),m);
 assert.equal(r.errors.length,10);assert.deepEqual(r.warnings,['p: placements.cai: montura sin configurar en stage.rehearsal.mounts: caballo neutro','p: environment.time: el entorno solo lee preset, state, spot y rotation']);
 assert.deepEqual(stagingIssues({id:'p',staging:{placements:[],environment:'noche'}},s,R).errors,['p: placements debe ser un objeto','p: environment debe ser un objeto']);});
test('rehearsalStageErrors y rehearsalConfig: mounts normalizado y validado',()=>{
 const cfg={mounts:{ana:{kind:'mule',color:'#553322'},bea:{},cai:{kind:'camel'},dan:{color:'marrón'},eva:'horse'}};
 assert.deepEqual(rehearsalConfig({stage:{rehearsal:cfg}}).mounts,{ana:{kind:'mule',color:'#553322'},bea:{kind:'horse',color:NEUTRAL_MOUNT_COLOR}});
 assert.deepEqual(rehearsalConfig({stage:{rehearsal:{mounts:[]}}}).mounts,{});
 const e=rehearsalStageErrors(cfg,{characters:['ana','bea','cai','dan']});assert.deepEqual(e,['mounts.cai.kind debe ser horse o mule','mounts.dan.color debe ser #rrggbb','mounts.eva debe ser un objeto','mounts: «eva» no es un personaje del proyecto']);
 assert.deepEqual(rehearsalStageErrors({mounts:{ana:{kind:'horse',color:'#aabbcc'}}},{characters:['ana']}),[]);assert.deepEqual(rehearsalStageErrors({mounts:[]}),['mounts debe ser un objeto']);});
test('digest: staging.environment entra en la huella solo si existe',async()=>{const m=await import('../app/store.mjs');
 const p={id:'x',style:'',language:'en',characters:[{id:'ana',name:'Ana'}],locations:[{id:'campo'}],episodes:[{id:'e',sequences:[{id:'s1',location:'campo',cast:[{character:'ana',x:0,z:0,yaw:0}],shots:[{id:'p1',title:'P',duration:5,camera:{},cameraEnd:{},lines:[]}]}]}]};
 const before=m.digest(p,'p1');const t=p.episodes[0].sequences[0].shots[0];t.staging={props:[]};assert.equal(m.digest(p,'p1'),before);
 t.staging.environment={preset:'noche'};const night=m.digest(p,'p1');assert.notEqual(night,before);t.staging.environment={preset:'dia'};assert.notEqual(m.digest(p,'p1'),night);delete t.staging.environment;assert.equal(m.digest(p,'p1'),before);});
