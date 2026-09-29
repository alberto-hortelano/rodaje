// Suelo del entorno en el ensayo (#53): actorPositionAt y cameraContext con ground, rejilla groundGrid, sonda floorProbe, validación de placements.y y huella.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {actorPositionAt,cameraContext,cameraAt,groundGrid,warmGround,stagingIssues} from '../app/workflow.mjs';
import {floorProbe,isFloorName} from '../viewer/walk.mjs';
import {digest} from '../app/store.mjs';

const near=(a,b,eps,msg='')=>assert.ok(Math.abs(a-b)<=eps,`${msg} ${a} ≠ ${b} ± ${eps}`);
const slope=(x,z)=>.2*x;
const spy=fn=>{const g=(...a)=>{g.calls++;return fn(...a);};g.calls=0;return g;};

test('actorPositionAt sin ground: igual que antes (y = delta[1]·k)',()=>{const pl={x:1,z:-2,yaw:.3};
 assert.deepEqual(actorPositionAt(pl,undefined,1,4),{position:[1,0,-2],yaw:.3});
 for(const kind of ['walk','glide-in','glide-out','turn'])for(const time of [0,1,2,4]){const move={kind,delta:[2,.5,-1]},r=actorPositionAt(pl,move,time,4),f=time/4,k=kind==='glide-out'?f:f-1;
  assert.deepEqual(r.position,[1+2*k,.5*k,-2-k],kind+' '+time);}
 assert.deepEqual(actorPositionAt(pl,{kind:'walk',delta:[1,0,0]},2,4,null),actorPositionAt(pl,{kind:'walk',delta:[1,0,0]},2,4));});

test('actorPositionAt con ground: la altura del terreno en la x, z del instante',()=>{
 near(actorPositionAt({x:3,z:0,yaw:0},undefined,0,4,slope).position[1],.6,1e-12,'quieto en x=3');
 const walk={kind:'walk',delta:[4,0,0]},mid=actorPositionAt({x:4,z:0,yaw:0},walk,2,4,slope).position;
 assert.equal(mid[0],2);near(mid[1],.4,1e-12,'a mitad');
 near(actorPositionAt({x:4,z:0,yaw:0},{kind:'walk',delta:[4,.5,0]},4,4,slope).position[1],.8,1e-12,'delta[1] al final (k=0)');
 near(actorPositionAt({x:4,z:0,yaw:0},{kind:'glide-out',delta:[0,.5,0]},4,4,slope).position[1],.8+.5,1e-12,'delta[1] se suma');
 const g=spy(slope);assert.equal(actorPositionAt({x:3,y:1.25,z:0,yaw:0},walk,1,4,g).position[1],1.25);assert.equal(g.calls,0,'y explícita manda');
 near(actorPositionAt({x:3,z:0,yaw:0},undefined,0,4,()=>null).position[1],0,0,'sin suelo, 0');});

const shot=extra=>({id:'p1',duration:4,staging:{moves:{ana:{kind:'walk',delta:[4,0,0]}},proxies:{dan:{x:5,z:-1}}},...extra});
const sequence={id:'s1',cast:[{character:'ana',x:4,z:0,yaw:0,pose:'standing'}]};

test('cameraContext con ground: actores y proxies a la altura del suelo; follow sube el target',()=>{
 const flat=cameraContext({shot:shot(),sequence}),hill=cameraContext({shot:shot(),sequence,ground:slope});
 assert.equal(flat.at('ana',4).position[1],0);assert.equal(flat.at('dan',0).position[1],0);
 near(hill.at('ana',4).position[1],.8,1e-12,'actor');near(hill.at('ana',2).position[1],.4,1e-12,'actor a mitad');near(hill.at('dan',0).position[1],1,1e-12,'proxy');
 const rig={type:'follow',start:{position:[0,1.6,6],target:[0,1.4,0],fov:40},follow:{character:'ana',mode:'pan',smoothing:0}};
 const a=cameraAt(rig,4,4,flat),b=cameraAt(rig,4,4,hill);near(b.target[1]-a.target[1],.8,1e-9,'target');assert.deepEqual(a,cameraAt(rig,4,4,cameraContext({shot:shot(),sequence,ground:null})));});

