// Producción por plano (#65): productionIndex (puro), montajeStart y el lector de disco productionFor (lib/lotes.mjs).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {productionIndex,montajeStart,productionView,PRODUCTION_VERDICTS,PRODUCTION_COMPACT,productionSummary,productionGroups,levelShotIds,environmentUses,relationIndexFor,appearanceTree,appearanceLevel} from '../app/workflow.mjs';
import {relProject} from './fixtures/relaciones.mjs';
const {DATA}=await import('../lib/paths.mjs'),L=await import('../lib/lotes.mjs');

// Vivo con p1…p4; l2 (reciente) y l1; has responde a un Set de ficheros relativos al proyecto.
const live={episodes:[{id:'e1',sequences:[{id:'s1',shots:[{id:'p1'},{id:'p2'},{id:'p3'},{id:'p4'}]}]}]};
const done=(n,verdict=null,extra={})=>({n,at:'2026-09-0'+n,status:'done',video:`generated-v0${n}.mp4`,verdict,...extra});
const fixture=()=>({live,lotes:[
 {id:'l2',created:'2026-09-02',plan:[{id:'b1',parts:[{shot:'p1',from:0,to:2,at:0},{shot:'p2',from:2,to:4,at:2}]}],attempts:{b1:[done(1,'rejected'),done(2)]},
  cuts:[{name:'corte',file:'assets/l2/montaje/corte.mp4',blocks:[{block:'b1',start:0,end:4}]}]},
 {id:'l1',created:'2026-09-01',plan:[{id:'b1',parts:[{shot:'p1',from:0,to:3,at:0}]},{id:'b2',parts:[{shot:'p3'}]},{id:'b3',parts:[{shot:'p3'}]},{id:'b4',parts:[{shot:'p9'}]}],
  attempts:{b1:[done(1,'accepted')],b2:[done(1,'accepted'),{n:2,status:'submitted',verdict:null}],b3:[done(1,'rejected')]},
  cuts:[{name:'a',file:'assets/l1/montaje/a.mp4',blocks:[{block:'b2',start:0,end:5}]},{name:'b',file:'assets/l1/montaje/b.mp4',blocks:[{block:'b1',start:0,end:3},{block:'b2',start:3,end:8}]}]},
 {id:'viejo',error:'Lote no válido: plan.json no es una lista de bloques'}],
 anim3d:[{storyboard:'sb',entries:[{file:'storyboards/sb/animacion-3d/v-v01.mp4',version:1,at:'a',duration:3,storyboardShot:'v1',shot:'p4'},{file:'storyboards/sb/animacion-3d/v-v02.mp4',version:2,at:'b',duration:3.5,storyboardShot:'v1',shot:'p4'},{file:'storyboards/sb/animacion-3d/falta.mp4',version:3,shot:'p4'},{file:'storyboards/sb/animacion-3d/x.mp4',version:1}]}]});
const files=new Set(['assets/l2/b1/generated-v01.mp4','assets/l2/b1/generated-v02.mp4','assets/l1/b1/generated-v01.mp4','assets/l1/b2/generated-v01.mp4','assets/l1/b3/generated-v01.mp4','storyboards/sb/animacion-3d/v-v01.mp4','storyboards/sb/animacion-3d/v-v02.mp4','storyboards/sb/animacion-3d/x.mp4']);
const has=f=>files.has(f);
const idx=(over={})=>productionIndex({...fixture(),has,...over});

test('productionIndex: un plano en dos lotes, del más reciente al más antiguo',()=>{
 const e=idx().shots.p1.lotes;assert.deepEqual(e.map(x=>[x.lote,x.created,x.block]),[['l2','2026-09-02','b1'],['l1','2026-09-01','b1']]);});
test('productionIndex: bloque con dos partes de dos planos',()=>{
 const {shots}=idx(),a=shots.p1.lotes[0],b=shots.p2.lotes[0];
 assert.deepEqual([a.block,a.part,a.from,a.to,a.at],['b1',0,0,2,0]);assert.deepEqual([b.block,b.part,b.from,b.to,b.at],['b1',1,2,4,2]);
 assert.deepEqual(a.attempts,b.attempts);assert.notEqual(a.attempts,b.attempts,'cada entrada lleva su copia');});
test('productionIndex: un plano en dos bloques del mismo lote',()=>{
 assert.deepEqual(idx().shots.p3.lotes.map(x=>[x.lote,x.block,x.part]),[['l1','b2',0],['l1','b3',0]]);});
