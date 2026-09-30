// Buscador de Historia e ideas, Pendientes, Generaciones y Montaje en el navegador (#63): el sondeo de 6 s no toca la barra (reloj de Playwright),
// Generaciones sin proyecto, Ideas sin plegable, Pendientes con arrastre tras filtrar, Montaje con optgroup y el lote cargado siempre visible, «Montaje →»
// sin memoria y móvil a 390 px. Servidor con RODAJE_DATA temporal; textos inventados; los trabajos se inyectan en /api/state.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-filtros-vistas-')),id='fvistas-'+process.pid,base=path.join(DATA,id);
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const w=(rel,v,root=base)=>{const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
const cam={position:[4,2.5,7],target:[0,1,0],fov:45},shot=x=>({id:x,title:x.toUpperCase(),duration:2,camera:cam,cameraEnd:cam,lines:[]});
w('proyecto.json',{id,name:'Vistas',type:'serie',language:'es',characters:[],locations:[],environments:[],
 storyboards:[{id:'sb-f',title:'Faro',sequences:[{id:'sq-f',title:'Faro',shots:[{id:'v2',code:'F01',title:'Uno'},{id:'v3',code:'F02',title:'Dos'}]}]}],
 ideas:[{id:'i1',title:'Canción del muelle',text:'La que suena al final.'},{id:'i2',title:'Premisa',text:'Un faro que se apaga.'},{id:'i3',title:'Reglas',text:'Nadie cruza de noche.'}],
 issues:[{id:'a',title:'Raccord de luz',text:'La lámpara cambia.',code:'A2',severity:'grave',status:'abierto'},{id:'b',title:'Ritmo lento',text:'Sobra un plano.',severity:'ritmo',status:'abierto'},
  {id:'c',title:'Diálogo flojo',text:'Revisar.',severity:'medio',status:'en-curso'},{id:'d',title:'Puerta abierta',text:'Otra vez.',severity:'grave',status:'en-curso'}],
 episodes:[{id:'e1',title:'Uno',synopsis:'',sequences:[{id:'s1',title:'Muelle',location:'',cast:[],shots:[shot('p1')]}]},
  {id:'e2',title:'Dos',synopsis:'',sequences:[{id:'s2',title:'Faro',location:'',cast:[],shots:[{...shot('p2'),storyboardShot:'v2'},{...shot('p3'),storyboardShot:'v3'}]}]}]});
w('proyecto.json',{id:id+'-vacio',name:'Vacío',type:'pelicula',language:'es',ideas:[],issues:[],characters:[],locations:[],environments:[],storyboards:[],episodes:[]},path.join(DATA,id+'-vacio'));
const take=n=>({n,at:'2026-09-0'+n,status:'done',video:`generated-v0${n}.mp4`,endpoint:'fal-ai/minimax/h3/image-to-video',durationRequested:2,durationReturned:2,verdict:null});
const lote=(l,meta,blocks)=>{w(`assets/${l}/plan.json`,blocks.map(([b,shot])=>({id:b,length:2,parts:[{shot}]})));if(meta)w(`assets/${l}/lote.json`,meta);
 for(const [b] of blocks){w(`assets/${l}/${b}/attempts.json`,[take(1)]);w(`assets/${l}/${b}/generated-v01.mp4`,'');}
 w(`assets/${l}/montaje/corte.cut.json`,{at:'2026-09-03',duration:2*blocks.length,blocks:blocks.map(([b],i)=>({block:b,at:2*i,length:2}))});w(`assets/${l}/montaje/corte.mp4`,'');};
lote('L0',null,[['z1','p1']]);lote('L1',{episode:'e1',sequence:'s1',created:'2026-09-01T00:00:00.000Z'},[['a1','p1']]);lote('L2',{episode:'e2',sequence:'s2',created:'2026-09-02T00:00:00.000Z'},[['b1','p2'],['b2','p3']]);
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const ORIGIN=`http://127.0.0.1:${port}`,BASE=`${ORIGIN}/?project=${id}`;
const session=(fn,viewport=VIEWPORTS.lineaBase)=>withChrome(async browser=>{const page=await (await newRenderContext(browser,viewport)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
// Sondeo desde Node con plazo (sin waitForFunction asíncrono).
const poll=async(fn,what,ms=8000)=>{const end=Date.now()+ms;let last;while(Date.now()<end){last=await fn();if(last)return last;await new Promise(r=>setTimeout(r,50));}throw Error('No llega: '+what+' (último: '+JSON.stringify(last)+')');};
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const url=(page,k,v)=>poll(()=>params(page)[k]===v,`${k}=${v} en ${page.url()}`);
const revision=async(page,pid=id)=>(await page.evaluate(async pid=>(await (await fetch('/api/project?id='+pid)).json()),pid)).revision;
const load=async(page,q)=>{await page.goto(q.startsWith('http')?q:BASE+q);await page.waitForSelector('#workspace .heading');};
const chip=(facet,value)=>`[data-facet="${facet}"][data-value="${value}"]`;
// Trabajos inyectados en /api/state: jobs es mutable (el sondeo ve los cambios); served cuenta las respuestas.
const injectJobs=async(page,jobs)=>{const n={served:0};await page.route('**/api/state',async r=>{const res=await r.fetch(),j=await res.json();j.jobs.push(...structuredClone(jobs));n.served++;await r.fulfill({response:res,json:j});});return n;};
const JOBS=()=>[{id:'j1',project:id,type:'preview',target:'p1-abcdefgh',status:'running',progress:10,summary:'Previsualización de P1',created:'2026-09-01T10:00:00.000Z'},
 {id:'j2',project:id,type:'video',target:'p2',status:'failed',error:'Tiempo agotado',created:'2026-09-02T10:00:00.000Z'},
 {id:'j3',project:id,type:'cover',target:'s1',status:'done',created:'2026-09-03T10:00:00.000Z'},
 {id:'j4',project:'otro',type:'voice',target:'x',status:'queued',created:'2026-09-04T10:00:00.000Z'}];
const barState=page=>page.evaluate(()=>{const q=document.querySelector('[data-filter-q]');return {value:q.value,pos:q.selectionStart,active:document.activeElement===q,bar:window.__bar===document.querySelector('.filter-bar'),
 open:document.querySelector('[data-filter-facets]')?.open,len:history.length,search:location.search};});

test('Generaciones: el sondeo no toca la barra; con cambios, solo los resultados',{skip:SIN_CHROME},()=>session(async page=>{
 const jobs=JOBS(),n=await injectJobs(page,jobs);await page.clock.install();
 await load(page,'&view=jobs');await page.waitForSelector('.job');const r0=await revision(page);
 assert.equal(await page.$eval('[data-filter-count]',e=>e.textContent),'3 generaciones');
 await page.click('[data-filter-q]');await page.keyboard.type('previs');await page.clock.runFor(200);await url(page,'q','previs');
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
 await page.evaluate(()=>{window.__card=document.querySelector('.job');window.__bar=document.querySelector('.filter-bar');});const s0=await barState(page);
 assert.deepEqual([s0.value,s0.pos,s0.active,s0.bar],['previs',4,true,true]);
 const served=n.served;await page.clock.runFor(13000);await poll(()=>n.served>=served+2,'dos sondeos');await page.waitForTimeout(300);
 assert.deepEqual(await barState(page),s0,'sin cambios: nada se mueve');assert.equal(await page.evaluate(()=>window.__card===document.querySelector('.job')),true,'la misma tarjeta');
 jobs[0].progress=55;await page.clock.runFor(7000);await poll(()=>page.$eval('.job',e=>/55%/.test(e.textContent)),'progreso nuevo');
 assert.deepEqual(await barState(page),s0,'con cambios: foco, cursor, URL e historial intactos');assert.equal(await page.$$eval('.job',l=>l.length),1);
 await load(page,'&view=jobs&f=status:running');await page.waitForSelector('.job');assert.equal(await page.getAttribute(chip('status','running'),'aria-pressed'),'true');
 jobs[0].status='done';await page.clock.runFor(7000);await poll(()=>page.$eval('[data-filter-results]',e=>/Nada coincide/.test(e.textContent)),'el trabajo sale del filtro');
 assert.equal(params(page).f,'status:running');assert.equal(await revision(page),r0,'el sondeo no guarda');}));

test('Generaciones sin proyecto: memoria rodaje-filtros--jobs y «Actividad reciente» sin barra',{skip:SIN_CHROME},()=>session(async page=>{
 await injectJobs(page,JOBS());await load(page,ORIGIN+'/?view=jobs');await page.waitForSelector('.job');
 assert.equal(await page.$$eval('.job',l=>l.length),4,'sin proyecto, todos');
 await page.click('[data-filter-q]');await page.keyboard.type('voz');await url(page,'q','voz');assert.equal(await page.$$eval('.job',l=>l.length),1);
 assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('rodaje-filtros--jobs'))),{q:'voz',f:{}});
 await load(page,'&view=overview');await page.waitForSelector('.job');assert.equal(await page.$$eval('.job',l=>l.length),3);assert.equal(await page.$('.filter-bar'),null);}));

test('Historia e ideas: búsqueda sin acentos, sin plegable Filtros, contador; sin ideas, el vacío de siempre',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=ideas');await page.waitForSelector('[data-filter-results] article.card');const r0=await revision(page);
 assert.equal(await page.$('[data-filter-facets]'),null);assert.equal(await page.$eval('[data-filter-count]',e=>e.textContent),'3 documentos');
 await page.click('[data-filter-q]');await page.keyboard.type('cancion');await url(page,'q','cancion');
 assert.equal(await page.$eval('[data-filter-count]',e=>e.textContent),'1 de 3 documentos');assert.deepEqual(await page.$$eval('[data-filter-results] h2',l=>l.map(h=>h.textContent)),['Canción del muelle']);
 assert.equal(await page.evaluate(()=>document.activeElement?.matches('[data-filter-q]')),true);assert.equal(await revision(page),r0);
 await load(page,ORIGIN+`/?project=${id}-vacio&view=ideas`);await page.waitForSelector('.empty');assert.equal(await page.$('.filter-bar'),null);
 assert.equal(await page.$eval('.empty h2',e=>e.textContent),'La historia antes que los planos.');}));