test('groundGrid: plano inclinado con error < 1 mm, memoria de esquinas y null sin suelo',()=>{
 const probe=spy((x,z)=>.3*x-.15*z+1),g=groundGrid(probe);
 const pts=Array.from({length:50},(_,i)=>[Math.sin(i*1.7)*6,Math.cos(i*2.3)*6]);
 for(const [x,z] of pts)near(g(x,z),.3*x-.15*z+1,1e-3,`(${x}, ${z})`);
 const n=g.probes;assert.equal(n,probe.calls);for(const [x,z] of pts)g(x,z);assert.equal(g.probes,n,'segunda pasada sin rayos');
 const none=groundGrid(()=>null);assert.equal(none(1.23,4.56),null);assert.equal(none.probes,4);
 const half=groundGrid((x)=>x<0.05?null:2);assert.equal(half(.02,0),2,'esquina sin suelo ignorada');});

// Suelo a y=0, suelo-sala a y=2,2 encima (planta alta), tejado a 5, rampa de 3 m sobre el origen lejos de la sala, y un grupo suelo-bodega con un hijo sin nombre.
const slab=(parent,name,[x0,x1],y,[z0,z1],t=.1)=>{const m=new T.Mesh(new T.BoxGeometry(x1-x0,t,z1-z0),new T.MeshBasicMaterial());m.position.set((x0+x1)/2,y-t/2,(z0+z1)/2);m.name=name;parent.add(m);return m;};
function world(){const root=new T.Group();root.name='entorno';const model=new T.Group();root.add(model);
 slab(model,'suelo',[-10,10],0,[-10,10]);slab(model,'suelo-sala',[-2,2],2.2,[-2,2]);slab(model,'tejado',[-3,3],5,[-3,3]);
 slab(model,'suelo-rampa',[20,22],3,[-1,1]);slab(model,'figura',[-8,-7],1.8,[-8,-7]);
 const cellar=new T.Group();cellar.name='suelo-bodega';cellar.position.set(30,-3,0);model.add(cellar);slab(cellar,'',[-1,1],0,[-1,1]);
 root.position.set(1,0,0);root.updateMatrixWorld(true);return root;}

test('floorProbe: suelos por nombre, varios niveles con yRef, segundo rayo y coordenadas del mundo',()=>{
 assert.ok(isFloorName('suelo')&&isFloorName('suelo-sala')&&!isFloorName('tejado')&&!isFloorName('figura'));
 const probe=floorProbe(T,world());
 near(probe(1,0,0),0,1e-9,'planta baja bajo la sala');near(probe(1,0,2.2),2.2,1e-9,'planta alta');
 near(probe(3.5,0,4),0,1e-9,'tejado ignorado (el primer rayo sale de 5,5)');near(probe(-6.5,-7.5,1),0,1e-9,'figura ignorada');
 near(probe(22,0,0),3,1e-9,'rampa de 3 m con el segundo rayo');near(probe(31,0,0),-3,1e-9,'hijo sin nombre de suelo-bodega');
 assert.equal(probe(100,100,0),null);
 near(probe(10.5,0,0),0,1e-9,'coordenadas del mundo: root desplazado 1 m');assert.equal(probe(-9.5,0,0),null);});

test('floorProbe + groundGrid + actorPositionAt: el actor pisa la rampa',()=>{const g=groundGrid(floorProbe(T,world()));
 near(actorPositionAt({x:22,z:0,yaw:0},undefined,0,4,g).position[1],3,1e-9);});

test('stagingIssues: placements.y numérica sí, texto no',()=>{const seq={id:'s',cast:[{character:'ana',x:0,z:0,yaw:0}]},sh=y=>({id:'p',duration:4,staging:{placements:{ana:{y}}}});
 assert.deepEqual(stagingIssues(sh(1.5),seq,null).errors,[]);assert.ok(stagingIssues(sh('alto'),seq,null).errors.some(e=>/placements\.ana\.y debe ser un número/.test(e)));});

test('digest: sin entorno ni con entorno inexistente no cambia; con entorno construible sí (ground)',()=>{const cam={position:[0,1.6,0],target:[0,1.2,-5],fov:50};
 const p=env=>({id:'suelo-huella',style:'x',language:'en',characters:[{id:'ana',name:'Ana'}],locations:[{id:'patio',name:'Patio',...(env?{environment:env}:{})}],environments:[{id:'nave',version:1,builder:'no/nave.js',data:'no/model.json'}],episodes:[{id:'e1',sequences:[{id:'s1',location:'patio',cast:[{character:'ana',x:0,z:-3,yaw:0}],shots:[{id:'p1',title:'p1',duration:4,camera:cam,cameraEnd:cam,lines:[]}]}]}]});
 // Huellas de antes de #53 (HEAD 5a1d570) para el mismo plano.
 assert.equal(digest(p(null),'p1'),'cfb9a94089f962ffde87c8035254757ac87bdb90f77bf032fb2bbc84e327c1be');
 assert.equal(digest(p('no-existe'),'p1'),'1fc0bf3463843fe5734557c656ce18b16f63acfa3c43376df7b65ebe01067cda');
 assert.notEqual(digest(p('nave'),'p1'),'459a2cec7f63e4576bd18b36c67123a1e5d461d990da65472e64b6d21d441e10');});

