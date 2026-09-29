// Buscador y facetas en el navegador (#59): teclear no repinta la vista (foco y cursor intactos), facetas en la URL y en la memoria por vista,
// Storyboards agrupada con coincidencias de viñeta, Planos con reparto heredado y numeración original, filtrar sin escribir y móvil a 390 px.
// Servidor con RODAJE_DATA temporal y el fixture de #56 migrado (textos inventados).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
import {storyMigrationPlan} from '../app/workflow.mjs';
import {storysProject,storysSpec} from './fixtures/escaleta-storys.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-filtros-')),id='filtros-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
// Migrado más una zona, una viñeta con zona en la que habla bea, un story sin ficha, reparto en una prueba y visibleCast en otra.
const p=storyMigrationPlan(storysProject(),storysSpec()).next;p.id=id;p.stage={zones:[{id:'norte',label:'Norte'}]};
Object.assign(p.storyboards.find(b=>b.id==='sb-v2').sequences[0].shots[1],{zone:'norte',dialogue:[{who:'Bea',text:'Hola.'}]});
p.storyboards.push({id:'sb-suelto',title:'Suelto',subtitle:'Borrador',sequences:[{id:'su-e1',title:'Patio',location:'otro',shots:[{id:'su1',code:'Z09',title:'Mirada',duration:3,cast:[],dialogue:[]}]}]});
const seqs=p.episodes[0].sequences,seq=x=>seqs.find(s=>s.id===x);seq('x-cruce').cast=[{character:'bea',x:0,z:0,yaw:0}];seq('x-fuego').shots[1].visibleCast=['bea'];
fs.mkdirSync(path.join(DATA,id),{recursive:true});fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify(p));
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const BASE=`http://127.0.0.1:${port}/?project=${id}`;
const revision=async page=>(await page.evaluate(async id=>(await (await fetch('/api/project?id='+id)).json()),id)).revision;
const session=(fn,viewport=VIEWPORTS.lineaBase)=>withChrome(async browser=>{const page=await (await newRenderContext(browser,viewport)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const load=async(page,q='')=>{await page.goto(BASE+q);await page.waitForSelector('#workspace .heading');await page.waitForTimeout(150);};
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const chip=(facet,value)=>`[data-facet="${facet}"][data-value="${value}"]`;
const pressed=(page,facet,value)=>page.$eval(chip(facet,value),b=>b.getAttribute('aria-pressed'));

test('teclear solo repinta los resultados: foco, cursor y vista intactos; q en la URL',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=storyboards');const r0=await revision(page);
 await page.evaluate(()=>{window.__shell=document.querySelector('.shell');});const before=await page.$eval('[data-filter-results]',el=>el.innerHTML);
 await page.click('[data-filter-q]');await page.keyboard.type('abc');await page.keyboard.press('ArrowLeft');await page.keyboard.type('x');
 await page.waitForFunction(()=>new URLSearchParams(location.search).get('q')==='abxc');
 const s=await page.evaluate(()=>{const q=document.querySelector('[data-filter-q]');return {value:q.value,pos:q.selectionStart,active:document.activeElement===q,same:window.__shell===document.querySelector('.shell'),results:document.querySelector('[data-filter-results]').innerHTML};});
 assert.deepEqual([s.value,s.pos,s.active,s.same],['abxc',3,true,true]);assert.notEqual(s.results,before);assert.match(s.results,/Nada coincide/);
 assert.equal(await revision(page),r0,'buscar no guarda');}));

test('facetas: aria-pressed, f en la URL, contador y Limpiar; sobreviven a la recarga',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=storyboards');const r0=await revision(page);
 assert.equal(await page.$eval('[data-filter-count]',e=>e.textContent),'6 resultados');assert.equal(await page.$eval('[data-filter-clear]',b=>b.hidden),true);
 await page.click(chip('kind','current'));assert.equal(await pressed(page,'kind','current'),'true');assert.equal(params(page).f,'kind:current');assert.match(new URL(page.url()).search,/f=kind:current/);
 const state=async()=>page.evaluate(()=>({count:document.querySelector('[data-filter-count]').textContent,clear:document.querySelector('.filter-bar [data-filter-clear]').textContent,hidden:document.querySelector('.filter-bar [data-filter-clear]').hidden,cards:document.querySelectorAll('[data-filter-results] article').length}));
 assert.deepEqual(await state(),{count:'2 de 6 resultados',clear:'Limpiar (1)',hidden:false,cards:2});
 await page.click('[data-filter-q]');await page.keyboard.type('carga');await page.waitForFunction(()=>new URLSearchParams(location.search).get('q')==='carga');
 assert.deepEqual(await state(),{count:'1 de 6 resultados',clear:'Limpiar (2)',hidden:false,cards:1});
 await page.reload();await page.waitForSelector('[data-filter-results] article');
 assert.equal(await pressed(page,'kind','current'),'true');assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'carga');assert.deepEqual(await state(),{count:'1 de 6 resultados',clear:'Limpiar (2)',hidden:false,cards:1});
 await page.click('.filter-bar [data-filter-clear]');const u=params(page);assert.deepEqual([u.q,u.f],[undefined,undefined]);
 assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'');assert.equal(await page.evaluate(()=>document.activeElement?.matches('[data-filter-q]')),true);assert.equal((await state()).cards,6);
 assert.equal(await revision(page),r0,'filtrar no guarda');}));

