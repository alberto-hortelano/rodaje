// Escaleta por niveles en el navegador (#67): raíz, acto, ficha, prueba, Pruebas y Sin secuencia como páginas con migas; alias y claves que no
// son páginas; migas del story hasta la ficha; scroll por página; limpieza de rodaje-tree-; migas en una línea a 390 px. Servidor con RODAJE_DATA temporal.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
import {storyMigrationPlan} from '../app/workflow.mjs';
import {storysProject,storysSpec,planShot} from './fixtures/escaleta-storys.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-arbol-')),id='arbol-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const LARGO='Secuencia-con-un-titulo-larguisimo-y-sin-espacios-para-probar-las-migas';
// Migrado más un story sin ficha, un plano del contenedor de v2 sin viñeta y una ficha de título largo sin espacios.
{const p=storyMigrationPlan(storysProject(),storysSpec()).next,seq=sid=>p.episodes.flatMap(e=>e.sequences).find(s=>s.id===sid);p.id=id;
 p.storyboards.push({id:'sb-suelto',title:'Suelto',sequences:[{id:'su-e1',title:'Patio',location:'otro',shots:[{id:'su1',code:'Z09',title:'Mirada',duration:3,cast:[],dialogue:[]}]}]});
 seq('x-v2').shots.push(planShot('p9','no-es-vineta'));seq('y-uno').title=LARGO;
 fs.mkdirSync(path.join(DATA,id),{recursive:true});fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify(p));}
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const BASE=`http://127.0.0.1:${port}/?project=${id}`;
const project=page=>page.evaluate(async id=>(await (await fetch('/api/project?id='+id)).json()),id);
const colgado=q=>q.episodes[0].sequences.find(s=>s.id==='x-colgado');
const session=(fn,viewport=VIEWPORTS.lineaBase)=>withChrome(async browser=>{const page=await (await newRenderContext(browser,viewport)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const load=async(page,q='')=>{await page.goto(BASE+q);await page.waitForSelector('#workspace .heading');await page.waitForTimeout(150);};
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const levels=page=>page.$$eval('[data-level]',l=>l.map(e=>e.dataset.level));
const crumbs=page=>page.$$eval('.crumbs li',l=>l.map(li=>[li.textContent,!!li.querySelector('a[data-route]')]));
const counter=page=>page.evaluate(async()=>(await import('/workflow.mjs')).relationCounters.relatedTo);
const toast=page=>page.$eval('#toast',t=>getComputedStyle(t).display==='none'?'':t.textContent.trim());
const go=async(page,sel,re)=>{await page.click(sel);await page.waitForFunction(r=>new RegExp(r).test(decodeURIComponent(location.search)),re.source);await page.waitForSelector('#workspace .heading');await page.waitForTimeout(150);};

test('raíz: actos con recuento, Pruebas y Sin secuencia; sin details ni relaciones; borra rodaje-tree',{skip:SIN_CHROME},()=>session(async page=>{
 await page.addInitScript(k=>{if(!sessionStorage.getItem('sembrado')){localStorage.setItem(k,'["act/e1"]');sessionStorage.setItem('sembrado','1');}},'rodaje-tree-'+id);await load(page);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),'rodaje-tree-'+id),null);assert.equal(params(page).view,'tree');
 assert.deepEqual(await levels(page),['act/e1','act/e2','tests','unlinked']);
 assert.equal(await page.$$eval('details.tree-node',l=>l.length),0);assert.equal(await page.$$eval('.crumbs',l=>l.length),0);
 assert.equal(await counter(page),0);assert.equal(await page.$$eval('.rel-links',l=>l.length),0);
 assert.equal(await page.textContent('.sidebar button.active'),'Escaleta');assert.equal(await page.$$eval('[data-action="tree-fold"]',l=>l.length),0);
 assert.deepEqual(await page.$$eval('[data-level="act/e1"] .level-meta .pill',l=>l.map(e=>e.textContent)),['9 min','3 secuencias','3 storys']);
 assert.match(await page.textContent('[data-level="tests"]'),/Pruebas.*2 secuencias/);assert.match(await page.textContent('[data-level="unlinked"]'),/Sin secuencia.*1 story/);}));

