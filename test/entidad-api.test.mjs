// GET /api/entity (#60): solo lectura; 200 con assets y documentos existentes, sin registro, 404 con un id desconocido y 400 con un tipo no válido.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {entityRegistry} from './fixtures/entidad.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-entity-')),DATA=path.join(TMP,'data'),id='ent-'+process.pid,id2='ent2-'+process.pid;
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const w=(pid,rel,v)=>{const f=path.join(DATA,pid,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
const project=pid=>({id:pid,name:'E',type:'serie',ideas:[],characters:[{id:'ana',name:'Ana'}],locations:[{id:'plaza',name:'Plaza'}],episodes:[]});
w(id,'proyecto.json',project(id));w(id,'registro.json',entityRegistry());w(id,'personajes/ana/hoja.md','# Ana');w(id,'personajes/ana/FICHA.md','x');w(id,'personajes/ana/ref/roja.png','');w(id,'ambientes/plaza/MAPA.md','x');
w(id2,'proyecto.json',project(id2));
let child;const origin=`http://127.0.0.1:${port}`;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(TMP,{recursive:true,force:true});});
const get=async(pid,kind,eid)=>{const r=await fetch(`${origin}/api/entity?project=${encodeURIComponent(pid)}&kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(eid)}`);return {status:r.status,body:await r.json()};};
test('GET /api/entity: forma completa, documentos que existen y ficheros sin tocar; sin registro; 404 y 400',async()=>{
 const files=['proyecto.json','registro.json'].map(f=>path.join(DATA,id,f)),before=files.map(f=>fs.readFileSync(f));
 let r=await get(id,'character','ana');assert.equal(r.status,200);
 assert.deepEqual(Object.keys(r.body),['kind','id','registry','assets','docs']);assert.deepEqual([r.body.kind,r.body.id,r.body.registry],['character','ana',true]);
 assert.deepEqual(r.body.assets.map(a=>[a.tag,a.exists]),[['ANA',false],['ANA_ROJA',true],['ANA_VOICE',false],['GRUPO',false]]);
 assert.deepEqual(r.body.docs,[{key:'hoja-md',label:'Hoja (texto)',file:'personajes/ana/hoja.md'},{key:'ficha',label:'Ficha',file:'personajes/ana/FICHA.md'}]);
 r=await get(id,'location','plaza');assert.equal(r.status,200);assert.deepEqual(r.body.assets.map(a=>a.tag),['PLAZA','PLAZA_NOCHE']);assert.deepEqual(r.body.docs.map(d=>d.key),['mapa']);
 r=await get(id2,'character','ana');assert.equal(r.status,200);assert.deepEqual([r.body.registry,r.body.assets,r.body.docs],[false,[],[]]);
 r=await get(id,'character','zz');assert.equal(r.status,404);assert.equal(r.body.error,'No existe el personaje zz');
 r=await get(id,'location','zz');assert.equal(r.status,404);assert.equal(r.body.error,'No existe el ambiente zz');
 r=await get(id,'otro','ana');assert.equal(r.status,400);assert.equal(r.body.error,'Tipo no válido: otro');
 const post=await fetch(`${origin}/api/entity?project=${id}&kind=character&id=ana`,{method:'POST',body:'{}'});assert.notEqual(post.status,200);
 assert.deepEqual(files.map(f=>fs.readFileSync(f)),before);});