test('productionIndex: lote de formato antiguo va a skipped y no lanza',()=>{
 const r=idx();assert.deepEqual(r.skipped,[{lote:'viejo',reason:'Lote no válido: plan.json no es una lista de bloques'}]);
 assert.ok(Object.values(r.shots).every(s=>s.lotes.every(x=>x.lote!=='viejo')));});
test('productionIndex: bloque sin attempts.json está pendiente',()=>{
 const f=fixture();delete f.lotes[1].attempts.b1;const e=productionIndex({...f,has}).shots.p1.lotes[1];
 assert.deepEqual([e.attempts,e.current,e.pending],[[],null,false]);});
test('productionIndex: el corte que no incluye el bloque no aparece',()=>{
 const {shots}=idx();assert.deepEqual(shots.p1.lotes[1].cuts,[{name:'b',file:'assets/l1/montaje/b.mp4',start:0,end:3}]);
 assert.deepEqual(shots.p3.lotes[0].cuts.map(c=>[c.name,c.start,c.end]),[['a',0,5],['b',3,8]]);assert.deepEqual(shots.p3.lotes[1].cuts,[]);});
test('productionIndex: plano ausente del vivo',()=>{
 const {shots}=idx();assert.equal(shots.p9.orphan,true);assert.deepEqual(shots.p9.lotes.map(x=>x.block),['b4']);
 for(const k of ['p1','p2','p3','p4'])assert.equal('orphan' in shots[k],false,k);});
test('productionIndex: vídeos que faltan se descartan con has',()=>{
 const f=fixture();f.lotes[0].attempts.b1=[done(1),done(2,'accepted')];const gone=new Set([...files].filter(x=>x!=='assets/l2/b1/generated-v02.mp4'));
 const e=productionIndex({...f,has:x=>gone.has(x)}).shots.p1.lotes[0];
 assert.deepEqual(e.attempts.map(a=>[a.n,a.video,a.current]),[[1,'assets/l2/b1/generated-v01.mp4',true],[2,null,false]]);assert.deepEqual([e.current,e.pending],[1,true]);
 const {shots}=idx();assert.ok(shots.p4.anim3d.every(x=>x.file!=='storyboards/sb/animacion-3d/falta.mp4'));
 assert.deepEqual(shots.p3.lotes[0].attempts.map(a=>[a.n,a.video,a.verdict]),[[1,'assets/l1/b2/generated-v01.mp4','accepted'],[2,null,null]]);});
test('productionIndex: sin animación 3D y solo animación 3D',()=>{
 const none=idx({anim3d:[]});assert.ok(Object.values(none.shots).every(s=>Array.isArray(s.anim3d)&&!s.anim3d.length));assert.equal(none.shots.p4,undefined);
 const p4=idx().shots.p4;assert.deepEqual(p4.lotes,[]);assert.deepEqual(p4.anim3d,[
  {file:'storyboards/sb/animacion-3d/v-v02.mp4',version:2,at:'b',duration:3.5,storyboard:'sb',storyboardShot:'v1'},
  {file:'storyboards/sb/animacion-3d/v-v01.mp4',version:1,at:'a',duration:3,storyboard:'sb',storyboardShot:'v1'}]);
 assert.equal(p4.orphan,undefined);assert.deepEqual(Object.keys(idx().shots).sort(),['p1','p2','p3','p4','p9'],'la entrada sin shot se ignora');});
test('productionIndex: current y pending como chosenAttempt; entradas raras',()=>{
 const {shots}=idx();
 assert.deepEqual([shots.p1.lotes[1].current,shots.p1.lotes[1].pending],[1,false]);
 assert.deepEqual([shots.p1.lotes[0].current,shots.p1.lotes[0].pending],[2,true]);assert.deepEqual(shots.p1.lotes[0].attempts.map(a=>a.current),[false,true]);
 assert.deepEqual([shots.p3.lotes[1].current,shots.p3.lotes[1].pending],[null,false]);
 assert.deepEqual(productionIndex(),{shots:{},skipped:[]});assert.deepEqual(productionIndex({lotes:null,anim3d:null,live:null}),{shots:{},skipped:[]});
 const odd=productionIndex({lotes:[null,{id:'x',plan:[null,{id:'b',parts:[null,{},{shot:''},{shot:'q'}]},{id:'c'}],attempts:{b:[null]},cuts:[null,{blocks:null}]}],anim3d:[null,{entries:[null,{shot:'q'}]}]});
 assert.deepEqual(Object.keys(odd.shots),['q']);assert.deepEqual(odd.shots.q.lotes[0].part,3);assert.equal(odd.shots.q.orphan,true);
 const f=fixture(),copy=structuredClone(f);productionIndex({...f,has});assert.deepEqual(f,copy);});
