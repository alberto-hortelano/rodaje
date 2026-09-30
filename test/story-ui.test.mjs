// Story, escena y viñeta por páginas en el navegador (#68): la lista de escenas del story, la escena con su rejilla, la viñeta con sus planos,
// rutas canónicas y avisos, «Mover a escena…» y arrastre, + Escena y borrados con replace, migas del estudio y de Animación, y móvil a 390 px.
// Servidor con RODAJE_DATA temporal y el fixture de #56 (textos inventados) con una segunda escena en v2 y un plano propio.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
import {storyMigrationPlan} from '../app/workflow.mjs';
import {storysProject,storysSpec,planShot} from './fixtures/escaleta-storys.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-story-')),id='story-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const LARGO='Secuencia-con-un-titulo-larguisimo-y-sin-espacios-para-probar-las-migas';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
// Migrado, con la escena «Llegada» (v2d con boceto) en v2, un plano propio en x-prologo y una ficha de título largo.
{const p=storyMigrationPlan(storysProject(),storysSpec()).next,seq=sid=>p.episodes.flatMap(e=>e.sequences).find(s=>s.id===sid);p.id=id;
 p.storyboards.find(b=>b.id==='sb-v2').sequences.push({id:'sb-v2-e2',title:'Llegada',location:'loc',shots:[{id:'v2d',code:'B01',title:'Viñeta B01',duration:6,cast:[],dialogue:[],sketch:'assets/v2d.png'}]});
 seq('x-prologo').shots.push(planShot('pp'));seq('y-uno').title=LARGO;
 fs.mkdirSync(path.join(DATA,id,'assets'),{recursive:true});fs.writeFileSync(path.join(DATA,id,'assets/v2d.png'),PNG);fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify(p));}
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const BASE=`http://127.0.0.1:${port}/?project=${id}`,SB='&view=storyboard&storyboard=sb-v2';
const project=page=>page.evaluate(async id=>(await (await fetch('/api/project?id='+id)).json()),id);
const scenes=(q,b='sb-v2')=>Object.fromEntries(q.storyboards.find(x=>x.id===b).sequences.map(s=>[s.id,s.shots.map(t=>t.id)]));
const session=(fn,viewport=VIEWPORTS.lineaBase)=>withChrome(async browser=>{const page=await (await newRenderContext(browser,viewport)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const settle=async page=>{await page.waitForSelector('#workspace .heading');await page.waitForTimeout(200);};
const load=async(page,q='')=>{await page.goto(BASE+q);await settle(page);};
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const len=page=>page.evaluate(()=>history.length);
const levels=page=>page.$$eval('[data-level]',l=>l.map(e=>e.dataset.level));
const crumbs=page=>page.$$eval('.crumbs li',l=>l.map(li=>[li.textContent,!!li.querySelector('a[data-route]')]));
const toast=page=>page.$eval('#toast',t=>getComputedStyle(t).display==='none'?'':t.textContent.trim());
const until=(page,re)=>page.waitForFunction(r=>new RegExp(r).test(decodeURIComponent(location.search)),re.source);
const go=async(page,sel,re)=>{await page.$eval(sel,e=>e.click());await until(page,re);await settle(page);};
const HEAD=[['Escaleta',true],['Acto I',true],['01 · Prólogo · El Colgado',true]];

test('story: cabecera, planteamiento y lista de escenas sin viñetas',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,SB);const r0=(await project(page)).revision;
 assert.deepEqual(await crumbs(page),[...HEAD,['Story v2',false]]);
 for(const a of ['new-sb-sequence:sb-v2','edit-storyboard:sb-v2','sb-to-episode:sb-v2'])assert.ok(await page.$(`.heading [data-action="${a}"]`),a);
 assert.ok(await page.$('.two .sb-stats'));assert.ok(await page.$('.two details.sb-help'));
 assert.deepEqual(await levels(page),['scene/sb-v2/sb-v2-e1','scene/sb-v2/sb-v2-e2']);
 const items=await page.$$eval('.level-scene',l=>l.map(e=>{const t=e.querySelector('.tile-media img,.tile-media .tile-blank');return [e.querySelector('.tree-code').textContent,e.querySelector('b').textContent,[...e.querySelectorAll('.level-meta .pill')].map(x=>x.textContent),t.tagName==='IMG'?t.loading:t.classList.contains('tile-blank')?'blank':'?'];}));
 assert.deepEqual(items,[['01','Camino',['3 viñetas','0 min 12 s'],'blank'],['02','Llegada',['1 viñeta','0 min 6 s'],'lazy']]);
 assert.equal(await page.$$eval('.sb-card',l=>l.length),0);assert.equal(await page.$$eval('[data-sb-grid]',l=>l.length),0);
 const h0=await len(page);await go(page,'[data-level="scene/sb-v2/sb-v2-e1"] a.level-link',/scene=sb-v2-e1/);
 assert.equal(await len(page),h0+1,'push');assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1'});
 assert.equal((await project(page)).revision,r0,'navegar no guarda');}));

