// Ruta /viewer/ del servidor: sirve viewer/ con safe(), sin /environment.js; la UI importa el visor GLB sin empaquetarlo (issue #9).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import http from 'node:http';import {spawn} from 'node:child_process';import * as T from 'three';
import {exportGlb} from '../lib/entorno3d.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-viewer-')),id='humo-'+process.pid;
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
// Proyecto de humo: un entorno solo con GLB (tres cajas).
const g=new T.Group();for(const x of [0,2,4]){const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial());m.name='caja'+x;m.position.x=x;g.add(m);}
fs.mkdirSync(path.join(DATA,id,'assets'),{recursive:true});fs.writeFileSync(path.join(DATA,id,'assets/h.glb'),(await exportGlb(g,{quiet:true})).buffer);
fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify({id,name:'Humo',type:'serie',ideas:[],characters:[],locations:[],episodes:[],environments:[{id:'solo-glb',name:'Humo',glb:'assets/h.glb'}]}));
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawn(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
// Ruta tal cual, sin normalizar: http.get no resuelve «..» ni descodifica.
const get=p=>new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port,path:p},res=>{let body='';res.setEncoding('utf8');res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],body}));}).on('error',reject));

test('/viewer/ sirve glb.mjs y kit.mjs como JavaScript',async()=>{const glb=await get('/viewer/glb.mjs');assert.equal(glb.status,200);assert.match(glb.type,/^text\/javascript/);assert.match(glb.body,/export async function mountGlb\(container, \{url, name\}\)/);
 const kit=await get('/viewer/kit.mjs');assert.equal(kit.status,200);assert.match(kit.type,/^text\/javascript/);assert.match(kit.body,/export function createKit/);});
test('/viewer/ no sale de viewer/',async()=>{for(const p of ['/viewer/../app/server.mjs','/viewer/%2e%2e/app/server.mjs','/viewer/..%2fapp%2fserver.mjs','/viewer/%2e%2e%2fapp%2fserver.mjs','/viewer/','/viewer/../package.json']){const r=await get(p);assert.notEqual(r.status,200,p);assert.doesNotMatch(r.body,/createServer|"dependencies"/,p);}
 assert.equal((await get('/viewer/nada.mjs')).status,404);});
test('/environment.js ya no existe',async()=>{assert.equal((await get('/environment.js')).status,404);assert.ok(!fs.existsSync(path.join(ROOT,'app/environment.js')));});
test('app.js importa /viewer/glb.mjs sin empaquetarlo',()=>{const src=fs.readFileSync(path.join(ROOT,'app/app.js'),'utf8');assert.match(src,/["']\/viewer\/glb\.mjs["']/);assert.ok(!src.includes('/environment.js'));assert.ok(!src.includes('class GLTFLoader'));});
test('humo: un entorno solo con GLB se abre en la vista environment',{skip:!fs.existsSync(CHROME)&&'sin Chrome'},async()=>{const {chromium}=await import('playwright');
 const browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{const page=await (await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=solo-glb`);
  await page.waitForFunction('window.rodaje?.environment',null,{timeout:30000});
  assert.match(await page.textContent('#environment-model p'),/^Humo · .* · 3 mallas$/);assert.deepEqual(errors,[]);}
 finally{await browser.close();}});
