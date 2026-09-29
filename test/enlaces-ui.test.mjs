// Enlaces de relaciones en el navegador (#61, #67): la raíz de la Escaleta no calcula relaciones y cada página pinta las de su nivel; story, escena,
// viñeta, Planos, estudio y Animación con su línea; «Pnn ·» sin repetir; página de entidad sin id y con id inexistente; plegado de Apariciones
// por tamaño de página; sin desbordamiento a 390 px. Servidor con RODAJE_DATA temporal y el fixture de #58 (textos inventados).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
import {relProject,relProjectMany} from './fixtures/relaciones.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-enlaces-')),id='enlaces-'+process.pid,big='enlaces-big-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const write=(pid,p)=>{p.id=pid;fs.mkdirSync(path.join(DATA,pid),{recursive:true});fs.writeFileSync(path.join(DATA,pid,'proyecto.json'),JSON.stringify(p));};
{const p=relProject();p.episodes[0].sequences.find(s=>s.id==='c1').shots[0].title='P01 · Entrada';write(id,p);}write(big,relProjectMany(50));
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const URL0=`http://127.0.0.1:${port}/`;
const session=(fn,viewport=VIEWPORTS.lineaBase)=>withChrome(async browser=>{const page=await (await newRenderContext(browser,viewport)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const load=async(page,q='',pid=id)=>{await page.goto(URL0+'?project='+pid+q);await page.waitForSelector('#workspace .heading');await page.waitForTimeout(150);};
const counter=page=>page.evaluate(async()=>(await import('/workflow.mjs')).relationCounters.relatedTo);
const texts=(page,sel)=>page.$$eval(sel,l=>l.map(e=>e.textContent.replace(/\s+/g,' ').trim()));
const card=a=>`article.card:has([data-action="shot:${a}"])`;

test('páginas: la raíz no calcula relaciones; el acto, una por nivel y ficha; la línea nunca dentro del enlace',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=tree');assert.equal(await counter(page),0);assert.equal(await page.$$eval('.rel-links',l=>l.length),0);
 await load(page,'&view=tree&node=act/e1');const fichas=await page.$$eval('.level-ficha',l=>l.length);assert.equal(fichas,1);
 assert.equal(await page.$$eval('.rel-head',l=>l.length),1);assert.equal(await page.$$eval('.level-ficha>.rel-links',l=>l.length),fichas);
 assert.ok(await counter(page)<=1+fichas);assert.equal(await page.$$eval('.level-link .rel-links',l=>l.length),0);
 for(const q of ['seq/k1','seq/f2']){await load(page,'&view=tree&node='+q);const shots=await page.$$eval('.tree-shot',l=>l.map(e=>!!e.querySelector('.rel-links')));assert.ok(shots.length&&shots.every(Boolean),q);}
 assert.match((await texts(page,'.tree-shot .rel-links'))[0],/Ambiente Bosque heredado/);
 await load(page,'&view=tree&node=seq/f1');assert.match((await texts(page,'.rel-head'))[0],/Ana Ruiz/);assert.equal(await page.$$eval('.level-story>.rel-links',l=>l.length),2);}));

test('story, escena y viñeta: líneas con enlaces a sus páginas, sin «Reparto:»',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=storyboard&storyboard=sb2');
 const head=await page.$$eval('.two .panel .rel-links a[data-route]',l=>l.map(a=>[a.textContent,new URL(a.href).searchParams.get('view')]));
 for(const x of [['Ana Ruiz','character'],['Beto','character'],['Nave','location']])assert.ok(head.some(h=>h[0]===x[0]&&h[1]===x[1]),x[0]);
 assert.equal(await page.$$eval('.sb-seq-head .rel-links',l=>l.length),1);
 assert.equal(await page.$$eval('[data-sb-drag="P3"] .rel-links',l=>l.length),1);assert.ok(!(await page.textContent('[data-sb-drag="P3"]')).includes('Reparto:'));
 await page.click('[data-sb-drag="P3"] .rel-links a[href*="character=ana"]');await page.waitForFunction(()=>/view=character/.test(location.search));await page.waitForSelector('.entity-top');
 assert.ok((await page.textContent('.heading')).includes('Ana Ruiz'));}));

test('Planos, estudio y Animación: ambiente propio o heredado, fuera de campo y sin «P01 ·» repetido',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=shots');
 const t3=(await texts(page,card('e1:c2:t3')+' .rel-links'))[0],t2=(await texts(page,card('e1:c1:t2')+' .rel-links'))[0];
 assert.match(t3,/Ambiente Bosque/);assert.doesNotMatch(t3,/heredado/);assert.match(t2,/Ambiente Plaza heredado/);
 assert.deepEqual([await page.textContent(card('e1:c1:t1')+' .pill'),await page.textContent(card('e1:c1:t1')+' h3')],['P01','Entrada']);
 for(const v of ['shot','anim']){await load(page,`&view=${v}&episode=e1&sequence=c2&shot=t3`);const h=await texts(page,'.rel-head');assert.equal(h.length,1,v);assert.match(h[0],/fuera de campo · pa/);}}));

test('entidades: sin id, la lista sin aviso; con id inexistente, el aviso',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=character');assert.equal(new URL(page.url()).searchParams.get('view'),'characters');assert.equal(await page.$eval('#toast',t=>getComputedStyle(t).display),'none');
 await load(page,'&view=character&character=zzz');assert.equal(new URL(page.url()).searchParams.get('view'),'characters');assert.equal((await page.textContent('#toast')).trim(),'No existe el personaje zzz');}));

test('Apariciones: con más de 40 viñetas y planos en la página, las secuencias empiezan plegadas',{skip:SIN_CHROME},()=>session(async page=>{
 await page.addInitScript(k=>localStorage.setItem(k,'1'),'rodaje-appear-all-'+big);await load(page,'&view=character&character=ana',big);
 const seqs=await page.$$eval('details.ap-sequence',l=>l.map(d=>d.open));assert.ok(seqs.length>=2);assert.ok(seqs.every(o=>!o));
 await load(page,'&view=character&character=beto');assert.ok((await page.$$eval('details.ap-sequence',l=>l.map(d=>d.open))).every(Boolean),'en una página pequeña, abiertas');}));

test('móvil a 390 px: sin desbordamiento horizontal ni errores',{skip:SIN_CHROME},()=>session(async page=>{
 const wide=()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 await load(page,'&view=tree&node=seq/f1');assert.ok(await wide()<=0,'tree');
 for(const q of ['&view=storyboard&storyboard=sb2','&view=shots','&view=character&character=ana']){await load(page,q);assert.ok(await wide()<=0,q);}},{width:390,height:844}));
