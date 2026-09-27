import test from 'node:test';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const {DATA}=await import('../lib/paths.mjs'),L=await import('../lib/lotes.mjs'),M=await import('../app/montaje.mjs'),w=await import('../app/workflow.mjs');
// Lote temporal en RODAJE_DATA (test/setup.mjs) construido con la fixture ep01-s01-b02.
const fx=path.join(import.meta.dirname,'fixtures/ep01-s01-b02');const j=f=>JSON.parse(fs.readFileSync(path.join(fx,f),'utf8'));
const P='lotes-test',LOTE='ep01-s01-t01',LOTE2='ep01-s01-t02',base=path.join(DATA,P),out=path.join(base,'assets',LOTE);
const sequence=j('sequence.json'),shots=j('shots.json'),block=j('block.json');
const snapshot={...j('project.json'),episodes:[{id:'ep01',sequences:[{...sequence,shots:Object.values(shots)}]}]};
const meta={episode:'ep01',sequence:sequence.id,created:'2026-09-01T00:00:00.000Z'},meta2={...meta,created:'2026-09-02T00:00:00.000Z'};
const attempts=[{n:1,status:'done',video:'generated-v01.mp4',durationReturned:14.4,verdict:'accepted',usedRange:[[0,14.17]]},{n:2,status:'done',video:'generated-v02.mp4',durationReturned:14.3,verdict:null}];
const cut={at:'2026-09-03T00:00:00.000Z',duration:14.17,blocks:[{block:block.id,at:0,length:14.17}]};
const text=v=>JSON.stringify(v,null,2)+'\n';
const put=(rel,v)=>{const f=path.join(base,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:text(v));};
fs.rmSync(base,{recursive:true,force:true});
put(`assets/${LOTE}/plan.json`,[block]);put(`assets/${LOTE}/project-snapshot.json`,snapshot);put(`assets/${LOTE}/lote.json`,meta);put(`assets/${LOTE}/${block.id}/attempts.json`,attempts);
put(`assets/${LOTE2}/plan.json`,[block]);put(`assets/${LOTE2}/lote.json`,meta2);put(`assets/${LOTE2}/montaje/corte.cut.json`,cut);put(`assets/${LOTE2}/montaje/corte.mp4`,'');
fs.mkdirSync(path.join(base,'assets','sin-plan'),{recursive:true});
put('REGLAS.md','# Reglas\n### C01 · Regla de prueba\n');
put('registro.json',{assets:{HOLD11_PLATE:{kind:'location',location:'cargo',aliases:[sequence.location]}}});
put('ambientes/cargo/MAPA.md','# Mapa\n\n```prompt\nThe MURAL at frame-left.\n```\n');
const ep=snapshot.episodes[0],seq=ep.sequences[0],scene={characters:{},local_constraints:['x']};
put(`capitulos/ep01/escenas/s${String(L.sceneNumber(ep,seq)).padStart(2,'0')}.json`,scene);