test('floorProbe: las mismas alturas que el Raycaster en un terreno ondulado con varios niveles',()=>{
 const root=new T.Group(),geo=new T.PlaneGeometry(40,40,57,43);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++)pos.setY(i,Math.sin(pos.getX(i)*.37)*2+Math.cos(pos.getZ(i)*.23)*1.5);
 const hill=new T.Mesh(geo,new T.MeshBasicMaterial());hill.name='suelo-cerro';hill.position.set(3,.5,-2);hill.rotation.y=.4;root.add(hill);
 const deck=new T.Group();deck.name='suelo-planta';deck.position.set(0,4,0);root.add(deck);slab(deck,'',[-5,5],0,[-5,5]);slab(root,'tejado',[-6,6],7,[-6,6]);
 const two=new T.Mesh(new T.PlaneGeometry(6,6),new T.MeshBasicMaterial({side:T.DoubleSide}));two.name='suelo-pasarela';two.rotation.x=Math.PI/2;two.position.set(12,9,0);root.add(two);
 root.updateMatrixWorld(true);const probe=floorProbe(T,root),floors=[];root.traverse(o=>{if(o.isMesh&&o.name!=='tejado')floors.push(o);});const ray=new T.Raycaster();
 const cast=(x,y,z,far)=>{ray.set(new T.Vector3(x,y,z),new T.Vector3(0,-1,0));ray.near=0;ray.far=far;return ray.intersectObjects(floors,false)[0]?.point.y??null;};
 const reference=(x,z,yRef)=>cast(x,yRef+1.5,z,80)??cast(x,yRef+60,z,58.5);
 let n=0;for(let i=0;i<400;i++){const x=Math.sin(i*1.3)*19,z=Math.cos(i*.7)*19,yRef=[0,4,9,-3][i%4],a=probe(x,z,yRef),b=reference(x,z,yRef);
  if(b===null)assert.equal(a,null,`(${x}, ${z}, ${yRef})`);else{near(a,b,1e-6,`(${x}, ${z}, ${yRef})`);n++;}}
 assert.ok(n>200,`${n} puntos con suelo`);assert.ok(probe.triangles>4900,String(probe.triangles));});

test('warmGround: tras calentar un walk largo, la reproducción a 24 fps no pregunta de nuevo; los proxies también se calientan',()=>{
 const probe=spy((x,z)=>Math.sin(x*.3)+z*.1),g=groundGrid(probe),sh={id:'p',duration:10,staging:{moves:{ana:{kind:'walk',delta:[14.6,0,-4]}},proxies:{dan:{x:7.3,z:-1.1}}}},pls=[{character:'ana',x:0,z:0,yaw:0},{character:'bea',x:3,z:2,yaw:0}];
 warmGround(g,{shot:sh,placements:pls});const n=g.probes;assert.ok(n>0);
 for(const pl of pls)for(let i=0;i<=240;i++)actorPositionAt(pl,sh.staging.moves[pl.character],i/24,10,g);assert.equal(g.probes,n,'24 fps');
 const ctx=cameraContext({shot:sh,sequence:{cast:pls},ground:g});ctx.at('dan',0);assert.equal(g.probes,n,'proxy');
 warmGround(null,{shot:sh,placements:pls});assert.equal(probe.calls,n);});

test('vista Animación: usa el contexto de cámara del stage (con suelo), no construye el suyo',()=>{const src=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),anim=src('app/anim.source.js'),stage=src('app/stage.js');
 assert.doesNotMatch(anim,/cameraContext\(\{/);assert.equal(anim.match(/ctx=stage\.cameraContext\(\)/g)?.length,2,'tras createStage y tras updateShot');
 assert.match(anim,/stage\.updateShot\(t\);ctx=stage\.cameraContext\(\)/);assert.match(stage,/cameraContext\(\)\{return rigContext;\}/);assert.match(stage,/rigContext=cameraContext\(\{shot:t,sequence:s,R,ground\}\)/);});
