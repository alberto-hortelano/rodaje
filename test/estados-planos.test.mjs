// Estado de los planos en bloque (#64): shotState/shotStates con un solo digest, coherentes con approved() y exportReady(), sensibles a los
// ficheros del entorno sin cambiar la revisión, y GET /api/shot-states de solo lectura. Fixture con entorno como el de test/huella.test.mjs.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
const m=await import('../app/store.mjs');
const ROOT=path.resolve(import.meta.dirname,'..');
const NAMES=['Sin preview','Preview vigente','Aprobado','Final vigente','Final viejo'];
function fixture(){const p=m.create('Estados','pelicula');const base=m.dir(p.id),env=path.join(base,'assets/nave');fs.mkdirSync(path.join(env,'tex'),{recursive:true});
 fs.writeFileSync(path.join(env,'nave.js'),'export function build(T){return new T.Group();}\n');
 fs.writeFileSync(path.join(env,'model.json'),JSON.stringify({nota:'x',presets:[],textures:{suelo:{file:'tex/suelo.png'}}}));fs.writeFileSync(path.join(env,'tex/suelo.png'),'suelo');
 p.environments=[{id:'nave',name:'Nave',version:1,builder:'assets/nave/nave.js',data:'assets/nave/model.json'}];
 p.characters.push({id:'ada',name:'Ada',description:'Piloto'});p.locations.push({id:'puente',name:'Puente',environment:'nave'},{id:'hangar',name:'Hangar'});
 p.episodes.push({id:'ep',title:'Acto 1',sequences:[{id:'s1',location:'puente',silent:true,cast:[{character:'ada',x:0,z:0,yaw:0}],shots:NAMES.map(n=>m.newShot(n))},{id:'s2',location:'hangar',silent:true,cast:[],shots:[m.newShot('Sin entorno')]}]});
 m.save(p);const ids=p.episodes[0].sequences[0].shots.map(t=>t.id),out=p.episodes[0].sequences[1].shots[0].id;
 const T=id=>m.shot(p,id).shot,h=id=>m.digest(p,id);
 T(ids[1]).preview={job:'p1',hash:h(ids[1])};
 for(const id of [ids[2],ids[3],ids[4],out]){T(id).preview={job:'p-'+id,hash:h(id)};T(id).approval={hash:h(id),preview:'p-'+id};}
 T(ids[3]).final={hash:h(ids[3]),file:'f.mp4'};T(out).final={hash:h(out),file:'g.mp4'};T(ids[4]).final={hash:'0'.repeat(40),file:'viejo.mp4'};
 m.save(p);return {p,base,env,ids,out};}
const flip=f=>{const b=fs.readFileSync(f);b[0]^=1;fs.writeFileSync(f,b);const t=new Date(Date.now()+5000);fs.utimesSync(f,t,t);};
const S=(preview,approved,final)=>({preview,approved,final});

test('shotState: los cinco casos y la preview de otro digest',()=>{const {p,ids}=fixture();
 assert.deepEqual(ids.map(id=>m.shotState(p,id)),[S('none',false,'none'),S('current',false,'none'),S('current',true,'none'),S('current',true,'current'),S('current',true,'stale')]);
 m.shot(p,ids[1]).shot.preview.hash='f'.repeat(64);assert.deepEqual(m.shotState(p,ids[1]),S('stale',false,'none'));
 assert.throws(()=>m.shotState(p,'no-existe'),/Plano no encontrado/);});

test('shotStates coincide con approved y exportReady',()=>{const {p,ids,out}=fixture();const st=m.shotStates(p);
 assert.deepEqual(Object.keys(st),[...ids,out]);for(const id of Object.keys(st))assert.equal(st[id].approved,m.approved(p,id),id);
 assert.throws(()=>m.exportReady(p,'ep'),/Falta vídeo vigente aprobado: Sin preview/);
 // Un capítulo con todo vigente: solo la secuencia sin entorno (su plano no cambia de digest al quedarse solo).
 const r=structuredClone(p);r.episodes[0].sequences=[r.episodes[0].sequences[1]];
 assert.deepEqual(Object.values(m.shotStates(r)),[S('current',true,'current')]);assert.equal(m.exportReady(r,'ep').length,1);});

