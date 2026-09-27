// Constructores declarados en proyectos/*/proyecto.json (environments[].builder y, provisional hasta #14, shipModel.builder), cada uno con su data.
// Solo lectura: lee ROOT/proyectos como kit.test.mjs y nunca escribe. Sin proyectos o sin constructores, los tests se saltan.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import * as T from 'three';
import {createKit} from '../viewer/kit.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),PROJECTS=path.join(ROOT,'proyectos');
const readJSON=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const found=[];
for(const id of fs.existsSync(PROJECTS)?fs.readdirSync(PROJECTS).sort():[]){const pj=path.join(PROJECTS,id,'proyecto.json');if(!fs.existsSync(pj))continue;let p;try{p=readJSON(pj);}catch{continue;}
 const list=[...(p.environments||[]).map(e=>({at:`${id}/environments/${e.id}`,builder:e.builder,data:e.data})),...(p.shipModel?[{at:`${id}/shipModel`,builder:p.shipModel.builder,data:p.shipModel.data}]:[])];
 for(const c of list){if(typeof c.builder!=='string'||typeof c.data!=='string')continue;const file=path.join(PROJECTS,id,c.builder),data=path.join(PROJECTS,id,c.data);if(fs.existsSync(file)&&fs.existsSync(data))found.push({...c,file,dataFile:data});}}

// Número finito, texto, booleano, null, array u objeto plano de lo mismo: lo que sobrevive a JSON sin perder nada.
const plain=v=>v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||(Array.isArray(v)&&v.every(plain))||(!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.values(v).every(plain));
const summary=root=>{const s={meshes:0,vertices:0,sum:0,names:[]};root.traverse(o=>{s.names.push(o.name);if(!o.isMesh)return;s.meshes++;const a=o.geometry.attributes.position;s.vertices+=a.count;for(let i=0;i<a.array.length;i+=97)s.sum+=a.array[i];});
 s.userData=Object.fromEntries(Object.entries(root.userData).map(([k,v])=>[k,v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([kk,vv])=>[kk,Array.isArray(vv)?vv.length:vv&&typeof vv==='object'?Object.keys(vv).length:vv])):v]));return s;};

for(const c of found){
 let first;
 test(`${c.at}: construye en Node sin tocar data y con userData serializable`,async()=>{const {build}=await import(c.file),data=readJSON(c.dataFile),copy=structuredClone(data);
  const root=build(T,data,createKit(T,{textures:false}));assert.ok(root?.isObject3D);assert.deepStrictEqual(data,copy);
  root.traverse(o=>assert.ok(plain(o.userData),`userData no serializable en «${o.name}»`));first=summary(root);
  const again=summary(build(T,structuredClone(copy),createKit(T,{textures:false})));assert.deepStrictEqual(again,first,'dos construcciones distintas');});
 test(`${c.at}: userData.ship coherente con los datos`,async t=>{const {build}=await import(c.file),data=readJSON(c.dataFile),root=build(T,data,createKit(T,{textures:false})),ship=root.userData.ship;
  if(!ship)return t.skip('sin userData.ship');
  const rooms=data.rooms.filter(r=>!r.virtual),names=new Map();root.traverse(o=>{if(o.name)names.set(o.name,(names.get(o.name)||0)+1);});
  const unique=n=>assert.equal(names.get(n),1,`nodo «${n}»: ${names.get(n)||0} veces`);
  for(const n of [ship.nodes.exterior,ship.nodes.interior,ship.nodes.labels,...ship.nodes.interiorMeshes])unique(n);
  assert.equal(ship.volumes.length,rooms.length);assert.equal(ship.doors.length,rooms.length);assert.deepEqual(ship.volumes.map(v=>v.id),rooms.map(r=>r.id));
  for(const x of [...ship.volumes,...ship.corridors,...ship.obstacles]){assert.equal(x.inverse.length,16);assert.equal(x.half.length,3);}
  for(const d of ship.doors){assert.equal(d.inverse.length,16);assert.equal(d.position.length,3);unique(d.node);unique(d.leaf);}
  for(const r of rooms)assert.deepStrictEqual(ship.kits[r.id],r.kit,`kit de ${r.id} distinto del de ${path.basename(c.dataFile)}`);});
}
test('hay constructores declarados que comprobar',{skip:!found.length&&'sin proyectos con constructor'},()=>assert.ok(found.length));
