// test/fixtures/hijos.mjs: los servidores de los tests mueren con el proceso del test aunque la señal no llegue al grupo (issue #38).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {pathToFileURL} from 'node:url';
const ROOT=path.resolve(import.meta.dirname,'..');
const HIJOS=pathToFileURL(path.join(ROOT,'test/fixtures/hijos.mjs')).href;
const vivo=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};

for(const sig of ['SIGINT','SIGTERM'])test(`un hijo registrado muere cuando ${sig} llega solo al proceso con setup.mjs`,async()=>{
 const code=`import {spawnServer} from '${HIJOS}';const h=spawnServer(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});h.on('spawn',()=>console.log(h.pid));setInterval(()=>{},1000);`;
 const c=spawn(process.execPath,['--import','./test/setup.mjs','--input-type=module','-e',code],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
 let pid;
 try{pid=await new Promise((resolve,reject)=>{let out='',err='';c.stdout.on('data',d=>{out+=d;if(out.includes('\n'))resolve(Number(out.trim()));});c.stderr.on('data',d=>err+=d);c.on('exit',code=>reject(Error('salió antes de tiempo: '+code+' '+err)));});
  assert.ok(vivo(pid));const done=new Promise(r=>c.on('exit',(code,signal)=>r({code,signal})));c.kill(sig);
  assert.deepEqual(await done,{code:null,signal:sig});
  // Huérfano, lo recoge init: puede tardar un instante en desaparecer como zombi.
  for(let i=0;i<40&&vivo(pid);i++)await new Promise(r=>setTimeout(r,50));
  assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
 }finally{c.kill('SIGKILL');if(pid&&vivo(pid))process.kill(pid,'SIGKILL');}
});

// Los únicos spawn asíncronos permitidos fuera del registro: los que prueban el propio setup.mjs y este fichero.
const LIBRES=new Set(['test/setup.test.mjs','test/hijos.test.mjs','test/fixtures/hijos.mjs']);
const ficheros=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?ficheros(path.join(dir,e.name)):/\.m?js$/.test(e.name)?[path.join(dir,e.name)]:[]);
test('todos los spawn de servidores de test/ pasan por fixtures/hijos.mjs',()=>{
 const malos=[];
 for(const f of ficheros(path.join(ROOT,'test'))){const rel=path.relative(ROOT,f);if(LIBRES.has(rel))continue;const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](?:node:)?child_process['"]/g)){
   const async=m[1].split(',').map(n=>n.trim().split(/\s+as\s+/)[0]).filter(n=>['spawn','exec','execFile','fork'].includes(n));if(async.length)malos.push(`${rel}: ${async.join(', ')}`);}
  if(/import\s+(?:\*\s+as\s+)?\w+\s+from\s*['"](?:node:)?child_process['"]|require\(\s*['"](?:node:)?child_process['"]\s*\)/.test(s))malos.push(`${rel}: importa child_process entero`);}
 assert.deepEqual(malos,[],'usa spawnServer() o track() de test/fixtures/hijos.mjs');
});
