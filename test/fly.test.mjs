import test from 'node:test';
import assert from 'node:assert/strict';
import {FLY_KEYS,FLY_PITCH,FLY_SPEED,FLY_FAST,FLY_TAU,FLY_MAX_DT,flyKey,flyFromCamera,flyStep,flyCamera,flyPrefs,flySpeedStep} from '../app/workflow.mjs';

const near=(a,b,eps=1e-9,msg='')=>{for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<=eps*Math.max(1,Math.abs(b[i])),`${msg} ${a} ≠ ${b}`);};
const len=v=>Math.hypot(...v);
const start=()=>flyFromCamera({position:[0,1.6,5],target:[0,1.6,0]});
const run=(s,opts,n,dt)=>{for(let i=0;i<n;i++)s=flyStep(s,opts,dt);return s;};

test('flyKey: minúsculas de las teclas de vuelo y null para el resto',()=>{
 assert.deepEqual(FLY_KEYS,['w','a','s','d','q','e','shift','arrowup','arrowdown','arrowleft','arrowright']);
 assert.equal(flyKey('W'),'w');assert.equal(flyKey('Shift'),'shift');assert.equal(flyKey('ArrowUp'),'arrowup');
 for(const k of ['x',' ','Enter',null,undefined,3,{}])assert.equal(flyKey(k),null);});

test('flyStep: flechas equivalentes a WASD; W avanza en la mirada (3D), A/D en horizontal y Q/E en la vertical del mundo',()=>{
 const pairs=[['w','arrowup'],['s','arrowdown'],['a','arrowleft'],['d','arrowright']];
 for(const [a,b] of pairs)near(run(start(),{keys:[a]},30,1/30).position,run(start(),{keys:[b]},30,1/30).position,1e-12,a);
 assert.ok(run(start(),{keys:['w']},30,1/30).position[2]<5);assert.ok(run(start(),{keys:['d']},30,1/30).position[0]>0);
 // Mirando hacia arriba: W sube, D sigue horizontal, E sube en vertical pura.
 const up=flyFromCamera({position:[0,0,0],target:[0,1,-1]}),w=run(up,{keys:['w']},10,.1).position,d=run(up,{keys:['d']},10,.1).position,e=run(up,{keys:['e']},10,.1).position,q=run(up,{keys:['q']},10,.1).position;
 assert.ok(w[1]>0&&w[2]<0);assert.ok(Math.abs(d[1])<1e-12&&d[0]>0);near([e[0],e[2]],[0,0],1e-12);assert.ok(e[1]>0);assert.ok(q[1]<0);
 near(run(up,{keys:['w','arrowup']},10,.1).position,w,1e-12,'w+flecha no suman');});

test('flyStep: Mayús (tecla o fast) multiplica la velocidad por FLY_FAST',()=>{
 const v=s=>len(s.velocity),slow=run(start(),{keys:['w'],speed:2},40,.1),fast=run(start(),{keys:['w','shift'],speed:2},40,.1),fast2=run(start(),{keys:['w'],speed:2,fast:true},40,.1);
 assert.ok(Math.abs(v(slow)-2)<1e-6);assert.ok(Math.abs(v(fast)-2*FLY_FAST)<1e-6);assert.ok(Math.abs(v(fast2)-2*FLY_FAST)<1e-6);});

test('flyStep: independiente del reparto de dt (60×1/60 = 24×1/24)',()=>{
 for(const keys of [['w'],['w','d','e'],['s','shift']]){const a=run(start(),{keys,speed:3},60,1/60),b=run(start(),{keys,speed:3},24,1/24);near(a.position,b.position,1e-9,keys);near(a.velocity,b.velocity,1e-9,keys);}
 // También frenando desde una velocidad previa.
 const moving=run(start(),{keys:['w']},10,.1);near(run(moving,{keys:[]},60,1/60).position,run(moving,{keys:[]},24,1/24).position,1e-9);});

