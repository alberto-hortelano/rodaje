// Vídeo del storyboard derivado de los lotes (#45): enlaces bloque→viñeta, secciones por secuencia y tomas/cortes por viñeta. Puro.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {blockStoryboardLinks,storyboardSections,storyboardMedia} from '../app/workflow.mjs';

const sb={id:'sb-a',sequences:[{id:'sq-1',title:'Cruce',shots:[{id:'v1'},{id:'v2'}]},{id:'sq-2',title:'Pie',shots:[{id:'v3'},{id:'v4'}]}]};
const other={id:'sb-b',sequences:[{id:'sq-x',title:'Otra',shots:[{id:'w1'}]}]};
const done=(n,extra={})=>({n,at:`2026-09-2${n}T10:00:00.000Z`,status:'done',video:`generated-v0${n}.mp4`,endpoint:'minimax/h3',...extra});

test('blockStoryboardLinks: primera parte con enlace; gana la instantánea; si falta, el vivo; omite sin enlace',()=>{
 const plan=[{id:'b1',parts:[{shot:'s0'},{shot:'s1'}]},{id:'b2',parts:[{shot:'s2'}]},{id:'b3',parts:[{shot:'s3'}]},{id:'b4',parts:[{shot:'s4'}]}];
 const snap={s0:{},s1:{storyboardShot:'v1'},s2:{storyboardShot:'v2'},s3:{}};const live={s1:{storyboardShot:'vX'},s2:{storyboardShot:'vY'},s3:{storyboardShot:'v3'}};
 assert.deepEqual(blockStoryboardLinks(plan,snap,live),{b1:'v1',b2:'v2',b3:'v3'});
 assert.deepEqual(blockStoryboardLinks(plan,snap),{b1:'v1',b2:'v2'});
 assert.deepEqual(blockStoryboardLinks([{id:'b1',parts:[{shot:'s0'},{shot:'s3'},{shot:'s1'}]}],snap,live),{b1:'v3'});});

test('storyboardSections: orden del plan, sin missing, at relativos, nombres y no muta',()=>{
 const plan=[{id:'b1'},{id:'b2'},{id:'b3'},{id:'b4'},{id:'b5'}],links={b1:'v1',b2:'v3',b3:'v2',b4:'v4',b5:'w1'};
 const blocks=[{block:'b1',source:'generated',at:0,length:8},{block:'b2',source:'guide',at:8,length:5},{block:'b3',source:'generated',at:13,length:6.5},{block:'b4',source:'missing'},{block:'b5',source:'generated',at:19.5,length:4}];
 const input=structuredClone({plan,links,blocks,storyboards:[sb]});
 const r=storyboardSections({plan,links,storyboards:[sb],blocks,name:'lote-cut-v00'});
 assert.deepEqual(input,{plan,links,blocks,storyboards:[sb]});
 assert.deepEqual(r,[
  {storyboard:'sb-a',sequence:'sq-1',title:'Cruce',file:'lote-cut-v00.sq-1.mp4',at:0,duration:14.5,blocks:[{block:'b1',at:0,length:8},{block:'b3',at:8,length:6.5}]},
  {storyboard:'sb-a',sequence:'sq-2',title:'Pie',file:'lote-cut-v00.sq-2.mp4',at:8,duration:5,blocks:[{block:'b2',at:0,length:5}]}]);
 assert.deepEqual(storyboardSections({plan,links,storyboards:[],blocks,name:'c'}),[]);
 assert.deepEqual(storyboardSections({plan,links:{},storyboards:[sb],blocks,name:'c'}),[]);
 // La primera coincidencia gana entre storyboards; id no válido → sec-NN; nombres repetidos → -2.
 const bad={id:'sb-c',sequences:[{id:'con espacio',title:'X',shots:[{id:'v1'}]},{id:'sq-2',title:'Y',shots:[{id:'w1'}]}]},dup={id:'sb-d',sequences:[{id:'sq-2',title:'Z',shots:[{id:'v3'}]}]};
 const r2=storyboardSections({plan,links,storyboards:[bad,dup,sb],blocks,name:'c'});
 assert.deepEqual(r2.map(s=>[s.storyboard,s.sequence,s.file]),[['sb-c','con espacio','c.sec-01.mp4'],['sb-d','sq-2','c.sq-2.mp4'],['sb-a','sq-1','c.sq-1.mp4'],['sb-c','sq-2','c.sq-2-2.mp4']]);});

