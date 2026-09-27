// Ruta /viewer/ del servidor: sirve viewer/ con safe(), sin /environment.js; la UI importa el visor GLB y el genérico sin empaquetarlos (issues #9 y #10).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import http from 'node:http';import {spawnSync} from 'node:child_process';import {spawnServer} from './fixtures/hijos.mjs';import * as T from 'three';
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
// Constructor con contador de construcciones (la vista guardada no debe construir dos veces) y datos con un estado.
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/humo-estado.js'),"let n = 0;\nexport function build(T, data, kit) { const g = kit.group('humo'); kit.box(g, 'suelo', [-10, 10], [-0.2, 0], [-10, 10], '#777777'); kit.box(g, 'muro', [-10, 10], [0, 3], [-5.2, -5], '#999999'); g.userData = {units: 'metres', construcciones: ++n}; return g; }\n");
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/model-estado.json'),JSON.stringify({landmarks,states:{luz:{label:'Luz',options:{on:'Encendida',off:'Apagada'}}},defaultState:{luz:'on'}}));
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/model-falla.json'),JSON.stringify({landmarks,walkthrough:[{label:'ping',call:'ping',expect:'otro'}]}));
// Con viewer.caminante el plugin pone su propio caminante (walkKeys con espacio y «c»); cuenta teclas «k», vistas propias y modos.
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/visor.js'),`export function plugin(api) {
  const walkerEnPlugin = api.walker, modos = [];
  let teclas = 0, pasos = 0, vista = null, restaurado = null;
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
    saveView: () => api.options.malGuardado ? {f: () => 1} : {pulsado: b.pressed},
    restoreView(s, {mode}) { restaurado = {s, mode}; if (typeof s?.pulsado === 'boolean') b.pressed = s.pulsado; },
    expose: {get restaurado() { return restaurado; }, ping: () => 'pong', panel: h => panel.set(h), walkerEnPlugin, mapa: !!mapa, get pasos() { return pasos; }, get teclas() { return teclas; }, get modos() { return [...modos]; }, get vista() { return vista; }}};
}
`);
const humo={builder:'ambientes/humo/3d/humo.js',data:'ambientes/humo/3d/model.json'};
fs.writeFileSync(path.join(DATA,id,'proyecto.json'),JSON.stringify({id,name:'Humo',type:'serie',ideas:[],characters:[],locations:[],episodes:[],environments:[{id:'solo-glb',name:'Humo',glb:'assets/h.glb'},{id:'con-plugin',name:'Con plugin',...humo,viewer:{plugins:['ambientes/humo/3d/visor.js']}},{id:'sin-plugin',name:'Sin plugin',...humo},{id:'plugin-roto',name:'Roto',...humo,viewer:{plugins:['ambientes/humo/3d/roto.js']}},{id:'caminante',name:'Caminante',...humo,viewer:{plugins:['ambientes/humo/3d/visor.js'],caminante:true}},{id:'recorrido-falla',name:'Falla',...humo,data:'ambientes/humo/3d/model-falla.json',viewer:{plugins:['ambientes/humo/3d/visor.js']}},
 {id:'estado',name:'Estado',builder:'ambientes/humo/3d/humo-estado.js',data:'ambientes/humo/3d/model-estado.json'},{id:'mal-guardado',name:'Mal guardado',...humo,viewer:{plugins:['ambientes/humo/3d/visor.js'],malGuardado:true}}]}));
fs.writeFileSync(path.join(DATA,id,'ambientes/humo/3d/roto.js'),'export const nada = 1;\n');
let child;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));}));
test.after(()=>{child?.kill();fs.rmSync(DATA,{recursive:true,force:true});});
// Ruta tal cual, sin normalizar: http.get no resuelve «..» ni descodifica.
const get=p=>new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port,path:p},res=>{let body='';res.setEncoding('utf8');res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],body}));}).on('error',reject));

test('/viewer/ sirve glb.mjs y kit.mjs como JavaScript',async()=>{const glb=await get('/viewer/glb.mjs');assert.equal(glb.status,200);assert.match(glb.type,/^text\/javascript/);assert.match(glb.body,/export async function mountGlb\(container, \{url, name\}\)/);
 const kit=await get('/viewer/kit.mjs');assert.equal(kit.status,200);assert.match(kit.type,/^text\/javascript/);assert.match(kit.body,/export function createKit/);});
test('/viewer/ sirve mount.mjs, walk.mjs y plugins.mjs',async()=>{for(const [f,re] of [['mount.mjs',/export async function mountEnvironment\(container, \{project, environment: env, persist\}\)/],['walk.mjs',/export function createWalker/],['plugins.mjs',/export function combineHooks/]]){const r=await get('/viewer/'+f);assert.equal(r.status,200,f);assert.match(r.type,/^text\/javascript/,f);assert.match(r.body,re,f);}});
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

// Vista guardada (#37): sessionStorage de la pestaña; page.reload() en la misma página. Para dejar un valor a mano sin que
// pagehide lo pise, antes se desmonta el visor (dispose guarda y retira las escuchas).
const abrir=async(page,env,extra='')=>{await page.goto(`http://127.0.0.1:${port}/?project=${id}&view=environment&environment=${env}${extra}`);await page.waitForFunction('window.rodaje?.environment?.scene',null,{timeout:30000});};
const recargar=async page=>{await page.reload();await page.waitForFunction('window.rodaje?.environment?.scene',null,{timeout:30000});};
const pose=page=>page.evaluate(()=>{const e=window.rodaje.environment,r=new e.camera.rotation.constructor().setFromQuaternion(e.camera.quaternion,'YXZ');return {mode:e.mode,noclip:e.noclip,position:e.camera.position.toArray(),target:e.controls.target.toArray(),euler:[r.x,r.y,r.z],state:e.state};});
const cerca=(a,b,eps,msg)=>assert.ok(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<eps),`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const clave=env=>`rodaje:visor:${id}:${env}`;
const dejar=(page,env,valor)=>page.evaluate(([k,v])=>{window.rodaje.environment.dispose();sessionStorage.setItem(k,v);},[clave(env),valor]);
const conPagina=fn=>withChrome(async browser=>{const page=await (await newRenderContext(browser,VIEWPORTS.lineaBase)).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await fn(page);assert.deepEqual(errors,[]);});

test('vista guardada: órbita con estado sin reconstruir; paseo y «no clip» sin plugins',{skip:SIN_CHROME},()=>conPagina(async page=>{
  await abrir(page,'estado');
  await page.evaluate(()=>{const e=window.rodaje.environment;e.setState({luz:'off'});e.camera.position.set(6,5,7);e.controls.target.set(1,0.5,-1);e.controls.update();});
  await page.waitForTimeout(200);const antes=await pose(page);await recargar(page);const despues=await pose(page);
  cerca(despues.position,antes.position,1e-3,'posición');cerca(despues.target,antes.target,1e-3,'objetivo');cerca(antes.target,[1,0.5,-1],1e-3,'objetivo pedido');
  assert.equal(despues.mode,'orbit');assert.deepEqual(despues.state,{luz:'off'});assert.equal(await page.$eval('select[data-state=luz]',s=>s.value),'off');
  assert.equal(await page.evaluate(()=>window.rodaje.environment.scene.getObjectByName('humo').userData.construcciones),1,'una sola construcción');
  await abrir(page,'sin-plugin');
  await page.evaluate(()=>{const e=window.rodaje.environment;e.setWalk(true);e.setView('centro');e.walk(['a'],0.5);e.camera.rotation.set(-10*Math.PI/180,30*Math.PI/180,0,'YXZ');});
  const paseo=await pose(page);await recargar(page);const tras=await pose(page);
  assert.equal(tras.mode,'walk');assert.equal(tras.noclip,false);cerca(tras.position,paseo.position,1e-3,'posición a pie');assert.ok(Math.abs(tras.position[1]-1.62)<1e-3,'a la altura de los ojos');
  cerca(tras.euler,[-10*Math.PI/180,30*Math.PI/180,0],1e-3,'orientación');
  await page.evaluate(()=>{const e=window.rodaje.environment;e.setNoclip(true);e.walk(['e'],1);});
  const alto=await pose(page);assert.ok(alto.position[1]>5,'sube con «no clip»: '+alto.position[1]);await recargar(page);const tras2=await pose(page);
  cerca(tras2.position,alto.position,1e-3,'altura con «no clip»');assert.equal(tras2.noclip,true);assert.equal(tras2.mode,'walk');
  assert.equal(await page.getAttribute('[data-a=noclip]','aria-pressed'),'true');assert.equal(await page.textContent('[data-a=noclip]'),'No clip · activado');}));

test('vista guardada: formato, parte del plugin y datos dañados',{skip:SIN_CHROME},()=>conPagina(async page=>{
  await abrir(page,'con-plugin');await page.click('[data-a=humo]');await recargar(page);
  const guardado=JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),clave('con-plugin')));
  assert.deepEqual(Object.keys(guardado),['v','mode','camera','target','noclip','state','plugins']);assert.deepEqual(Object.keys(guardado.plugins),['ambientes/humo/3d/visor.js']);
  assert.deepEqual(await page.evaluate(()=>window.rodaje.environment.restaurado),{s:{pulsado:true},mode:'orbit'});assert.equal(await page.getAttribute('[data-a=humo]','aria-pressed'),'true');
  await abrir(page,'estado');const general=await pose(page);
  await page.evaluate(()=>{const e=window.rodaje.environment;e.camera.position.set(8,8,8);e.controls.update();});
  const valida=await page.evaluate(()=>JSON.stringify(window.rodaje.environment.saveView()));
  for(const malo of ['{roto',JSON.stringify({...JSON.parse(valida),v:2})]){await dejar(page,'estado',malo);await recargar(page);const p=await pose(page);cerca(p.position,general.position,1e-3,'vista general con '+malo.slice(0,10));cerca(p.target,general.target,1e-3,'objetivo general');}
  await dejar(page,'estado',JSON.stringify({...JSON.parse(valida),state:{luz:'fantasma',otra:'x'}}));await recargar(page);
  const p3=await pose(page);assert.deepEqual(p3.state,{luz:'on'});cerca(p3.position,[8,8,8],1e-2,'la pose sí vale');
  await abrir(page,'con-plugin');const v2=await page.evaluate(()=>JSON.stringify(window.rodaje.environment.saveView()));
  await dejar(page,'con-plugin',JSON.stringify({...JSON.parse(v2),plugins:{'ambientes/humo/3d/visor.js':42,'otro.js':{}}}));await recargar(page);
  assert.equal(await page.evaluate(()=>window.rodaje.environment.restaurado.s),42);}));

test('vista guardada: persist=0, «Visitar estancia», re-montar y valor no serializable',{skip:SIN_CHROME},()=>conPagina(async page=>{
  await abrir(page,'sin-plugin');const general=await pose(page);
  await page.evaluate(()=>{const e=window.rodaje.environment;e.camera.position.set(9,6,3);e.controls.target.set(0,1,0);e.controls.update();});const a=await pose(page);
  await abrir(page,'sin-plugin','&persist=0');const p0=await pose(page);cerca(p0.position,general.position,1e-3,'persist=0 no lee');
  await page.evaluate(()=>{const e=window.rodaje.environment;e.camera.position.set(-7,2,2);e.controls.update();});
  await abrir(page,'sin-plugin');cerca((await pose(page)).position,a.position,1e-3,'persist=0 no escribe');
  await page.evaluate(()=>window.rodaje.act('visit-room:sin-plugin:centro'));const c=await pose(page);cerca(c.position,[0,1.6,4],1e-3,'setView gana');cerca(c.target,[0,1.5,-10],1e-3,'objetivo del lugar');
  await page.evaluate(()=>{const e=window.rodaje.environment;e.camera.position.set(5,3,-2);e.controls.update();});const m=await pose(page);
  await page.evaluate(()=>window.rodaje.render());cerca((await pose(page)).position,m.position,1e-3,'re-montar conserva');
  await abrir(page,'mal-guardado');
  const err=await page.evaluate(()=>{try{window.rodaje.environment.saveView();return null;}catch(e){return e.message;}});
  assert.match(err||'',/^El plugin ambientes\/humo\/3d\/visor\.js: saveView.*no serializable/);
  await recargar(page);assert.equal(await page.evaluate(()=>window.rodaje.environment.mode),'orbit');}));

test('recorrer.mjs, capturar.mjs y linea-base.mjs abren el visor con persist=0',()=>{for(const f of ['scripts/entornos/recorrer.mjs','scripts/entornos/capturar.mjs','scripts/linea-base.mjs'])assert.match(fs.readFileSync(path.join(ROOT,f),'utf8'),/&environment=\$\{encodeURIComponent\([\w.]+\)\}&persist=0`/,f);});
