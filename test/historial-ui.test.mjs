// Historial de navegación en el navegador (#66): Atrás y Adelante por la escaleta, filtros sin entradas nuevas, scroll de la entrada,
// redirecciones que no atrapan Atrás, visores 3D y Animación desmontados al volver (también a mitad de montaje), guardado al volver,
// recarga, biblioteca y parámetros ajenos. Servidor con RODAJE_DATA temporal y el fixture de la escaleta más un entorno con constructor.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
import {storyMigrationPlan} from '../app/workflow.mjs';
import {storysProject,storysSpec} from './fixtures/escaleta-storys.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-historial-')),id='historial-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
// Migrado, con el entorno humo (constructor mínimo) enlazado al ambiente loc, que usan los planos de x-cruce.
{const p=storyMigrationPlan(storysProject(),storysSpec()).next;p.id=id;
 fs.mkdirSync(path.join(DATA,id,'ambientes/humo/3d'),{recursive:true});
 fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/humo.js'),"export function build(T, data, kit) { const g = kit.group('humo'); kit.box(g, 'suelo', [-10, 10], [-0.2, 0], [-10, 10], '#777777'); g.userData = {units: 'metres'}; return g; }\n");
 fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/model.json'),JSON.stringify({landmarks:[{id:'centro',name:'Centro',view:[0,1.6,4],at:[0,1.5,-10]}]}));
 p.environments=[{id:'humo',name:'Humo',builder:'ambientes/humo/3d/humo.js',data:'ambientes/humo/3d/model.json'}];p.locations.find(l=>l.id==='loc').environment='humo';
 fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify(p));}
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
const ORIGIN=`http://127.0.0.1:${port}/`,BASE=ORIGIN+`?project=${id}`;
const project=page=>page.evaluate(async id=>(await (await fetch('/api/project?id='+id)).json()),id);
const session=(fn,viewport=VIEWPORTS.lineaBase,init)=>withChrome(async browser=>{const ctx=await newRenderContext(browser,viewport);if(init)await ctx.addInitScript(init);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});
const settle=async page=>{await page.waitForSelector('#workspace .heading');await page.waitForTimeout(250);};
const load=async(page,q='')=>{await page.goto(BASE+q);await settle(page);};
const params=page=>Object.fromEntries(new URL(page.url()).searchParams);
const len=page=>page.evaluate(()=>history.length);
const crumbs=page=>page.$$eval('.crumbs li',l=>l.map(li=>li.textContent));
const active=page=>page.textContent('.sidebar button.active');
const toast=page=>page.$eval('#toast',t=>getComputedStyle(t).display==='none'?'':t.textContent.trim());
const until=(page,re)=>page.waitForFunction(r=>new RegExp(r).test(decodeURIComponent(location.search)),re.source);
// Clic sin desplazar la página (page.click lleva antes el elemento a la vista y cambiaría el scroll que se guarda).
const go=async(page,sel,re)=>{await page.$eval(sel,e=>e.click());await until(page,re);await settle(page);};
const act=async(page,a,re)=>{await page.evaluate(a=>window.rodaje.act(a),a);if(re)await until(page,re);await settle(page);};
const back=async(page,re)=>{await page.goBack();if(re)await until(page,re);await settle(page);};
const fwd=async(page,re)=>{await page.goForward();if(re)await until(page,re);await settle(page);};
const pick=(o,...k)=>Object.fromEntries(k.map(x=>[x,o[x]??null]));
const at=page=>page.evaluate(()=>[scrollX,scrollY]);

test('atrás y adelante por la escaleta',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page);const h0=await len(page),seen=[];const snap=async()=>seen.push({p:pick(params(page),'view','node','storyboard','scene','panel','character'),crumbs:await crumbs(page),active:await active(page)});await snap();
 await go(page,'[data-level="act/e1"] a.level-link',/node=act\/e1/);await snap();
 await go(page,'[data-level="seq/x-colgado"] a.level-link',/node=seq\/x-colgado/);await snap();
 await go(page,'[data-level="sb/sb-v2"] a.level-link',/view=storyboard&storyboard=sb-v2/);await snap();
 await go(page,'[data-level="scene/sb-v2/sb-v2-e1"] a.level-link',/scene=sb-v2-e1/);await snap();
 await go(page,'[data-sb-drag="v2b"] h3 a',/panel=v2b/);await snap();
 await act(page,'nav:characters',/view=characters/);await snap();
 assert.equal(await len(page),h0+6,'una entrada por paso');
 assert.deepEqual(seen.map(s=>s.p.view),['tree','tree','tree','storyboard','storyboard','storyboard','characters']);assert.deepEqual(seen.map(s=>s.active),['Escaleta','Escaleta','Escaleta','Storyboards','Storyboards','Storyboards','Personajes y voces']);
 assert.deepEqual(seen.slice(3,6).map(s=>[s.p.scene,s.p.panel,s.crumbs.at(-1)]),[[null,null,'Story v2'],['sb-v2-e1',null,'Camino'],['sb-v2-e1','v2b','A02 · Viñeta A02']]);
 for(let i=seen.length-2;i>=0;i--){await back(page);assert.deepEqual({p:pick(params(page),'view','node','storyboard','scene','panel','character'),crumbs:await crumbs(page),active:await active(page)},seen[i],'atrás hasta '+i);}
 for(let i=1;i<seen.length;i++){await fwd(page);assert.deepEqual({p:pick(params(page),'view','node','storyboard','scene','panel','character'),crumbs:await crumbs(page),active:await active(page)},seen[i],'adelante hasta '+i);}
 assert.equal(await len(page),h0+6);
 await load(page,'&view=storyboard&storyboard=sb-v1');const h1=await len(page);
 await page.evaluate(()=>window.rodaje.render());await settle(page);assert.equal(await len(page),h1,'volver a pintar la misma ruta no crea entrada');}));

