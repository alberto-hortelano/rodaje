// Ruta /viewer/ del servidor: sirve viewer/ con safe(), sin /environment.js; la UI importa el visor GLB y el genérico sin empaquetarlos (issues #9 y #10).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import http from 'node:http';import {spawn} from 'node:child_process';import * as T from 'three';
import {exportGlb} from '../lib/entorno3d.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-viewer-')),id='humo-'+process.pid;
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
// Proyecto de humo: un entorno solo con GLB (tres cajas).
const g=new T.Group();for(const x of [0,2,4]){const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial());m.name='caja'+x;m.position.x=x;g.add(m);}
fs.mkdirSync(path.join(DATA,id,'assets'),{recursive:true});fs.writeFileSync(path.join(DATA,id,'assets/h.glb'),(await exportGlb(g,{quiet:true})).buffer);
// Y dos entornos con constructor (suelo y muro) para el visor genérico: uno con plugin (botón, panel, capa, entrada y expose) y otro sin él.
fs.mkdirSync(path.join(DATA,id,'ambientes/humo/3d'),{recursive:true});
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/humo.js'),"export function build(T, data, kit) { const g = kit.group('humo'); kit.box(g, 'suelo', [-10, 10], [-0.2, 0], [-10, 10], '#777777'); kit.box(g, 'muro', [-10, 10], [0, 3], [-5.2, -5], '#999999'); return g; }\n");
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/model.json'),JSON.stringify({landmarks:[{id:'centro',name:'Centro',view:[0,1.6,4],at:[0,1.5,-10]}]}));
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/visor.js'),`export function plugin(api) {
  const b = api.ui.button({a: 'humo', text: 'Humo', pressed: false}, () => { b.pressed = !b.pressed; });
  const panel = api.ui.panel({title: 'Panel', html: '<p class="humo-panel">uno</p>'});
  api.ui.overlay('<div class="humo-hud">hud</div>');
  return {spawn: () => ({position: [0, 0, 0], lookAt: [0, 1.62, -10]}), expose: {ping: () => 'pong', panel: h => panel.set(h)}};
}
`);
const humo={builder:'ambientes/humo/3d/humo.js',data:'ambientes/humo/3d/model.json'};
fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify({id,name:'Humo',type:'serie',ideas:[],characters:[],locations:[],episodes:[],environments:[{id:'solo-glb',name:'Humo',glb:'assets/h.glb'},{id:'con-plugin',name:'Con plugin',...humo,viewer:{plugins:['ambientes/humo/3d/visor.js']}},{id:'sin-plugin',name:'Sin plugin',...humo},{id:'plugin-roto',name:'Roto',...humo,viewer:{plugins:['ambientes/humo/3d/roto.js']}}]}));
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/roto.js'),'export const nada = 1;\n');
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawn(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
// Ruta tal cual, sin normalizar: http.get no resuelve «..» ni descodifica.
const get=p=>new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port,path:p},res=>{let body='';res.setEncoding('utf8');res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],body}));}).on('error',reject));

test('/viewer/ sirve glb.mjs y kit.mjs como JavaScript',async()=>{const glb=await get('/viewer/glb.mjs');assert.equal(glb.status,200);assert.match(glb.type,/^text\/javascript/);assert.match(glb.body,/export async function mountGlb\(container, \{url, name\}\)/);
 const kit=await get('/viewer/kit.mjs');assert.equal(kit.status,200);assert.match(kit.type,/^text\/javascript/);assert.match(kit.body,/export function createKit/);});
test('/viewer/ sirve mount.mjs, walk.mjs y plugins.mjs',async()=>{for(const [f,re] of [['mount.mjs',/export async function mountEnvironment\(container, \{project, environment: env\}\)/],['walk.mjs',/export function createWalker/],['plugins.mjs',/export function combineHooks/]]){const r=await get('/viewer/'+f);assert.equal(r.status,200,f);assert.match(r.type,/^text\/javascript/,f);assert.match(r.body,re,f);}});
test('/viewer/ sirve el editor de plantas',async()=>{const h=await get('/viewer/planta.html');assert.equal(h.status,200);assert.match(h.type,/^text\/html/);assert.match(h.body,/from '\.\/planta\.mjs'/);
 const m=await get('/viewer/planta.mjs');assert.equal(m.status,200);assert.match(m.type,/^text\/javascript/);assert.match(m.body,/export function validarPlanta\(planta, anterior\)/);});
test('mount.mjs y walk.mjs no conocen piezas de ningún escenario',()=>{for(const f of ['mount.mjs','walk.mjs','plugins.mjs'])assert.doesNotMatch(fs.readFileSync(path.join(ROOT,'viewer',f),'utf8'),/tejado|bodega|cellar|camino|puerta-fuera|batiente|recinto/,f);});
test('/viewer/ no sale de viewer/',async()=>{for(const p of ['/viewer/../app/server.mjs','/viewer/%2e%2e/app/server.mjs','/viewer/..%2fapp%2fserver.mjs','/viewer/%2e%2e%2fapp%2fserver.mjs','/viewer/','/viewer/../package.json']){const r=await get(p);assert.notEqual(r.status,200,p);assert.doesNotMatch(r.body,/createServer|"dependencies"/,p);}
 assert.equal((await get('/viewer/nada.mjs')).status,404);});
test('/environment.js ya no existe',async()=>{assert.equal((await get('/environment.js')).status,404);assert.ok(!fs.existsSync(path.join(ROOT,'app/environment.js')));});
test('app.js importa /viewer/glb.mjs y /viewer/mount.mjs sin empaquetarlos',()=>{const src=fs.readFileSync(path.join(ROOT,'app/app.js'),'utf8');assert.match(src,/["']\/viewer\/glb\.mjs["']/);assert.match(src,/["']\/viewer\/mount\.mjs["']/);assert.ok(!src.includes('class OrbitControls'));assert.ok(!src.includes('function createWalker'));assert.ok(!src.includes('/environment.js'));assert.ok(!src.includes('class GLTFLoader'));});
test('los constructores siempre reciben un kit',async()=>{const {moduleImports,resolveModule}=await import('../app/workflow.mjs');
 for(const f of ['app/stage.js','viewer/mount.mjs','lib/entorno3d.mjs']){const src=fs.readFileSync(path.join(ROOT,f),'utf8'),calls=src.match(/\.build\(T,[^\n]{0,40}/g)||[];assert.ok(calls.length>=1,f);for(const c of calls)assert.match(c,/\.build\(T,\s*[\w.]+,\s*createKit\(T,/,`${f}: ${c}`);}
 const stage=fs.readFileSync(path.join(ROOT,'app/stage.js'),'utf8');assert.ok(stage.includes("import {createKit} from '/viewer/kit.mjs'"));assert.ok(moduleImports(stage).includes('/viewer/kit.mjs'));assert.equal(resolveModule('/viewer/kit.mjs','/stage.js'),'/viewer/kit.mjs');});
test('humo: un entorno solo con GLB se abre en la vista environment',{skip:!fs.existsSync(CHROME)&&'sin Chrome'},async()=>{const {chromium}=await import('playwright');
 const browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{const page=await (await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=solo-glb`);
  await page.waitForFunction('window.rodaje?.environment',null,{timeout:30000});
  assert.match(await page.textContent('#environment-model p'),/^Humo · .* · 3 mallas$/);assert.deepEqual(errors,[]);}
 finally{await browser.close();}});
