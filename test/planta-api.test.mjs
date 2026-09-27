// /api/planta (issue #12): lee y guarda dims.planta de los datos de un entorno. Ruta desde proyecto.json, token, origen y revisión.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawnServer} from './fixtures/hijos.mjs';
import {jsonValueSpan} from '../lib/json.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-planta-')),DATA=path.join(TMP,'data'),id='humo-'+process.pid,base=path.join(DATA,id);
const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const PLANTA={version:1,formas:[{id:'a',nombre:'A',cerrada:true,puntos:[[0,0],[4,0],[4,3],[0,3]],lados:['n','e','s','o']},{id:'b',nombre:'B',cerrada:false,puntos:[[0,5],[6,5]]}],marcas:[{id:'m',nombre:'M',punto:[1,1]}],revision:2};
const MODEL=`{
  "name": "Humo",
  "dims": {
    "muro": {"note": "planta } en dims.planta", "alto": 3},
    "planta": ${JSON.stringify(PLANTA,null,2).replace(/\n/g,'\n    ')}
  },
  "defaultState": {"puerta": "cerrada"}
}`;
const modelFile=path.join(base,'ambientes/h/3d/model.json'),outside=path.join(TMP,'x.json');
fs.mkdirSync(path.dirname(modelFile),{recursive:true});fs.writeFileSync(modelFile,MODEL);
fs.writeFileSync(outside,MODEL);fs.symlinkSync(outside,path.join(base,'ambientes/h/3d/enlace.json'));
fs.writeFileSync(path.join(base,'ambientes/h/3d/sin.json'),'{"dims": {}}');
const env=(eid,data)=>({id:eid,name:'Entorno '+eid,builder:'ambientes/h/3d/h.js',data});
fs.writeFileSync(path.join(base,'proyecto.json'),JSON.stringify({id,name:'Humo',type:'serie',ideas:[],characters:[],locations:[],episodes:[],environments:[env('h','ambientes/h/3d/model.json'),env('fuera','../../x.json'),env('enlace','ambientes/h/3d/enlace.json'),env('sin','ambientes/h/3d/sin.json'),env('texto','ambientes/h/3d/LEEME.md')]}));
let child,token;const origin=`http://127.0.0.1:${port}`;
test.before(()=>new Promise((resolve,reject)=>{child=spawnServer(process.execPath,[path.join(ROOT,'app/server.mjs')],{cwd:ROOT,env:{...process.env,PORT:String(port),RODAJE_DATA:DATA,RODAJE_LAN:'',RODAJE_TLS_CERT:'',RODAJE_TLS_KEY:''},stdio:['ignore','pipe','pipe']});let out='';
 const t=setTimeout(()=>reject(Error('El servidor no arrancó: '+out)),15000);child.stdout.on('data',d=>{out+=d;if(out.includes('Rodaje ·')){clearTimeout(t);resolve();}});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('El servidor salió con '+c+': '+out)));})
 .then(async()=>{token=(await (await fetch(origin+'/api/state')).json()).token;}));
test.after(()=>{child?.kill();fs.rmSync(TMP,{recursive:true,force:true});});
const get=async(project,environment)=>{const r=await fetch(`${origin}/api/planta?project=${encodeURIComponent(project)}&environment=${encodeURIComponent(environment)}`);return {status:r.status,body:await r.json()};};
const post=async(b,headers={'x-rodaje-token':token})=>{const r=await fetch(origin+'/api/planta',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)});return {status:r.status,body:await r.json()};};
const moved=()=>{const p=structuredClone(PLANTA);p.formas[0].puntos[2]=[4.5,3.5];return p;};
const outsideSame=()=>assert.equal(fs.readFileSync(outside,'utf8'),MODEL,'el fichero de fuera no cambia');

test('GET devuelve la planta, su revisión y el entorno',async()=>{const r=await get(id,'h');assert.equal(r.status,200);assert.deepEqual(r.body,{planta:PLANTA,revision:2,environment:{id:'h',name:'Entorno h'}});
 assert.equal((await get(id,'nada')).status,404);assert.equal((await get(id,'sin')).status,404);assert.equal((await get(id,'texto')).status,404);});
test('POST exige token y origen propio',async()=>{assert.equal((await post({project:id,environment:'h',revision:2,planta:moved()},{})).status,403);
 assert.equal((await post({project:id,environment:'h',revision:2,planta:moved()},{'x-rodaje-token':token,origin:'http://evil.example'})).status,403);assert.equal(fs.readFileSync(modelFile,'utf8'),MODEL);});
test('proyecto o datos fuera de sitio: error y nada escrito',async()=>{for(const project of ['../x','..','a/b']){const r=await post({project,environment:'h',revision:2,planta:moved()});assert.ok(r.status>=400,project);}
 assert.equal((await post({project:id,environment:'nada',revision:2,planta:moved()})).status,404);
 for(const e of ['fuera','enlace']){const r=await post({project:id,environment:e,revision:2,planta:moved()});assert.equal(r.status,400,e);assert.match(r.body.error,/Ruta no válida|Enlace fuera/);assert.ok((await get(id,e)).status>=400);}
 outsideSame();assert.equal(fs.readFileSync(modelFile,'utf8'),MODEL);});
test('revisión antigua 409 y fichero idéntico; ids cambiados 400',async()=>{const r=await post({project:id,environment:'h',revision:1,planta:moved()});assert.equal(r.status,409);assert.match(r.body.error,/revisión 2 en disco, 1 en el editor/);
 const p=moved();p.formas[1].id='otra';assert.equal((await post({project:id,environment:'h',revision:2,planta:p})).status,400);
 const q=moved();q.formas[0].lados.pop();assert.equal((await post({project:id,environment:'h',revision:2,planta:q})).status,400);assert.equal(fs.readFileSync(modelFile,'utf8'),MODEL);});
test('guardar: sube la revisión, solo cambia el tramo de dims.planta e ignora rutas del cliente',async()=>{const r=await post({project:id,environment:'h',revision:2,planta:moved(),file:'../../x.json',data:'../../x.json'});
 assert.equal(r.status,200);assert.equal(r.body.revision,3);assert.deepEqual(r.body.planta,{...moved(),revision:3});
 const text=fs.readFileSync(modelFile,'utf8'),[s0,e0]=jsonValueSpan(MODEL,['dims','planta']),[s1,e1]=jsonValueSpan(text,['dims','planta']);
 assert.equal(text.slice(0,s1),MODEL.slice(0,s0));assert.equal(text.slice(e1),MODEL.slice(e0));assert.deepEqual(JSON.parse(text).dims.planta,{...moved(),revision:3});
 const a=MODEL.split('\n'),b=text.split('\n');assert.equal(a.filter((l,i)=>l!==b[i]).length,3);outsideSame();
 assert.equal((await get(id,'h')).body.revision,3);assert.equal((await post({project:id,environment:'h',revision:2,planta:moved()})).status,409);
 assert.deepEqual(fs.readdirSync(path.dirname(modelFile)).filter(f=>f.endsWith('.tmp')),[]);});