test('escena: migas, rejilla arrastrable, acciones y Atrás con su scroll',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,SB+'&scene=sb-v2-e1');
 assert.deepEqual(await crumbs(page),[...HEAD,['Story v2',true],['Camino',false]]);assert.equal(await page.textContent('#workspace h1'),'Camino');
 assert.equal(await page.$$eval('.sb-card[draggable=true]',l=>l.length),3);assert.deepEqual(await page.$$eval('[data-sb-grid]',l=>l.map(g=>g.dataset.sbGrid)),['sb-v2-e1']);
 for(const a of ['sb-sequence:sb-v2:sb-v2-e1','new-sb-shot:sb-v2:sb-v2-e1','delete-sb-sequence:sb-v2:sb-v2-e1'])assert.ok(await page.$(`.heading [data-action="${a}"]`),a);
 assert.match(await page.getAttribute('[data-sb-drag="v2b"] h3 a','href'),/view=storyboard&storyboard=sb-v2&scene=sb-v2-e1&panel=v2b$/);
 await page.evaluate(()=>scrollTo(0,250));await page.waitForTimeout(300);const y0=await page.evaluate(()=>scrollY);assert.ok(y0>100,'la escena da para bajar: '+y0);
 await go(page,'[data-sb-drag="v2b"] h3 a',/panel=v2b/);await page.waitForFunction(()=>scrollY===0,null,{timeout:5000}).catch(()=>{});assert.equal(await page.evaluate(()=>scrollY),0,'la viñeta empieza arriba');
 await page.goBack();await until(page,/scene=sb-v2-e1$/);await settle(page);assert.equal(await page.evaluate(()=>scrollY),y0,'Atrás vuelve a la escena con su scroll');},{width:1280,height:500}));

test('viñeta: tarjeta grande, acciones, planos y estudio con migas hasta la viñeta',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,SB+'&scene=sb-v2-e1&panel=v2b');const r0=(await project(page)).revision;
 assert.deepEqual(await crumbs(page),[...HEAD,['Story v2',true],['Camino',true],['A02 · Viñeta A02',false]]);assert.equal(await page.textContent('#workspace h1'),'A02 · Viñeta A02');
 assert.equal(await page.$$eval('.sb-card-page',l=>l.map(e=>e.getAttribute('draggable')+'|'+e.dataset.sbPanel).join()),'null|v2b');assert.equal(await page.$$eval('[data-sb-drag]',l=>l.length),0);
 for(const a of ['sb-shot:sb-v2:sb-v2-e1:v2b','gen-sb:v2b','sb-prompt:v2b','sb-move-to:v2b','sb-move:v2b:-1','delete-sb-shot:v2b'])assert.ok(await page.$(`.sb-card-page [data-action="${a}"]`),a);
 assert.deepEqual(await page.$$eval('.level-section .tree-shot [data-action^="shot:"]',l=>l.map(b=>b.dataset.action)),['shot:e1:x-v2:p4']);
 await go(page,'[data-action="shot:e1:x-v2:p4"]',/view=shot&/);
 assert.deepEqual(await crumbs(page),[...HEAD,['Story v2',true],['Camino',true],['A02 · Viñeta A02',true],['P02 · p4',false]]);
 await go(page,'.crumbs a[href*="panel=v2b"]',/panel=v2b/);assert.ok(await page.$('[data-sb-panel="v2b"]'));
 assert.equal((await project(page)).revision,r0,'navegar no guarda');}));

