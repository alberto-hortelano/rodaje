// Ruta /viewer/ del servidor: sirve viewer/ con safe(), sin /environment.js; la UI importa el visor GLB y el genérico sin empaquetarlos (issues #9 y #10).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import http from 'node:http';import {spawn,spawnSync} from 'node:child_process';import * as T from 'three';
import {exportGlb} from '../lib/entorno3d.mjs';import {withChrome,newRenderContext,chromePath,VIEWPORTS} from '../lib/chrome.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-viewer-')),id='humo-'+process.pid;
const SIN_CHROME=!fs.existsSync(chromePath())&&'sin Chrome';
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
// Proyecto de humo: un entorno solo con GLB (tres cajas).
const g=new T.Group();for(const x of [0,2,4]){const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial());m.name='caja'+x;m.position.x=x;g.add(m);}
fs.mkdirSync(path.join(DATA,id,'assets'),{recursive:true});fs.writeFileSync(path.join(DATA,id,'assets/h.glb'),(await exportGlb(g,{quiet:true})).buffer);
// Y dos entornos con constructor (suelo y muro) para el visor genérico: uno con plugin (botón, panel, capa, entrada y expose) y otro sin él.
fs.mkdirSync(path.join(DATA,id,'ambientes/humo/3d'),{recursive:true});
// La raíz deja en userData datos de ejecución (ship), que no deben llegar al GLB, y units, que sí.
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/humo.js'),"export function build(T, data, kit) { const g = kit.group('humo'); kit.box(g, 'suelo', [-10, 10], [-0.2, 0], [-10, 10], '#777777'); kit.box(g, 'muro', [-10, 10], [0, 3], [-5.2, -5], '#999999'); g.userData = {units: 'metres', ship: {x: [1]}}; return g; }\n");
const landmarks=[{id:'centro',name:'Centro',view:[0,1.6,4],at:[0,1.5,-10]}];
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/model.json'),JSON.stringify({landmarks,walkthrough:[{label:'ping',call:'ping',expect:'pong'},{label:'centro',walk:true,view:'centro'},{label:'marca del plugin',call:'setView',args:['marca-plugin'],expect:true}]}));
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/model-falla.json'),JSON.stringify({landmarks,walkthrough:[{label:'ping',call:'ping',expect:'otro'}]}));
// Con viewer.caminante el plugin pone su propio caminante (walkKeys con espacio y «c»); cuenta teclas «k», vistas propias y modos.
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/visor.js'),`export function plugin(api) {
  const walkerEnPlugin = api.walker, modos = [];
  let teclas = 0, pasos = 0, vista = null;
  const b = api.ui.button({a: 'humo', text: 'Humo', pressed: false}, () => { b.pressed = !b.pressed; });
  const panel = api.ui.panel({title: 'Panel', html: '<p class="humo-panel">uno</p>'});
  api.ui.overlay('<div class="humo-hud">hud</div>');
  const mapa = api.ui.overlay('<canvas class="humo-mapa" width="40" height="40"></canvas>').el.querySelector('canvas').getContext('2d');
  const walker = ({camera}) => {
    const keys = new Set(), w = {keys, walkKeys: ['w', ' ', 'c'], noclip: false, eye: 1.62,
      place(x, y, z) { camera.position.set(x, y + w.eye, z); }, aim(from, to) { camera.lookAt(...to); }, look() {},
      update(dt) { if (keys.has(' ')) camera.position.y += dt; if (keys.has('c')) camera.position.y -= dt; if (keys.has('w')) camera.position.z -= dt; },
      walk(k, s) { pasos++; k.forEach(x => keys.add(x)); for (let t = 0; t < s; t += 1 / 30) w.update(1 / 30); k.forEach(x => keys.delete(x)); return camera.position.toArray(); }};
    return w;
  };
  return {spawn: () => ({position: [0, 0, 0], lookAt: [0, 1.62, -10]}),
    ...(api.options.caminante ? {walker} : {}),
    onKey(k, {down}) { if (k !== 'k') return false; if (down) teclas++; return true; },
    view(id) { if (id !== 'marca-plugin') return false; vista = id; return true; },
    onMode(m) { modos.push(m); },
    expose: {ping: () => 'pong', panel: h => panel.set(h), walkerEnPlugin, mapa: !!mapa, get pasos() { return pasos; }, get teclas() { return teclas; }, get modos() { return [...modos]; }, get vista() { return vista; }}};
}
`);
const humo={builder:'ambientes/humo/3d/humo.js',data:'ambientes/humo/3d/model.json'};
fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify({id,name:'Humo',type:'serie',ideas:[],characters:[],locations:[],episodes:[],environments:[{id:'solo-glb',name:'Humo',glb:'assets/h.glb'},{id:'con-plugin',name:'Con plugin',...humo,viewer:{plugins:['ambientes/humo/3d/visor.js']}},{id:'sin-plugin',name:'Sin plugin',...humo},{id:'plugin-roto',name:'Roto',...humo,viewer:{plugins:['ambientes/humo/3d/roto.js']}},{id:'caminante',name:'Caminante',...humo,viewer:{plugins:['ambientes/humo/3d/visor.js'],caminante:true}},{id:'recorrido-falla',name:'Falla',...humo,data:'ambientes/humo/3d/model-falla.json',viewer:{plugins:['ambientes/humo/3d/visor.js']}}]}));
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
test('humo: un entorno solo con GLB se abre en la vista environment',{skip:SIN_CHROME},()=>withChrome(async browser=>{const page=await (await newRenderContext(browser,VIEWPORTS.lineaBase)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=solo-glb`);
  await page.waitForFunction('window.rodaje?.environment',null,{timeout:30000});
  assert.match(await page.textContent('#environment-model p'),/^Humo · .* · 3 mallas$/);assert.deepEqual(errors,[]);}));
