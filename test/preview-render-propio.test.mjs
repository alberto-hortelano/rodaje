import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {previewIssues} from '../app/workflow.mjs';
const {create,save,newShot}=await import('../app/store.mjs');const {enqueue,jobs,pageReady}=await import('../app/jobs.mjs');

test('previewIssues: un plano con render propio no admite la preview estándar',()=>{
 assert.deepEqual(previewIssues({customRenderer:true}),['Plano con render propio: reproduce la preview guardada']);
 for(const t of [{},{customRenderer:false},null,undefined])assert.deepEqual(previewIssues(t),[]);
});

test('enqueue rechaza la preview de un plano con render propio sin crear trabajo',()=>{
 const p=create('Render propio');const t={...newShot('C0'),customRenderer:true,coverage:[{start:0,end:2,type:'tracking'}]};
 p.episodes=[{id:'e',sequences:[{id:'s',location:'',cast:[],silent:true,shots:[t]}]}];save(p);const before=jobs.size;
 assert.throws(()=>enqueue(p.id,'preview',t.id),/Plano con render propio: reproduce la preview guardada/);assert.equal(jobs.size,before);
 // Los avisos de readiness se siguen sumando al mensaje.
 p.episodes[0].sequences[0].silent=false;save(p);
 assert.throws(()=>enqueue(p.id,'preview',t.id),/render propio.*; Añade ambiente/);
});

const fakePage=wait=>{const page=new EventEmitter();page.waitForFunction=wait;return page;};
test('pageReady: un pageerror hace fallar con el error real, sin esperar al timeout',async()=>{
 const page=fakePage(()=>new Promise((_,reject)=>setTimeout(()=>reject(Error('Timeout 60000ms exceeded')),200)));
 const r=pageReady(page);page.emit('pageerror',Error("Cannot read properties of undefined (reading 'position')"));
 await assert.rejects(r,/Error en render.html: Cannot read properties of undefined \(reading 'position'\)/);
 assert.equal(page.listenerCount('pageerror'),0);
 await new Promise(r=>setTimeout(r,250));// el rechazo tardío de waitForFunction no queda sin capturar
});

test('pageReady: sin errores resuelve con window.ready y suelta el listener',async()=>{
 let args;const page=fakePage((...a)=>{args=a;return Promise.resolve('ok');});
 assert.equal(await pageReady(page),'ok');assert.deepEqual(args.slice(1),[{},{timeout:60000}]);assert.equal(page.listenerCount('pageerror'),0);
 const slow=fakePage(()=>Promise.reject(Error('Timeout 5ms exceeded')));await assert.rejects(pageReady(slow,5),/Timeout 5ms/);
});
