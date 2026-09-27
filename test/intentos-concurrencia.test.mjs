// #23: enviar.mjs, estado.mjs y la vista Montaje escriben attempts.json a la vez sin pisarse. Otro proceso se simula con un gancho
// del grabador de fetch (RODAJE_MOCK_HOOK) que escribe en el mismo RODAJE_DATA mientras el script espera a fal (simulado, sin coste).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const H=await import('./fixtures/providers/harness.mjs');
const P=H.CLI_PROJECT,ENDPOINT='minimax/h3-max/reference-to-video';
const v1={n:1,at:'2026-09-01T00:00:00Z',endpoint:ENDPOINT,prompt:'prompt-v01.txt',durationRequested:10,status:'done',video:'generated-v01.mp4',durationReturned:9.5,verdict:'rejected',failedRules:['R12'],notes:'',reviewedAt:'2026-09-01T00:00:00Z'};
// Copia nueva del proyecto fixture con attempts.json de b01 sembrado; prompt-v01.txt igual a prompt.txt.
function setup(list){const data=H.cliData(),out=path.join(data,P,'assets','lote-a'),dir=path.join(out,'b01');
 const prompt=fs.readFileSync(path.join(dir,'prompt.txt'),'utf8');fs.writeFileSync(path.join(dir,'prompt-v01.txt'),prompt);
 fs.writeFileSync(path.join(dir,'attempts.json'),JSON.stringify(list,null,2)+'\n');
 return {data,out,dir,line:prompt.split('\n').find(l=>l.trim()),read:()=>JSON.parse(fs.readFileSync(path.join(dir,'attempts.json'),'utf8'))};}
// Gancho de un solo disparo: MATCH y ACCIÓN son código con method, url, out y las funciones de lib/lotes.mjs a mano.
const hook=(out,match,action)=>H.hookModule(`const {updateAttempts,patchAttempt,reviewBlock}=await import(ROOT_URL+'/lib/lotes.mjs');const out=${JSON.stringify(out)};let done=false;
export default async ({method,url})=>{if(done||!(${match}))return;done=true;${action};};`);
const run=(s,script,args,hookFile)=>H.runCli(s.data,script,args,{env:hookFile?{RODAJE_MOCK_HOOK:hookFile}:{}});
const ON_STATUS="method==='GET'&&/\\/status/.test(url)",ON_SUBMIT="method==='POST'&&url.includes('queue.fal.run')",ON_UPLOAD="method==='POST'&&url.includes('rest.fal.ai/storage/upload/initiate')";
const REVIEW_V1=`reviewBlock('${P}','lote-a','b01',{attempt:1,verdict:'rejected',rules:['R04'],notes:'desde Montaje'})`;
const noTrace=t=>assert.doesNotMatch(t,/^\s+at /m);

test('un veredicto dado mientras estado espera a fal sobrevive a la descarga',()=>{
 const s=setup([v1,{n:2,status:'submitted',requestId:'mock-90-minimax_h3_max_reference_to_video',endpoint:ENDPOINT,prompt:'prompt-v02.txt',changedLine:'x'}]);
 const r=run(s,'scripts/bloques/estado.mjs',['lote-a','b01'],hook(s.out,ON_STATUS,REVIEW_V1));assert.equal(r.status,0,r.stderr);
 const [a1,a2]=s.read();assert.deepEqual(a1.failedRules,['R04']);assert.equal(a1.notes,'desde Montaje');
 assert.equal(a2.status,'done');assert.equal(a2.video,'generated-v02.mp4');assert.equal(a2.seed,1234);assert.equal(a2.verdict,null);});

for(const [name,match] of [['el submit',ON_SUBMIT],['las subidas',ON_UPLOAD]])
 test(`un veredicto dado durante ${name} de enviar sobrevive al registro del intento`,()=>{
  const s=setup([v1]);const r=run(s,'scripts/bloques/enviar.mjs',['lote-a','b01','--changed',s.line,'--yes'],hook(s.out,match,REVIEW_V1));assert.equal(r.status,0,r.stderr);
  const [a1,a2]=s.read(),req=JSON.parse(fs.readFileSync(path.join(s.dir,'request-v02.json'),'utf8'));
  assert.deepEqual(a1.failedRules,['R04']);assert.equal(a2.status,'submitted');assert.equal(a2.requestId,req.requestId);assert.ok(req.requestId);assert.equal(a2.changedLine,s.line);
  assert.ok(fs.existsSync(path.join(s.dir,'prompt-v02.txt')));});