test('filtros: sin entradas nuevas; al volver, q y f intactos',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=storyboards');const h0=await len(page);
 await page.fill('[data-filter-bar] input[type=search]','colgado');await page.waitForFunction(()=>/q=colgado/.test(location.search));
 const facet=await page.$('[data-filter-bar] [data-facet]');assert.ok(facet,'hay facetas');{await page.evaluate(()=>{const d=document.querySelector('[data-filter-bar] details');if(d)d.open=true;});await facet.click();await page.waitForFunction(()=>/f=/.test(location.search));}
 await page.waitForTimeout(300);assert.equal(await len(page),h0,'filtrar no crea entradas');const q0=params(page);assert.equal(q0.q,'colgado');
 await go(page,'[data-action^="storyboard:"]',/view=storyboard&storyboard=/);assert.equal(await len(page),h0+1);
 await back(page,/view=storyboards/);assert.deepEqual(pick(params(page),'q','f'),pick(q0,'q','f'));assert.equal(await page.inputValue('[data-filter-bar] input[type=search]'),'colgado');
 assert.ok(await page.$('[data-filter-bar] [data-facet][aria-pressed="true"]'),'la faceta sigue pulsada');}));

test('scroll: Atrás restaura el de la entrada, no el foco',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page);await page.evaluate(()=>scrollTo(0,300));await page.waitForTimeout(300);const y0=(await at(page))[1];assert.ok(y0>100,'la raíz da para bajar: '+y0);
 await go(page,'[data-level="act/e2"] a.level-link',/node=act\/e2/);assert.equal((await at(page))[1],0);
 await back(page,/view=tree$/);assert.equal((await at(page))[1],y0);
 await load(page,'&view=tree&node=seq/x-cruce');const h0=await len(page);await act(page,'shots:x-cruce',/view=shots/);
 assert.equal(params(page).sequence,undefined,'el foco se consume');assert.equal(await len(page),h0+1,'consumir el foco no crea entrada');
 const yf=(await at(page))[1];await page.evaluate(y=>scrollTo(0,y),yf>60?yf-60:yf+60);await page.waitForTimeout(300);const y1=(await at(page))[1];assert.notEqual(y1,yf);
 await act(page,'shot:e1:x-cruce:p8',/view=shot&/);await back(page,/view=shots/);assert.equal((await at(page))[1],y1,'scroll guardado, no el foco');},{width:1280,height:360}));

test('id inexistente: la redirección no atrapa Atrás',{skip:SIN_CHROME},()=>session(async page=>{
 for(const [q,re] of [['&view=storyboard&storyboard=nada',/view=storyboards$/],['&view=environment&environment=nada',/view=environments$/],['&view=tree&node=act/nada',/view=tree$/]]){
  await load(page,'&view=overview');await page.goto(BASE+q);await until(page,re);await settle(page);
  await back(page,/view=overview/);assert.equal(params(page).view,'overview',q);}
 await load(page,'&view=ideas');await load(page,'&view=overview');const h0=await len(page);await act(page,'env-open:nada',/view=environments$/);assert.equal(await len(page),h0+1,'el clic empuja la ruta resuelta');
 await back(page,/view=overview/);assert.equal(params(page).view,'overview');await back(page,/view=ideas/);}));