test('acto: fichas con miniatura perezosa y enlaces; relaciones ≤ 1 + fichas',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page);await go(page,'[data-level="act/e1"] a.level-link',/node=act\/e1/);
 assert.equal(params(page).node,'act/e1');assert.deepEqual(await crumbs(page),[['Escaleta',true],['Acto I',false]]);
 assert.deepEqual(await levels(page),['seq/x-colgado','seq/x-prologo','seq/x-camino']);
 assert.deepEqual(await page.$$eval('.level-ficha .level-link',l=>l.map(a=>{const t=a.querySelector('.tree-thumb');return t.tagName==='IMG'?t.loading:t.classList.contains('blank')?'blank':'?';})),['blank','lazy','blank']);
 const fichas=await page.$$eval('.level-ficha',l=>l.length);assert.ok(await counter(page)<=1+fichas);assert.equal(await page.$$eval('.level-link .rel-links',l=>l.length),0);
 assert.equal(await page.$$eval('.rel-head',l=>l.length),1);
 await go(page,'[data-level="seq/x-prologo"] img.tree-thumb',/node=seq\/x-prologo/);assert.equal(await page.evaluate(()=>document.querySelector('dialog[open]')),null,'la miniatura navega, no amplía');}));

// Antes de «ficha», que cambia el vigente a v1.
test('story: migas desde la Escaleta y vuelta a la ficha',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page);const r0=(await project(page)).revision;
 await load(page,'&view=storyboard&storyboard=sb-v1&scene=sb-v1-e1');
 assert.deepEqual(await crumbs(page),[['Escaleta',true],['Acto I',true],['01 · Prólogo · El Colgado',true],['Story v1',true],['Cruce',false]]);
 assert.deepEqual(await page.$$eval('.sb-seq.target',l=>l.map(s=>s.dataset.sbScene)),['sb-v1-e1']);
 assert.deepEqual(await page.$$eval('[data-sb-version] option',l=>l.map(o=>[o.textContent,o.selected])),[['v1',true],['v2 · vigente',false]]);
 await page.selectOption('[data-sb-version]','sb-v2');await page.waitForFunction(()=>/storyboard=sb-v2/.test(location.search));
 assert.ok(!/scene=/.test(new URL(page.url()).search));assert.equal(colgado(await project(page)).currentStoryboard,'sb-v2');
 await go(page,'.crumbs a[href*="node=seq"]',/view=tree&node=seq\/x-colgado/);await page.waitForTimeout(200);
 assert.deepEqual([params(page).view,params(page).node],['tree','seq/x-colgado'],'node se queda en la URL');assert.ok(await page.$('.ficha-body'));
 assert.equal((await project(page)).revision,r0,'navegar no guarda');}));

test('ficha: tarjeta completa, storys por versión y vigente',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=tree&node=seq/x-colgado');const r0=(await project(page)).revision;
 assert.deepEqual(await crumbs(page),[['Escaleta',true],['Acto I',true],['01 · Prólogo · El Colgado',false]]);
 for(const s of ['.ficha-body','textarea[data-cover-prompt="x-colgado"]','[data-action="gen-cover:x-colgado"]','[data-action="upload-cover:x-colgado"]','[data-action="edit-outline:x-colgado"]'])assert.ok(await page.$(s),s);
 assert.deepEqual(await levels(page),['sb/sb-v1','sb/sb-v2']);
 assert.ok(await page.$('[data-level="sb/sb-v2"] .pill.ok'));assert.ok(await page.$('[data-level="sb/sb-v1"] [data-action="sb-current:sb-v1"]'));assert.equal(await page.$('[data-level="sb/sb-v2"] [data-action^="sb-current"]'),null);
 assert.match(await page.getAttribute('[data-level="sb/sb-v1"] a.level-link','href'),/view=storyboard&storyboard=sb-v1$/);
 await page.click('.ficha-body details>summary');await page.fill('textarea[data-cover-prompt="x-colgado"]','Prompt nuevo.');await page.dispatchEvent('textarea[data-cover-prompt="x-colgado"]','change');await page.click('[data-action="save"]');await page.waitForTimeout(400);
 assert.equal(params(page).node,'seq/x-colgado','editar el prompt no cambia de página');const r1=(await project(page)).revision;assert.equal(colgado(await project(page)).coverPrompt,'Prompt nuevo.');
 page.once('dialog',d=>d.accept());await page.click('[data-action="sb-current:sb-v1"]');await page.waitForSelector('[data-level="sb/sb-v1"] .pill.ok');
 const q=await project(page);assert.equal(colgado(q).currentStoryboard,'sb-v1');assert.equal(q.revision,r1+1);assert.ok(r1>r0);assert.equal(params(page).node,'seq/x-colgado');
 await go(page,'[data-level="sb/sb-v2"] a.level-link',/view=storyboard&storyboard=sb-v2/);assert.equal((await project(page)).revision,r1+1,'navegar no guarda');}));

