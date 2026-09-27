// test/setup.mjs: una raíz temporal por proceso con DATA, configuración y TMPDIR dentro, borrada al salir (issue #32).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'..');

test('setup.mjs cuelga RODAJE_DATA, RODAJE_CONFIG_DIR y os.tmpdir() de una raíz que se borra al salir',()=>{
 const r=spawnSync(process.execPath,['--import','./test/setup.mjs','--input-type=module','-e',"import os from 'node:os';import fs from 'node:fs';const d=os.tmpdir();fs.writeFileSync(fs.mkdtempSync(d+'/x-')+'/f','x');console.log(JSON.stringify([process.env.RODAJE_DATA,process.env.RODAJE_CONFIG_DIR,d]))"],{cwd:ROOT,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const [data,config,tmp]=JSON.parse(r.stdout);
 assert.match(path.basename(tmp),/^rodaje-suite-/);assert.equal(path.dirname(data),tmp);assert.equal(path.dirname(config),tmp);
 assert.equal(fs.existsSync(tmp),false,'la raíz sigue existiendo: '+tmp);
});
test('bajo la suite, RODAJE_DATA, RODAJE_CONFIG_DIR y TMPDIR comparten raíz',()=>{
 const tmp=process.env.TMPDIR;assert.match(path.basename(tmp),/^rodaje-suite-/);
 assert.equal(path.dirname(process.env.RODAJE_DATA),tmp);assert.equal(path.dirname(process.env.RODAJE_CONFIG_DIR),tmp);
});
for(const sig of ['SIGINT','SIGTERM'])test(`setup.mjs borra su raíz al recibir ${sig} y muere por esa señal`,async()=>{
 const c=spawn(process.execPath,['--import','./test/setup.mjs','-e',"console.log(require('node:os').tmpdir());setInterval(()=>{},1000)"],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
 const tmp=await new Promise((resolve,reject)=>{let out='';c.stdout.on('data',d=>{out+=d;if(out.includes('\n'))resolve(out.trim());});c.on('exit',code=>reject(Error('salió antes de tiempo: '+code)));});
 assert.ok(fs.existsSync(tmp),tmp);const done=new Promise(r=>c.on('exit',(code,signal)=>r({code,signal})));c.kill(sig);
 assert.deepEqual(await done,{code:null,signal:sig});assert.equal(fs.existsSync(tmp),false,'la raíz sigue existiendo: '+tmp);
});
