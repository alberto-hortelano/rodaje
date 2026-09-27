// viewer/walk.mjs en Node: colisión por rayos (suelo, muros, piezas que se saltan) y caminante (peldaños, deslizamiento, «no clip», colisión inyectable).
import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {raycastCollision,createWalker,WALK_KEYS} from '../viewer/walk.mjs';

const box=(parent,name,[x0,x1],[y0,y1],[z0,z1])=>{const m=new T.Mesh(new T.BoxGeometry(x1-x0,y1-y0,z1-z0),new T.MeshBasicMaterial());m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);m.name=name;parent.add(m);return m;};
// Suelo de 20 × 20 m con la cara de arriba en y = 0, un muro al norte (z = −5), un peldaño de 0,2 m al este y un escalón de 0,5 m al oeste.
function world(){const root=new T.Group();box(root,'suelo',[-10,10],[-0.2,0],[-10,10]);const wall=box(root,'muro',[-10,10],[0,3],[-5.2,-5]);
 box(root,'peldaño',[1,3],[0,0.2],[-1,1]);box(root,'escalón',[-3,-1],[0,0.5],[-1,1]);return {root,wall};}
const near=(a,b,eps,msg)=>assert.ok(Math.abs(a-b)<=eps,`${msg}: ${a} ≠ ${b} ± ${eps}`);

test('WALK_KEYS: las teclas del paseo',()=>{assert.deepEqual(WALK_KEYS,['w','a','s','d','q','e','shift','arrowup','arrowdown','arrowleft','arrowright']);});

test('raycastCollision: suelo por rayo y muros',()=>{const {root}=world(),c=raycastCollision(T);c.collect(root);
 near(c.groundAt(0,0,0),0,1e-6,'suelo');assert.equal(c.groundAt(50,0,50),null);near(c.groundAt(2,0,0),0.2,1e-6,'peldaño');
 assert.equal(c.blocked(new T.Vector3(0,1.62,-4),new T.Vector3(0,0,-1),1,0),true);
 assert.equal(c.blocked(new T.Vector3(0,1.62,-4),new T.Vector3(0,0,1),1,0),false);});

test('raycastCollision: skip deja pasar lo invisible y lo atravesable',()=>{
 const {root,wall}=world();wall.visible=false;const c=raycastCollision(T,{skip:q=>!q.visible});c.collect(root);
 assert.equal(c.blocked(new T.Vector3(0,1.62,-4),new T.Vector3(0,0,-1),1,0),false);
 const w2=world(),g=new T.Group();g.name='puerta';w2.root.remove(w2.wall);g.add(w2.wall);w2.root.add(g);
 const c2=raycastCollision(T,{skip:q=>q.name==='puerta'});c2.collect(w2.root);
 assert.equal(c2.blocked(new T.Vector3(0,1.62,-4),new T.Vector3(0,0,-1),1,0),false);});

test('createWalker: sube un peldaño de 0,2 m y no uno de 0,5 m',()=>{const {root}=world(),collision=raycastCollision(T);collision.collect(root);
 const cam=new T.PerspectiveCamera(),w=createWalker(T,cam,{collision});
 w.place(0,0,0);near(cam.position.y,1.62,1e-6,'ojos');w.aim(cam.position.toArray(),[10,1.62,0]);w.walk(['w'],0.6);
 assert.ok(cam.position.x>1.2&&cam.position.x<3,`sobre el peldaño: ${cam.position.x}`);near(w.floorY,0.2,1e-6,'suelo del peldaño');near(cam.position.y,1.82,1e-6,'ojos');
 w.place(0,0,0);w.aim(cam.position.toArray(),[-10,1.62,0]);w.walk(['w'],1);
 assert.ok(cam.position.x>-1,`se para antes del escalón: ${cam.position.x}`);near(w.floorY,0,1e-6,'sigue en el suelo');});

test('createWalker: en diagonal contra un muro desliza por el otro eje',()=>{const {root}=world(),collision=raycastCollision(T);collision.collect(root);
 const cam=new T.PerspectiveCamera(),w=createWalker(T,cam,{collision});w.place(5,0,-4.6);w.aim(cam.position.toArray(),[15,1.62,-14.6]);
 const [x,,z]=w.walk(['w'],0.5);assert.ok(z>-5,`no cruza el muro: ${z}`);assert.ok(x>6,`avanza por x: ${x}`);});

test('createWalker: «no clip» con E sube unos 12 m en 2 s',()=>{const cam=new T.PerspectiveCamera(),w=createWalker(T,cam,{collision:raycastCollision(T)});
 w.noclip=true;const y0=cam.position.y,[,y]=w.walk(['e'],2);near(y-y0,12,0.3,'subida');});

test('createWalker: colisión inyectable; W 1 s avanza unos 3,2 m hacia −z y suelta las teclas',()=>{const calls=[];
 const fake={collect(){},groundAt:(x,y,z)=>{calls.push('g');return 0;},blocked:()=>{calls.push('b');return false;}};
 const cam=new T.PerspectiveCamera(),w=createWalker(T,cam,{collision:fake});assert.equal(w.collision,fake);assert.equal(w.eye,1.62);
 w.place(0,0,0);const pos=w.walk(['w'],1);near(pos[2],-3.2,0.15,'z');near(pos[0],0,1e-9,'x');assert.deepEqual(pos,cam.position.toArray());
 assert.equal(w.keys.size,0);assert.ok(calls.includes('b')&&calls.includes('g'));});

test('createWalker: walkKeys por defecto y opciones de walkOptions',async()=>{const {walkOptions}=await import('../viewer/plugins.mjs');
 const fake={collect(){},groundAt:()=>0,blocked:()=>false},cam=new T.PerspectiveCamera();
 const w=createWalker(T,cam,{collision:fake,...walkOptions({walk:{eye:1.5}})});assert.equal(w.walkKeys,WALK_KEYS);assert.equal(w.eye,1.5);
 w.place(0,0,0);near(cam.position.y,1.5,1e-9,'ojos');});
