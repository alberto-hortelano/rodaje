import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import * as T from 'three';
const {DATA}=await import('../app/store.mjs');const e3=await import('../lib/entorno3d.mjs');
const id='e3d-'+process.pid,base=path.join(DATA,id);
const builder=`export function build(T,data,{state}={}){const root=new T.Group();root.name='caja-raiz';for(const b of [...data.boxes,...(state?.extra||[])]){const m=new T.Mesh(new T.BoxGeometry(...b.size),new T.MeshBasicMaterial());m.name=b.name;m.position.set(...b.pos);root.add(m);}return root;}\n`;
// Dos cajas separadas en el estado por defecto; el preset añade una que comparte la cara x+ de «a».
const model={boxes:[{name:'a',pos:[0,1,0],size:[1,1,1]},{name:'b',pos:[3,1,0],size:[1,1,1]}],presets:[{id:'pegada',state:{extra:[{name:'c',pos:[0,1,0.2],size:[1,1,1]}]}}]};
fs.mkdirSync(path.join(base,'3d'),{recursive:true});fs.writeFileSync(path.join(base,'3d/b.js'),builder);fs.writeFileSync(path.join(base,'3d/m.json'),JSON.stringify(model));
fs.writeFileSync(path.join(base,'3d/roto.js'),'export const build = ;\n');
// Constructor que exige un kit: grupo y caja del kit, y deja en userData lo que ha recibido.
fs.writeFileSync(path.join(base,'3d/kit.js'),`export function build(T,data,kit){if(!kit?.isKit)throw Error('sin kit');const root=kit.group('raiz');kit.box(root,'a',[0,1],[0,1],[0,1],'#ffffff');root.userData={state:kit.state,textures:kit.textures,tile:kit.tile};return root;}\n`);
fs.writeFileSync(path.join(base,'proyecto.json'),JSON.stringify({id,name:'Entornos',type:'serie',ideas:[],characters:[],locations:[],episodes:[],environments:[{id:'caja',builder:'3d/b.js',data:'3d/m.json'},{id:'solo-glb',glb:'x.glb'},{id:'sin-datos',builder:'3d/b.js'},{id:'roto',builder:'3d/roto.js',data:'3d/m.json'},{id:'kit',builder:'3d/kit.js',data:'3d/m.json'}]}));
const box=(name,pos,size=[1,1,1])=>{const m=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial());m.name=name;m.position.set(...pos);return m;};
const group=(...ms)=>{const g=new T.Group();g.add(...ms);return g;};
const files=()=>fs.readdirSync(base,{recursive:true}).sort();

test('descubre solo los entornos con constructor y datos',()=>{assert.ok(e3.projectIds().includes(id));assert.deepEqual(e3.environmentsWithBuilder().filter(x=>x.projectId===id),[{projectId:id,envId:'caja'},{projectId:id,envId:'roto'},{projectId:id,envId:'kit'}]);});
test('loadEnvironment da errores claros',async()=>{await assert.rejects(e3.loadEnvironment(id,'nada'),/Entorno no encontrado: nada/);await assert.rejects(e3.loadEnvironment(id,'solo-glb'),/no tiene constructor/);await assert.rejects(e3.loadEnvironment(id,'sin-datos'),/no tiene constructor/);const ctx=await e3.loadEnvironment(id,'caja');assert.equal(ctx.env.id,'caja');assert.equal(ctx.base,base);assert.equal(typeof ctx.build,'function');assert.equal(ctx.data.boxes.length,2);});
test('exportGlb devuelve un GLB estable sin escribir en disco',async()=>{const ctx=await e3.loadEnvironment(id,'caja'),before=files();const a=await e3.exportGlb(e3.buildEnvironment(ctx,{textures:false}),{quiet:true});const b=await e3.exportGlb(e3.buildEnvironment(ctx,{textures:false}));assert.equal(a.buffer.subarray(0,4).toString(),'glTF');assert.equal(a.meshes,2);assert.equal(a.bytes,a.buffer.length);assert.match(a.sha256,/^[0-9a-f]{64}$/);assert.equal(a.sha256,b.sha256);const c=await e3.exportGlb(e3.buildEnvironment(ctx,{state:ctx.data.presets[0].state}),{quiet:true});assert.equal(c.meshes,3);assert.notEqual(c.sha256,a.sha256);assert.deepEqual(files(),before);});
test('buildEnvironment pasa un kit nuevo con el estado y sin texturas',async()=>{const ctx=await e3.loadEnvironment(id,'kit');
 const a=e3.buildEnvironment(ctx,{state:{x:1}}),b=e3.buildEnvironment(ctx);assert.equal(a.name,'raiz');assert.deepEqual(a.userData,{state:{x:1},textures:false,tile:2});assert.deepEqual(b.userData.state,{});assert.equal(b.userData.textures,false);
 assert.notEqual(a.getObjectByName('a').material,b.getObjectByName('a').material);});
