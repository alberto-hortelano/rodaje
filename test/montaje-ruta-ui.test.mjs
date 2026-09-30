// Ruta de Montaje en el navegador (#65): ?view=montaje&lote=…&block=… abre ese lote y bloque; los cambios internos reemplazan la entrada;
// sin lote, el recordado; «Montaje →» del storyboard crea entrada; un veredicto invalida la caché de la app (onWrite).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-montaje-ruta-')),id='mruta-'+process.pid,base=path.join(DATA,id);
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const w=(rel,v)=>{const f=path.join(base,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
w('proyecto.json',{id,name:'Ruta',type:'serie',language:'es',ideas:[],characters:[],locations:[],environments:[],
 storyboards:[{id:'sb-a',title:'A',sequences:[{id:'sq-1',title:'Uno',shots:[{id:'v1',code:'A01',title:'Uno'},{id:'v2',code:'A02',title:'Dos'}]}]}],
 episodes:[{id:'e1',title:'E1',sequences:[{id:'s1',title:'S1',location:'',cast:[],shots:[{id:'p1',title:'P1',storyboardShot:'v1',duration:2,lines:[]},{id:'p2',title:'P2',storyboardShot:'v2',duration:2,lines:[]}]}]}]});
const take=n=>({n,at:'2026-09-0'+n,status:'done',video:`generated-v0${n}.mp4`,endpoint:'fal-ai/minimax/h3/image-to-video',durationRequested:2,durationReturned:2,verdict:null});
w('assets/L1/plan.json',[{id:'a1',length:2,parts:[{shot:'p1'}]}]);w('assets/L1/lote.json',{episode:'e1',sequence:'s1',created:'2026-09-01T00:00:00.000Z'});
w('assets/L2/plan.json',[{id:'b1',length:2,parts:[{shot:'p1'}]},{id:'b2',length:2,parts:[{shot:'p2'}]}]);w('assets/L2/lote.json',{episode:'e1',sequence:'s1',created:'2026-09-02T00:00:00.000Z'});
for(const b of ['b1','b2']){w(`assets/L2/${b}/attempts.json`,[take(1)]);w(`assets/L2/${b}/generated-v01.mp4`,'');}
w('assets/L2/montaje/corte.cut.json',{at:'2026-09-03',duration:4,blocks:[{block:'b1',at:0,length:2},{block:'b2',at:2,length:2}]});w('assets/L2/montaje/corte.mp4','');
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const BASE=`http://127.0.0.1:${port}/?project=${id}`;
const session=fn=>withChrome(async browser=>{const ctx=await newRenderContext(browser,VIEWPORTS.lineaBase),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
// Sondeo desde Node con plazo (sin waitForFunction asíncrono).
const poll=async(fn,what,ms=8000)=>{const end=Date.now()+ms;let last;while(Date.now()<end){last=await fn();if(last)return last;await new Promise(r=>setTimeout(r,50));}throw Error('No llega: '+what+' (último: '+JSON.stringify(last)+')');};
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const len=page=>page.evaluate(()=>history.length);
const ready=page=>poll(()=>page.$eval('[data-mt="editor"]',e=>/bloque/.test(e.textContent)).catch(()=>false),'editor de Montaje');
const url=(page,k,v)=>poll(()=>params(page)[k]===v,`${k}=${v} en ${page.url()}`);
const selected=page=>page.$eval('.mt-seg.selected',e=>e.dataset.seg).catch(()=>null);
const loteSel=page=>page.$eval('[data-mt="lote"]',e=>e.value);

test('recargar ?view=montaje&lote=L2&block=b2 abre L2 con b2 seleccionado; seleccionar otro bloque y otro lote reemplaza',{skip:SIN_CHROME},()=>session(async page=>{
 await page.goto(BASE+'&view=montaje&lote=L2&block=b2');await ready(page);
 assert.equal(await loteSel(page),'L2');assert.equal(await selected(page),'b2');assert.match(await page.textContent('[data-mt="editor"]'),/bloque b2/);
 assert.deepEqual([params(page).lote,params(page).block],['L2','b2']);
 const h0=await len(page);await page.$eval('.mt-seg[data-seg="b1"]',e=>e.click());await url(page,'block','b1');assert.equal(await len(page),h0,'otro bloque no crea entrada');
 await page.reload();await ready(page);assert.equal(await selected(page),'b1');assert.equal(params(page).block,'b1');
 const h1=await len(page);await page.selectOption('[data-mt="lote"]','L1');await url(page,'lote','L1');await url(page,'block','a1');assert.equal(await len(page),h1,'otro lote no crea entrada');}));

test('sin lote usa el recordado y lo escribe en la URL; un lote que no existe avisa',{skip:SIN_CHROME},()=>session(async page=>{
 await page.goto(BASE+'&view=montaje');await ready(page);assert.equal(await loteSel(page),'L2','sin recordado, el más reciente');
 await page.evaluate(k=>localStorage.setItem(k,'L1'),`rodaje-montaje-${id}-lote`);
 await page.goto(BASE+'&view=montaje');await ready(page);assert.equal(await loteSel(page),'L1');await url(page,'lote','L1');await url(page,'block','a1');
 await page.goto(BASE+'&view=montaje&lote=NOPE&block=b2');await ready(page);assert.equal(await loteSel(page),'L1');
 assert.match(await page.textContent('#toast'),/No existe el lote NOPE: se abre L1/);await url(page,'lote','L1');assert.equal(params(page).block,'a1');}));

test('«Montaje →» desde el storyboard crea entrada y Atrás vuelve',{skip:SIN_CHROME},()=>session(async page=>{
 await page.goto(BASE+'&view=storyboard&storyboard=sb-a&panel=v2');await page.waitForSelector('[data-sb-take-go="v2"]');const h0=await len(page);
 assert.equal(await page.getAttribute('[data-sb-take-go="v2"]','data-action'),'sb-montaje:L2:b2');
 await page.$eval('[data-sb-take-go="v2"]',e=>e.click());await ready(page);await url(page,'view','montaje');
 assert.deepEqual([params(page).lote,params(page).block],['L2','b2']);assert.equal(await selected(page),'b2');assert.equal(await len(page),h0+1);
 await page.goBack();await url(page,'view','storyboard');assert.equal(params(page).panel,'v2');await page.waitForSelector('[data-sb-take-go="v2"]');}));

test('revisar un bloque llama a onWrite: la caché de estados de planos se vuelve a pedir',{skip:SIN_CHROME},()=>session(async page=>{
 let n=0;page.on('request',r=>{if(r.url().includes('/api/shot-states'))n++;});
 await page.goto(BASE+'&view=shots');await poll(()=>n===1,'primera petición');await poll(()=>page.evaluate(()=>!!window.rodaje),'app lista');
 await page.evaluate(()=>window.rodaje.act('nav:montaje'));await ready(page);await page.evaluate(()=>window.rodaje.act('nav:shots'));await page.waitForSelector('[data-shots-seq]');
 assert.equal(n,1,'sin veredicto, de la caché');
 await page.evaluate(()=>window.rodaje.act('nav:montaje'));await ready(page);await page.$eval('[data-ed="accept"]',e=>e.click());
 await poll(()=>page.textContent('#toast').then(t=>/aceptada/.test(t)),'veredicto');
 await page.evaluate(()=>window.rodaje.act('nav:shots'));await poll(()=>n===2,'nueva petición tras el veredicto');}));
