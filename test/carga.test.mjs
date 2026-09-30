// Carga bajo demanda del cliente (#64, reutilizable por #65): caché por URL y revisión, peticiones compartidas, fallos sin guardar e
// invalidación por proyecto en todo el grupo. fetchJSON falso que cuenta llamadas y se resuelve a mano.
import test from 'node:test';import assert from 'node:assert/strict';
import {lazyGroup} from '../app/carga.source.js';

function fake(){const calls=[],pending=[];
 const fetchJSON=url=>{calls.push(url);return new Promise((resolve,reject)=>pending.push({url,resolve,reject}));};
 const settle=async(value,fail)=>{await null;const x=pending.shift();fail?x.reject(Error('red')):x.resolve(value??{url:x.url});};
 return {calls,pending,fetchJSON,settle};}
const tick=()=>new Promise(r=>setTimeout(r,0));
const url=(id,params)=>'/api/x?project='+id+(params?'&k='+params:'');

test('misma revisión: una sola petición, también en paralelo',async()=>{const f=fake(),g=lazyGroup(f.fetchJSON),ix=g.index(url);
 const a=ix.get('p',1),b=ix.get('p',1);await tick();assert.equal(f.calls.length,1);assert.equal(a,b);await f.settle({v:1});
 assert.deepEqual(await a,{v:1});assert.deepEqual(await ix.get('p',1),{v:1});assert.equal(f.calls.length,1);});

test('otra revisión u otro proyecto: nueva petición; peek solo con la misma revisión',async()=>{const f=fake(),g=lazyGroup(f.fetchJSON),ix=g.index(url);
 const a=ix.get('p',1);assert.equal(ix.peek('p',1),undefined,'en curso');await tick();await f.settle({v:1});await a;
 assert.deepEqual(ix.peek('p',1),{v:1});assert.equal(ix.peek('p',2),undefined);
 const b=ix.get('p',2);await tick();assert.equal(f.calls.length,2);await f.settle({v:2});assert.deepEqual(await b,{v:2});assert.equal(ix.peek('p',1),undefined,'la revisión nueva sustituye a la vieja');
 const c=ix.get('q',2);await tick();assert.deepEqual(f.calls,[url('p'),url('p'),url('q')]);await f.settle();await c;});

test('fallo: resuelve null, no se guarda y el siguiente get reintenta',async()=>{const f=fake(),g=lazyGroup(f.fetchJSON),ix=g.index(url);
 const a=ix.get('p',1);await tick();await f.settle(null,true);assert.equal(await a,null);assert.equal(ix.peek('p',1),undefined);
 const b=ix.get('p',1);await tick();assert.equal(f.calls.length,2);await f.settle({v:1});assert.deepEqual(await b,{v:1});
 const boom=lazyGroup(()=>{throw Error('síncrono');}).index(url);assert.equal(await boom.get('p',1),null,'un fallo síncrono tampoco rechaza');});

test('invalidate(project) vacía ese proyecto en todos los índices del grupo; invalidate() vacía todo',async()=>{const f=fake(),g=lazyGroup(f.fetchJSON),a=g.index(url),b=g.index((id,x)=>'/api/y?project='+id+(x||''));
 const fill=async()=>{const ps=[a.get('p',1),b.get('p',1),a.get('q',1)];await tick();while(f.pending.length)await f.settle();await Promise.all(ps);};
 await fill();const n=f.calls.length;g.invalidate('p');assert.equal(a.peek('p',1),undefined);assert.equal(b.peek('p',1),undefined);assert.ok(a.peek('q',1));
 const again=[a.get('p',1),a.get('q',1)];await tick();assert.equal(f.calls.length,n+1,'q sigue en caché');await f.settle();await Promise.all(again);
 g.invalidate();for(const [ix,id] of [[a,'p'],[a,'q'],[b,'p']])assert.equal(ix.peek(id,1),undefined);
 const other=lazyGroup(f.fetchJSON).index(url);const o=other.get('p',1);await tick();await f.settle({o:1});await o;a.get('p',1);g.invalidate('p');assert.deepEqual(other.peek('p',1),{o:1},'otro grupo no se toca');});

test('una respuesta que llega tras invalidate no se queda en caché',async()=>{const f=fake(),g=lazyGroup(f.fetchJSON),ix=g.index(url);
 const a=ix.get('p',1);await tick();g.invalidate('p');await f.settle({viejo:1});assert.deepEqual(await a,{viejo:1},'quien la pidió la recibe');
 assert.equal(ix.peek('p',1),undefined);const b=ix.get('p',1);await tick();assert.equal(f.calls.length,2);await f.settle({nuevo:1});assert.deepEqual(await b,{nuevo:1});
 // Un fallo tardío de la petición invalidada no borra la entrada nueva.
 const c=ix.get('p',2);await tick();g.invalidate('p');const d=ix.get('p',2);await tick();await f.settle(null,true);assert.equal(await c,null);await f.settle({d:1});assert.deepEqual(await d,{d:1});assert.deepEqual(ix.peek('p',2),{d:1});});

test('params distintos, entradas distintas',async()=>{const f=fake(),g=lazyGroup(f.fetchJSON),ix=g.index(url);
 const a=ix.get('p',1,'a'),b=ix.get('p',1,'b'),a2=ix.get('p',1,'a');await tick();assert.deepEqual(f.calls,[url('p','a'),url('p','b')]);
 await f.settle({a:1});await f.settle({b:1});assert.deepEqual([await a,await b,await a2],[{a:1},{b:1},{a:1}]);
 assert.deepEqual(ix.peek('p',1,'b'),{b:1});g.invalidate('p');assert.equal(ix.peek('p',1,'a'),undefined);});