const lote=(id,created,links,attempts={},cuts=[])=>({id,created,links,attempts,cuts});

test('storyboardMedia: vigente del lote más reciente con toma; rechazadas agrupadas; pending y has',()=>{
 const nuevo=lote('l2','2026-09-28',{b1:'v1',b2:'v2',b3:'v3'},{b1:[done(1,{verdict:'rejected',failedRules:['C15']})],b2:[done(1)],b3:[{n:1,status:'failed'}]});
 const viejo=lote('l1','2026-09-26',{b1:'v1',b2:'v2',b9:'w1'},{b1:[done(1),done(2,{verdict:'accepted'})],b2:[done(1,{verdict:'accepted'})]});
 const r=storyboardMedia(sb,[nuevo,viejo]);
 assert.deepEqual(Object.keys(r.shots).sort(),['v1','v2']);
 const v1=r.shots.v1;assert.equal(v1.pending,false);assert.equal(v1.current.lote,'l1');assert.equal(v1.current.n,2);assert.equal(v1.current.current,true);
 assert.deepEqual(v1.groups.map(g=>[g.lote,g.block,g.takes.map(t=>t.n)]),[['l2','b1',[1]],['l1','b1',[1,2]]]);
 assert.deepEqual(v1.groups[0].takes[0],{lote:'l2',block:'b1',n:1,at:'2026-09-21T10:00:00.000Z',video:'assets/l2/b1/generated-v01.mp4',verdict:'rejected',rules:['C15'],notes:'',endpoint:'minimax/h3',current:false});
 const v2=r.shots.v2;assert.equal(v2.current.lote,'l2');assert.equal(v2.pending,true);assert.equal(v2.groups[1].takes[0].current,false);
 assert.deepEqual(r.lotes,[{id:'l2',created:'2026-09-28',covered:3,total:4,partial:true},{id:'l1',created:'2026-09-26',covered:2,total:4,partial:true}]);
 // Todas rechazadas: sin vigente, pero listadas.
 const rej=storyboardMedia(sb,[lote('l1','x',{b1:'v1'},{b1:[done(1,{verdict:'rejected',failedRules:['C01']})]})]);
 assert.equal(rej.shots.v1.current,null);assert.equal(rej.shots.v1.pending,false);assert.equal(rej.shots.v1.groups[0].takes.length,1);
 // has false quita la toma (y la viñeta si se queda sin ninguna).
 const h=storyboardMedia(sb,[nuevo,viejo],(l,b,a)=>!(l==='l1'&&b==='b1'&&a.n===2));
 assert.equal(h.shots.v1.current.n,1);assert.equal(h.shots.v1.current.lote,'l1');assert.equal(h.shots.v1.pending,true);assert.deepEqual(h.shots.v1.groups[1].takes.map(t=>t.n),[1]);
 assert.deepEqual(Object.keys(storyboardMedia(sb,[nuevo,viejo],()=>false).shots),[]);});

test('storyboardMedia: lote enlazado sin intentos, enlaces a otro storyboard y sin lotes',()=>{
 const r=storyboardMedia(sb,[lote('l1','x',{b1:'v1'}),lote('l0','y',{b1:'w1'})]);
 assert.deepEqual(r,{storyboard:'sb-a',lotes:[{id:'l1',created:'x',covered:1,total:4,partial:true}],shots:{},sequences:{},cuts:{current:null,list:[]}});
 assert.deepEqual(storyboardMedia(other,[lote('l1','x',{b1:'v1'})]).lotes,[]);});