test('humo: el visor genérico monta un entorno con constructor y plugin, y otro sin plugin',{skip:!fs.existsSync(CHROME)&&'sin Chrome'},async()=>{const {chromium}=await import('playwright');
 const browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 try{const page=await (await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=con-plugin`);
  await page.waitForFunction('window.rodaje?.environment',null,{timeout:30000});
  assert.deepEqual(await page.$$eval('.env3d-bar button',l=>l.map(b=>[b.dataset.a,b.textContent,b.getAttribute('aria-pressed')])).then(l=>l.slice(0,3)),[['overview','Vista general',null],['humo','Humo','false'],['walk','Recorrer a pie','false']]);
  await page.click('[data-a=humo]');assert.equal(await page.getAttribute('[data-a=humo]','aria-pressed'),'true');
  assert.equal(await page.textContent('.env3d-side .humo-panel'),'uno');assert.equal(await page.textContent('.env3d-view .env3d-overlay .humo-hud'),'hud');
  const r=await page.evaluate(()=>{const e=window.rodaje.environment;const ping=e.ping();e.panel('<p class="humo-panel">dos</p>');e.setWalk(true);const start=e.camera.position.toArray();const end=e.walk(['w'],3);return {ping,start,end,mode:e.mode,keys:Object.keys(e).sort()};});
  assert.equal(r.ping,'pong');assert.equal(r.mode,'walk');assert.equal(await page.textContent('.env3d-side .humo-panel'),'dos');
  assert.ok(Math.abs(r.start[1]-1.62)<1e-6&&Math.abs(r.start[2])<1e-6,JSON.stringify(r.start));assert.ok(r.end[2]<-4&&r.end[2]>-5,'se para antes del muro: '+JSON.stringify(r.end));
  assert.ok(r.keys.includes('ping')&&r.keys.includes('setView')&&!r.keys.includes('setCut'));
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=sin-plugin`);
  await page.waitForFunction('window.rodaje?.environment?.scene',null,{timeout:30000});
  const s=await page.evaluate(()=>{const e=window.rodaje.environment;return {lights:e.scene.children.filter(o=>o.isLight).map(o=>o.type),bg:e.scene.background?.getHexString(),note:document.querySelector('.env3d-note').textContent,buttons:[...document.querySelectorAll('.env3d-bar button')].map(b=>b.dataset.a)};});
  assert.deepEqual(s,{lights:['HemisphereLight','DirectionalLight'],bg:'b9c0c4',note:'Sin plugin',buttons:['overview','walk','noclip','fullscreen','capture','glb']});
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=plugin-roto`);
  await page.waitForFunction(()=>/No se pudo/.test(document.querySelector('#environment-model')?.textContent||''),null,{timeout:30000});
  assert.equal(await page.textContent('#environment-model'),'No se pudo cargar el entorno 3D: El plugin ambientes/humo/3d/roto.js no exporta plugin(api)');
  assert.deepEqual(errors,[]);}
 finally{await browser.close();}});
