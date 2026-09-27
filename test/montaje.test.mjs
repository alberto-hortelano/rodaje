import test from 'node:test';import assert from 'node:assert/strict';
const w=await import('../app/workflow.mjs');
const list=[{n:1,status:'done',video:'generated-v01.mp4',durationReturned:8.2,verdict:'rejected',failedRules:['C15']},{n:2,status:'done',video:'generated-v02.mp4',durationReturned:8.2,verdict:null},{n:3,status:'submitted'}];

test('chosenAttempt: aceptada antes que pendiente; nunca una rechazada',()=>{
 assert.deepEqual(w.chosenAttempt(list),{attempt:list[1],pending:true});
 const acc=[{...list[0],verdict:'accepted'},list[1]];assert.equal(w.chosenAttempt(acc).attempt.n,1);assert.equal(w.chosenAttempt(acc).pending,false);
 assert.equal(w.chosenAttempt([list[0]]).attempt,null);assert.equal(w.chosenAttempt(list,a=>a.n!==2).attempt,null);
 assert.equal(w.chosenAttempt([{n:1,video:'g.mp4',verdict:null}]).attempt,null,'con vídeo pero sin status done no cuenta');});

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
 assert.throws(()=>w.reviewAttempt(list,{attempt:3,verdict:'accepted'}),/descargado/);
 const clear=w.reviewAttempt(list,{attempt:1,verdict:null});assert.equal(clear[0].verdict,null);assert.equal(clear[0].failedRules,undefined);});

// #24: un solo veredicto, igual en estado.mjs y en la vista Montaje.
const K=['R04','R12'];
test('isDownloaded: solo done con vídeo',()=>{
 assert.equal(w.isDownloaded({status:'done',video:'v.mp4'}),true);
 for(const a of [{video:'v.mp4'},{status:'done'},{status:'submitted'},null,undefined])assert.equal(w.isDownloaded(a),false,JSON.stringify(a));});
test('reviewAttempt: una sola aceptada por bloque, con replacedBy',()=>{
 const legacy=[{...list[0],verdict:'accepted',failedRules:[]},{...list[1],verdict:'accepted'},{n:3,status:'done',video:'generated-v03.mp4',durationReturned:8.2,verdict:null}],copy=structuredClone(legacy);
 const a3=w.reviewAttempt(legacy,{attempt:3,verdict:'accepted'},'T');
 assert.deepEqual(a3.map(a=>a.verdict),[null,null,'accepted']);assert.deepEqual(a3.map(a=>a.replacedBy),[3,3,undefined]);assert.deepEqual(legacy,copy,'no muta la entrada');
 const a1=w.reviewAttempt(a3,{attempt:1,verdict:'accepted'},'T');
 assert.deepEqual(a1.map(a=>a.verdict),['accepted',null,null]);assert.equal('replacedBy' in a1[0],false);assert.equal(a1[2].replacedBy,1);assert.equal(a1[1].replacedBy,3);});
test('reviewAttempt: al aceptar no guarda reglas, pero las valida; known vacío no admite ninguna',()=>{
 const acc=w.reviewAttempt(list,{attempt:2,verdict:'accepted',rules:['R12'],known:K},'T');assert.deepEqual(acc[1].failedRules,[]);
 assert.throws(()=>w.reviewAttempt(list,{attempt:2,verdict:'accepted',rules:['X9'],known:K}),/desconocida/);
 assert.throws(()=>w.reviewAttempt(list,{attempt:2,verdict:'rejected',rules:['R12']}),/desconocida/);
 const withRange=[list[0],{...list[1],usedRange:[[1,5]]}];assert.deepEqual(w.reviewAttempt(withRange,{attempt:2,verdict:'rejected',rules:['R12'],known:K})[1].usedRange,[[1,5]]);});
test('reviewAttempt: rango conservado, por defecto, redondeado y validado',()=>{
 const withRange=[list[0],{...list[1],usedRange:[[1,5]]}];
 assert.deepEqual(w.reviewAttempt(withRange,{attempt:2,verdict:'accepted',length:6})[1].usedRange,[[1,5]]);
 assert.deepEqual(w.reviewAttempt(list,{attempt:2,verdict:'accepted',length:6})[1].usedRange,[[0,6]]);
 assert.deepEqual(w.reviewAttempt(list,{attempt:2,verdict:'accepted'})[1].usedRange,[[0,8.2]]);
 assert.deepEqual(w.reviewAttempt(list,{attempt:2,verdict:'accepted',range:[[0.123,5.678]]})[1].usedRange,[[0.12,5.68]]);
 for(const range of [[[5,2]],[[0,9]],[],[[0]]])assert.throws(()=>w.reviewAttempt(list,{attempt:2,verdict:'accepted',range}),/Rango no válido/,JSON.stringify(range));});
test('reviewAttempt: null quita la revisión sin tocar las demás',()=>{
 const l=[{...list[0],verdict:null,replacedBy:2},{...list[1],verdict:'accepted',usedRange:[[0,6]],notes:'x',reviewedAt:'T',failedRules:[]}];
 const r=w.reviewAttempt(l,{attempt:2,verdict:null});assert.deepEqual(r[1],{n:2,status:'done',video:'generated-v02.mp4',durationReturned:8.2,verdict:null});assert.equal(r[0].replacedBy,2);});
test('reviewAttempt: solo intentos descargados',()=>{
 assert.throws(()=>w.reviewAttempt(list,{attempt:3,verdict:'accepted'}),/no está descargado \(estado submitted\)/);
 assert.throws(()=>w.reviewAttempt([{n:1,video:'v.mp4'}],{attempt:1,verdict:'accepted'}),/no está descargado \(estado —\)/);});
test('parseRange y parseVerdict',()=>{
 assert.deepEqual(w.parseRange('0-9.6,11-14'),[[0,9.6],[11,14]]);assert.deepEqual(w.parseRange(' 0.5 - 3 '),[[0.5,3]]);
 for(const bad of ['','5','a-b','1-2-3',undefined])assert.throws(()=>w.parseRange(bad),/Rango no válido/,String(bad));
 assert.equal(w.parseVerdict('accepted'),'accepted');assert.equal(w.parseVerdict('rejected'),'rejected');assert.equal(w.parseVerdict('none'),null);
 for(const bad of ['x',true,undefined])assert.throws(()=>w.parseVerdict(bad),/accepted\|rejected\|none/,String(bad));});
test('acceptedAttempt y chosenAttempt eligen la última aceptada descargada',()=>{
 const two=[{...list[0],verdict:'accepted'},{...list[1],verdict:'accepted'}];
 assert.equal(w.acceptedAttempt(two).n,2);assert.equal(w.chosenAttempt(two).attempt.n,2);
 assert.equal(w.acceptedAttempt(two,a=>a.n!==2).n,1);assert.equal(w.chosenAttempt(two,a=>a.n!==2).attempt.n,1);
 assert.equal(w.acceptedAttempt([{n:1,video:'v.mp4',verdict:'accepted'}]),null);assert.equal(w.acceptedAttempt([]),null);});
