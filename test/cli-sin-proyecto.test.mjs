// Ningún script asume un proyecto: sin --project, posicional, RODAJE_PROJECT ni proyecto activo en la app, uso y código 2
// sin tocar el disco; con proyecto, imprimen «Proyecto: X (fuente)» en stderr (issue #4).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const ROOT=path.resolve(import.meta.dirname,'..'),SCRIPTS=path.join(ROOT,'scripts');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-cli-'));
const baseEnv=()=>{const env={...process.env,FAL_KEY:'test:dummy'};delete env.RODAJE_PROJECT;return env;};
const run=(script,args,env={})=>spawnSync(process.execPath,[path.join(SCRIPTS,script),...args],{cwd:ROOT,encoding:'utf8',timeout:30000,env:{...baseEnv(),...env}});
const snapshot=d=>fs.existsSync(d)?fs.readdirSync(d,{recursive:true}).sort().map(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()?f+'/':f+' '+createHash('sha256').update(fs.readFileSync(p)).digest('hex');}):null;

// Órdenes que necesitan proyecto; cada script también se prueba sin argumentos.
const TABLE={
 'bloques/masters.mjs':[['ep1']],
 'bloques/planificar.mjs':[['l1','ep1','s1']],
 'bloques/render.mjs':[['l1']],
 'bloques/prompt.mjs':[['l1']],
 'bloques/enviar.mjs':[['l1','b01']],
 'bloques/estado.mjs':[['l1'],['l1','b01','--verdict','accepted']],
 'bloques/montar.mjs':[['l1']],
 'bloques/informe.mjs':[['l1']],
 'bloques/voces.mjs':[['lineas','ep1','s1'],['prueba','--voz','x','--texto','hola']],
 'registro.mjs':[['sync'],['render'],['check'],['freeze','ROZ_BASE'],['describe','roz@foot'],['describe','roz','ana']],
 'perfil.mjs':[['list'],['show','roz']],
 'mapa-espacial.mjs':[['cabina']],
 'leer-movil.mjs':[[],['4322']],
 'pendientes.mjs':[['listar']],
 'prompts-pendientes.mjs':[[]],
 'storyboard-a-secuencia.mjs':[['sb1','s1']],
 'storyboard-prompts.mjs':[['sb1']],
 'stage-config.mjs':[['show'],['check'],['set','--desde','x.json']],
 'entorno-glb.mjs':[['caja']],
 'entorno-coplanares.mjs':[['caja'],['caja','--todos']],
 'entornos/capturar.mjs':[['out','[]','--entorno','caja']],
 'entornos/recorrer.mjs':[['out','--entorno','caja']],
};
const EXCLUIDOS={
 'bloques/lib.mjs':'biblioteca, no es una orden',
 'fusionar.mjs':'sin proyecto recorre todos (no es un proyecto por defecto)',
 'proyecto-check.mjs':'valida uno o todos los proyectos (--all)',
 'linea-base.mjs':'recorre todos los proyectos',
 'check-ui.mjs':'issue #6',
 'prepare-dead-air.mjs':'issue #17','import-conjurados.mjs':'issue #17','conjurados-pelicula.mjs':'issue #17',
 'entornos/calibrar.mjs':'herramienta de calibración fuera de esta issue','entornos/retroproyectar.mjs':'herramienta de calibración fuera de esta issue',
};
const cases=Object.entries(TABLE).flatMap(([s,list])=>[...list,[]].filter((a,i,all)=>all.findIndex(b=>b.join('\0')===a.join('\0'))===i).map(args=>[s,args]));

function expectUsage(r,label){
 assert.equal(r.status,2,`${label}: código ${r.status}\n${r.stderr}`);
 assert.match(r.stderr,/Uso:/,label);
 assert.ok(!r.stderr.split('\n').some(l=>/^\s+at /.test(l)),`${label}: traza en stderr\n${r.stderr}`);
 assert.equal(r.stdout,'',label);
}

test('todo scripts/**/*.mjs está en la tabla o excluido con motivo',()=>{
 const all=fs.readdirSync(SCRIPTS,{recursive:true}).filter(f=>f.endsWith('.mjs')).map(f=>f.split(path.sep).join('/')).sort();
 assert.deepEqual(all.filter(f=>!TABLE[f]&&!EXCLUIDOS[f]),[]);
 assert.deepEqual([...Object.keys(TABLE),...Object.keys(EXCLUIDOS)].filter(f=>!all.includes(f)),[]);
});

test('sin proyecto y con RODAJE_DATA inexistente: uso, código 2 y sin crear nada',()=>{
 const data=path.join(tmp(),'datos');
 for(const [s,args] of cases){const r=run(s,args,{RODAJE_DATA:data});expectUsage(r,`${s} ${args.join(' ')}`);assert.equal(fs.existsSync(data),false,`${s} creó RODAJE_DATA`);}
});

test('con un proyecto activo que ya no existe: mismo resultado y DATA sin cambios',()=>{
 const data=tmp();fs.writeFileSync(path.join(data,'.activo.json'),JSON.stringify({project:'borrado',at:'2026-01-01T00:00:00.000Z'}));
 const before=snapshot(data);
 for(const [s,args] of cases){const r=run(s,args,{RODAJE_DATA:data});expectUsage(r,`${s} ${args.join(' ')}`);assert.deepEqual(snapshot(data),before,`${s} cambió DATA`);}
});