test('storyboardMedia: cortes por lote, parciales, vigente y montajes por secuencia',()=>{
 const seq=(cut,f)=>({storyboard:'sb-a',sequence:'sq-1',title:'Cruce',file:`assets/l2/montaje/${cut}.${f}.mp4`,at:0,duration:14,blocks:[{block:'b1',at:0,length:8}]});
 const l2=lote('l2','b',{b1:'v1',b2:'v2',b3:'v3',b4:'v4'},{},[{name:'l2-cut-v00',file:'assets/l2/montaje/l2-cut-v00.mp4',at:'t0',duration:30},{name:'l2-cut-v01',file:'assets/l2/montaje/l2-cut-v01.mp4',at:'t1',duration:31,sequences:[seq('l2-cut-v01','sq-1'),{...seq('x','y'),storyboard:'sb-b'}]}]);
 const l1=lote('l1','a',{b1:'v1'},{},[{name:'l1-cut-v00',file:'assets/l1/montaje/l1-cut-v00.mp4',at:'t',duration:9,sequences:[{...seq('l1-cut-v00','sq-1'),file:'assets/l1/montaje/l1-cut-v00.sq-1.mp4'}]}]);
 const r=storyboardMedia(sb,[lote('l3','c',{b1:'v1'}),l2,l1]);
 assert.deepEqual(r.cuts.list.map(c=>[c.lote,c.name,c.partial,c.covered,c.total]),[['l2','l2-cut-v00',false,4,4],['l2','l2-cut-v01',false,4,4],['l1','l1-cut-v00',true,1,4]]);
 assert.equal(r.cuts.current.name,'l2-cut-v01');
 assert.deepEqual(Object.keys(r.sequences),['sq-1']);
 assert.deepEqual(r.sequences['sq-1'].list.map(x=>[x.lote,x.cut,x.file]),[['l2','l2-cut-v01','assets/l2/montaje/l2-cut-v01.sq-1.mp4'],['l1','l1-cut-v00','assets/l1/montaje/l1-cut-v00.sq-1.mp4']]);
 assert.equal(r.sequences['sq-1'].current.cut,'l2-cut-v01');assert.deepEqual(r.sequences['sq-1'].current.blocks,[{block:'b1',at:0,length:8}]);
 // Cortes antiguos sin sequences: cuentan como cortes, sin montajes por secuencia.
 const old=storyboardMedia(sb,[lote('l1','a',{b1:'v1'},{},[{name:'c0',file:'f',at:'t',duration:1}])]);
 assert.equal(old.cuts.current.name,'c0');assert.deepEqual(old.sequences,{});});

test('vista Storyboards: el vídeo de la viñeta no se precarga y lleva póster',()=>{
 const src=fs.readFileSync(new URL('../app/app.source.js',import.meta.url),'utf8'),m=/<video class="sb-video"[^>]*>/.exec(src);
 assert.ok(m,'sbFrame sin <video class="sb-video">');assert.match(m[0],/preload="none"/);assert.match(m[0],/poster=/);
 assert.match(src,/\/api\/storyboard-media\?project=/);});

test('storyboardMedia: cada corte lleva block, el primero de su línea de tiempo enlazado al story (#63)',()=>{
 const cut=(name,blocks)=>({name,file:name+'.mp4',at:'t',duration:4,...(blocks?{blocks:blocks.map(block=>({block,start:0,end:1}))}:{})});
 const r=storyboardMedia(sb,[lote('l2','b',{b2:'v2',b3:'v3',b9:'w1'},{},[cut('c1',['b9','b3','b2']),cut('c0')])]);
 assert.deepEqual(r.cuts.list.map(c=>[c.name,c.block]),[['c1','b3'],['c0','b2']],'sin bloques en el corte, el primero enlazado');
 assert.equal(r.cuts.current,r.cuts.list[1]);});