test('montajeStart: lote de la ruta, recordado o el primero; block solo con su lote; missing',()=>{
 const lotes=[{id:'a'},{id:'b'},{id:'c'}];
 assert.deepEqual(montajeStart(lotes,{lote:'b',block:'b2'},'c'),{lote:'b',block:'b2',missing:null});
 assert.deepEqual(montajeStart(lotes,{},'c'),{lote:'c',block:null,missing:null});
 assert.deepEqual(montajeStart(lotes,{block:'b2'},'c'),{lote:'c',block:null,missing:null});
 assert.deepEqual(montajeStart(lotes,{lote:'nope',block:'b2'},'c'),{lote:'c',block:null,missing:'nope'});
 assert.deepEqual(montajeStart(lotes,{lote:'nope'},'zz'),{lote:'a',block:null,missing:'nope'});
 assert.deepEqual(montajeStart(lotes,null,null),{lote:'a',block:null,missing:null});
 assert.deepEqual(montajeStart([],{lote:'x'},'y'),{lote:null,block:null,missing:'x'});});

// Entrega B: modelo de la sección Producción, planos de un nivel de Apariciones y ambientes de un entorno.
test('productionView: sin servidor, vacío y con datos',()=>{
 assert.deepEqual(productionView(null,['p1']),{available:false,empty:true,shots:[]});assert.deepEqual(productionView({error:'x'},['p1']).available,false);
 assert.deepEqual(productionView({shots:{}},['p1']),{available:true,empty:true,shots:[]});
 const v=productionView(idx(),['p2','p1','p9','p1']);assert.equal(v.empty,false);assert.deepEqual(v.shots.map(s=>s.id),['p2','p1'],'orden de ids, sin repetir ni huérfanos');
 const [a,b]=v.shots[1].lotes;assert.deepEqual([a.lote,a.block,a.part,a.from,a.to,a.attempts],['l2','b1',0,0,2,2]);
 assert.deepEqual(a.route,{view:'montaje',lote:'l2',block:'b1'});assert.deepEqual(b.route,{view:'montaje',lote:'l1',block:'b1'});
 assert.deepEqual(a.cuts,[{name:'corte',start:0,end:4,route:{view:'montaje',lote:'l2',block:'b1'}}]);assert.deepEqual(b.cuts.map(c=>[c.name,c.start,c.end]),[['b',0,3]]);
 assert.deepEqual(productionView(idx(),['p9']),{available:true,empty:true,shots:[]});});
test('productionView: veredicto vigente',()=>{
 const f=fixture();delete f.lotes[1].attempts.b1;const v=productionView(productionIndex({...f,has}),['p1','p3']),vs=v.shots.flatMap(s=>s.lotes.map(e=>[s.id,e.lote,e.block,e.verdict.key,e.verdict.label]));
 assert.deepEqual(vs,[['p1','l2','b1','pending',PRODUCTION_VERDICTS.pending],['p1','l1','b1','none','Pendiente'],['p3','l1','b2','accepted','Aceptada'],['p3','l1','b3','rejected','Sin toma válida']]);
 assert.deepEqual(PRODUCTION_VERDICTS,{accepted:'Aceptada',pending:'Sin revisar',rejected:'Sin toma válida',none:'Pendiente'});});
test('productionView: animación 3D con ruta a la viñeta y no lanza con entradas raras',()=>{
 const v=productionView(idx(),['p4']);assert.deepEqual(v.shots[0].lotes,[]);
 assert.deepEqual(v.shots[0].anim3d[0],{file:'storyboards/sb/animacion-3d/v-v02.mp4',version:2,at:'b',duration:3.5,storyboard:'sb',storyboardShot:'v1',route:{view:'storyboard',storyboard:'sb',panel:'v1'}});
 assert.deepEqual(productionView(idx(),null),{available:true,empty:true,shots:[]});
 const odd=productionView({shots:{a:{},b:{lotes:null,anim3d:'x'},c:{lotes:[null,{lote:'L',block:'B',cuts:[null,{name:'n'}]}],anim3d:[null,{}]},toString:1}},['a','b','c','toString',null,7]);
 assert.deepEqual(odd.shots.map(s=>s.id),['c']);assert.deepEqual(odd.shots[0].lotes[0].verdict.key,'none');assert.deepEqual(odd.shots[0].lotes[0].cuts,[{name:'n',start:null,end:null,route:{view:'montaje',lote:'L',block:'B'}}]);
 assert.deepEqual(odd.shots[0].anim3d,[]);assert.deepEqual(productionView({shots:{}},['constructor']).shots,[]);});