test('entorno, animación, plano y ensayo se desmontan al volver, también a mitad de montaje',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=environments');await act(page,'env-open:humo',/view=environment&environment=humo/);await page.waitForFunction(()=>window.rodaje.environment);
 await back(page,/view=environments$/);assert.equal(await page.evaluate(()=>window.rodaje.environment),null);assert.equal(await page.evaluate(()=>window.rodaje.stage),null);assert.ok(await page.$('[data-action="env-open:humo"]'));
 await load(page,'&view=tree&node=seq/x-cruce');await act(page,'anim:e1:x-cruce:p8',/view=anim/);await page.waitForFunction(()=>window.rodaje.anim);
 await page.evaluate(()=>{const a=window.rodaje.anim,d=a.dispose.bind(a);window.__disposed=false;a.dispose=()=>{window.__disposed=true;return d();};});
 await back(page,/view=tree/);assert.equal(await page.evaluate(()=>window.__disposed),true);assert.equal(await page.evaluate(()=>window.rodaje.anim),null);
 // Carrera: con las peticiones nuevas retrasadas, Atrás llega a mitad del montaje; el visor recién montado se desecha y la ruta no se confirma.
 for(const a of ['anim:e1:x-cruce:p8','shot:e1:x-cruce:p8','rehearsal:e1','env-open:humo']){
  await load(page,'&view=overview');await act(page,'tree:seq/x-cruce',/node=seq\/x-cruce/);
  await page.route('**/*',async r=>{await new Promise(ok=>setTimeout(ok,700));await r.continue().catch(()=>{});});
  await page.evaluate(a=>{window.rodaje.act(a).catch(()=>{});},a);await page.waitForTimeout(100);assert.equal(params(page).view,'tree',a+': aún montando');
  await page.goBack();await until(page,/view=overview/);await page.waitForTimeout(2500);await page.unroute('**/*');
  const n0=await page.evaluate(()=>window.__raf);await page.waitForTimeout(1000);const n1=await page.evaluate(()=>window.__raf);
  assert.ok(n1-n0<=5,a+': rAF tras volver '+(n1-n0));assert.equal(await page.evaluate(()=>window.rodaje.stage),null,a);assert.equal(await page.evaluate(()=>window.rodaje.view),'overview',a);assert.equal(params(page).view,'overview',a);}}
 ,VIEWPORTS.lineaBase,()=>{window.__raf=0;const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>{window.__raf++;return r(f);};}));

test('cambios sin guardar: Atrás guarda; si falla, se queda',{skip:SIN_CHROME},()=>session(async page=>{
 const colgado=q=>q.episodes[0].sequences.find(s=>s.id==='x-colgado');
 await load(page,'&view=tree&node=act/e1');await go(page,'[data-level="seq/x-colgado"] a.level-link',/node=seq\/x-colgado/);
 const edit=async text=>{await page.evaluate(()=>{const d=document.querySelector('.ficha-body details');if(d)d.open=true;});await page.fill('textarea[data-cover-prompt="x-colgado"]',text);await page.dispatchEvent('textarea[data-cover-prompt="x-colgado"]','change');};
 await edit('Atrás guarda.');await back(page,/node=act\/e1/);assert.equal(colgado(await project(page)).coverPrompt,'Atrás guarda.');assert.equal(await toast(page),'Cambios guardados');
 await fwd(page,/node=seq\/x-colgado/);await edit('No se guarda.');
 await page.route('**/api/project',r=>r.request().method()==='POST'?r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'disco lleno'})}):r.continue());
 await page.goBack();await page.waitForTimeout(600);assert.equal(params(page).node,'seq/x-colgado','se queda en la ficha');assert.match(await toast(page),/No se pudo guardar; sigues en esta vista: disco lleno/);
 assert.notEqual(colgado(await project(page)).coverPrompt,'No se guarda.');
 await page.unroute('**/api/project');await back(page,/node=act\/e1/);assert.equal(colgado(await project(page)).coverPrompt,'No se guarda.','con el disco bien, Atrás guarda');
 await fwd(page,/node=seq\/x-colgado/);assert.equal(params(page).node,'seq/x-colgado','Adelante sigue funcionando');}));

test('recarga, biblioteca y parámetros ajenos',{skip:SIN_CHROME},()=>session(async page=>{
 await load(page,'&view=storyboard&storyboard=sb-v2');await page.evaluate(()=>scrollTo(0,200));await page.waitForTimeout(300);const y0=(await at(page))[1];assert.ok(y0>100,'el story da para bajar: '+y0);
 const h0=await len(page);await page.reload();await settle(page);assert.equal(params(page).storyboard,'sb-v2');assert.equal((await at(page))[1],y0,'recargar conserva el scroll');assert.equal(await len(page),h0);
 await page.goto(ORIGIN+'?view=library');await settle(page);await page.click(`[data-action="open:${id}"]`);await until(page,/view=tree/);await settle(page);
 await back(page,/view=library/);assert.equal(await page.evaluate(()=>window.rodaje.project),null);assert.ok(await page.$(`[data-action="open:${id}"]`),'lista de proyectos');
 await fwd(page,/view=tree/);assert.equal(await page.evaluate(()=>window.rodaje.project?.id),id);
 await load(page,'&view=environment&environment=humo&persist=0');assert.equal(params(page).persist,'0');const h1=await len(page);
 await act(page,'nav:overview',/view=overview/);assert.equal(params(page).persist,'0');assert.equal(await len(page),h1+1);
 await back(page,/view=environment/);assert.equal(params(page).persist,'0');await page.waitForFunction(()=>window.rodaje.environment);},{width:1280,height:360}));