test('final vigente exige keyframeJob y previewJob vigentes',()=>{const {p,ids}=fixture();const r=structuredClone(p);r.episodes[0].sequences=[r.episodes[0].sequences[1]];
 const t=r.episodes[0].sequences[0].shots[0],id=t.id;assert.equal(m.exportReady(r,'ep').length,1);
 t.keyframe={job:'k1'};t.final.keyframeJob='k0';assert.equal(m.shotState(r,id).final,'stale');assert.throws(()=>m.exportReady(r,'ep'),/Falta vídeo vigente aprobado: Sin entorno/);
 t.final.keyframeJob='k1';assert.equal(m.shotState(r,id).final,'current');assert.equal(m.exportReady(r,'ep').length,1);
 t.final.previewJob='otra';assert.equal(m.shotState(r,id).final,'stale');assert.throws(()=>m.exportReady(r,'ep'),/Falta vídeo/);
 t.final.previewJob=t.preview.job;assert.equal(m.shotState(r,id).final,'current');assert.equal(m.shotState(p,ids[3]).final,'current');});

test("final con hash vigente pero sin aprobación es 'stale'",()=>{const {p,ids}=fixture();const t=m.shot(p,ids[3]).shot;delete t.approval;
 assert.deepEqual(m.shotState(p,ids[3]),S('current',false,'stale'));t.approval={hash:t.preview.hash,preview:'otro'};assert.deepEqual(m.shotState(p,ids[3]),S('current',false,'stale'));});

test('editar un byte del builder caduca el estado sin cambiar la revisión',()=>{const {p,env,ids,out}=fixture();const rev=p.revision,before=m.shotStates(p);
 assert.equal(before[ids[3]].approved,true);flip(path.join(env,'nave.js'));const after=m.shotStates(p);
 assert.deepEqual(after[ids[3]],S('stale',false,'stale'));assert.deepEqual(after[ids[0]],S('none',false,'none'));assert.deepEqual(after[out],before[out],'el plano sin entorno no cambia');
 for(const id of Object.keys(after))assert.equal(after[id].approved,m.approved(p,id));assert.equal(m.load(p.id).revision,rev);assert.equal(p.revision,rev);});

test('shotStates no escribe',()=>{const {p,base}=fixture();const file=path.join(base,'proyecto.json'),vers=path.join(base,'versiones');
 const snap=()=>({mtime:fs.statSync(file).mtimeMs,text:fs.readFileSync(file,'utf8'),vers:fs.readdirSync(vers).sort()});const s0=snap(),copy=structuredClone(p);
 m.shotStates(p);m.shotStates(m.load(p.id));assert.deepEqual(snap(),s0);assert.deepEqual(p,copy);});

test('GET /api/shot-states: {revision, shots}, solo lectura y error sin proyecto; /api/shot-state igual',async()=>{const {p,base,ids,out}=fixture();
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>r(n));});});
 const child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{let o='';const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+o)),15000);child.stdout.on('data',d=>{o+=d;if(o.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>o+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+o)));});
  const U=`http://127.0.0.1:${port}`,file=path.join(base,'proyecto.json'),mt=fs.statSync(file).mtimeMs;
  const r=await fetch(`${U}/api/shot-states?project=${p.id}`);assert.equal(r.status,200);const b=await r.json();
  assert.deepEqual(Object.keys(b),['revision','shots']);assert.equal(b.revision,p.revision);assert.deepEqual(Object.keys(b.shots),[...ids,out]);assert.deepEqual(b.shots,m.shotStates(p));
  assert.equal(m.load(p.id).revision,p.revision);assert.equal(fs.statSync(file).mtimeMs,mt);
  const bad=await fetch(`${U}/api/shot-states?project=no-existe`);assert.ok(bad.status>=400);assert.ok((await bad.json()).error);
  const one=await (await fetch(`${U}/api/shot-state?project=${p.id}&shot=${ids[2]}`)).json();assert.deepEqual(Object.keys(one),['hash','approved','issues']);assert.equal(one.approved,true);}
 finally{child.kill();}});
