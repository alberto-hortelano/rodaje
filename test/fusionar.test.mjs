import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {spawnServer} from './fixtures/hijos.mjs';
const F=await import('../lib/fusiones.mjs');
// Cada test usa su propio DATA temporal, no el de la suite (test/setup.mjs).
const dirs=[],tmp=()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-fusiones-'));dirs.push(d);return d;};
test.after(()=>dirs.forEach(d=>fs.rmSync(d,{recursive:true,force:true})));
const text=v=>JSON.stringify(v,null,2)+'\n';
const put=(d,rel,v)=>{const f=path.join(d,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'||Buffer.isBuffer(v)?v:text(v));};
const read=(d,rel)=>JSON.parse(fs.readFileSync(path.join(d,rel),'utf8'));
const e=(o,c,fecha)=>({original:o,cruda:c,...(fecha&&{fecha})});
const snap=d=>{const out={};(function w(x){for(const n of fs.readdirSync(x,{withFileTypes:true})){const f=path.join(x,n.name);if(n.isDirectory())w(f);else out[path.relative(d,f)]=createHash('sha256').update(fs.readFileSync(f)).digest('hex');}})(d);return out;};
const LOG={
 'a/x-v2.png':e('a/x.png','a/x-v2.chatgpt.png','2026-09-25T10:00:00.000Z'),
 'a/sub/y.png':e('a/sub/y0.png','a/sub/y.chatgpt.png','2026-09-25T11:00:00.000Z'),
 'b/z.png':e('b/z0.png','b/z.chatgpt.png','2026-09-25T12:00:00.000Z'),
 'zzz/h.png':e('zzz/h0.png','zzz/h.chatgpt.png','2026-09-25T13:00:00.000Z'),
 'a/cruzada.png':e('b/otra.png','a/cruzada.chatgpt.png','2026-09-25T14:00:00.000Z'),
 'a/../b/fuera.png':e('a/f.png','a/f.chatgpt.png'),
 '/home/x/a/abs.png':e('a/abs0.png','a/abs.chatgpt.png')};
const proyectos=(d,...ids)=>ids.forEach(id=>put(d,`${id}/proyecto.json`,{id}));

test('lib/fusiones solo importa node:fs, node:path, ./json y ./paths',()=>{const src=fs.readFileSync(new URL('../lib/fusiones.mjs',import.meta.url),'utf8');assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map(m=>m[1]).sort(),['./json.mjs','./paths.mjs','node:fs','node:path']);});
test('claveFusion separa el proyecto y rechaza absolutas, .., ids no válidos y claves vacías',()=>{
 assert.deepEqual(F.claveFusion('conjurados/assets/x.png'),{project:'conjurados',clave:'assets/x.png'});
 for(const bad of ['/home/a/x.png','a/../x.png','../a/x.png','a b/x.png','a','a/','',null,undefined,3])assert.equal(F.claveFusion(bad),null,String(bad));});
test('splitFusiones reparte por proyecto con rutas relativas y deja huérfanas; no muta',()=>{
 const copia=structuredClone(LOG),r=F.splitFusiones(LOG,['a','b']);assert.deepEqual(LOG,copia);
 assert.deepEqual(r.porProyecto,{a:{'sub/y.png':e('sub/y0.png','sub/y.chatgpt.png','2026-09-25T11:00:00.000Z'),'x-v2.png':e('x.png','x-v2.chatgpt.png','2026-09-25T10:00:00.000Z')},b:{'z.png':e('z0.png','z.chatgpt.png','2026-09-25T12:00:00.000Z')}});
 assert.deepEqual(Object.keys(r.porProyecto.a),['sub/y.png','x-v2.png']);
 assert.deepEqual(Object.keys(r.huerfanas),['/home/x/a/abs.png','a/../b/fuera.png','a/cruzada.png','zzz/h.png']);assert.deepEqual(r.huerfanas['zzz/h.png'],LOG['zzz/h.png']);});
test('mergeFusiones: gana la fecha más reciente en ambos órdenes; empate conserva la actual; sin fecha pierde',()=>{
 const viejo=e('o.png','c1.png','2026-01-01T00:00:00.000Z'),nuevo=e('o.png','c2.png','2026-02-01T00:00:00.000Z'),empate=e('o.png','c3.png','2026-01-01T00:00:00.000Z'),sin=e('o.png','c4.png');
 assert.deepEqual(F.mergeFusiones({k:viejo},{k:nuevo}),{k:nuevo});assert.deepEqual(F.mergeFusiones({k:nuevo},{k:viejo}),{k:nuevo});
 assert.deepEqual(F.mergeFusiones({k:viejo},{k:empate}),{k:viejo});
 assert.deepEqual(F.mergeFusiones({k:viejo},{k:sin}),{k:viejo});assert.deepEqual(F.mergeFusiones({k:sin},{k:viejo}),{k:viejo});
 assert.deepEqual(Object.keys(F.mergeFusiones({b:viejo},{a:nuevo,c:sin})),['a','b','c']);});
test('migrarFusiones reparte y deja en el raíz solo las huérfanas',()=>{
 const d=tmp();proyectos(d,'a','b');fs.mkdirSync(path.join(d,'zzz'));put(d,'fusiones.json',LOG);
 const m=F.migrarFusiones(d);assert.equal(m.raiz,'huerfanas');assert.deepEqual(m.movidas,{a:2,b:1});assert.equal(m.huerfanas.length,4);
 assert.deepEqual(read(d,'a/fusiones.json'),F.splitFusiones(LOG,['a','b']).porProyecto.a);assert.deepEqual(read(d,'b/fusiones.json'),{'z.png':e('z0.png','z.chatgpt.png','2026-09-25T12:00:00.000Z')});
 assert.deepEqual(Object.keys(read(d,'fusiones.json')),['/home/x/a/abs.png','a/../b/fuera.png','a/cruzada.png','zzz/h.png']);assert.equal(fs.existsSync(path.join(d,'zzz/fusiones.json')),false);});
test('migrarFusiones sin huérfanas borra el raíz; la segunda llamada lo da por ausente',()=>{
 const d=tmp();proyectos(d,'a');put(d,'fusiones.json',{'a/x-v2.png':LOG['a/x-v2.png']});
 assert.deepEqual(F.migrarFusiones(d),{raiz:'borrado',movidas:{a:1},huerfanas:[]});assert.equal(fs.existsSync(path.join(d,'fusiones.json')),false);
 assert.deepEqual(F.migrarFusiones(d),{raiz:'ausente',movidas:{},huerfanas:[]});});
test('migrarFusiones es idempotente byte a byte y conserva una clave existente con fecha posterior',()=>{
 const d=tmp();proyectos(d,'a','b');const posterior=e('x.png','x-v2.chatgpt.png','2026-09-26T00:00:00.000Z');put(d,'a/fusiones.json',{'x-v2.png':posterior});put(d,'fusiones.json',LOG);
 F.migrarFusiones(d);assert.deepEqual(read(d,'a/fusiones.json')['x-v2.png'],posterior);assert.ok(read(d,'a/fusiones.json')['sub/y.png']);
 const antes=snap(d);const m=F.migrarFusiones(d);assert.deepEqual(snap(d),antes);assert.equal(m.raiz,'huerfanas');assert.deepEqual(m.movidas,{});});
test('JSON inválido en el raíz o en un proyecto lanza y migrarFusiones no escribe',()=>{
 const d=tmp();proyectos(d,'a','b');put(d,'fusiones.json','{no');let antes=snap(d);assert.throws(()=>F.migrarFusiones(d),/JSON inválido/);assert.deepEqual(snap(d),antes);
 put(d,'fusiones.json',LOG);put(d,'b/fusiones.json','[roto');antes=snap(d);assert.throws(()=>F.migrarFusiones(d),/JSON inválido/);assert.deepEqual(snap(d),antes);
 assert.throws(()=>F.leerFusiones(d,'b'),/JSON inválido/);assert.deepEqual(F.leerFusiones(d,'a'),{});});
test('registrarFusion escribe en el proyecto con rutas relativas y no toca el raíz',()=>{
 const d=tmp();proyectos(d,'a','b');put(d,'fusiones.json',{'zzz/h.png':LOG['zzz/h.png']});const raiz=fs.readFileSync(path.join(d,'fusiones.json'));
 const r=F.registrarFusion(d,{editada:path.join(d,'a/ref/x-v2.png'),original:path.join(d,'a/ref/x.png'),cruda:path.join(d,'a/ref/x-v2.chatgpt.png')},'2026-09-27T00:00:00.000Z');
 assert.deepEqual(r,{project:'a',clave:'ref/x-v2.png'});assert.deepEqual(read(d,'a/fusiones.json'),{'ref/x-v2.png':e('ref/x.png','ref/x-v2.chatgpt.png','2026-09-27T00:00:00.000Z')});
 assert.deepEqual(fs.readFileSync(path.join(d,'fusiones.json')),raiz);
 assert.throws(()=>F.registrarFusion(d,{editada:path.join(d,'zzz/x.png'),original:path.join(d,'zzz/y.png'),cruda:path.join(d,'zzz/x.chatgpt.png')}),/no está en un proyecto/);
 assert.throws(()=>F.registrarFusion(d,{editada:path.join(d,'a/x.png'),original:path.join(d,'b/y.png'),cruda:path.join(d,'a/x.chatgpt.png')}),/mismo proyecto/);
 assert.deepEqual(fs.readFileSync(path.join(d,'fusiones.json')),raiz);});

const ffmpeg=spawnSync('ffmpeg',['-version']).status===0;
const freePort=()=>new Promise(ok=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>ok(port));});});
test('fusionar.mjs migra al arrancar, guarda en el proyecto y marca la fusionada con y sin proyecto',{skip:!ffmpeg&&'sin ffmpeg'},async()=>{
 const d=tmp(),script=path.join(import.meta.dirname,'../scripts/fusionar.mjs'),env={...process.env,RODAJE_DATA:d};
 proyectos(d,'a');fs.mkdirSync(path.join(d,'zzz'));
 assert.equal(spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=gray:s=96x64','-frames:v','1',path.join(d,'a/x.png')]).status,0);
 fs.copyFileSync(path.join(d,'a/x.png'),path.join(d,'a/x-v2.png'));
 const huerfana={'zzz/h.png':LOG['zzz/h.png']};put(d,'fusiones.json',{...huerfana,'a/viejo.png':e('a/viejo0.png','a/viejo.chatgpt.png','2026-09-01T00:00:00.000Z')});
 const port=await freePort(),child=spawnServer(process.execPath,[script,'--puerto',String(port)],{env,stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((ok,ko)=>{let out='';child.stdout.on('data',b=>{out+=b;if(out.includes('http://'))ok();});child.on('exit',c=>ko(Error('salió con '+c)));});
  assert.deepEqual(read(d,'a/fusiones.json'),{'viejo.png':e('viejo0.png','viejo.chatgpt.png','2026-09-01T00:00:00.000Z')});assert.deepEqual(read(d,'fusiones.json'),huerfana);
  const raiz=fs.readFileSync(path.join(d,'fusiones.json')),url=`http://127.0.0.1:${port}`;
  const r=await fetch(`${url}/api/guardar?editada=a/x-v2.png&original=a/x.png`,{method:'POST',headers:{origin:url},body:fs.readFileSync(path.join(d,'a/x.png'))});
  assert.deepEqual(await r.json(),{ok:true,cruda:'a/x-v2.chatgpt.png'});
  const g=read(d,'a/fusiones.json')['x-v2.png'];assert.deepEqual({...g,fecha:typeof g.fecha},{original:'x.png',cruda:'x-v2.chatgpt.png',fecha:'string'});
  assert.deepEqual(fs.readFileSync(path.join(d,'fusiones.json')),raiz);
  for(const q of ['?recargar']){const pares=await (await fetch(`${url}/api/pares${q}`)).json();const p=pares.find(p=>p.editada==='a/x-v2.png');assert.ok(p,q);assert.equal(p.original,'a/x.png');assert.equal(p.fusionada,g.fecha);}
 }finally{child.kill();}
 const port2=await freePort(),solo=spawnServer(process.execPath,[script,'a','--puerto',String(port2)],{env,stdio:['ignore','pipe','pipe']});
 try{await new Promise((ok,ko)=>{let out='';solo.stdout.on('data',b=>{out+=b;if(out.includes('http://'))ok();});solo.on('exit',c=>ko(Error('salió con '+c)));});
  const p=(await (await fetch(`http://127.0.0.1:${port2}/api/pares`)).json()).find(p=>p.editada==='a/x-v2.png');assert.ok(p?.fusionada);}finally{solo.kill();}
 const m=spawnSync(process.execPath,[script,'--migrar'],{env,encoding:'utf8',timeout:20000});assert.equal(m.status,0);assert.match(m.stdout,/Nada que migrar/);assert.doesNotMatch(m.stdout,/http:\/\//);});
