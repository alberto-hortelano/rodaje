// Huella de los planos con entorno enlazado (#30): el digest ve el contenido del constructor, de data y de sus texturas, no las rutas.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
const m=await import('../app/store.mjs');const {fileHash,environmentContent}=await import('../lib/huella.mjs');
const ROOT=path.resolve(import.meta.dirname,'..');
function fixture(){const p=m.create('Huella','pelicula');const base=m.dir(p.id),env=path.join(base,'assets/nave');fs.mkdirSync(path.join(env,'tex'),{recursive:true});
 fs.writeFileSync(path.join(env,'nave.js'),'export function build(T){return new T.Group();}\n');
 fs.writeFileSync(path.join(env,'model.json'),JSON.stringify({nota:'x',presets:[],textures:{suelo:{file:'tex/suelo.png',tile:2},cielo:{file:'tex/cielo.png',sky:true},falta:{file:'tex/no-existe.png'}}}));
 fs.writeFileSync(path.join(env,'tex/suelo.png'),'suelo');fs.writeFileSync(path.join(env,'tex/cielo.png'),'cielo');fs.writeFileSync(path.join(env,'nave.glb'),'glb');fs.writeFileSync(path.join(env,'visor.js'),'export default {};\n');
 p.environments=[{id:'nave',name:'Nave',version:1,builder:'assets/nave/nave.js',data:'assets/nave/model.json',glb:'assets/nave/nave.glb',viewer:{plugins:['assets/nave/visor.js']}}];
 p.characters.push({id:'ada',name:'Ada',description:'Piloto'});p.locations.push({id:'puente',name:'Puente',environment:'nave'},{id:'hangar',name:'Hangar'});
 p.episodes.push({id:'ep',title:'Acto 1',sequences:[{id:'s1',location:'puente',silent:true,cast:[{character:'ada',x:0,z:0,yaw:0}],shots:[m.newShot('Con entorno')]},{id:'s2',location:'hangar',silent:true,cast:[],shots:[m.newShot('Sin entorno')]}]});
 m.save(p);const [a,b]=p.episodes[0].sequences.map(s=>s.shots[0].id);return {p,base,env,a,b};}
const approve=(p,id)=>{const t=m.shot(p,id).shot;t.preview={job:'r',hash:m.digest(p,id)};t.approval={hash:t.preview.hash,preview:'r'};t.final={hash:t.preview.hash,file:'out.mp4'};return t;};
// Reescribe un fichero con otro contenido del mismo tamaño (en model.json, dentro de un valor: sigue siendo JSON válido) y adelanta su mtime: la caché no puede depender de que cambie el tamaño.
const flip=f=>{const b=fs.readFileSync(f),i=f.endsWith('.json')?b.indexOf('"x"')+1:0;b[i]^=1;fs.writeFileSync(f,b);const t=new Date(Date.now()+5000);fs.utimesSync(f,t,t);};

test('huella: un byte en el constructor, model.json o una textura caduca el plano con entorno y no el que no lo tiene',()=>{
 for(const f of ['nave.js','model.json','tex/suelo.png','tex/cielo.png']){const {p,env,a,b}=fixture();const da=m.digest(p,a),db=m.digest(p,b);approve(p,a);approve(p,b);assert(m.approved(p,a));
  flip(path.join(env,f));assert.notEqual(m.digest(p,a),da,f);assert.equal(m.approved(p,a),false,f);assert.equal(m.digest(p,b),db,f);assert(m.approved(p,b),f);}});

test('huella: el glb, los plugins y la ruta de los ficheros no cambian el digest',()=>{const {p,base,env,a}=fixture();const d=m.digest(p,a);
 flip(path.join(env,'nave.glb'));flip(path.join(env,'visor.js'));assert.equal(m.digest(p,a),d);
 const e=p.environments[0];e.glb='assets/otro.glb';e.viewer.plugins.push('assets/otro.js');assert.equal(m.digest(p,a),d);
 fs.cpSync(env,path.join(base,'ambientes/nave'),{recursive:true});e.builder='ambientes/nave/nave.js';e.data='ambientes/nave/model.json';assert.equal(m.digest(p,a),d,'mover los ficheros no caduca');
 fs.rmSync(path.join(base,'ambientes/nave/tex/suelo.png'));assert.notEqual(m.digest(p,a),d,'la textura se busca junto a data');});

test('huella: sin entorno el digest no depende de ficheros ni de environments',()=>{const {p,env,b}=fixture();const d=m.digest(p,b);
 for(const f of ['nave.js','model.json','tex/suelo.png'])flip(path.join(env,f));delete p.environments;assert.equal(m.digest(p,b),d);});

test('huella: la caché se invalida al reescribir el fichero',()=>{const {env}=fixture();const f=path.join(env,'tex/suelo.png');const h=fileHash(f);
 assert.equal(fileHash(f),h);fs.writeFileSync(f,'suelo nuevo');assert.notEqual(fileHash(f),h);const h2=fileHash(f);flip(f);assert.notEqual(fileHash(f),h2);
 fs.rmSync(f);fs.writeFileSync(f+'.tmp','suelo');fs.renameSync(f+'.tmp',f);assert.equal(fileHash(f),h,'sustitución atómica');});

test('huella: los ficheros que faltan dan null y no rompen digest, approved ni exportReady',()=>{const {p,base,env,a,b}=fixture();
 const c=environmentContent(base,p.environments[0]);assert.match(c.builder,/^[0-9a-f]{64}$/);assert.match(c.data,/^[0-9a-f]{64}$/);assert.match(c.textures.suelo,/^[0-9a-f]{64}$/);assert.equal(c.textures.falta,null);
 approve(p,a);approve(p,b);assert.equal(m.exportReady(p,'ep').length,2);
 fs.rmSync(path.join(env,'nave.js'));assert.equal(environmentContent(base,p.environments[0]).builder,null);assert.throws(()=>m.exportReady(p,'ep'),/Falta vídeo/);
 approve(p,a);assert.equal(m.exportReady(p,'ep').length,2);
 fs.rmSync(path.join(env,'model.json'));assert.deepEqual(environmentContent(base,p.environments[0]),{builder:null,data:null,textures:null});approve(p,a);assert(m.approved(p,a));
 p.environments[0].data='../../fuera.json';p.environments[0].builder='/abs/nave.js';assert.deepEqual(environmentContent(base,p.environments[0]),{builder:null,data:null,textures:null});
 p.locations[0].environment='no-existe';assert.match(m.digest(p,a),/^[0-9a-f]{64}$/);
 fs.writeFileSync(path.join(env,'model.json'),'{roto');p.locations[0].environment='nave';p.environments[0].data='assets/nave/model.json';assert.equal(environmentContent(base,p.environments[0]).textures,null);assert.match(m.digest(p,a),/^[0-9a-f]{64}$/);});

test('huella: /api/shot-state responde con el entorno sin ficheros',async()=>{const {p,env,a}=fixture();fs.rmSync(env,{recursive:true});
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>r(n));});});
 const child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{let out='';const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));});
  const r=await fetch(`http://127.0.0.1:${port}/api/shot-state?project=${p.id}&shot=${a}`);assert.equal(r.status,200);const s=await r.json();assert.equal(s.hash,m.digest(p,a));assert.equal(s.approved,false);}
 finally{child.kill();}});
