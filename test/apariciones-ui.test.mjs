// Apariciones por niveles en el navegador (#69): raíz con una fila por acto (entrar y abrir), niveles con migas y cabecera reducida, viñetas y
// planos en línea, conmutador «Todas las versiones» en cualquier nivel, claves inválidas corregidas con replace, historial y scroll por nivel,
// ambiente con su nota, 390 px y sin guardar. Servidor con RODAJE_DATA temporal y el fixture de #58 (textos inventados).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
import {relProject,relProjectMany} from './fixtures/relaciones.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-apariciones-')),id='apariciones-'+process.pid,big='apariciones-big-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const write=(pid,p)=>{p.id=pid;fs.mkdirSync(path.join(DATA,pid),{recursive:true});fs.writeFileSync(path.join(DATA,pid,'proyecto.json'),JSON.stringify(p));};
write(id,relProject());write(big,relProjectMany(50));
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const ORIGIN=`http://127.0.0.1:${port}/`;
// all: «Todas las versiones» marcado de partida en los dos proyectos.
const session=(fn,viewport=VIEWPORTS.lineaBase,all=false)=>withChrome(async browser=>{const ctx=await newRenderContext(browser,viewport);if(all)await ctx.addInitScript(ks=>{if(!sessionStorage.getItem('i69'))for(const k of ks)localStorage.setItem(k,'1');sessionStorage.setItem('i69','1');},[id,big].map(p=>'rodaje-appear-all-'+p));const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const settle=async page=>{await page.waitForSelector('#workspace .heading');await page.waitForTimeout(250);};
const load=async(page,q='',pid=id)=>{await page.goto(ORIGIN+'?project='+pid+q);await settle(page);};
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const len=page=>page.evaluate(()=>history.length);
const crumbs=page=>page.$$eval('.crumbs li',l=>l.map(li=>[li.textContent,li.querySelector('a')?new URL(li.querySelector('a').href).searchParams.get('at'):li.querySelector('[aria-current]')?'actual':'']));
const toast=page=>page.$eval('#toast',t=>getComputedStyle(t).display==='none'?'':t.textContent.trim());
const until=(page,re)=>page.waitForFunction(r=>new RegExp(r).test(decodeURIComponent(location.search)),re.source);
const go=async(page,sel,re)=>{await page.$eval(sel,e=>e.click());await until(page,re);await settle(page);};
const rows=page=>page.$$eval('#workspace .ap-row',l=>l.map(e=>e.dataset.ap));
const counter=page=>page.evaluate(async()=>(await import('/workflow.mjs')).relationCounters.relatedTo);
const project=(page,pid=id)=>page.evaluate(async id=>(await (await fetch('/api/project?id='+id)).json()),pid);
const href=(page,sel)=>page.$eval(sel,a=>{const q=new URL(a.href).searchParams;return Object.fromEntries(q);});

test('raíz: página completa y una fila por acto con entrar y abrir, sin plegado',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=character&character=ana');assert.ok(await page.$('.entity-top'));
 assert.equal(await page.$$eval('.entity-section details',l=>l.filter(d=>d.closest('.entity-section').querySelector('h2').textContent==='Apariciones').length),0);
 assert.ok(!(await page.textContent('#workspace')).includes('Desplegar todo'));assert.ok(!(await page.textContent('#workspace')).includes('Plegar todo'));
 assert.deepEqual(await rows(page),['act/e1','act/e2']);assert.match(await page.textContent('.ap-row[data-ap="act/e1"] .ap-meta'),/viñeta/);
 assert.equal((await href(page,'.ap-row[data-ap="act/e1"] a.ap-enter')).at,'act/e1');
 assert.deepEqual(await href(page,'.ap-row[data-ap="act/e1"] a.ap-page'),{project:id,view:'tree',node:'act/e1'});
 assert.equal(await counter(page),0);}));

