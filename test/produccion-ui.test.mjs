// Sección «Producción» en el navegador (#65 B): estudio, Animación, Planos (plegable al abrirse) y niveles de Apariciones, bajo demanda y con
// caché; «Sin servidor…» si falla; y la página de entorno con los ambientes que lo usan, sin pedir producción.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-produccion-ui-')),id='prod-'+process.pid,base=path.join(DATA,id);
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const w=(rel,v)=>{const f=path.join(base,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
const cam={position:[4,2.5,7],target:[0,1,0],fov:45},shot=(sid,title,extra={})=>({id:sid,title,duration:2,lines:[],camera:cam,cameraEnd:cam,history:[],...extra});
// plaza usa env-a; env-z no lo usa nadie. p1 está en dos lotes (L1 y L2) y tiene animación 3D; p2, en L2 con un corte; p3, sin producción.
w('proyecto.json',{id,name:'Producción',type:'serie',language:'es',ideas:[],issues:[],
 characters:[{id:'ana',name:'Ana',kind:'person'}],locations:[{id:'plaza',name:'Plaza',environment:'env-a'},{id:'patio',name:'Patio'}],
 environments:[{id:'env-a',name:'Entorno A'},{id:'env-z',name:'Entorno Z'}],
 storyboards:[{id:'sb-a',title:'Story A',version:1,sequences:[{id:'sq-1',title:'Uno',location:'plaza',shots:[{id:'v1',code:'A01',title:'Uno',duration:2,cast:['ana'],dialogue:[]},{id:'v2',code:'A02',title:'Dos',duration:2,cast:['ana'],dialogue:[]}]}]}],
 episodes:[{id:'e1',title:'E1',sequences:[{id:'s1',title:'S1',storyboard:'sb-a',location:'plaza',silent:true,cast:[{character:'ana',x:0,z:0,yaw:0}],
  shots:[shot('p1','Primero',{storyboardShot:'v1'}),shot('p2','Segundo',{storyboardShot:'v2'}),shot('p3','Tercero')]}]}]});
const take=(n,verdict=null)=>({n,at:'2026-09-0'+n,status:'done',video:`generated-v0${n}.mp4`,endpoint:'fal-ai/minimax/h3/image-to-video',durationRequested:2,durationReturned:2,verdict});
w('assets/L1/plan.json',[{id:'a1',length:2,parts:[{shot:'p1',from:0,to:2,at:0}]}]);w('assets/L1/lote.json',{episode:'e1',sequence:'s1',created:'2026-09-01T00:00:00.000Z'});
w('assets/L1/a1/attempts.json',[take(1,'accepted')]);w('assets/L1/a1/generated-v01.mp4','');
w('assets/L2/plan.json',[{id:'b1',length:2,parts:[{shot:'p1',from:0,to:2,at:0}]},{id:'b2',length:4,parts:[{shot:'p2',from:0,to:4,at:0}]}]);w('assets/L2/lote.json',{episode:'e1',sequence:'s1',created:'2026-09-02T00:00:00.000Z'});
w('assets/L2/b1/attempts.json',[take(1,'rejected')]);w('assets/L2/b1/generated-v01.mp4','');
w('assets/L2/b2/attempts.json',[take(1)]);w('assets/L2/b2/generated-v01.mp4','');
w('assets/L2/montaje/corte.cut.json',{at:'2026-09-03',duration:6,blocks:[{block:'b1',at:0,length:2},{block:'b2',at:2,length:4}]});w('assets/L2/montaje/corte.mp4','');
w('storyboards/sb-a/animacion-3d/index.json',{entries:[{file:'storyboards/sb-a/animacion-3d/A01-v01.mp4',version:1,at:'2026-09-04T10:00:00.000Z',duration:2,storyboardShot:'v1',shot:'p1',episode:'e1',sequence:'s1'}]});
w('storyboards/sb-a/animacion-3d/A01-v01.mp4','');
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const BASE=`http://127.0.0.1:${port}/?project=${id}`;
// Cada sesión cuenta las peticiones a /api/production (prod()).
const session=fn=>withChrome(async browser=>{const ctx=await newRenderContext(browser,VIEWPORTS.lineaBase),page=await ctx.newPage(),errors=[];let n=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/production'))n++;});await fn(page,()=>n);assert.deepEqual(errors,[]);});
// Sondeo desde Node con plazo (sin waitForFunction asíncrono).
const poll=async(fn,what,ms=8000)=>{const end=Date.now()+ms;let last;while(Date.now()<end){last=await fn();if(last)return last;await new Promise(r=>setTimeout(r,50));}throw Error('No llega: '+what+' (último: '+JSON.stringify(last)+')');};
const settle=()=>new Promise(r=>setTimeout(r,400));
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const text=(page,sel)=>page.$eval(sel,e=>e.textContent).catch(()=>null);
const filled=(page,sel='[data-prod-slot]')=>poll(()=>page.$eval(sel,e=>!/Cargando…/.test(e.textContent)&&e.textContent).catch(()=>false),'sección Producción rellena');
const act=(page,a)=>page.evaluate(x=>window.rodaje.act(x),a);
const ready=page=>poll(()=>page.evaluate(()=>!!window.rodaje?.project).catch(()=>false),'app lista');
const studio=BASE+'&view=shot&episode=e1&sequence=s1&shot=p1';

test('estudio: lote, bloque, tramo, intentos, veredicto, cortes y vídeo 3D; el enlace abre Montaje con lote y block',{skip:SIN_CHROME},()=>session(async(page,prod)=>{
 await page.goto(studio);const t=await filled(page);assert.equal(prod(),1);
 assert.equal(await page.$eval('#workspace',ws=>ws.lastElementChild.matches('[data-prod-slot]')),true,'la sección va al final de la página');
 assert.match(t,/L2 · b1/);assert.match(t,/L1 · a1/);assert.match(t,/tramo 0–2 s/);assert.match(t,/1 intento/);
 assert.deepEqual(await page.$$eval('[data-prod-slot] [data-verdict]',x=>x.map(e=>[e.dataset.verdict,e.textContent])),[['rejected','Sin toma válida'],['accepted','Aceptada']]);
 assert.match(t,/Cortes: corte 0:00–0:02/);assert.match(t,/Animación 3D: v1/);assert.match(t,/2 s/);assert.doesNotMatch(t,/Primero/,'un solo plano va sin rótulo');
 assert.match(await page.getAttribute('[data-prod-slot] .prod-a3d a[target]','href'),/A01-v01\.mp4/);
 const vig=await page.getAttribute('[data-prod-slot] .prod-a3d a[data-route]','href');assert.match(vig,/view=storyboard&storyboard=sb-a/);assert.match(vig,/panel=v1/);
 await page.click('[data-prod-slot] .prod-row a[data-route]');await poll(()=>params(page).view==='montaje','Montaje');
 assert.deepEqual([params(page).lote,params(page).block],['L2','b1']);await poll(()=>page.$eval('.mt-seg.selected',e=>e.dataset.seg==='b1').catch(()=>false),'bloque b1 seleccionado');
 await page.goBack();await poll(()=>params(page).view==='shot','vuelta al estudio');await filled(page);
 await page.click('[data-prod-slot] .prod-cuts a');await poll(()=>params(page).view==='montaje'&&params(page).block==='b1','corte en Montaje');}));

test('Planos: pintar y filtrar no piden; desplegar pide una vez',{skip:SIN_CHROME},()=>session(async(page,prod)=>{
 await page.goto(BASE+'&view=shots');await page.waitForSelector('[data-prod-shot="p1"]');await settle();assert.equal(prod(),0,'pintar Planos no pide');
 assert.equal(await page.$$eval('details[data-prod-shot]',x=>x.filter(d=>d.open).length),0,'plegables cerrados');
 await page.fill('[data-filter-q]','Segundo');await poll(()=>page.$$eval('[data-prod-shot]',x=>x.length===1),'filtro aplicado');
 await page.fill('[data-filter-q]','');await poll(()=>page.$$eval('[data-prod-shot]',x=>x.length===3),'filtro limpio');await settle();assert.equal(prod(),0,'filtrar no pide');
 await page.click('[data-prod-shot="p2"] summary');const t=await filled(page,'[data-prod-shot="p2"] .prod-body');assert.equal(prod(),1);
 assert.match(t,/L2 · b2/);assert.match(t,/Sin revisar/);assert.match(t,/corte 0:02–0:06/);
 await page.click('[data-prod-shot="p3"] summary');assert.match(await filled(page,'[data-prod-shot="p3"] .prod-body'),/Sin producción todavía/);
 await page.click('[data-prod-shot="p1"] summary');assert.match(await filled(page,'[data-prod-shot="p1"] .prod-body'),/L1 · a1/);assert.equal(prod(),1,'los demás salen de la caché');
 await page.goto(BASE+'&view=tree&node=seq/s1');await page.waitForSelector('.tile-shot');assert.equal(await page.$$eval('details[data-prod-shot]',x=>x.length),0,'la Escaleta no lo lleva');
 await page.goto(BASE+'&view=storyboard&storyboard=sb-a&panel=v1');await page.waitForSelector('.sb-card');assert.equal(await page.$$eval('details[data-prod-shot]',x=>x.length),0,'la viñeta no lo lleva');
 await settle();assert.equal(prod(),1+0,'la Escaleta y la viñeta no piden');}));

test('Animación: sección Producción al final, con una petición',{skip:SIN_CHROME},()=>session(async(page,prod)=>{
 await page.goto(BASE+'&view=anim&episode=e1&sequence=s1&shot=p2');const t=await filled(page);await settle();assert.equal(prod(),1);
 assert.match(t,/L2 · b2/);assert.equal(await page.$eval('#workspace',ws=>ws.lastElementChild.matches('[data-prod-slot]')&&ws.lastElementChild.previousElementSibling.id==='anim'),true);}));

test('Apariciones: nivel de personaje y de ambiente con at lista sus planos con producción; la página sin at no pide',{skip:SIN_CHROME},()=>session(async(page,prod)=>{
 await page.goto(BASE+'&view=character&character=ana');await page.waitForSelector('[data-ap]');await settle();assert.equal(prod(),0);assert.equal(await page.$('[data-prod-slot]'),null);
 await page.goto(BASE+'&view=character&character=ana&at='+encodeURIComponent('scene/sb-a/sq-1'));const t=await filled(page);assert.equal(prod(),1);
 assert.deepEqual(JSON.parse(await page.getAttribute('[data-prod-slot]','data-prod-slot')),['p1','p2']);
 assert.deepEqual(await page.$$eval('[data-prod-slot] .prod-label',x=>x.map(e=>e.textContent)),['P01 · Primero','P02 · Segundo']);assert.match(t,/L2 · b2/);
 await page.goto(BASE+'&view=location&location=plaza');await page.waitForSelector('[data-ap]');await settle();assert.equal(prod(),1,'el ambiente sin at no pide');
 await page.goto(BASE+'&view=location&location=plaza&at='+encodeURIComponent('sb/sb-a'));const u=await filled(page);assert.equal(prod(),2,'otra carga de página');
 assert.deepEqual(JSON.parse(await page.getAttribute('[data-prod-slot]','data-prod-slot')),['p1','p2'],'los planos del ambiente heredan su location');assert.match(u,/L1 · a1/);
 await page.goto(BASE+'&view=location&location=plaza&at='+encodeURIComponent('seq/s1'));assert.match(await filled(page),/Sin producción todavía/,'s1 solo tiene p3 directamente');}));

test('sin servidor: la sección lo dice y la página funciona',{skip:SIN_CHROME},()=>session(async(page,prod)=>{
 await page.route('**/api/production*',r=>r.abort());
 await page.goto(studio);assert.match(await filled(page),/Sin servidor: no se puede leer la producción\./);
 for(const a of ['save','preview'])assert.equal(await page.$eval(`[data-action="${a}"]`,b=>b.disabled),false,a);
 await page.waitForSelector('#viewport canvas');
 await act(page,'nav:shots');await page.waitForSelector('[data-prod-shot="p1"]');await page.click('[data-prod-shot="p1"] summary');
 assert.match(await filled(page,'[data-prod-shot="p1"] .prod-body'),/Sin servidor/);
 await page.unroute('**/api/production*');const n=prod();await page.click('[data-prod-shot="p1"] summary');await page.click('[data-prod-shot="p1"] summary');
 await poll(()=>text(page,'[data-prod-shot="p1"] .prod-body').then(t=>/L1 · a1/.test(t)),'reintento al reabrir');assert.equal(prod(),n+1);}));

test('caché: Actualizar y Montaje invalidan',{skip:SIN_CHROME},()=>session(async(page,prod)=>{
 await page.goto(studio);await filled(page);assert.equal(prod(),1);
 await act(page,'nav:shots');await page.waitForSelector('[data-prod-shot]');await act(page,'shot:e1:s1:p1');await filled(page);await settle();assert.equal(prod(),1,'de la caché');
 await page.click('[data-action="refresh"]');await poll(()=>prod()===2,'Actualizar vuelve a pedir');await filled(page);
 await page.goto(BASE+'&view=montaje&lote=L2&block=b2');await poll(()=>page.$eval('[data-mt="editor"]',e=>/bloque/.test(e.textContent)).catch(()=>false),'editor de Montaje');
 const before=prod();await act(page,'shot:e1:s1:p2');await filled(page);assert.equal(prod(),before+1,'nueva carga de página');
 await page.goBack();await poll(()=>page.$eval('[data-mt="editor"]',e=>/bloque/.test(e.textContent)).catch(()=>false),'editor de Montaje');
 await page.$eval('[data-ed="accept"]',e=>e.click());await poll(()=>text(page,'#toast').then(t=>/aceptada/.test(t||'')),'veredicto');
 const k=prod();await act(page,'shot:e1:s1:p2');assert.match(await filled(page),/Aceptada/);assert.equal(prod(),k+1,'el veredicto invalida la caché');}));

test('página de entorno: ambientes que lo usan y sus apariciones, sin pedir producción',{skip:SIN_CHROME},()=>session(async(page,prod)=>{
 await page.goto(BASE+'&view=environment&environment=env-a');await page.waitForSelector('[data-env-use="plaza"]');
 const t=await text(page,'[data-env-use="plaza"]');assert.match(t,/Plaza/);assert.match(t,/entorno del ambiente/);
 const hrefs=await page.$$eval('[data-env-use="plaza"] .env-level',x=>x.map(a=>a.getAttribute('href')));
 assert.deepEqual(hrefs.map(h=>new URLSearchParams(h.slice(1)).get('at')),['seq/s1','sb/sb-a']);for(const h of hrefs)assert.match(h,/view=location&location=plaza&at=/);
 const w0=await page.$eval('#environment-model',e=>e.getBoundingClientRect().width);
 const w1=await page.evaluate(()=>{document.querySelector('[data-env-use]').closest('section').remove();return document.querySelector('#environment-model').getBoundingClientRect().width;});assert.equal(w0,w1);
 await page.reload();await page.waitForSelector('[data-env-use="plaza"] .env-level');await page.click('[data-env-use="plaza"] .env-level >> nth=1');
 await poll(()=>params(page).view==='location'&&params(page).at==='sb/sb-a','nivel del ambiente');await page.waitForSelector('.ap-head');
 const before=prod();await page.goto(BASE+'&view=environment&environment=env-z');await page.waitForSelector('#environment-model');
 assert.match(await page.textContent('#workspace'),/Ningún ambiente usa este entorno\./);await settle();assert.equal(prod(),before,'la página de entorno no pide');
 assert.equal(before,1,'solo el nivel del ambiente pidió');}));