test('lib/lotes solo importa node:*, ./paths, ./json y ../app/workflow',()=>{const src=fs.readFileSync(new URL('../lib/lotes.mjs',import.meta.url),'utf8');const from=[...src.matchAll(/from '([^']+)'/g)].map(m=>m[1]);assert.deepEqual(from.filter(f=>!f.startsWith('node:')).sort(),['../app/workflow.mjs','./json.mjs','./paths.mjs']);});
test('nombres de lote y bloque: rechaza vacío, punto, dos puntos, barras y no cadenas',()=>{
 for(const bad of ['','.','..','a/b','../x','a\\b',undefined,null,3])assert.throws(()=>L.lotePaths(P,bad),/Lote no válido/,String(bad));
 for(const ok of ['ep01-s01-v02','a.b','_x','-y'])assert.equal(L.isLoteName(ok),true,ok);
 assert.throws(()=>L.loteDir(P,'..'),/Lote no válido/);assert.throws(()=>L.attemptsPath(out,'..'),/Bloque no válido/);
 assert.throws(()=>M.loteDetail(P,'..'),/Lote no válido/);assert.throws(()=>M.review(P,'..',block.id,{attempt:1,verdict:null}),/Lote no válido/);assert.throws(()=>M.review(P,LOTE,'..',{attempt:1,verdict:null}),/Bloque no válido/);});
test('lotePaths conserva las rutas y el orden de las claves',()=>{const p=L.lotePaths(P,LOTE);assert.deepEqual(Object.keys(p),['base','out','plan','snapshot','meta','registry','uploads']);assert.equal(p.base,base);assert.equal(p.out,out);assert.equal(p.plan,path.join(out,'plan.json'));assert.equal(p.snapshot,path.join(out,'project-snapshot.json'));assert.equal(p.meta,path.join(out,'lote.json'));assert.equal(p.registry,path.join(base,'registro.json'));assert.equal(p.uploads,path.join(out,'uploads.json'));});
test('loadLote devuelve plan, meta, episodio, secuencia, planos, mapa y escena; sin plan explica el paso',()=>{
 const r=L.loadLote(P,LOTE);assert.deepEqual(r.plan,[block]);assert.deepEqual(r.meta,meta);assert.deepEqual(r.project,snapshot);assert.equal(r.episode.id,'ep01');assert.equal(r.sequence.id,sequence.id);assert.deepEqual(r.shots,shots);assert.equal(r.map.prompt,'The MURAL at frame-left.');assert.deepEqual(r.scene,scene);assert.equal(r.registry.assets.HOLD11_PLATE.location,'cargo');
 assert.throws(()=>L.loadLote(P,'sin-plan'),e=>e.message===`No existe ${path.join(base,'assets','sin-plan','plan.json')}; ejecuta planificar.mjs`);});
test('loadAttempts, saveAttempts y updateAttempts: [] si falta y JSON con dos espacios y salto final',()=>{
 assert.deepEqual(L.loadAttempts(out,'b99'),[]);assert.equal(L.attemptsPath(out,'b99'),path.join(out,'b99','attempts.json'));
 L.saveAttempts(out,'b99',[{n:1}]);assert.equal(fs.readFileSync(L.attemptsPath(out,'b99'),'utf8'),text([{n:1}]));
 assert.deepEqual(L.updateAttempts(out,'b99',l=>[...l,{n:2}]),[{n:1},{n:2}]);
 assert.deepEqual(L.updateAttempts(out,'b99',l=>{l[0].verdict='accepted';}),[{n:1,verdict:'accepted'},{n:2}]);
 assert.equal(fs.readFileSync(L.attemptsPath(out,'b99'),'utf8'),text([{n:1,verdict:'accepted'},{n:2}]));
 assert.throws(()=>L.updateAttempts(out,'b99',()=>{throw Error('no');}),/no/);assert.equal(fs.readFileSync(L.attemptsPath(out,'b99'),'utf8'),text([{n:1,verdict:'accepted'},{n:2}]));
 assert.deepEqual(fs.readdirSync(path.join(out,'b99')),['attempts.json']);fs.rmSync(path.join(out,'b99'),{recursive:true});});
test('listLotes: solo lotes con plan, del más reciente al más antiguo, con sus cortes',()=>{
 assert.deepEqual(L.listLotes(P),[{id:LOTE2,episode:'ep01',sequence:sequence.id,created:meta2.created,blocks:1,cuts:[{name:'corte',file:`assets/${LOTE2}/montaje/corte.mp4`,at:cut.at,duration:cut.duration}]},{id:LOTE,episode:'ep01',sequence:sequence.id,created:meta.created,blocks:1,cuts:[]}]);
 assert.equal(M.listLotes,L.listLotes);assert.deepEqual(L.listLotes('no-existe'),[]);});
test('loteDetail: misma forma y orden de claves; lote sin plan es desconocido',()=>{
 const d=M.loteDetail(P,LOTE);assert.deepEqual(Object.keys(d),['id','meta','rules','cuts','montando','blocks']);
 assert.deepEqual(d,{id:LOTE,meta,rules:L.projectRules(P),cuts:[],montando:null,blocks:[{id:block.id,length:block.length,duration:block.duration,mode:block.mode,shots:block.parts.map(x=>x.shot),refs:null,attempts,direccion:null}]});
 assert.deepEqual(d.rules.find(r=>r.id==='C01'),{id:'C01',title:'Regla de prueba'});assert.ok(d.rules.some(r=>r.id==='R12'));
 assert.deepEqual(M.loteDetail(P,LOTE2).cuts,[{name:'corte',file:`assets/${LOTE2}/montaje/corte.mp4`,at:cut.at,duration:cut.duration,blocks:w.cutTimeline(cut,[block])}]);
 assert.throws(()=>M.loteDetail(P,'sin-plan'),/Lote desconocido/);});
test('review exige attempts.json, no escribe si el veredicto no vale y guarda con updateAttempts',()=>{
 const f=L.attemptsPath(out,block.id),before=fs.readFileSync(f,'utf8');
 assert.throws(()=>M.review(P,LOTE,'b77',{attempt:1,verdict:'accepted'}),/El bloque no tiene intentos/);assert.equal(fs.existsSync(path.join(out,'b77')),false);
 assert.throws(()=>M.review(P,LOTE,block.id,{attempt:2,verdict:'rejected',rules:['X9']}),/desconocida/);assert.equal(fs.readFileSync(f,'utf8'),before);
 const list=M.review(P,LOTE,block.id,{attempt:2,verdict:'accepted'});assert.equal(list[1].verdict,'accepted');assert.equal(list[0].replacedBy,2);assert.equal(fs.readFileSync(f,'utf8'),text(list));});
test('loteDetail lee direccion.json en formato nuevo y antiguo con la misma forma',()=>{const f=path.join(out,'direccion.json'),e={camera:'Static.',action:'She waits.',acting:'x',local:'y'};
 try{put(`assets/${LOTE}/direccion.json`,{_nota:'x',locks:['L'],blocks:{[block.id]:e}});const nuevo=M.loteDetail(P,LOTE).blocks[0].direccion;assert.deepEqual(nuevo,e);
  put(`assets/${LOTE}/direccion.json`,{_nota:'x',[block.id]:e});assert.deepEqual(M.loteDetail(P,LOTE).blocks[0].direccion,nuevo);
  put(`assets/${LOTE}/direccion.json`,{blocks:{}});assert.equal(M.loteDetail(P,LOTE).blocks[0].direccion,null);assert.deepEqual(L.direccionFor(out),{blocks:{}});}
 finally{fs.rmSync(f,{force:true});}assert.equal(L.direccionFor(out),null);});
test('lotes antiguos (#26): listLotes omite plan.json que no es lista o está corrupto, avisa y ordena los sin fecha al final',t=>{
 const P3='lotes-viejos',b3=path.join(DATA,P3),w3=(rel,v)=>{const f=path.join(b3,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:text(v));};
 fs.rmSync(b3,{recursive:true,force:true});
 w3('assets/viejo-objeto/plan.json',{blocks:[block]});w3('assets/viejo-corrupto/plan.json','{"no es json');w3('assets/viejo-corrupto/lote.json',meta2);
 w3('assets/sin-fecha/plan.json',[block]);w3('assets/con-fecha/plan.json',[block]);w3('assets/con-fecha/lote.json',meta);
 const warn=t.mock.method(console,'warn',()=>{});
 assert.deepEqual(L.listLotes(P3).map(l=>l.id),['con-fecha','sin-fecha']);
 const avisos=warn.mock.calls.map(c=>c.arguments.join(' '));assert.equal(avisos.length,2);
 for(const l of ['viejo-objeto','viejo-corrupto'])assert.ok(avisos.some(a=>a.includes(l)),l);
 for(const l of ['viejo-objeto','viejo-corrupto'])assert.throws(()=>M.loteDetail(P3,l),e=>e.message==='Lote no válido: plan.json no es una lista de bloques');
 assert.throws(()=>L.readPlan(path.join(b3,'x.json')),/Lote no válido/);w3('assets/sin-parts/plan.json',[{id:'b1'}]);assert.throws(()=>M.loteDetail(P3,'sin-parts'),/Lote no válido/);
 fs.rmSync(b3,{recursive:true,force:true});});

// Reglas heredadas (#19): docs/REGLAS.md + REGLAS.md del proyecto.
const GENERALES=['R01','R02','R03','R04','R05','R06','R09','R10','R11','R12','R21','R22','R23','R26'];
test('mergeRules une, ordena por id numérico, rechaza repetidos y no muta',()=>{
 const g=[{id:'R12',title:'b'},{id:'R02',title:'a'}],o=[{id:'C01',title:'c'}],gc=structuredClone(g),oc=structuredClone(o);
 assert.deepEqual(L.mergeRules(g,o).map(r=>r.id),['C01','R02','R12']);assert.deepEqual(g,gc);assert.deepEqual(o,oc);
 assert.deepEqual(L.mergeRules([{id:'R2',title:'x'},{id:'R10',title:'y'}],[]).map(r=>r.id),['R2','R10']);
 assert.throws(()=>L.mergeRules(g,[{id:'R12',title:'x'}]),e=>e.message==='Regla R12 repetida: ya es general (docs/REGLAS.md); quítala del REGLAS.md del proyecto');
 assert.throws(()=>L.mergeRules([...g,{id:'R12',title:'x'}],[]),e=>e.message==='Regla R12 repetida en docs/REGLAS.md');
 assert.throws(()=>L.mergeRules([],[...o,{id:'C01',title:'x'}]),e=>e.message==='Regla C01 repetida en el REGLAS.md del proyecto');});
test('projectRules hereda las generales de docs/REGLAS.md y añade las propias',()=>{
 assert.equal(L.GENERAL_RULES_FILE,path.join(path.resolve(import.meta.dirname,'..'),'docs','REGLAS.md'));
 const ids=L.projectRules(P).map(r=>r.id);assert.deepEqual(ids,['C01',...GENERALES]);assert.equal(new Set(ids).size,ids.length);
 const P2='lotes-sin-reglas';fs.rmSync(path.join(DATA,P2),{recursive:true,force:true});fs.mkdirSync(path.join(DATA,P2));
 try{assert.deepEqual(L.projectRules(P2).map(r=>r.id),GENERALES);assert.deepEqual(L.rulesAt(path.join(DATA,P2)),L.projectRules(P2));}finally{fs.rmSync(path.join(DATA,P2),{recursive:true,force:true});}});
test('un id general repetido en el REGLAS.md del proyecto lanza y el lote no carga',()=>{
 const P2='lotes-dup',b2=path.join(DATA,P2);fs.rmSync(b2,{recursive:true,force:true});
 const w2=(rel,v)=>{const f=path.join(b2,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:text(v));};
 try{w2('REGLAS.md','# Reglas\n### R12 · Otra vez\n');w2(`assets/${LOTE}/plan.json`,[block]);w2(`assets/${LOTE}/lote.json`,meta);
  assert.throws(()=>L.projectRules(P2),/Regla R12 repetida/);assert.throws(()=>L.loteDetail(P2,LOTE),/R12 repetida/);}
 finally{fs.rmSync(b2,{recursive:true,force:true});}});
test('estado.mjs --verdict valida las reglas contra las generales y las propias sin escribir si falla',()=>{
 const P2='lotes-estado',b2=path.join(DATA,P2);fs.rmSync(b2,{recursive:true,force:true});
 const w2=(rel,v)=>{const f=path.join(b2,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:text(v));};
 const run=(...a)=>spawnSync(process.execPath,[path.join(import.meta.dirname,'..','scripts','bloques','estado.mjs'),LOTE,block.id,'--project',P2,'--verdict','rejected',...a],{encoding:'utf8',timeout:30000});
 const f=path.join(b2,'assets',LOTE,block.id,'attempts.json');
 try{w2(`assets/${LOTE}/plan.json`,[block]);w2(`assets/${LOTE}/project-snapshot.json`,snapshot);w2(`assets/${LOTE}/lote.json`,meta);w2(`assets/${LOTE}/${block.id}/attempts.json`,attempts);
  w2('proyecto.json',{id:P2});w2('registro.json',{assets:{}});w2('REGLAS.md','# Reglas\n### C01 · Regla de prueba\n');
  let before=fs.readFileSync(f,'utf8'),r=run('--rules','X9');assert.notEqual(r.status,0);assert.match(r.stderr,/Regla desconocida X9/);assert.equal(fs.readFileSync(f,'utf8'),before);
  r=run('--rules','R12,C01');assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(fs.readFileSync(f,'utf8')).at(-1).failedRules,['R12','C01']);
  w2('REGLAS.md','# Reglas\n### R12 · Otra vez\n');before=fs.readFileSync(f,'utf8');r=run('--rules','R12');assert.notEqual(r.status,0);assert.match(r.stderr,/R12 repetida/);assert.equal(fs.readFileSync(f,'utf8'),before);}
 finally{fs.rmSync(b2,{recursive:true,force:true});}});
