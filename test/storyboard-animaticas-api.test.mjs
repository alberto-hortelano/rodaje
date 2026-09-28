// GET /api/storyboard-animaticas y trabajo 'animatic' (#46): lectura de las animáticas agrupadas por paso y generación en segundo plano
// con el script, sin clave de fal (ffmpeg y ffprobe falsos de test/fixtures/bin).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {FONT} from '../lib/animaticas.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-sbanim-')),DATA=path.join(TMP,'data'),id='sba-'+process.pid,base=path.join(DATA,id);
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const w=(rel,v)=>{const f=path.join(base,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
w('proyecto.json',{id,name:'SBA',type:'serie',language:'en',revision:1,ideas:[],characters:[{id:'ana',name:'Ana'}],locations:[],issues:[],
 storyboards:[{id:'sb-a',title:'A',sequences:[{id:'sq-1',title:'Uno',shots:[{id:'v1',code:'A01',title:'Uno',duration:3,renders:[{file:'storyboards/sb-a/3d/A01.png',source:'ensayo 3D'}],render:'storyboards/sb-a/render/A01.png',dialogue:[{character:'ana',text:'Hello.'}]}]}]}],
 episodes:[]});
w('storyboards/sb-a/3d/A01.png','png');w('storyboards/sb-a/render/A01.png','png');
const env={...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:'',RODAJE_CONFIG_DIR:fs.mkdtempSync(path.join(TMP,'config-')),RODAJE_MOCK_LOG:path.join(TMP,'mock.jsonl'),
 PATH:[path.join(ROOT,'test/fixtures/bin'),path.dirname(process.execPath),process.env.PATH].join(path.delimiter)};delete env.FAL_KEY;delete env.RODAJE_PROJECT;
let child;const origin=`http://127.0.0.1:${port}`;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(TMP,{recursive:true,force:true});});
const get=async (p,sb)=>{const r=await fetch(`${origin}/api/storyboard-animaticas?project=${encodeURIComponent(p)}&storyboard=${encodeURIComponent(sb)}`);return {status:r.status,body:await r.json()};};
const state=()=>fetch(origin+'/api/state').then(r=>r.json());
const post=async body=>{const {token}=await state();const r=await fetch(origin+'/api/job',{method:'POST',headers:{'Content-Type':'application/json','x-rodaje-token':token},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};

test('GET /api/storyboard-animaticas: vacío sin carpeta; 400 con un storyboard desconocido',async()=>{
 const r=await get(id,'sb-a');assert.equal(r.status,200);assert.deepEqual(r.body,{storyboard:{},sequences:{}});
 const bad=await get(id,'nada');assert.equal(bad.status,400);assert.equal(bad.body.error,'Storyboard desconocido');});

test('POST /api/job animatic: 400 si el storyboard no existe; 202, no pide clave de fal y llega a done; el segundo en curso se rechaza',{skip:fs.existsSync(FONT)?false:'falta '+FONT,timeout:60000},async()=>{
 const bad=await post({project:id,type:'animatic',target:'nada'});assert.equal(bad.status,400);assert.equal(bad.body.error,'Storyboard desconocido');
 assert.equal((await state()).settings.configured,false);
 const r=await post({project:id,type:'animatic',target:'sb-a'});assert.equal(r.status,202,JSON.stringify(r.body));
 const again=await post({project:id,type:'animatic',target:'sb-a'});assert.equal(again.status,400);assert.equal(again.body.error,'Este trabajo ya está en curso');
 let j;const t0=Date.now();do{await new Promise(res=>setTimeout(res,100));j=(await state()).jobs.find(x=>x.id===r.body.id);assert.ok(Date.now()-t0<50000,'el trabajo no terminó');}while(['queued','running'].includes(j.status));
 assert.equal(j.status,'done',j.error);assert.equal(j.output,'storyboards/sb-a/animaticas/index.json');assert.match(j.summary,/^3d v01 · 3\.0 s · 1 secuencia · completa \| fotogramas v01 · .* \| voces v01 · .*incompleta \(1 viñeta sin plano\)$/);
 assert.ok(fs.existsSync(path.join(base,'storyboards/sb-a/animaticas/index.json')));assert.ok(fs.existsSync(path.join(base,'storyboards/sb-a/animaticas/3d-v01.mp4')));
 const g=await get(id,'sb-a');assert.deepEqual(Object.keys(g.body.storyboard).sort(),['3d','fotogramas','voces']);assert.equal(g.body.storyboard['3d'].current.file,'storyboards/sb-a/animaticas/3d-v01.mp4');
 assert.deepEqual(Object.keys(g.body.sequences['sq-1']).sort(),['3d','fotogramas','voces']);});