test('rutas canónicas y avisos',{skip:SIN_CHROME},()=>session(async page=>{
 const open=async q=>{await load(page,'&view=overview');const h0=await len(page);await page.goto(BASE+q);await settle(page);assert.equal(await len(page),h0+1,'sin entrada nueva: '+q);};
 await open(SB+'&scene=sb-v2-e2&panel=v2a');assert.deepEqual([params(page).scene,params(page).panel],['sb-v2-e1','v2a']);assert.ok(await page.$('[data-sb-panel="v2a"]'));
 await open(SB+'&panel=v2d');assert.deepEqual([params(page).scene,params(page).panel],['sb-v2-e2','v2d']);
 await open(SB+'&scene=sb-v2-e1&panel=nada');assert.deepEqual([params(page).scene,params(page).panel],['sb-v2-e1',undefined]);assert.ok(await page.$('[data-sb-grid="sb-v2-e1"]'));assert.equal(await toast(page),'No existe la viñeta: nada');
 await open(SB+'&scene=nada');assert.deepEqual([params(page).scene,params(page).panel],[undefined,undefined]);assert.ok(await page.$('.level-scene'));assert.equal(await toast(page),'No existe la escena: nada');
 await open('&view=storyboard&storyboard=sb-v1&panel=v2a');assert.deepEqual([params(page).storyboard,params(page).scene,params(page).panel],['sb-v1',undefined,undefined],'viñeta de otro story');
 await open('&view=tree&node=panel/v2a');assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1',panel:'v2a'});
 await open('&view=tree&node=scene/sb-v2/sb-v2-e2');assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e2'});assert.ok(await page.$('[data-sb-grid="sb-v2-e2"]'));}));

test('Animación: migas del estudio con el plano enlazado y «Animación» detrás',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=anim&episode=e1&sequence=x-cruce&shot=p8');
 assert.deepEqual(await crumbs(page),[['Escaleta',true],['Pruebas',true],['Prueba 3D · El cruce',true],['P01 · p8',true],['Animación',false]]);
 assert.match(await page.getAttribute('.crumbs a[href*="shot=p8"]','href'),/view=shot&episode=e1&sequence=x-cruce&shot=p8$/);
 await load(page,'&view=shot&episode=e1&sequence=x-prologo&shot=pp');assert.deepEqual(await crumbs(page),[['Escaleta',true],['Acto I',true],['02 · Prólogo · La carga',true],['P01 · pp',false]]);}));

test('móvil a 390 px: viñeta, escena, ficha larga y raíz sin desbordar; migas enteras',{skip:SIN_CHROME},()=>session(async page=>{
 for(const q of [SB+'&scene=sb-v2-e1&panel=v2a',SB+'&scene=sb-v2-e1','&view=shot&episode=e1&sequence=x-v2&shot=p3','&view=tree&node=seq/y-uno','&view=tree']){await load(page,q);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=0,'documento: '+q);
  const m=await page.evaluate(()=>{const ol=document.querySelector('.crumbs ol');if(!ol)return null;const first=ol.querySelector('li>*'),cur=ol.querySelector('[aria-current]');
   return {ol:ol.scrollWidth-ol.clientWidth,first:first.scrollWidth<=first.clientWidth,cur:cur.scrollWidth<=cur.clientWidth&&cur.textContent===cur.title,right:ol.getBoundingClientRect().right<=innerWidth};});
  if(!m){assert.ok(q.endsWith('view=tree'),q);continue;}
  assert.ok(m.ol<=0,'migas: '+q);assert.ok(m.first,'primera entera: '+q);assert.ok(m.cur,'actual entera: '+q);assert.ok(m.right,q);}
 assert.deepEqual(await page.$eval('[data-level="tests"]',e=>[e.querySelector('b').textContent,e.querySelector('.level-sub').getBoundingClientRect().height>0]),['Pruebas',true]);},{width:390,height:844}));