test('levelShotIds',()=>{
 const ix=relationIndexFor(relProject()),T=appearanceTree(ix,'character/beto'),f1=T.roots[0].children[0];
 assert.equal(f1.key,'seq/f1');assert.deepEqual(levelShotIds(f1),['t3','t4']);assert.deepEqual(levelShotIds({kind:'act',children:T.roots}),['t3','t4','t5']);
 assert.deepEqual(levelShotIds({kind:'act',children:[f1,f1,{kind:'shot',id:'t3',children:[]}]}),['t3','t4'],'un plano repetido sale una vez');
 assert.deepEqual(levelShotIds({kind:'shot',id:'x'}),['x']);assert.deepEqual(levelShotIds(null),[]);assert.deepEqual(levelShotIds({children:[null,1]}),[]);});
// #71: resumen, grupos por secuencia y planos de un nivel de secuencia.
test('productionSummary: suma N y mejor veredicto por plano',()=>{
 const f=fixture();delete f.lotes[1].attempts.b1;const ids=['p1','p2','p3','p4','p5'],v=productionView(productionIndex({...f,has}),ids),r=productionSummary(v,ids);
 assert.deepEqual(r.counts,{accepted:1,pending:2,rejected:0,none:0,nolote:2},'p1 (pending y none) sin revisar; p3 (accepted y rejected) aceptado; p4 y p5 sin lote');
 assert.equal(r.total,5);assert.equal(Object.values(r.counts).reduce((a,b)=>a+b,0),r.total);
 assert.equal(r.text,'5 planos · 1 aceptado · 2 sin revisar · 2 sin lote');
 const g=fixture();g.lotes[1].attempts.b3=[];g.lotes[0].attempts.b1=[done(1,'rejected')];const w=productionView(productionIndex({...g,has}),['p1','p2','p3']);
 assert.deepEqual(productionSummary(w,['p1','p2','p3']).text,'3 planos · 2 aceptados · 1 sin toma válida');
 const one=productionView(productionIndex({...f,has}),['p2']);assert.equal(productionSummary(one,['p2']).text,'1 plano · 1 sin revisar');
 const h=fixture();h.lotes[1].attempts={};h.lotes[0].attempts={};assert.equal(productionSummary(productionView(productionIndex({...h,has}),['p1','p3']),['p1','p3']).text,'2 planos · 2 pendientes');
 assert.equal(PRODUCTION_COMPACT,12);});
test('productionSummary: solo anim3d es sin lote; ids repetidos y raros; sin servidor',()=>{
 const v=productionView(idx(),['p4']);assert.equal(v.shots.length,1);assert.deepEqual(productionSummary(v,['p4']).counts,{accepted:0,pending:0,rejected:0,none:0,nolote:1});
 const r=productionSummary(productionView(idx(),['p1']),['p1','p1',null,7]);assert.equal(r.total,1);assert.equal(r.text,'1 plano · 1 aceptado');
 assert.equal(productionSummary(productionView(null,['p1']),['p1']),null);assert.equal(productionSummary(null,['p1']),null);
 assert.deepEqual(productionSummary({available:true,shots:null},null),{total:0,counts:{accepted:0,pending:0,rejected:0,none:0,nolote:0},text:'0 planos'});});
test('productionGroups: una y varias secuencias, rol de prueba y orden',()=>{
 const ix=relationIndexFor(relProject());
 assert.deepEqual(productionGroups(ix,['t2','t1']),[{sequence:'seq/c1',id:'c1',title:'Planos v1',role:'container',ids:['t2','t1']}]);
 const g=productionGroups(ix,['t3','t4','t1','t4','t3']);assert.deepEqual(g.map(x=>[x.sequence,x.role,x.ids]),[['seq/c2','container',['t3']],['seq/k1','test',['t4']],['seq/c1','container',['t1']]]);
 assert.equal(g[1].title,'Prueba');
 assert.deepEqual(productionGroups(ix,['t1','zz','t2','zz',null]),[{sequence:'seq/c1',id:'c1',title:'Planos v1',role:'container',ids:['t1','t2']},{sequence:null,id:null,title:'Sin secuencia',role:null,ids:['zz']}]);
 assert.deepEqual(productionGroups(null,['a']),[{sequence:null,id:null,title:'Sin secuencia',role:null,ids:['a']}]);assert.deepEqual(productionGroups(ix,null),[]);});