test('prueba, Pruebas y Sin secuencia',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=tree&node=tests');assert.deepEqual(await levels(page),['seq/x-fuego','seq/x-cruce']);assert.deepEqual(await crumbs(page),[['Escaleta',true],['Pruebas',false]]);
 await go(page,'[data-level="seq/x-cruce"] a.level-link',/node=seq\/x-cruce/);
 assert.deepEqual(await crumbs(page),[['Escaleta',true],['Pruebas',true],['Prueba 3D · El cruce',false]]);
 assert.ok(await page.$('.tree-shot [data-action="shot:e1:x-cruce:p8"]'));assert.ok(await page.$('.tree-shot [data-action="anim:e1:x-cruce:p8"]'));
 await page.click('.heading [data-action="shots:x-cruce"]');await page.waitForFunction(()=>/view=shots/.test(location.search));assert.equal(params(page).view,'shots');
 await load(page,'&view=tree&node=unlinked');assert.deepEqual(await levels(page),['sb/sb-suelto']);assert.match(await page.getAttribute('a.level-link','href'),/view=storyboard&storyboard=sb-suelto$/);}));

test('alias y claves que no son páginas',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=outline&node=act/e1');assert.deepEqual([params(page).view,params(page).node],['tree','act/e1']);
 await load(page,'&view=tree&node=sb/sb-v1');assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v1'});
 await load(page,'&view=tree&node=scene/sb-v2/sb-v2-e1');assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1'});
 assert.deepEqual(await page.$$eval('.sb-seq.target',l=>l.map(s=>s.dataset.sbScene)),['sb-v2-e1']);
 await load(page,'&view=tree&node=orphans/sb-v2');assert.deepEqual(params(page),{project:id,view:'shots'},'el foco de Planos se consume');assert.deepEqual(await page.$$eval('.shots-seq.target',l=>l.map(s=>s.dataset.shotsSeq)),['x-v2']);
 await load(page,'&view=tree&node=nada');assert.deepEqual(params(page),{project:id,view:'tree'});assert.equal(await toast(page),'No existe en la escaleta: nada');
 await load(page,'&view=tree&node=scene/sb-v2/nada');assert.deepEqual(params(page),{project:id,view:'storyboard',storyboard:'sb-v2'});assert.equal(await toast(page),'No existe en la escaleta: scene/sb-v2/nada');}));

test('scroll por página: cada nivel recuerda el suyo',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page);await page.evaluate(()=>scrollTo(0,300));await page.waitForTimeout(100);const y0=await page.evaluate(()=>scrollY);assert.ok(y0>100,'la raíz da para bajar: '+y0);
 await go(page,'[data-level="unlinked"] a.level-link',/node=unlinked/);assert.equal(await page.evaluate(()=>scrollY),0,'el nivel empieza arriba');
 await go(page,'.crumbs a[data-route]',/view=tree$/);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>scrollY),y0);},{width:1280,height:360}));

test('móvil a 390 px: migas en una línea sin desbordar',{skip:SIN_CHROME},()=>session(async page=>{
 for(const q of ['&view=tree&node=seq/y-uno','&view=storyboard&storyboard=sb-v1&scene=sb-v1-e1','&view=tree&node=seq/x-colgado','&view=tree']){await load(page,q);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=0,q);
  const m=await page.evaluate(()=>{const ol=document.querySelector('.crumbs ol');if(!ol)return null;const r=ol.getBoundingClientRect(),cur=ol.querySelector('[aria-current]').getBoundingClientRect(),lis=[...ol.children];
   return {right:r.right,inner:innerWidth,cur:cur.right,olRight:r.right,rows:new Set(lis.map(li=>Math.round(li.getBoundingClientRect().top))).size,clipped:[...ol.querySelectorAll('a,span')].filter(e=>e.scrollWidth>e.clientWidth).map(e=>e.title)};});
  if(!m)continue;assert.ok(m.right<=m.inner,q);assert.ok(m.cur<=m.olRight+1,'la miga actual se ve: '+q);assert.equal(m.rows,1,'una línea: '+q);
  if(q.includes('y-uno'))assert.deepEqual(m.clipped,['04 · '+LARGO],'elipsis con el texto completo en title');}},{width:390,height:844}));