test('navegación: el menú no arrastra filtros, la memoria vuelve por vista y una secuencia enfocada la ignora',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=storyboards');await page.click(chip('kind','other'));await page.click('[data-filter-q]');await page.keyboard.type('colgado');
 await page.waitForFunction(()=>new URLSearchParams(location.search).get('q')==='colgado');
 await page.click('.sidebar [data-action="nav:shots"]');await page.waitForSelector('[data-shots-seq]');
 assert.deepEqual([params(page).view,params(page).q,params(page).f],['shots',undefined,undefined]);assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'');
 await page.click(chip('panel','no'));assert.equal(params(page).f,'panel:no');
 await page.click('.sidebar [data-action="nav:storyboards"]');await page.waitForSelector('[data-filter-results] article');
 assert.deepEqual([params(page).q,params(page).f],['colgado','kind:other']);assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'colgado');assert.equal(await pressed(page,'kind','other'),'true');
 await load(page,'&view=shots&sequence=x-v2');assert.deepEqual([params(page).q,params(page).f,params(page).sequence],[undefined,undefined,undefined]);
 assert.equal(await page.$eval('[data-filter-q]',q=>q.value),'');assert.equal(await page.$eval('.shots-seq.target',d=>d.dataset.shotsSeq),'x-v2');
 await load(page,'&view=shots');assert.equal(params(page).f,'panel:no','la memoria de Planos sigue ahí');
 await load(page,'&view=storyboards&q=suelto');assert.deepEqual([params(page).q,params(page).f],['suelto',undefined],'la URL manda sobre la memoria');}));

