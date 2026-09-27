import test from 'node:test';import assert from 'node:assert/strict';
const w=await import('../app/workflow.mjs');
const list=[{n:1,video:'generated-v01.mp4',durationReturned:8.2,verdict:'rejected',failedRules:['C15']},{n:2,video:'generated-v02.mp4',durationReturned:8.2,verdict:null},{n:3,status:'submitted'}];

test('chosenAttempt: aceptada antes que pendiente; nunca una rechazada',()=>{
 assert.deepEqual(w.chosenAttempt(list),{attempt:list[1],pending:true});
 const acc=[{...list[0],verdict:'accepted'},list[1]];assert.equal(w.chosenAttempt(acc).attempt.n,1);assert.equal(w.chosenAttempt(acc).pending,false);
 assert.equal(w.chosenAttempt([list[0]]).attempt,null);assert.equal(w.chosenAttempt(list,a=>a.n!==2).attempt,null);});

test('cutTimeline usa at/length y, si faltan, suma usedRange',()=>{
 const t=w.cutTimeline({blocks:[{block:'b01',usedRange:[[0,4]]},{block:'b02',usedRange:[[1,2],[3,5]]},{block:'b03',source:'guide'}]},[{id:'b03',length:5}]);
 assert.deepEqual(t.map(b=>[b.start,b.end]),[[0,4],[4,7],[7,12]]);
 assert.deepEqual(w.cutTimeline({blocks:[{block:'b01',at:0,length:4.04},{block:'b02',at:4.04,length:3}]}).map(b=>b.end),[4.04,7.04]);
 assert.equal(w.blockAt(t,4).block,'b02');assert.equal(w.blockAt(t,12).block,'b03');assert.equal(w.blockAt([],3),null);});

test('parseRules lee los encabezados de REGLAS.md',()=>{
 assert.deepEqual(w.parseRules('# Reglas\n### C01 · Cada persona una sola vez\ntexto\n### R12 · Sin guía\n'),[{id:'C01',title:'Cada persona una sola vez'},{id:'R12',title:'Sin guía'}]);});

test('reviewAttempt acepta, rechaza con regla, limpia y valida el rango',()=>{
 const acc=w.reviewAttempt(list,{attempt:2,verdict:'accepted',length:6},'T');assert.deepEqual(acc[1].usedRange,[[0,6]]);assert.equal(acc[1].reviewedAt,'T');assert.equal(list[1].verdict,null,'no muta la entrada');
 const other=w.reviewAttempt([{...list[0],verdict:'accepted'},list[1]],{attempt:2,verdict:'accepted',range:[[0.5,3.456]]});assert.equal(other[0].verdict,null);assert.equal(other[0].replacedBy,2);assert.deepEqual(other[1].usedRange,[[0.5,3.46]]);
 assert.throws(()=>w.reviewAttempt(list,{attempt:2,verdict:'rejected'}),/regla/);
 assert.throws(()=>w.reviewAttempt(list,{attempt:2,verdict:'rejected',rules:['X9'],known:['C01']}),/desconocida/);
 assert.throws(()=>w.reviewAttempt(list,{attempt:2,verdict:'accepted',range:[[0,9]]}),/Rango/);
 assert.throws(()=>w.reviewAttempt(list,{attempt:3,verdict:'accepted'}),/vídeo/);
 const clear=w.reviewAttempt(list,{attempt:1,verdict:null});assert.equal(clear[0].verdict,null);assert.equal(clear[0].failedRules,undefined);});