test('Pendientes: facetas Gravedad y Estado, columnas con recuento visible y arrastre tras filtrar',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=issues&f=severity:grave');await page.waitForSelector('[data-kanban-card]');const r0=await revision(page);
 const facetsOf=()=>page.$$eval('[data-facet]',l=>[...new Set(l.map(b=>b.dataset.facet))]);assert.deepEqual(await facetsOf(),['severity','status']);
 const cols=()=>page.$$eval('[data-kanban-col]',l=>l.map(c=>[c.dataset.kanbanCol,c.querySelector('h3 .tiny').textContent,[...c.querySelectorAll('[data-kanban-card]')].map(x=>x.dataset.kanbanCard)]));
 assert.deepEqual(await cols(),[['abierto','1',['a']],['en-curso','1',['d']],['cerrado','0',[]]]);
 await page.click('[data-filter-q]');await page.keyboard.type('r');await url(page,'q','r');await page.keyboard.press('Backspace');await poll(()=>params(page).q===undefined,'q borrada');
 await page.dragAndDrop('[data-kanban-card="a"]','[data-kanban-col="cerrado"]');const r1=await poll(async()=>{const r=await revision(page);return r!==r0&&r;},'guardado');
 await page.waitForSelector('[data-kanban-col="cerrado"] [data-kanban-card="a"]');
 assert.equal(params(page).f,'severity:grave');assert.equal(await page.getAttribute(chip('severity','grave'),'aria-pressed'),'true');
 assert.deepEqual(await cols(),[['abierto','0',[]],['en-curso','1',['d']],['cerrado','1',['a']]]);
 await page.click('[data-filter-q]');await page.keyboard.type('puerta');await url(page,'q','puerta');
 await page.dragAndDrop('[data-kanban-card="d"]','[data-kanban-col="abierto"]');await poll(async()=>{const r=await revision(page);return r!==r1&&r;},'segundo arrastre');
 await page.waitForSelector('[data-kanban-col="abierto"] [data-kanban-card="d"]');assert.deepEqual([params(page).q,params(page).f],['puerta','severity:grave']);
 assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'puerta');}));