test('humo: el visor genérico monta un entorno con constructor y plugin, y otro sin plugin',{skip:SIN_CHROME},()=>withChrome(async browser=>{const page=await (await newRenderContext(browser,VIEWPORTS.lineaBase)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
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
  assert.deepEqual(errors,[]);}));
test('humo: hooks walker, onKey, view y onMode; expose con getters; canvas en la capa',{skip:SIN_CHROME},()=>withChrome(async browser=>{const page=await (await newRenderContext(browser,VIEWPORTS.lineaBase)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=caminante`);
  await page.waitForFunction('window.rodaje?.environment?.scene',null,{timeout:30000});
  const r=await page.evaluate(()=>{const e=window.rodaje.environment;const antes=e.pasos;e.setWalk(true);const start=e.camera.position.toArray();const end=e.walk([' '],1);
   return {walkerEnPlugin:e.walkerEnPlugin,mapa:e.mapa,antes,despues:e.pasos,start,end,marca:e.setView('marca-plugin'),vista:e.vista,nada:e.setView('nada'),centro:e.setView('centro'),keys:Object.keys(e)};});
  assert.equal(r.walkerEnPlugin,null);assert.equal(r.mapa,true);assert.equal(r.antes,0);assert.equal(r.despues,1);assert.ok(Math.abs(r.end[1]-r.start[1]-1)<0.05,JSON.stringify(r));
  assert.equal(r.marca,true);assert.equal(r.vista,'marca-plugin');assert.equal(r.nada,false);assert.equal(r.centro,true);assert.ok(r.keys.includes('pasos')&&r.keys.includes('setNoclip'));
  assert.equal(await page.$$eval('.env3d-overlay canvas.humo-mapa',l=>l.length),1);
  // Teclado: «k» es del plugin; el espacio es del caminante; con foco en el select de presets no se procesa nada.
  await page.focus('.env3d-view');await page.keyboard.press('k');await page.keyboard.press('k');assert.equal(await page.evaluate(()=>window.rodaje.environment.teclas),2);
  const y0=await page.evaluate(()=>window.rodaje.environment.camera.position.y);await page.keyboard.down(' ');await page.waitForTimeout(400);await page.keyboard.up(' ');
  assert.ok(await page.evaluate(()=>window.rodaje.environment.camera.position.y)>y0+0.1,'el espacio sube con el caminante del plugin');
  await page.focus('select[data-a=preset]');await page.keyboard.press('k');assert.equal(await page.evaluate(()=>window.rodaje.environment.teclas),2);
  // No clip: setNoclip y el botón del visor van juntos.
  const n=await page.evaluate(()=>{const e=window.rodaje.environment;e.setNoclip(true);const a=[e.noclip,document.querySelector('[data-a=noclip]').getAttribute('aria-pressed')];document.querySelector('[data-a=noclip]').click();return [...a,e.noclip];});
  assert.deepEqual(n,[true,'true',false]);
  const m=await page.evaluate(()=>{const e=window.rodaje.environment;e.setWalk(false);return {modos:e.modos,up:e.camera.up.toArray()};});
  assert.deepEqual(m,{modos:['walk','orbit'],up:[0,1,0]});
  assert.deepEqual(errors,[]);}));
test('humo: GLB del visor sin userData de ejecución',{skip:SIN_CHROME},()=>withChrome(async browser=>{const ctx=await newRenderContext(browser,VIEWPORTS.lineaBase),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=sin-plugin`);
  await page.waitForFunction('window.rodaje?.environment?.scene',null,{timeout:30000});
  const [dl]=await Promise.all([page.waitForEvent('download'),page.click('[data-a=glb]')]);
  const buf=fs.readFileSync(await dl.path()),json=buf.subarray(20,20+buf.readUInt32LE(12)).toString('utf8'),j=JSON.parse(json);
  assert.equal(buf.subarray(0,4).toString(),'glTF');assert.doesNotMatch(json,/ship/);assert.deepEqual(j.nodes.find(x=>x.name==='humo').extras,{units:'metres'});
  assert.deepEqual(errors,[]);}));
test('humo: recorrer.mjs ejecuta call y expect, y sale con 1 si un paso falla',{skip:SIN_CHROME},()=>{const out=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-recorrer-'));
  try{const run=env=>spawnSync(process.execPath,[path.join(ROOT,'scripts/entornos/recorrer.mjs'),out,'--entorno',env,'--project',id,'--url',`http://127.0.0.1:${port}`],{cwd:ROOT,env:{...process.env,RODAJE_DATA:DATA},encoding:'utf8',timeout:120000});
   const ok=run('con-plugin');assert.equal(ok.status,0,ok.stdout+ok.stderr);assert.match(ok.stdout,/ping\s+"pong" OK/);assert.match(ok.stdout,/marca del plugin\s+true OK/);assert.match(ok.stdout,/3 de 3 pasos OK/);
   const ko=run('recorrido-falla');assert.equal(ko.status,1,ko.stdout+ko.stderr);assert.match(ko.stdout,/FALLO: valor: "pong" ≠ "otro"/);}
  finally{fs.rmSync(out,{recursive:true,force:true});}});