test('flyStep: aceleración y frenada acotadas; tras soltar queda <1 % en 5τ',()=>{
 const vmax=4;let s=start();for(let i=0;i<60;i++){const dt=1/60,n=flyStep(s,{keys:['w'],speed:vmax},dt);assert.ok(len(n.velocity.map((x,j)=>x-s.velocity[j]))/dt<=vmax/FLY_TAU+1e-9);s=n;}
 assert.ok(Math.abs(len(s.velocity)-vmax)<1e-3);
 let t=s;for(let i=0;i<Math.round(5*FLY_TAU*240);i++){const n=flyStep(t,{keys:[]},1/240);assert.ok(len(n.velocity.map((x,j)=>x-t.velocity[j]))*240<=vmax/FLY_TAU+1e-9);t=n;}
 assert.ok(len(t.velocity)<.01*vmax);});

test('flyStep: dt recortado a FLY_MAX_DT y dt negativo o basura no mueve',()=>{
 assert.equal(FLY_MAX_DT,.1);near(flyStep(start(),{keys:['w']},5).position,flyStep(start(),{keys:['w']},.1).position,0);
 for(const dt of [-1,NaN,'x',undefined])assert.deepEqual(flyStep(start(),{keys:['w']},dt).position,start().position);});

test('flyStep: cabeceo limitado a ±FLY_PITCH, sin alabeo y el objetivo nunca en la vertical exacta',()=>{
 let s=start();s=flyStep(s,{look:[0,-1e6]},.016);assert.equal(s.pitch,FLY_PITCH);s=flyStep(s,{look:[0,1e6]},.016);assert.equal(s.pitch,-FLY_PITCH);
 for(const dy of [-1e6,1e6]){const c=flyCamera(flyStep(start(),{look:[0,dy]},.016),50),d=c.target.map((x,i)=>x-c.position[i]);assert.ok(Math.hypot(d[0],d[2])>.1,'no vertical');}
 // Guiñada: 0,0025 rad por píxel hacia la izquierda con dx negativo.
 assert.ok(Math.abs(flyStep(start(),{look:[-100,0]},.016).yaw-.25)<1e-12);
 // Fuera del rango (cámara importada casi vertical) no empeora, pero puede volver.
 const top=flyFromCamera({position:[0,0,0],target:[1e-4,1,0]});assert.ok(top.pitch>FLY_PITCH);assert.equal(flyStep(top,{look:[0,-50]},.016).pitch,top.pitch);assert.ok(flyStep(top,{look:[0,50]},.016).pitch<top.pitch);});

test('flyCamera(flyFromCamera(c)) reproduce la cámara; con distancia <1 m el objetivo queda a 1 m sin girar',()=>{
 const cams=[{position:[1,2,3],target:[4,1.5,-2],fov:40},{position:[0,5,0],target:[1e-6,0,1e-7],fov:30},{position:[0,0,0],target:[1e-7,3,-1e-7],fov:50},{position:[-2,1,7],target:[-2,1,1],fov:35}];
 for(const c of cams){const r=flyCamera(flyFromCamera(c),c.fov);near(r.position,c.position,1e-9);near(r.target,c.target,1e-9);assert.equal(r.fov,c.fov);}
 const c={position:[1,1,1],target:[1.3,1.4,1],fov:45},r=flyCamera(flyFromCamera(c),45),d=r.target.map((x,i)=>x-r.position[i]);
 assert.ok(Math.abs(len(d)-1)<1e-12);near(d,[.6,.8,0],1e-12);near(r.position,c.position,0);});

test('flyPrefs y flySpeedStep: basura y límites',()=>{
 for(const raw of [null,undefined,'x',42,[],{mode:'x',speed:'5'},{speed:NaN}])assert.deepEqual(flyPrefs(raw),{mode:'orbit',speed:FLY_SPEED.default});
 assert.deepEqual(flyPrefs({mode:'fly',speed:7}),{mode:'fly',speed:7});assert.deepEqual(flyPrefs({mode:'fly',speed:1e9}),{mode:'fly',speed:FLY_SPEED.max});assert.deepEqual(flyPrefs({speed:0}),{mode:'orbit',speed:FLY_SPEED.min});
 assert.ok(Math.abs(flySpeedStep(2,-120)-2.3)<1e-12);assert.ok(Math.abs(flySpeedStep(2,3)-2/1.15)<1e-12);assert.equal(flySpeedStep(2,0),2);
 assert.equal(flySpeedStep(20,-1),FLY_SPEED.max);assert.equal(flySpeedStep(.25,1),FLY_SPEED.min);assert.equal(flySpeedStep('x',-1),FLY_SPEED.default*1.15);assert.equal(flySpeedStep(2,'x'),2);});