const mtReady=page=>poll(()=>page.$eval('[data-mt="editor"]',e=>/bloque/.test(e.textContent)).catch(()=>false),'editor de Montaje');
const options=page=>page.$$eval('[data-mt="lote"] optgroup',l=>l.map(g=>[g.label,[...g.querySelectorAll('option')].map(o=>o.textContent)]));

test('Montaje: optgroup por acto y secuencia, facetas y lote cargado fuera del filtro sin recargar',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=montaje&lote=L2');await mtReady(page);
 assert.deepEqual(await options(page),[['Uno › Muelle',['L1 · 1 bloques']],['Dos › Faro',['L2 · 2 bloques']],['Sin secuencia',['L0 · 1 bloques']]]);
 let lotes=0;page.on('request',r=>{if(r.url().includes('/api/lote?'))lotes++;});const src=await page.$eval('[data-mt="video"]',v=>v.src),ed=await page.$eval('[data-mt="editor"]',e=>e.textContent);
 await page.click(chip('sequence','s1'));await url(page,'f','sequence:s1');
 assert.deepEqual(await options(page),[['Uno › Muelle',['L1 · 1 bloques']],['Dos › Faro',['L2 · 2 bloques · fuera del filtro']]]);
 assert.equal(await page.$eval('[data-mt="lote"]',s=>s.value),'L2');assert.equal(await page.$eval('[data-mt="video"]',v=>v.src),src);assert.equal(await page.$eval('[data-mt="editor"]',e=>e.textContent),ed);
 await page.waitForTimeout(300);assert.equal(lotes,0,'filtrar no pide el lote');assert.equal(await page.$eval('[data-filter-results]',e=>e.textContent),'');
 await page.selectOption('[data-mt="lote"]','L1');await url(page,'lote','L1');await poll(async()=>JSON.stringify(await options(page))===JSON.stringify([['Uno › Muelle',['L1 · 1 bloques']]]),'L2 desaparece');
 assert.equal(params(page).f,'sequence:s1');}));