test('levelShotIds con T en un nodo de secuencia',()=>{
 const ix=relationIndexFor(relProject()),T=appearanceTree(ix,'location/plaza',{current:false}),L=k=>appearanceLevel(T,k,ix).node;
 assert.deepEqual(levelShotIds(L('seq/c1')),['t2'],'sin T, solo el subárbol');assert.deepEqual(levelShotIds(L('seq/c1'),T),['t1','t2'],'con T, t1 cuelga de la viñeta P1');
 assert.deepEqual(levelShotIds(L('seq/k1')),[]);assert.deepEqual(levelShotIds(L('seq/k1'),T),['t4'],'la prueba recoge su plano de la viñeta de sb2');
 assert.deepEqual(levelShotIds(L('sb/sb1'),T),levelShotIds(L('sb/sb1')),'un nodo que no es secuencia no cambia');assert.deepEqual(levelShotIds(L('seq/f1'),T),['t1','t2','t4']);
 const B=appearanceTree(ix,'location/bosque',{current:false}),f2=appearanceLevel(B,'seq/f2',ix).node;assert.deepEqual(levelShotIds(f2,B),['t5','t6']);
 assert.deepEqual(levelShotIds(null,T),[]);assert.deepEqual(levelShotIds(L('seq/c1'),{roots:null}),['t2']);});
test('environmentUses',()=>{
 const ix=relationIndexFor(relProject()),a=environmentUses(ix,'env-a'),b=environmentUses(ix,'env-b');
 assert.deepEqual(a.map(u=>[u.id,u.name,u.via]),[['plaza','Plaza','environment']]);assert.deepEqual(b.map(u=>[u.id,u.name,u.via]),[['nave','Nave','modelSpace']]);
 assert.deepEqual(a[0].route,{view:'location',location:'plaza'});assert.equal(b[0].total.sequences,2);
 for(const u of [...a,...b]){const T=appearanceTree(ix,'location/'+u.id,{current:true,inherited:false});assert.ok(u.levels.length);
  for(const l of u.levels){assert.equal(l.kind,'sequence');assert.deepEqual(l.route,{view:'location',location:u.id,at:l.key});const L=appearanceLevel(T,l.route.at,ix);assert.equal(L.missing,false);assert.equal(L.key,l.key);assert.equal(L.node.label,l.label);}}
 assert.deepEqual(b[0].levels.map(l=>l.key),['seq/f1']);
 const all=environmentUses(ix,'env-a',{current:false});assert.deepEqual(all[0].levels.map(l=>l.key),['seq/f1','seq/k1']);
 const one=environmentUses(ix,'env-a',{current:false,max:1});assert.deepEqual([one[0].levels.length,one[0].more],[1,1]);assert.equal(all[0].more,0);
 // Raíz que es nivel sin secuencias (story «Sin secuencia») y entorno sin ambientes.
 const p=relProject();p.storyboards.push({id:'sb3',title:'Suelto',version:1,sequences:[{id:'sc3',title:'Tres',location:'plaza',shots:[{id:'P9',code:'C1',title:'x',duration:2,cast:[],dialogue:[]}]}]});
 p.environments.push({id:'env-c',builder:'m/c.js',data:'m/c.json'});const ix2=relationIndexFor(p),u=environmentUses(ix2,'env-a')[0];
 assert.ok(u.levels.some(l=>l.kind==='story'&&l.key==='sb/sb3'),JSON.stringify(u.levels));assert.deepEqual(environmentUses(ix2,'env-c'),[]);
 assert.deepEqual(environmentUses(ix,'nope'),[]);assert.deepEqual(environmentUses(null,'env-a'),[]);});

