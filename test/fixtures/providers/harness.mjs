// Arnés sin coste de las pruebas de proveedores (issue #5): la app (app-driver.mjs) y los scripts corren en subprocesos con
// el grabador de fetch (fal-fetch-mock.mjs), ffmpeg/ffprobe falsos en PATH y FAL_KEY=test:dummy. Lo registrado se normaliza
// y se compara con golden/. RODAJE_GOLDEN=grabar lo reescribe, y solo se permite sobre el código anterior al refactor.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const GOLDEN=path.join(import.meta.dirname,'golden');
const MOCK=pathToFileURL(path.join(ROOT,'test/fixtures/fal-fetch-mock.mjs')).href,BIN=path.join(ROOT,'test/fixtures/bin');
const DRIVER=path.join(import.meta.dirname,'app-driver.mjs'),FIXTURE=path.join(import.meta.dirname,'proyecto');
export const CLI_PROJECT='fixture-proveedores';
export const RECORD=process.env.RODAJE_GOLDEN==='grabar';
// Tras el refactor no se regraba: con lib/media|fal|tts.mjs presentes, golden() se niega a escribir (y las pruebas fallan).
const refactored=['media','fal','tts'].find(f=>fs.existsSync(path.join(ROOT,'lib',f+'.mjs')));
export const RECORD_BLOCKED=RECORD&&refactored?`RODAJE_GOLDEN=grabar: existe lib/${refactored}.mjs; el golden se graba sobre el código anterior al refactor`:null;
export const tmp=prefix=>fs.mkdtempSync(path.join(os.tmpdir(),prefix));

// Entorno de un subproceso: nunca la clave real ni el proyecto del entorno; ffmpeg/ffprobe falsos solo aquí.
export function mockEnv({data,log,extra={}}){const base={...process.env};delete base.RODAJE_PROJECT;delete base.RODAJE_MOCK_FFMPEG_FAIL;
 const env={...base,RODAJE_DATA:data,RODAJE_MOCK_LOG:log,FAL_KEY:'test:dummy',RODAJE_CONFIG_DIR:tmp('rodaje-config-'),PATH:[BIN,path.dirname(process.execPath),process.env.PATH].join(path.delimiter),...extra};
 for(const [k,v] of Object.entries(extra))if(v===undefined)delete env[k];return env;}

export const normalize=(text,data)=>text.replaceAll(fs.realpathSync(data),'<DATA>').replaceAll(data,'<DATA>').replaceAll(ROOT,'<ROOT>').replace(/\b\d{13}\b/g,'<TS>');
export const readLog=(file,data)=>fs.existsSync(file)?normalize(fs.readFileSync(file,'utf8'),data).split('\n').filter(Boolean):[];

// Golden: .jsonl = líneas; si no, JSON. En modo grabar escribe; si no, devuelve lo grabado (y falla si falta).
export function golden(rel,value){const file=path.join(GOLDEN,rel),lines=rel.endsWith('.jsonl');const text=lines?value.join('\n')+'\n':JSON.stringify(value,null,1)+'\n';
 if(RECORD_BLOCKED)throw Error(RECORD_BLOCKED);
 if(RECORD){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);return value;}
 if(!fs.existsSync(file))throw Error(`falta el golden ${rel}; grábalo sobre el código anterior`);const saved=fs.readFileSync(file,'utf8');
 return lines?saved.split('\n').filter(Boolean):JSON.parse(saved);}

// run(j) de la app sobre fixture-app. jobs: nombres de app-driver.mjs (todos si falta). env: variables extra del subproceso.
export function runApp({jobs,env={}}={}){const data=tmp('rodaje-prov-app-'),logs=tmp('rodaje-prov-log-'),out=path.join(logs,'resumen.json');
 const r=spawnSync(process.execPath,['--import',MOCK,DRIVER],{cwd:ROOT,encoding:'utf8',timeout:120000,env:mockEnv({data,log:path.join(logs,'_inicio.jsonl'),extra:{RODAJE_MOCK_DIR:logs,RODAJE_DRIVER_OUT:out,CHROME_PATH:'/nonexistent',...(jobs?{RODAJE_DRIVER_JOBS:jobs.join(',')}:{}),...env}})});
 if(r.status!==0)throw Error('app-driver falló: '+r.stderr);
 return {data,summary:JSON.parse(fs.readFileSync(out,'utf8')),log:name=>readLog(path.join(logs,name+'.jsonl'),data)};}

// Copia nueva del proyecto fixture-proveedores en un RODAJE_DATA temporal.
export function cliData(){const data=tmp('rodaje-prov-cli-');fs.cpSync(FIXTURE,path.join(data,CLI_PROJECT),{recursive:true});return data;}
// Un script con el grabador. Devuelve las líneas del registro normalizadas más {kind:'salida',status,stdout}.
export function runCli(data,script,args,{env={},name='cli'}={}){const log=path.join(tmp('rodaje-prov-log-'),name+'.jsonl');
 const r=spawnSync(process.execPath,['--import',MOCK,path.join(ROOT,script),...args,'--project',CLI_PROJECT],{cwd:ROOT,encoding:'utf8',timeout:60000,env:mockEnv({data,log,extra:env})});
 return {status:r.status,stderr:r.stderr,lines:[...readLog(log,data),JSON.stringify({kind:'salida',status:r.status,stdout:normalize(r.stdout,data)})]};}

const freePort=()=>new Promise((ok,ko)=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>ok(port));}).on('error',ko);});
const get=url=>new Promise((ok,ko)=>http.get(url,res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>ok(Buffer.concat(c).toString()));}).on('error',ko));
// fusionar.mjs: arranca el servidor, pide /api/pares y lo para. Registro con los argv ordenados (el orden de recorrido no cuenta).
export async function runFusionar(data){const log=path.join(tmp('rodaje-prov-log-'),'fusionar.jsonl'),port=await freePort();
 const child=spawn(process.execPath,['--import',MOCK,path.join(ROOT,'scripts/fusionar.mjs'),CLI_PROJECT,'--puerto',String(port)],{cwd:ROOT,env:mockEnv({data,log}),stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',d=>stderr+=d);
 try{await new Promise((ok,ko)=>{let out='';child.stdout.on('data',d=>{out+=d;if(out.includes('http://127.0.0.1:'))ok();});child.on('exit',c=>ko(Error('fusionar salió con '+c+': '+stderr)));setTimeout(()=>ko(Error('fusionar no arrancó: '+stderr)),20000).unref();});
  const pares=JSON.parse(await get(`http://127.0.0.1:${port}/api/pares`));
  return [...readLog(log,data).sort(),JSON.stringify({kind:'pares',body:pares})];}
 finally{child.kill();}}