test('Montaje: «Montaje →» (con block) ignora la memoria; sin foco se aplica y el lote recordado sigue',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=ideas');const key=`rodaje-filtros-${id}-montaje`,mem={q:'zzz',f:{sequence:['s1']}};await page.evaluate(([k,m])=>localStorage.setItem(k,JSON.stringify(m)),[key,mem]);
 // «Montaje →» del reproductor del story (data-sb-go): lleva el primer bloque del corte, así que la ruta trae foco y la memoria no se aplica.
 await load(page,'&view=storyboard&storyboard=sb-f');await page.waitForSelector('[data-sb-go="storyboard"]');assert.equal(await page.getAttribute('[data-sb-go="storyboard"]','data-action'),'sb-montaje:L2:b1');
 await page.$eval('[data-sb-go="storyboard"]',e=>e.click());await mtReady(page);await url(page,'view','montaje');
 assert.deepEqual([params(page).lote,params(page).block,params(page).q,params(page).f],['L2','b1',undefined,undefined]);
 assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'');assert.equal(await page.$$eval('[data-facet][aria-pressed="true"]',l=>l.length),0);
 assert.deepEqual(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key)),mem,'la memoria se conserva');
 await load(page,'&view=montaje&lote=L2&block=b1');await mtReady(page);
 assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'');assert.equal(await page.$eval('[data-mt="lote"]',s=>s.value),'L2');
 assert.deepEqual(await options(page),[['Uno › Muelle',['L1 · 1 bloques']],['Dos › Faro',['L2 · 2 bloques']],['Sin secuencia',['L0 · 1 bloques']]]);
 assert.deepEqual(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key)),mem,'la memoria se conserva');
 await load(page,'&view=montaje');await mtReady(page);assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'zzz');
 assert.equal(await page.$eval('[data-mt="lote"]',s=>s.value),'L2');assert.deepEqual(await options(page),[['Dos › Faro',['L2 · 2 bloques · fuera del filtro']]]);
 assert.match(await page.$eval('[data-filter-results]',e=>e.textContent),/Nada coincide/);}));

test('móvil (390×844): Pendientes y Montaje sin desbordes y con la barra pegada',{skip:SIN_CHROME},()=>session(async page=>{
 for(const v of ['issues','montaje']){await load(page,'&view='+v);await page.waitForSelector('.filter-bar');if(v==='montaje')await mtReady(page);await page.waitForTimeout(100);
  const m=await page.evaluate(()=>{const cs=getComputedStyle(document.querySelector('.filter-bar'));return {sw:document.documentElement.scrollWidth,pos:cs.position,top:parseFloat(cs.top),side:document.querySelector('.sidebar').offsetHeight};});
  assert.ok(m.sw<=390,v+': scrollWidth '+m.sw);assert.equal(m.pos,'sticky');assert.equal(m.top,m.side,v+': debajo de la barra lateral');}
},{width:390,height:844}));