// Lector sobre un proyecto en DATA (test/setup.mjs), como test/lotes.test.mjs.
const P='produccion-test',base=path.join(DATA,P);
const put=(rel,v)=>{const f=path.join(base,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
fs.rmSync(base,{recursive:true,force:true});
put('assets/t01/plan.json',[{id:'b1',parts:[{shot:'p1',from:0,to:4,at:0},{shot:'p2',from:4,to:6,at:4}]},{id:'b2',parts:[{shot:'p1',from:6,to:8,at:0}]}]);
put('assets/t01/lote.json',{episode:'e1',sequence:'s1',created:'2026-09-01T00:00:00.000Z'});
put('assets/t01/b1/attempts.json',[{n:1,at:'x',status:'done',video:'generated-v01.mp4',verdict:'accepted'}]);put('assets/t01/b1/generated-v01.mp4','');
put('assets/t02/plan.json',[{id:'b1',length:4,parts:[{shot:'p3'}]}]);put('assets/t02/lote.json',{episode:'e1',sequence:'s1',created:'2026-09-02T00:00:00.000Z'});
put('assets/t02/b1/attempts.json',[{n:1,at:'y',status:'done',video:'generated-v01.mp4',verdict:null}]);put('assets/t02/b1/generated-v01.mp4','');
put('assets/t02/montaje/corte.cut.json',{at:'z',duration:4,blocks:[{block:'b1',at:0,length:4}]});put('assets/t02/montaje/corte.mp4','');
put('assets/viejo/plan.json',{id:'x',sequences:[]});put('assets/sin-plan/nada.txt','');
put('storyboards/borrado/animacion-3d/index.json',{entries:[{file:'storyboards/borrado/animacion-3d/v-v01.mp4',version:1,at:'w',duration:2,storyboardShot:'v1',shot:'p4'}]});put('storyboards/borrado/animacion-3d/v-v01.mp4','');
put('storyboards/roto/animacion-3d/index.json','{no');put('storyboards/sin-anim/nada.json',{});
const liveP={id:P,episodes:[{id:'e1',sequences:[{id:'s1',shots:[{id:'p1'},{id:'p2'},{id:'p3'}]}]}],storyboards:[]};
const snap=dir=>{const out=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else{const s=fs.statSync(f);out.push([path.relative(base,f),s.size,s.mtimeMs]);}}};walk(dir);return out.sort((a,b)=>a[0].localeCompare(b[0]));};

test('productionFor lee los lotes válidos, deja el antiguo en skipped y lee todos los index.json de storyboards/',()=>{
 const before=L.listLotes(P),warn=console.warn,said=[];console.warn=(...a)=>said.push(a.join(' '));let r;try{r=L.productionFor(P,liveP);}finally{console.warn=warn;}
 assert.deepEqual(said,[],'productionFor no avisa por consola');
 assert.deepEqual(r.skipped,[{lote:'viejo',reason:'Lote no válido: plan.json no es una lista de bloques'}]);
 assert.deepEqual(r.shots.p1.lotes.map(x=>[x.lote,x.block,x.part,x.current]),[['t01','b1',0,1],['t01','b2',0,null]]);
 assert.deepEqual(r.shots.p1.lotes[0].attempts,[{n:1,at:'x',verdict:'accepted',video:'assets/t01/b1/generated-v01.mp4',current:true}]);
 assert.deepEqual(r.shots.p3.lotes[0].cuts,[{name:'corte',file:'assets/t02/montaje/corte.mp4',start:0,end:4}]);assert.equal(r.shots.p3.lotes[0].pending,true);
 assert.deepEqual(r.shots.p4,{lotes:[],anim3d:[{file:'storyboards/borrado/animacion-3d/v-v01.mp4',version:1,at:'w',duration:2,storyboard:'borrado',storyboardShot:'v1'}],orphan:true});
 assert.deepEqual(L.anim3dIndexes(P).map(x=>x.storyboard),['borrado'],'index.json ilegible se omite');
 assert.deepEqual(before.map(l=>l.id),['t02','t01']);assert.deepEqual(L.listLotes(P),before);
 assert.deepEqual(L.productionFor('produccion-nada',liveP),{shots:{},skipped:[]});});
test('productionFor no escribe',()=>{const a=snap(base);L.productionFor(P,liveP);L.productionFor(P,liveP);assert.deepEqual(snap(base),a);});
test('lib/lotes.mjs sigue sin importar app/store.mjs',()=>{const src=fs.readFileSync(new URL('../lib/lotes.mjs',import.meta.url),'utf8');assert.doesNotMatch(src,/store\.mjs'/);assert.match(src,/import \{readAnim3dIndex\} from '\.\/animacion3d\.mjs'/);});