test('niveles: entrar, migas, cabecera y viñetas y planos en línea',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=character&character=ana');const h0=await len(page);
 await go(page,'.ap-row[data-ap="act/e1"] a.ap-enter',/at=act\/e1/);assert.equal(await len(page),h0+1);assert.equal(await page.$('.entity-top'),null);
 assert.deepEqual(await crumbs(page),[['Personajes y voces',null],['Ana Ruiz',null],['Acto I','actual']]);
 assert.equal((await href(page,'.crumbs li:nth-child(2) a')).view,'character');assert.equal(await page.$eval('.ap-head',e=>e.dataset.ap),'act/e1');
 assert.equal((await href(page,'.ap-head a.ap-page')).node,'act/e1');assert.deepEqual(await rows(page),['seq/f1']);
 await go(page,'.ap-row[data-ap="seq/f1"] a.ap-enter',/at=seq\/f1/);assert.deepEqual(await rows(page),['sb/sb2'],'solo lo vigente');
 await go(page,'.ap-row[data-ap="sb/sb2"] a.ap-enter',/at=sb\/sb2/);await go(page,'.ap-row[data-ap="scene/sb2/sc2"] a.ap-enter',/at=scene\/sb2\/sc2/);
 assert.deepEqual((await crumbs(page)).map(c=>c[1]),[null,null,'act/e1','seq/f1','sb/sb2','actual']);
 assert.deepEqual(await href(page,'.ap-leaf[data-ap="panel/P3"] a'),{project:id,view:'storyboard',storyboard:'sb2',scene:'sc2',panel:'P3'});
 assert.match(await page.textContent('.ap-leaf[data-ap="panel/P3"]'),/aparece/);
 await load(page,'&view=character&character=ana&at=seq%2Ff2');assert.deepEqual(await href(page,'.ap-leaf[data-ap="shot/t6"] a'),{project:id,view:'shot',episode:'e2',sequence:'f2',shot:'t6'});
 assert.equal(await counter(page),0);}));

test('conmutador en cualquier nivel: «no vigente», y el nivel que desaparece se corrige con replace y aviso',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=character&character=ana&at=scene%2Fsb2%2Fsc2');const r0=(await project(page)).revision;await page.check('[data-appear-all]');await page.waitForTimeout(300);
 assert.equal(params(page).at,'scene/sb2/sc2');assert.ok(await page.isChecked('[data-appear-all]'));
 await go(page,'.crumbs a[href*="at=seq%2Ff1"]',/at=seq\/f1$/);assert.deepEqual(await rows(page),['sb/sb1','sb/sb2']);assert.match(await page.textContent('.ap-row[data-ap="sb/sb1"]'),/no vigente/);
 await go(page,'.ap-row[data-ap="sb/sb1"] a.ap-enter',/at=sb\/sb1/);await go(page,'.ap-row[data-ap="scene/sb1/sc1"] a.ap-enter',/at=scene\/sb1\/sc1/);
 assert.match(await page.textContent('.ap-line'),/\S/);const h=await len(page);
 await page.uncheck('[data-appear-all]');await until(page,/at=seq\/f1$/);await settle(page);
 assert.equal(await len(page),h,'replace');assert.match(await toast(page),/^Sin apariciones vigentes en ese nivel: se muestra «Ficha uno»\.$/);assert.equal(await page.$eval('.ap-head',e=>e.dataset.ap),'seq/f1');
 await page.goBack();await page.waitForTimeout(400);await until(page,/at=seq\/f1$/);await settle(page);assert.equal(await page.$eval('.ap-head',e=>e.dataset.ap),'seq/f1','Atrás a sb1, que no es vigente: se corrige otra vez');
 assert.equal((await project(page)).revision,r0,'el conmutador no guarda');}));