test('quiet silencia console.warn solo durante la exportación',async()=>{const warn=console.warn;await e3.exportGlb(group(box('a',[0,1,0])),{quiet:true});assert.equal(console.warn,warn);});
test('coplanarPairs detecta caras solapadas y respeta el suelo',()=>{const pegadas=e3.coplanarPairs(group(box('a',[0,1,0]),box('b',[0,1,0.5])));assert.ok(pegadas.size>=1);assert.ok([...pegadas.keys()].every(k=>k.startsWith('a ↔ b (')));
 const cara=e3.coplanarPairs(group(box('a',[0,1,0]),box('b',[0.5,0.5,0.5],[1,2,1])));assert.deepEqual([...cara.keys()],['a ↔ b (y+ 1.50)']);
 assert.equal(e3.coplanarPairs(group(box('a',[0,1,0]),box('b',[3,1,0]))).size,0);
 assert.equal(e3.coplanarPairs(group(box('a',[0,0.5,0]),box('b',[0.5,1,0.5],[1,2,1]))).size,0);assert.deepEqual([...e3.coplanarPairs(group(box('a',[0,1.5,0]),box('b',[0.5,2,0.5],[1,2,1]))).keys()],['a ↔ b (y− 1.00)']);});
test('coplanarReport suma defecto y presets con --todos',async()=>{const ctx=await e3.loadEnvironment(id,'caja');const r=e3.coplanarReport(ctx,'--todos');assert.deepEqual(r.porPreset,{defecto:0,pegada:e3.coplanarReport(ctx,'pegada').total});assert.ok(r.porPreset.pegada>0);assert.equal(r.total,r.porPreset.defecto+r.porPreset.pegada);assert.deepEqual([...r.pares.keys()],['defecto','pegada']);assert.deepEqual(e3.coplanarReport(ctx).porPreset,{defecto:0});assert.throws(()=>e3.coplanarReport(ctx,'otro'),/Preset no encontrado: otro/);});
test('environmentData lee los datos sin importar el constructor',async()=>{const ctx=e3.environmentData(id,'roto');assert.equal(ctx.base,base);assert.equal(ctx.env.id,'roto');assert.equal(ctx.data.boxes.length,2);assert.equal(ctx.build,undefined);await assert.rejects(e3.loadEnvironment(id,'roto'));assert.throws(()=>e3.environmentData(id,'nada'),/Entorno no encontrado: nada/);assert.throws(()=>e3.environmentData(id,'solo-glb'),/no tiene constructor/);});
test('walkthroughSteps valida y normaliza el recorrido',()=>{
 for(const d of [{},{walkthrough:[]},{walkthrough:{}},null])assert.throws(()=>e3.walkthroughSteps(d),/El entorno no tiene recorrido \(walkthrough en sus datos\)/);
 const steps=e3.walkthroughSteps({walkthrough:[{label:'a',walk:true,view:'v',snapshot:'s-1'},{label:'b',view:'v',position:[1,2,3],keys:['w'],seconds:4},{label:'c',noclip:true,keys:['e'],seconds:2,extra:1}]});
 assert.deepEqual(steps,[{label:'a',walk:true,view:'v',snapshot:'s-1'},{label:'b',view:'v',position:[1,2,3],yawDeg:0,keys:['w'],seconds:4},{label:'c',noclip:true,keys:['e'],seconds:2}]);
 const bad=[{},{label:''},{label:'x',keys:['w']},{label:'x',keys:['w'],seconds:0},{label:'x',keys:[],seconds:1},{label:'x',seconds:1},{label:'x',position:[1,2]},{label:'x',position:[1,'2',3]},{label:'x',yawDeg:90},{label:'x',snapshot:'../x'},{label:'x',view:3}];
 for(const s of bad)assert.throws(()=>e3.walkthroughSteps({walkthrough:[s]}),/Paso 1 del recorrido/,JSON.stringify(s));});