// Desde aquí, cambios en el proyecto.
test('mover: «Mover a escena…» al final de otra escena del mismo story y arrastre dentro de la escena',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,SB+'&scene=sb-v2-e1&panel=v2c');const r0=(await project(page)).revision,h0=await len(page);
 await page.click('.sb-card-page .sb-more>summary');await page.click('[data-action="sb-move-to:v2c"]');await page.waitForSelector('#modal[open] select[name=scene]');
 assert.deepEqual(await page.$$eval('#modal select[name=scene] option',l=>l.map(o=>[o.value,o.textContent])),[['sb-v2-e2','Llegada · 1 viñeta']]);
 await page.click('#modal [type=submit]');await until(page,/scene=sb-v2-e2&panel=v2c/);await settle(page);
 let q=await project(page);assert.deepEqual(scenes(q),{'sb-v2-e1':['v2a','v2b'],'sb-v2-e2':['v2d','v2c']});assert.equal(q.revision,r0+1);assert.equal(await len(page),h0+1,'la viñeta en su escena nueva es otra entrada');
 assert.deepEqual((await crumbs(page)).at(-2),['Llegada',true]);
 await load(page,SB+'&scene=sb-v2-e1');await page.dragAndDrop('[data-sb-drag="v2b"] .sb-frame','[data-sb-drag="v2a"] .sb-frame');await page.waitForTimeout(600);
 q=await project(page);assert.deepEqual(scenes(q)['sb-v2-e1'],['v2b','v2a'],'arrastre delante de otra');assert.equal(q.revision,r0+2);
 await load(page,'&view=storyboard&storyboard=sb-v1&scene=sb-v1-e1&panel=v1a');assert.equal(await page.$('[data-action="sb-move-to:v1a"]'),null,'un story de una escena no ofrece mover');}));

test('+ Escena abre la nueva; eliminar escena o viñeta vuelve con replace',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,SB);const h0=await len(page);
 await page.click('.heading [data-action="new-sb-sequence:sb-v2"]');await page.waitForSelector('#modal[open] input[name=title]');await page.fill('#modal input[name=title]','Salida');await page.click('#modal [type=submit]');
 await until(page,/scene=/);await settle(page);const sid=params(page).scene;
 assert.equal(await page.textContent('#workspace h1'),'Salida');assert.equal(await len(page),h0+1);assert.deepEqual(Object.keys(scenes(await project(page))).at(-1),sid);
 page.once('dialog',d=>d.accept());await page.click(`.heading [data-action="delete-sb-sequence:sb-v2:${sid}"]`);await page.waitForFunction(()=>!/scene=/.test(location.search));await settle(page);
 assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v2'});assert.equal(await len(page),h0+1,'replace');assert.ok(!(sid in scenes(await project(page))));
 await load(page,SB+'&scene=sb-v2-e2&panel=v2d');const h1=await len(page);
 await page.click('.sb-card-page .sb-more>summary');page.once('dialog',d=>d.accept());await page.click('[data-action="delete-sb-shot:v2d"]');await page.waitForFunction(()=>!/panel=/.test(location.search));await settle(page);
 assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e2'});assert.equal(await len(page),h1,'replace');assert.equal(await page.$('[data-sb-drag="v2d"]'),null);
 await page.goBack();await page.waitForTimeout(400);assert.notEqual(params(page).panel,'v2d','Atrás no vuelve a la viñeta borrada');}));