// DATA de compatibilidad: p1 con el personaje roz y el entorno caja; p2 con max.
const builder=`export function build(T,data){const root=new T.Group();for(const b of data.boxes){const m=new T.Mesh(new T.BoxGeometry(...b.size),new T.MeshBasicMaterial());m.name=b.name;m.position.set(...b.pos);root.add(m);}return root;}\n`;
function compatData(){
 const data=tmp();
 const project=(id,character,extra={})=>{fs.mkdirSync(path.join(data,id),{recursive:true});fs.writeFileSync(path.join(data,id,'proyecto.json'),JSON.stringify({id,name:id.toUpperCase(),type:'serie',ideas:[],characters:[{id:character,name:character[0].toUpperCase()+character.slice(1),description:''}],locations:[],episodes:[],issues:[],revision:1,...extra}));};
 project('p1','roz',{environments:[{id:'caja',builder:'3d/b.js',data:'3d/m.json'}]});project('p2','max');
 fs.mkdirSync(path.join(data,'p1','3d'));fs.writeFileSync(path.join(data,'p1','3d','b.js'),builder);fs.writeFileSync(path.join(data,'p1','3d','m.json'),JSON.stringify({boxes:[{name:'a',pos:[0,1,0],size:[1,1,1]},{name:'b',pos:[3,1,0],size:[1,1,1]}]}));
 return data;
}
const setActive=(data,id)=>{const f=path.join(data,'.activo.json');if(id)fs.writeFileSync(f,JSON.stringify({project:id,at:'2026-01-01T00:00:00.000Z'}));else fs.rmSync(f,{force:true});};

test('compatibilidad: cada fuente del proyecto y su línea «Proyecto: X (fuente)»',()=>{
 const data=compatData();
 const rows=[
  // [script, args, RODAJE_PROJECT, activo, proyecto, fuente, marcador en stdout]
  ['perfil.mjs',['list','--project','p1'],'p2','p2','p1','--project',/^roz /m],
  ['perfil.mjs',['list','p1'],null,'p2','p1','argumento',/^roz /m],
  ['perfil.mjs',['list'],'p1','p2','p1','RODAJE_PROJECT',/^roz /m],
  ['perfil.mjs',['list'],null,'p2','p2','activo en la app',/^max /m],
  ['perfil.mjs',['show','p1','roz'],null,'p2','p1','argumento',/^# Roz$/m],
  ['perfil.mjs',['show','roz'],null,'p1','p1','activo en la app',/^# Roz$/m],
  ['registro.mjs',['check','p1'],null,'p2','p1','argumento',/check: sin errores/],
  ['registro.mjs',['check'],'p1','p2','p1','RODAJE_PROJECT',/check: sin errores/],
  ['pendientes.mjs',['listar','p1'],null,'p2','p1','argumento',/\(0\)/],
  ['pendientes.mjs',['listar'],null,'p1','p1','activo en la app',/\(0\)/],
  ['prompts-pendientes.mjs',['p1'],null,'p2','p1','argumento',/0 pendientes · 0 generados/],
  ['prompts-pendientes.mjs',['--project','p1','filtro'],null,'p2','p1','--project',/0 pendientes · 0 generados/],
  ['entorno-coplanares.mjs',['p1','caja'],null,'p2','p1','argumento',/defecto: 0 pares coplanarios/],
  ['entorno-coplanares.mjs',['caja'],'p1',null,'p1','RODAJE_PROJECT',/defecto: 0 pares coplanarios/],
 ];
 for(const [s,args,envProject,active,project,source,marker] of rows){
  setActive(data,active);const before=snapshot(data);const label=`${s} ${args.join(' ')}`;
  const r=run(s,args,{RODAJE_DATA:data,...(envProject?{RODAJE_PROJECT:envProject}:{})});
  assert.equal(r.status,0,`${label}\n${r.stderr}`);
  assert.ok(r.stderr.split('\n').includes(`Proyecto: ${project} (${source})`),`${label}: stderr\n${r.stderr}`);
  assert.match(r.stdout,marker,label);
  assert.deepEqual(snapshot(data),before,`${label}: cambió DATA`);
 }
 for(const [args,message] of [[['list','--project','p9'],'No existe el proyecto: p9'],[['list','--project','a/b'],'ID de proyecto no válido'],[['list','--project'],'--project necesita un id']]){
  setActive(data,'p2');const before=snapshot(data);const r=run('perfil.mjs',args,{RODAJE_DATA:data,RODAJE_PROJECT:'p2'});
  expectUsage(r,args.join(' '));assert.ok(r.stderr.includes(message),r.stderr);assert.deepEqual(snapshot(data),before);
 }
});

test('app/, lib/, scripts/ y viewer/ no nombran proyectos concretos',()=>{
 const skip=new Set(['scripts/check-ui.mjs','scripts/prepare-dead-air.mjs','scripts/import-conjurados.mjs','scripts/conjurados-pelicula.mjs']);
 const hits=[];
 for(const d of ['app','lib','scripts','viewer'])for(const f of fs.readdirSync(path.join(ROOT,d),{recursive:true})){
  const rel=d+'/'+f.split(path.sep).join('/'),abs=path.join(ROOT,rel);
  if(skip.has(rel)||!fs.statSync(abs).isFile()||!/\.(mjs|js|html|css|json)$/.test(rel))continue;
  // Tolerado hasta #14: la clase .toledo-explorer la pinta el visor de la nave que aún carga el proyecto.
  fs.readFileSync(abs,'utf8').split('\n').forEach((l,i)=>{if(/dead-air|conjurados|caseron|toledo/i.test(rel==='app/style.css'?l.replaceAll('.toledo-explorer',''):l))hits.push(`${rel}:${i+1}`);});
 }
 assert.deepEqual(hits,[]);
});