test('captureSetup: valores por defecto y los de data.capture',()=>{
 assert.deepEqual(e3.captureSetup({},'caja'),{root:'caja',group:undefined,keep:[],fog:true});
 assert.deepEqual(e3.captureSetup({capture:{root:'r',group:'g',keep:['k'],fog:false}},'caja'),{root:'r',group:'g',keep:['k'],fog:false});
 assert.equal(e3.captureSetup({capture:{fog:null}},'caja').fog,true);});

// Extras de los nodos del GLB (su JSON va tras la cabecera de 20 bytes).
const gltfJson=buf=>JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString('utf8'));
test('exportGlb deja en el GLB solo las claves de GLB_USERDATA de la raíz',async()=>{
 const hijo=box('hijo',[0,1,0]);hijo.userData={ship:{y:2}};const root=group(hijo);root.name='raiz';root.userData={state:{a:1},units:'metres',ship:{x:[1]}};
 const j=gltfJson((await e3.exportGlb(root,{quiet:true})).buffer),n=j.nodes.find(x=>x.name==='raiz'),h=j.nodes.find(x=>x.name==='hijo');
 assert.deepEqual(n.extras,{state:{a:1},units:'metres'});assert.deepEqual(Object.keys(n.extras),['state','units']);assert.deepEqual(h.extras,{ship:{y:2}});
 assert.deepEqual(root.userData,{state:{a:1},units:'metres',ship:{x:[1]}});
 const solo=group(box('a',[0,1,0]));solo.name='solo';solo.userData={ship:1};const j2=gltfJson((await e3.exportGlb(solo,{quiet:true})).buffer);assert.equal(j2.nodes.find(x=>x.name==='solo').extras,undefined);});
test('walkthroughSteps: call, args, expect y tolerance',()=>{
 assert.deepEqual(e3.walkthroughSteps({walkthrough:[{label:'a',call:'navigationState',expect:{mode:'inside'}},{label:'b',call:'setPlace',args:['x',1],expect:[1,2],tolerance:0.1},{label:'c',call:'$pos'}]}),
  [{label:'a',call:'navigationState',expect:{mode:'inside'}},{label:'b',call:'setPlace',args:['x',1],expect:[1,2],tolerance:0.1},{label:'c',call:'$pos'}]);
 assert.deepEqual(e3.walkthroughSteps({walkthrough:[{label:'d',expect:null}]}),[{label:'d',expect:null}]);
 for(const s of [{label:'x',call:'a.b'},{label:'x',call:'dispose'},{label:'x',call:'1a'},{label:'x',call:3},{label:'x',args:[1]},{label:'x',call:'a',args:'1'},{label:'x',tolerance:1},{label:'x',expect:1,tolerance:-1},{label:'x',expect:1,tolerance:'1'}])
  assert.throws(()=>e3.walkthroughSteps({walkthrough:[s]}),/Paso 1 del recorrido/,JSON.stringify(s));});
test('matchExpect: parcial, tolerancia, listas y rutas',()=>{
 assert.deepEqual(e3.matchExpect({mode:'inside',x:1,extra:[1]},{mode:'inside'}),[]);
 assert.deepEqual(e3.matchExpect({navigationState:{mode:'outside'}},{navigationState:{mode:'inside'}}),['navigationState.mode: "outside" ≠ "inside"']);
 assert.deepEqual(e3.matchExpect([1.0000001,2],[1,2]),[]);assert.equal(e3.matchExpect([1.05,2],[1,2]).length,1);assert.deepEqual(e3.matchExpect([1.05,2],[1,2],{tolerance:0.1}),[]);
 assert.deepEqual(e3.matchExpect({p:[1,2,3]},{p:[1,2]}),['p: 3 elementos ≠ 2']);assert.deepEqual(e3.matchExpect({p:[1,5]},{p:[1,2]}),['p[1]: 5 ≠ 2']);
 assert.deepEqual(e3.matchExpect(null,null),[]);assert.deepEqual(e3.matchExpect(null,{a:1}),['valor: null no es un objeto']);assert.deepEqual(e3.matchExpect({a:null},{a:{b:1}}),['a: null no es un objeto']);
 assert.deepEqual(e3.matchExpect('pong','pong'),[]);assert.deepEqual(e3.matchExpect('1',1),['valor: "1" ≠ 1']);assert.deepEqual(e3.matchExpect({},{a:1}),['a: undefined ≠ 1']);});
