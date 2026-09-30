// GET /api/production (#65): solo lectura; 200 con {shots, skipped} y 400 con un proyecto desconocido.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-prod-')),DATA=path.join(TMP,'data'),id='prod-'+process.pid,base=path.join(DATA,id);
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const w=(rel,v)=>{const f=path.join(base,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
w('proyecto.json',{id,name:'Prod',type:'serie',ideas:[],characters:[],locations:[],storyboards:[],episodes:[{id:'e1',sequences:[{id:'s1',shots:[{id:'p1'}]}]}]});
w('assets/lote-1/plan.json',[{id:'b1',parts:[{shot:'p1',from:0,to:4,at:0}]}]);w('assets/lote-1/lote.json',{episode:'e1',sequence:'s1',created:'2026-09-27T00:00:00.000Z'});
w('assets/lote-1/b1/attempts.json',[{n:1,at:'t',status:'done',video:'generated-v01.mp4',verdict:null}]);w('assets/lote-1/b1/generated-v01.mp4','');
w('assets/viejo/plan.json',{sequences:[]});
let child;const origin=`http://127.0.0.1:${port}`;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(TMP,{recursive:true,force:true});});
const get=async project=>{const r=await fetch(`${origin}/api/production?project=${encodeURIComponent(project)}`);return {status:r.status,body:await r.json()};};
const list=d=>fs.readdirSync(d,{recursive:true}).sort();
test('GET /api/production: 200 con shots y skipped; el plano enlaza su lote, bloque e intento',async()=>{
 const r=await get(id);assert.equal(r.status,200);assert.deepEqual(Object.keys(r.body),['shots','skipped']);
 assert.deepEqual(r.body.skipped,[{lote:'viejo',reason:'Lote no válido: plan.json no es una lista de bloques'}]);
 const e=r.body.shots.p1.lotes[0];assert.deepEqual([e.lote,e.block,e.part,e.from,e.to,e.current,e.pending],['lote-1','b1',0,0,4,1,true]);
 assert.equal(e.attempts[0].video,'assets/lote-1/b1/generated-v01.mp4');assert.deepEqual(r.body.shots.p1.anim3d,[]);});
test('proyecto desconocido: 400 con error',async()=>{const r=await get('no-existe');assert.equal(r.status,400);assert.equal(typeof r.body.error,'string');assert.ok(r.body.error);});
test('solo lectura: proyecto.json y attempts.json intactos, sin ficheros nuevos',async()=>{
 const files=['proyecto.json','assets/lote-1/b1/attempts.json'].map(f=>path.join(base,f)),stat=()=>files.map(f=>[fs.readFileSync(f,'utf8'),fs.statSync(f).mtimeMs]),before=stat(),tree=list(base);
 for(let i=0;i<3;i++)assert.equal((await get(id)).status,200);assert.deepEqual(stat(),before);assert.deepEqual(list(base),tree);});