test('claves inválidas: la raíz con aviso; viñeta a su escena sin aviso; at fuera de personaje y ambiente se ignora',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=overview');const h=await len(page);
 await page.evaluate(()=>{history.pushState(null,'','?project='+new URL(location.href).searchParams.get('project')+'&view=character&character=ana&at=nada');dispatchEvent(new PopStateEvent('popstate'));});
 await until(page,/view=character&character=ana$/);await settle(page);assert.equal(await len(page),h+1,'sin entrada nueva al corregir');
 assert.equal(params(page).at,undefined);assert.match(await toast(page),/se muestra el resumen/);assert.ok(await page.$('.entity-top'));
 await load(page,'&view=character&character=ana&at=panel%2FP3');assert.equal(params(page).at,'scene/sb2/sc2');assert.equal(await page.$eval('.ap-head',e=>e.dataset.ap),'scene/sb2/sc2');
 await load(page,'&view=tree&at=seq%2Ff1');assert.equal(params(page).at,undefined);}));

test('historial y scroll por nivel; la miga del nombre lleva a la página completa',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=character&character=ana&at=seq%2Fc1',big);assert.ok((await page.$$eval('.ap-leaf',l=>l.length))>50);
 await page.evaluate(()=>scrollTo(0,900));await page.waitForTimeout(400);const y0=await page.evaluate(()=>scrollY);assert.ok(y0>500,'da para bajar: '+y0);
 await go(page,'.crumbs a[href*="at=sb%2Fsb1"]',/at=sb\/sb1/);assert.ok(await page.evaluate(()=>scrollY)<y0);
 await page.goBack();await until(page,/at=seq\/c1/);await settle(page);await page.waitForTimeout(300);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y0)<5,'recupera el scroll');
 await go(page,'.crumbs li:nth-child(2) a',/character=ana$/);assert.ok(await page.$('.entity-top'));assert.deepEqual(await rows(page),['act/e1','act/e2']);},{width:1280,height:600},true));

test('ambiente: nota en todos los niveles, prueba sin entrar y Entorno 3D solo en la página completa',{skip:SIN_CHROME},()=>session(async page=>{
 const note=/las viñetas y los planos heredan/;
 await load(page,'&view=location&location=plaza');assert.match(await page.textContent('#workspace'),note);assert.ok((await page.$$eval('.entity-section h2',l=>l.map(h=>h.textContent))).includes('Entorno 3D'));
 await go(page,'.ap-row[data-ap="act/e1"] a.ap-enter',/at=act\/e1/);assert.deepEqual(await rows(page),['seq/f1','seq/k1']);
 assert.equal(await page.$('.ap-row[data-ap="seq/k1"] a.ap-enter'),null);assert.ok(await page.$('.ap-row[data-ap="seq/k1"] a.ap-page'));
 await load(page,'&view=location&location=plaza&at=seq%2Ff1');assert.match(await page.textContent('#workspace'),note);
 assert.ok(!(await page.$$eval('.entity-section h2',l=>l.map(h=>h.textContent))).includes('Entorno 3D'));
 assert.deepEqual((await crumbs(page)).map(c=>c[0]),['Ambientes','Plaza','Acto I','Ficha uno']);},VIEWPORTS.lineaBase,true));

test('móvil a 390 px: sin desbordamiento; entrar y abrir con 40 px de alto',{skip:SIN_CHROME},()=>session(async page=>{
 const wide=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 for(const [q,pid] of [['&view=character&character=ana',id],['&view=character&character=ana&at=scene%2Fsb1%2Fsc1',id],['&view=character&character=ana',big],['&view=character&character=ana&at=seq%2Fc1',big],['&view=location&location=plaza&at=act%2Fe1',id]]){
  await load(page,q,pid);assert.ok(await wide()<=0,q);
  const hs=await page.$$eval('#workspace a.ap-enter,#workspace a.ap-page',l=>l.map(a=>a.getBoundingClientRect().height));assert.ok(hs.length&&hs.every(x=>x>=40),q+' '+hs);}},{width:390,height:844},true));