test('si otro envío registra el mismo número durante las subidas, enviar aborta sin enviar',()=>{
 const s=setup([v1]),other={n:2,status:'submitting',at:'otro'};
 const r=run(s,'scripts/bloques/enviar.mjs',['lote-a','b01','--changed',s.line,'--yes'],hook(s.out,ON_UPLOAD,"updateAttempts(out,'b01',l=>[...l,{n:2,status:'submitting',at:'otro'}])"));
 assert.notEqual(r.status,0);assert.match(r.stderr,/Otro proceso registró intentos/);assert.match(r.stderr,/No se ha enviado nada/);noTrace(r.stderr);
 assert.equal(r.lines.map(l=>JSON.parse(l)).filter(l=>l.kind==='fetch'&&l.method==='POST'&&l.url.includes('queue.fal.run')).length,0);
 assert.deepEqual(s.read(),[v1,other]);for(const f of ['prompt-v02.txt','request-v02.json'])assert.equal(fs.existsSync(path.join(s.dir,f)),false,f);});

test('request-vNN.json guarda el requestId aunque falle el parche de attempts.json',()=>{
 const s=setup([v1]);const r=run(s,'scripts/bloques/enviar.mjs',['lote-a','b01','--changed',s.line,'--yes'],hook(s.out,ON_SUBMIT,"updateAttempts(out,'b01',l=>l.filter(a=>a.n!==2))"));
 const req=JSON.parse(fs.readFileSync(path.join(s.dir,'request-v02.json'),'utf8'));
 assert.notEqual(r.status,0);assert.equal(req.status,'submitted');assert.ok(req.requestId);
 assert.ok(r.stderr.includes(req.requestId),r.stderr);assert.match(r.stderr,/request-v02\.json/);assert.match(r.stderr,/no se pudo actualizar/);noTrace(r.stderr);});

test('estado recupera un intento submitting con el requestId de request-vNN.json',()=>{
 const s=setup([v1,{n:2,status:'submitting',request:'request-v02.json',endpoint:ENDPOINT,prompt:'prompt-v02.txt'}]),requestId='mock-91-minimax_h3_max_reference_to_video';
 fs.writeFileSync(path.join(s.dir,'request-v02.json'),JSON.stringify({status:'submitted',endpoint:ENDPOINT,input:{},requestId}));
 const r=run(s,'scripts/bloques/estado.mjs',['lote-a','b01']);assert.equal(r.status,0,r.stderr);
 const a2=s.read()[1];assert.equal(a2.status,'done');assert.equal(a2.requestId,requestId);assert.equal(a2.video,'generated-v02.mp4');});

test('estado no pisa un intento que otro proceso ya descargó y revisó',()=>{
 const s=setup([v1,{n:2,status:'submitted',requestId:'mock-92-minimax_h3_max_reference_to_video',endpoint:ENDPOINT,prompt:'prompt-v02.txt',changedLine:'x'}]);
 const r=run(s,'scripts/bloques/estado.mjs',['lote-a','b01'],hook(s.out,ON_STATUS,"patchAttempt(out,'b01',2,()=>({status:'done',video:'generated-v02.mp4',verdict:'rejected',failedRules:['R12']}))"));
 assert.equal(r.status,0,r.stderr);const a2=s.read()[1];assert.equal(a2.verdict,'rejected');assert.deepEqual(a2.failedRules,['R12']);});

test('estado sin nada pendiente no reescribe attempts.json',()=>{
 const s=setup([v1]),f=path.join(s.dir,'attempts.json'),raw=JSON.stringify([v1]);fs.writeFileSync(f,raw);const old=new Date(Date.now()-3600e3);fs.utimesSync(f,old,old);const mtime=fs.statSync(f).mtimeMs;
 const r=run(s,'scripts/bloques/estado.mjs',['lote-a','b01']);assert.equal(r.status,0,r.stderr);
 assert.equal(fs.readFileSync(f,'utf8'),raw);assert.equal(fs.statSync(f).mtimeMs,mtime);});