test('Storyboards: acto › ficha, Pruebas y Sin secuencia; una viñeta enlaza a su página y una escena a la suya',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=storyboards');const r0=await revision(page);
 const t=await page.evaluate(()=>({acts:[...document.querySelectorAll('.sbs-act>h2')].map(e=>e.textContent),fichas:[...document.querySelectorAll('.sbs-ficha>h3 a')].map(a=>[a.textContent,new URL(a.href).searchParams.get('node')]),groups:[...document.querySelectorAll('.sbs-group>.eyebrow')].map(e=>e.textContent),pills:[...document.querySelectorAll('.sbs-ficha article .pill')].map(e=>e.textContent),actions:[...document.querySelectorAll('.heading [data-action]')].map(b=>b.dataset.action),zone:!!document.querySelector('[data-facet="zone"]')}));
 assert.deepEqual(t.acts,['Acto I']);assert.deepEqual(t.fichas,[['01 · Prólogo · El Colgado','seq/x-colgado'],['02 · Prólogo · La carga','seq/x-prologo']]);assert.deepEqual(t.groups,['Pruebas','Sin secuencia']);
 assert.deepEqual(t.pills,['v1','v2','vigente','v1','vigente']);assert.deepEqual(t.actions,['import-storyboard','new-storyboard']);assert.equal(t.zone,true);
 await page.click('[data-filter-q]');await page.keyboard.type('Z09');await page.waitForFunction(()=>new URLSearchParams(location.search).get('q')==='Z09');
 const hits=await page.$$eval('.filter-hits a',l=>l.map(a=>[a.textContent,new URL(a.href).search]));
 assert.deepEqual(hits.map(h=>h[0]),['Patio · Z09 Mirada']);assert.match(hits[0][1],/view=storyboard&storyboard=sb-suelto&scene=su-e1&panel=su1$/);
 await page.click('.filter-hits a');await page.waitForFunction(()=>/view=storyboard&/.test(location.search));await page.waitForSelector('[data-sb-panel="su1"]');
 await load(page,'&view=storyboards&q=Patio');const sc=await page.$$eval('.filter-hits a',l=>l.map(a=>[a.textContent,new URL(a.href).search]));
 assert.deepEqual(sc.map(h=>h[0]),['Patio']);assert.match(sc[0][1],/view=storyboard&storyboard=sb-suelto&scene=su-e1$/,'la escena, sin viñeta');
 await page.click('.filter-hits a');await page.waitForFunction(()=>/scene=su-e1/.test(location.search));await page.waitForSelector('[data-sb-grid="su-e1"]');
 await load(page,'&view=storyboards&f=cast:bea');assert.deepEqual(await page.$$eval('.filter-hits a',l=>l.map(a=>a.textContent)),['Camino · A02 Viñeta A02']);
 assert.deepEqual(await page.$$eval('.sbs-group .card h2',l=>l.map(h=>h.textContent)),['El fuego','Prueba 3D · El cruce'],'pruebas con visibleCast y con reparto propio');
 assert.equal(await revision(page),r0);}));

test('Planos: personaje heredado deja sus planos con su número original; sin actos vacíos',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=shots');const r0=await revision(page);assert.ok(await page.$('.shots-empty'));
 await page.click(chip('cast','bea'));await page.waitForFunction(()=>new URLSearchParams(location.search).get('f')==='cast:bea');
 const t=await page.evaluate(()=>({seqs:[...document.querySelectorAll('[data-shots-seq]')].map(s=>[s.dataset.shotsSeq,[...s.querySelectorAll('.card .pill')].map(x=>x.textContent)]),acts:[...document.querySelectorAll('[data-filter-results]>.panel h2')].map(h=>h.textContent),empty:!!document.querySelector('.shots-empty'),count:document.querySelector('[data-filter-count]').textContent}));
 assert.deepEqual(t.seqs,[['x-fuego',['P02']],['x-cruce',['P01']]]);assert.deepEqual(t.acts,['Acto I']);assert.equal(t.empty,false);assert.equal(t.count,'2 de 8 planos');
 await load(page,'&view=shots&sequence=x-v1&f=cast:bea');assert.match(await page.$eval('[data-filter-results]',e=>e.textContent),/La secuencia enfocada queda oculta por los filtros/);
 await page.click('.filter-hidden [data-filter-clear]');assert.equal(params(page).f,undefined);assert.ok(await page.$('[data-shots-seq="x-v1"]'));
 assert.equal(await revision(page),r0);}));

test('móvil (390×844): sin desbordes, entrada de 16 px y barra pegada en las dos vistas',{skip:SIN_CHROME},()=>session(async page=>{
 for(const v of ['storyboards','shots']){await load(page,'&view='+v);await page.evaluate(()=>{document.querySelector('[data-filter-facets]').open=true;});await page.waitForTimeout(100);
  const m=await page.evaluate(()=>{const bar=document.querySelector('.filter-bar'),cs=getComputedStyle(bar);return {sw:document.documentElement.scrollWidth,font:parseFloat(getComputedStyle(document.querySelector('[data-filter-q]')).fontSize),pos:cs.position,top:parseFloat(cs.top),side:document.querySelector('.sidebar').offsetHeight};});
  assert.ok(m.sw<=390,v+': scrollWidth '+m.sw);assert.ok(m.font>=16,v+': '+m.font);assert.equal(m.pos,'sticky');assert.equal(m.top,m.side,v+': debajo de la barra lateral');
  await page.evaluate(()=>scrollTo(0,600));await page.waitForTimeout(100);const y=await page.$eval('.filter-bar',b=>Math.round(b.getBoundingClientRect().top));assert.equal(y,m.side,v+': pegada al desplazar');}
},{width:390,height:844}));
