// Tarjetas unificadas (#70) en el navegador: columnas por tipo (CARD_COLUMNS) y por ancho, marco 16:9, imágenes perezosas, imagen principal,
// un único enlace por tarjeta de nivel, arrastre y menú ⋯ de la viñeta, reproductores fuera de la rejilla. Servidor con RODAJE_DATA temporal.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath} from '../lib/chrome.mjs';
import {storyMigrationPlan} from '../app/workflow.mjs';
import {storysProject,storysSpec} from './fixtures/escaleta-storys.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-tarjetas-')),id='tarjetas-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
// Migrado con imágenes (rutas que no hace falta que existan: se compara src): carátula en x-prologo (del fixture), fotograma en v1a (sb-v1) y v2b
// (sb-v2, vigente de x-colgado), preview.snapshot en p6 (prueba x-fuego), imagen de ana, de loc y de un entorno; una segunda escena en sb-v2.
{const p=storyMigrationPlan(storysProject(),storysSpec()).next,panel=pid=>p.storyboards.flatMap(b=>b.sequences.flatMap(s=>s.shots)).find(t=>t.id===pid);p.id=id;
 panel('v1a').render='assets/v1a.png';panel('v2b').render='assets/v2b.png';p.episodes[0].sequences.find(s=>s.id==='x-fuego').shots.find(t=>t.id==='p6').preview={snapshot:'assets/p6.png'};
 p.storyboards.find(b=>b.id==='sb-v2').sequences.push({id:'sb-v2-e2',title:'Llegada',location:'loc',shots:[{id:'v2d',code:'B09',title:'Puerta',duration:3,cast:[],dialogue:[]}]});
 p.characters[0].image='assets/ana.png';p.locations[0].image='assets/loc.png';p.environments=[{id:'env-a',name:'Plaza 3D',glb:'modelos/plaza.glb',image:'assets/env.png'}];
 fs.mkdirSync(path.join(DATA,id),{recursive:true});fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify(p));}
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const BASE=`http://127.0.0.1:${port}/?project=${id}`,media=f=>'/api/asset?project='+id+'&file='+encodeURIComponent(f);
const project=page=>page.evaluate(async id=>(await (await fetch('/api/project?id='+id)).json()),id);
const session=(fn,viewport={width:1440,height:900})=>withChrome(async browser=>{const page=await (await newRenderContext(browser,viewport)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const load=async(page,q='')=>{await page.goto(BASE+q);await page.waitForSelector('#workspace .heading');await page.waitForTimeout(150);};
const cols=(page,sel='#workspace .tiles')=>page.$eval(sel,g=>getComputedStyle(g).gridTemplateColumns.split(' ').length);
const src=(page,sel)=>page.$eval(sel,i=>i.getAttribute('src'));
const PAGES={raiz:['&view=tree',5],acto:['&view=tree&node=act/e1',3],story:['&view=storyboard&storyboard=sb-v2',4],escena:['&view=storyboard&storyboard=sb-v2&scene=sb-v2-e1',3],planos:['&view=shots',4],personajes:['&view=characters',2]};

test('columnas por tipo a 1440 px',{skip:SIN_CHROME},()=>session(async page=>{
 for(const [k,[q,n]] of Object.entries(PAGES)){await load(page,q);assert.equal(await cols(page),n,k);}
 await load(page,'&view=environments');assert.equal(await cols(page),3,'entornos');await load(page,'&view=storyboards');assert.equal(await cols(page),3,'lista de storyboards');}));

test('topes responsive: 3 a 1000 px, 2 a 700 px y 1 a 400 px',{skip:SIN_CHROME},async()=>{
 for(const [w,raiz,pers] of [[1000,3,2],[700,2,2],[400,1,1]])await session(async page=>{
  await load(page,PAGES.raiz[0]);assert.equal(await cols(page),raiz,'raíz a '+w);await load(page,PAGES.personajes[0]);assert.equal(await cols(page),pers,'personajes a '+w);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desborde a '+w);},{width:w,height:800});});

test('marco 16:9 arriba, imágenes perezosas y marcador con rótulo',{skip:SIN_CHROME},()=>session(async page=>{
 for(const [k,[q]] of Object.entries(PAGES)){await load(page,q);
  const r=await page.$$eval('#workspace .tiles>.tile',l=>l.map(t=>{const f=t.firstElementChild.matches('.tile-link,.tile-still')?t.firstElementChild.firstElementChild:t.firstElementChild,b=f.getBoundingClientRect();
   return {frame:f.matches('.tile-media,.sb-frame'),ratio:b.width/b.height,lazy:[...f.querySelectorAll(':scope>img')].every(i=>i.loading==='lazy'),blank:f.matches('.tile-media')&&!f.querySelector('img')?f.querySelector('.tile-blank')?.textContent:null};}));
  assert.ok(r.length,k);for(const x of r){assert.ok(x.frame,k);assert.ok(Math.abs(x.ratio-16/9)<16/9*.02,k+' '+x.ratio);assert.ok(x.lazy,k);if(x.blank!==null)assert.ok(x.blank.length>0,k+': marcador sin rótulo');}}
 await load(page,PAGES.acto[0]);assert.equal(await page.textContent('[data-level="seq/x-camino"] .tile-blank'),await page.textContent('[data-level="seq/x-camino"] .tree-code'),'el marcador lleva el código');}));

test('imagen principal: carátula, story vigente, prueba y plano',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,PAGES.acto[0]);
 assert.equal(await src(page,'[data-level="seq/x-prologo"] .tile-media img'),media('assets/c.png'),'carátula');
 assert.equal(await src(page,'[data-level="seq/x-colgado"] .tile-media img'),media('assets/v2b.png'),'la del story vigente aunque sb-v1 tenga imagen');
 await load(page,PAGES.raiz[0]);assert.equal(await src(page,'[data-level="act/e1"] .tile-media img'),media('assets/v2b.png'));assert.equal(await src(page,'[data-level="tests"] .tile-media img'),media('assets/p6.png'),'Pruebas: su primer plano con imagen');
 assert.equal(await page.$('[data-level="act/e2"] .tile-media img'),null);
 await load(page,PAGES.planos[0]);assert.equal(await src(page,'article.tree-shot:has([data-action="shot:e1:x-fuego:p6"]) .tile-media img'),media('assets/p6.png'));
 assert.equal(await src(page,'article.tree-shot:has([data-action="shot:e1:x-v2:p4"]) .tile-media img'),media('assets/v2b.png'),'plano: la de su viñeta');
 await load(page,PAGES.story[0]);assert.equal(await src(page,'[data-level="scene/sb-v2/sb-v2-e1"] .tile-media img'),media('assets/v2b.png'),'escena: su primera viñeta con imagen');
 await load(page,PAGES.personajes[0]);assert.equal(await src(page,'.tile-character .tile-media img'),media('assets/ana.png'));
 await load(page,'&view=environments');assert.equal(await src(page,'.tile-environment .tile-media img'),media('assets/env.png'));}));

test('un único enlace por tarjeta de nivel; la imagen navega',{skip:SIN_CHROME},()=>session(async page=>{
 for(const q of [PAGES.raiz[0],PAGES.acto[0],'&view=tree&node=seq/x-colgado',PAGES.story[0]]){await load(page,q);
  const r=await page.$$eval('.level-item',l=>l.map(e=>[e.querySelectorAll('a.tile-link').length,e.querySelectorAll('a.tile-link :is(a,button,select,.rel-links)').length,e.querySelectorAll('a').length-e.querySelectorAll(':scope>.rel-links a,:scope>.tree-actions a').length]));
  assert.ok(r.length,q);for(const x of r)assert.deepEqual(x,[1,0,1],q);}
 await load(page,PAGES.acto[0]);await page.click('[data-level="seq/x-prologo"] .tile-media img');await page.waitForFunction(()=>/node=seq\/x-prologo/.test(decodeURIComponent(location.search)));
 assert.equal(await page.evaluate(()=>document.querySelector('dialog[open]')),null,'navega, no amplía');}));

test('viñeta: arrastre, soltar en el hueco de la rejilla y menú ⋯ sin recorte; reproductores fuera de la rejilla',{skip:SIN_CHROME},()=>session(async page=>{
 const order=async()=>(await project(page)).storyboards.find(b=>b.id==='sb-v2').sequences.find(s=>s.id==='sb-v2-e1').shots.map(t=>t.id);
 await load(page,PAGES.escena[0]);assert.deepEqual(await order(),['v2a','v2b','v2c']);
 await page.dragAndDrop('[data-sb-drag="v2c"] .sb-frame','[data-sb-drag="v2a"] .sb-frame');await page.waitForFunction(()=>document.querySelector('[data-sb-drag]')?.dataset.sbDrag==='v2c');await page.waitForTimeout(300);
 assert.deepEqual(await order(),['v2c','v2a','v2b']);
 const gap=await page.evaluate(()=>{const g=document.querySelector('[data-sb-grid]').getBoundingClientRect(),a=document.querySelector('[data-sb-drag]').getBoundingClientRect();return {x:a.right-g.left+8,y:a.top-g.top+a.height/2};});
 await page.dragAndDrop('[data-sb-drag="v2c"] .sb-frame','[data-sb-grid]',{targetPosition:gap});await page.waitForFunction(()=>[...document.querySelectorAll('[data-sb-drag]')].at(-1)?.dataset.sbDrag==='v2c');await page.waitForTimeout(300);
 assert.deepEqual(await order(),['v2a','v2b','v2c'],'soltar en el hueco la lleva al final');
 await page.click('[data-sb-drag="v2c"] .sb-more>summary');const b='[data-sb-drag="v2c"] [data-action="sb-move-to:v2c"]';await page.waitForSelector(b,{state:'visible'});
 assert.ok(await page.$eval(b,el=>{el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),'«Mover a escena…» visible, sin recorte');
 assert.equal(await page.$$eval('.tiles .sb-player,.tiles .sb-scene-videos,.tiles video.sb-cut-video',l=>l.length),0);
 await load(page,PAGES.story[0]);assert.equal(await page.$$eval('.tiles .sb-player',l=>l.length),0);}));
