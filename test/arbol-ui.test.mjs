// Árbol de la escaleta y página del story en el navegador (#57): portada con actos abiertos y fichas sin pintar, nodos abiertos en localStorage,
// alias de rutas, migas y escena enfocada, selector de versión que no escribe y «Marcar como vigente» que sí. Servidor con RODAJE_DATA temporal.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
import {storyMigrationPlan} from '../app/workflow.mjs';
import {storysProject,storysSpec} from './fixtures/escaleta-storys.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-arbol-')),id='arbol-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const p=storyMigrationPlan(storysProject(),storysSpec()).next;p.id=id;fs.mkdirSync(path.join(DATA,id),{recursive:true});fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify(p));
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const BASE=`http://127.0.0.1:${port}/?project=${id}`;
const project=page=>page.evaluate(async id=>(await (await fetch('/api/project?id='+id)).json()),id);
const colgado=q=>q.episodes[0].sequences.find(s=>s.id==='x-colgado');
const open=(page,key)=>page.evaluate(k=>document.querySelector(`[data-tree="${k}"]`)?.open??null,key);
const session=fn=>withChrome(async browser=>{const page=await (await newRenderContext(browser,VIEWPORTS.lineaBase)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const load=async(page,q='')=>{await page.goto(BASE+q);await page.waitForSelector('#workspace .heading');await page.waitForTimeout(150);};

test('portada: árbol con actos abiertos, fichas cerradas sin pintar y nodos abiertos guardados',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page);assert.equal(new URL(page.url()).searchParams.get('view'),'tree');
 const t=await page.evaluate(()=>({acts:[...document.querySelectorAll('details.tree-act')].map(d=>[d.dataset.tree,d.open]),fichas:[...document.querySelectorAll('details.tree-ficha')].map(d=>[d.dataset.tree,d.open,d.querySelector(':scope>.tree-kids').innerHTML]),top:[...document.querySelectorAll('.tree>details')].map(d=>d.dataset.tree),active:document.querySelector('.sidebar button.active').textContent}));
 assert.deepEqual(t.acts,[['act/e1',true],['act/e2',true]]);assert.deepEqual(t.fichas.map(f=>f[0]),['seq/x-colgado','seq/x-prologo','seq/x-camino','seq/y-uno']);assert.ok(t.fichas.every(f=>f[1]===false&&f[2]===''));
 assert.deepEqual(t.top,['act/e1','act/e2','tests']);assert.equal(t.active,'Escaleta');
 await page.click('[data-tree="seq/x-colgado"]>summary');await page.waitForSelector('[data-tree="sb/sb-v2"]');
 assert.deepEqual(await page.$$eval('[data-tree="seq/x-colgado"] details.tree-story>summary',l=>l.map(s=>s.textContent)),['v1 · Prólogo · El Colgado1 escena · 2 viñetas','v2 · Prólogo · El Colgado (v2)vigente1 escena · 3 viñetas']);
 await page.click('[data-tree="sb/sb-v2"]>summary');await page.click('[data-tree="scene/sb-v2/sb-v2-e1"]>summary');await page.waitForSelector('.tree-panel');
 assert.equal(await page.$$eval('[data-tree="scene/sb-v2/sb-v2-e1"] .tree-panel',l=>l.length),3);
 assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),'rodaje-tree-'+id),['act/e1','act/e2','seq/x-colgado','sb/sb-v2','scene/sb-v2/sb-v2-e1']);
 await page.reload();await page.waitForSelector('.tree-panel');assert.equal(await open(page,'scene/sb-v2/sb-v2-e1'),true);
 await page.click('[data-action="tree-fold"]');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.querySelectorAll('details.tree-node[open]').length),0);
 assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),'rodaje-tree-'+id),[]);}));

test('rutas: outline lleva al árbol y episodes a Planos',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=outline');assert.equal(new URL(page.url()).searchParams.get('view'),'tree');
 await load(page,'&view=episodes');assert.equal(new URL(page.url()).searchParams.get('view'),'shots');
 assert.deepEqual(await page.$$eval('.shots-group>.eyebrow',l=>l.map(e=>e.textContent)),['Planos de storys','Pruebas']);}));

test('página del story: migas al árbol, escena enfocada, versión sin escribir y «Marcar como vigente»',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page);const r0=(await project(page)).revision;
 await load(page,'&view=storyboard&storyboard=sb-v1&scene=sb-v1-e1');
 assert.deepEqual(await page.$$eval('.crumbs li',l=>l.map(li=>[li.textContent,!!li.querySelector('a[data-route]')])),[['Acto I',true],['01 · Prólogo · El Colgado',true],['Story v1',true],['Cruce',false]]);
 assert.deepEqual(await page.$$eval('.sb-seq.target',l=>l.map(s=>s.dataset.sbScene)),['sb-v1-e1']);
 assert.deepEqual(await page.$$eval('[data-sb-version] option',l=>l.map(o=>[o.textContent,o.selected])),[['v1',true],['v2 · vigente',false]]);
 await page.selectOption('[data-sb-version]','sb-v2');await page.waitForFunction(()=>/storyboard=sb-v2/.test(location.search));
 assert.ok(!/scene=/.test(new URL(page.url()).search));assert.equal(colgado(await project(page)).currentStoryboard,'sb-v2');
 await page.selectOption('[data-sb-version]','sb-v1');await page.waitForFunction(()=>/storyboard=sb-v1/.test(location.search));
 await page.click('.crumbs a[href*="node=seq"]');await page.waitForFunction(()=>/view=tree/.test(location.search)&&!/node=/.test(location.search));
 assert.equal(await open(page,'seq/x-colgado'),true);assert.equal(await page.$eval('.tree-node.target',d=>d.dataset.tree),'seq/x-colgado');
 assert.equal((await project(page)).revision,r0,'navegar no guarda');
 await load(page,'&view=storyboard&storyboard=sb-v1');page.once('dialog',d=>d.accept());await page.click('[data-action="sb-current:sb-v1"]');
 await page.waitForSelector('.heading-actions .pill.ok');const q=await project(page);assert.equal(colgado(q).currentStoryboard,'sb-v1');assert.equal(q.revision,r0+1);}));
