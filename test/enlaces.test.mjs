// #61: enlaces de relaciones de cada nodo (relationLinks, relationLine), etiqueta de plano, voiceStatus legible y plegado de Apariciones.
import test from 'node:test';import assert from 'node:assert/strict';
import {relationIndex,relationLinks,relationLine,relationCounters,shotLabel,voiceStatusLabel,VOICE_STATUS,appearanceOpen,APPEARANCE_FOLD,appearanceTree} from '../app/workflow.mjs';
import {relProject,relProjectMany} from './fixtures/relaciones.mjs';

const ids=list=>list.map(e=>e.id);
const snap=I=>JSON.stringify({links:I.links,dangling:I.dangling,nodes:[...I.nodes.values()]});

test('relationLinks de una viñeta: enlaces propios, hablantes con canal, ambiente y entorno heredados, sin relatedTo',()=>{
 const I=relationIndex(relProject()),n0=relationCounters.relatedTo,L=relationLinks(I,'panel/P1');
 assert.equal(L.deep,false);assert.deepEqual(ids(L.appears),['ana']);assert.deepEqual(L.appears[0].via,['panel.cast']);
 assert.deepEqual(L.speaks.map(e=>[e.id,e.lines,e.offscreenLines,e.offscreen,e.channels]),[['ana',1,0,false,[]],['beto',1,1,true,[]],['pa',1,1,true,['pa']]]);
 assert.ok(!L.speaks.some(e=>e.id==='nadie'));
 assert.deepEqual(L.location.map(e=>[e.id,e.inherited,e.label,e.route]),[['plaza',true,'Plaza',{view:'location',location:'plaza'}]]);
 assert.deepEqual(L.environment.map(e=>[e.id,e.inherited,e.route]),[['env-a',true,{view:'environment',environment:'env-a'}]]);
 assert.deepEqual(L.missing,[]);assert.equal(relationCounters.relatedTo,n0,'una viñeta no llama a relatedTo');});

test('relationLinks de un plano: visibleCast, shot.location propia, sequence.cast, líneas fuera de campo e ids inexistentes',()=>{
 const I=relationIndex(relProject()),n0=relationCounters.relatedTo;
 const t3=relationLinks(I,'shot/t3');assert.deepEqual(t3.appears.map(e=>[e.id,e.via]),[['beto',['visibleCast']]]);
 assert.deepEqual(t3.speaks.map(e=>[e.id,e.offscreen,e.channels]),[['pa',true,['pa']]]);
 assert.deepEqual(t3.location.map(e=>[e.id,e.inherited,e.via]),[['bosque',false,['shot.location']]]);assert.deepEqual(t3.environment,[]);
 const t2=relationLinks(I,'shot/t2');assert.deepEqual(t2.appears.map(e=>[e.id,e.via]),[['ana',['sequence.cast']]]);
 assert.deepEqual([t2.location.map(e=>[e.id,e.inherited]),t2.environment.map(e=>[e.id,e.inherited])],[[['plaza',true]],[['env-a',true]]]);
 const t1=relationLinks(I,'shot/t1');assert.deepEqual(t1.speaks.map(e=>[e.id,e.lines,e.offscreenLines,e.sources]),[['ana',1,0,1],['beto',1,1,1]]);
 assert.deepEqual(relationLinks(I,'shot/t6').missing,[{kind:'character',id:'fantasma',via:'shot.cast'}]);
 assert.equal(relationCounters.relatedTo,n0);});

test('relationLinks agregado: current salta los storys no vigentes; la clave de un story cuenta siempre lo suyo',()=>{
 const I=relationIndex(relProject()),n0=relationCounters.relatedTo,f1=relationLinks(I,'seq/f1');
 assert.equal(relationCounters.relatedTo,n0+1,'una sola llamada a relatedTo');assert.equal(f1.deep,true);assert.deepEqual(f1.missing,[]);
 // Vigente sb2: sin las líneas de ana (solo en sb1); plaza llega solo heredada por el plano de la prueba k1 colgado de P3.
 assert.deepEqual(ids(f1.appears),['ana','beto']);assert.deepEqual(ids(f1.speaks),['beto','pa']);
 assert.deepEqual(f1.location.map(e=>[e.id,e.inherited]),[['nave',false],['bosque',false],['plaza',true]]);
 const all=relationLinks(I,'seq/f1',{current:false});assert.deepEqual(ids(all.speaks),['ana','beto','pa']);
 assert.deepEqual(all.location.map(e=>[e.id,e.inherited]),[['plaza',false],['nave',false],['bosque',false]]);
 const sb1=relationLinks(I,'sb/sb1');assert.deepEqual(sb1.location.map(e=>[e.id,e.inherited]),[['plaza',false]]);assert.deepEqual(ids(sb1.speaks),['ana','beto','pa']);
 assert.deepEqual(sb1.speaks.find(e=>e.id==='beto').sources,2);
 // El acto incluye la prueba k1, con plaza propia: deja de ser heredada.
 const e1=relationLinks(I,'act/e1');assert.deepEqual(e1.location.map(e=>[e.id,e.inherited]),[['nave',false],['bosque',false],['plaza',false]]);
 assert.deepEqual(e1.environment.map(e=>[e.id,e.inherited]),[['env-b',false],['env-a',false]]);
 const k1=relationLinks(I,'seq/k1');assert.deepEqual([ids(k1.appears),k1.location.map(e=>[e.id,e.inherited])],[['beto'],[['plaza',false]]]);
 assert.deepEqual(relationLinks(I,'scene/sb2/sc2').appears.map(e=>e.id),['ana','beto']);
 assert.deepEqual(relationLinks(I,'panel/P3',{deep:true}).location.map(e=>e.id),['nave','bosque','plaza'],'deep explícito en una viñeta agrega sus planos');});

test('relationLinks: clave desconocida vacía, sin mutar el índice ni el proyecto, orden de aparición y sin repetidos',()=>{
 const p=relProject(),before=JSON.stringify(p),I=relationIndex(p),s0=snap(I);
 assert.deepEqual(relationLinks(I,'seq/zzz'),{key:'seq/zzz',deep:false,appears:[],speaks:[],location:[],environment:[],missing:[]});
 assert.deepEqual(relationLinks(null,'act/e1').appears,[]);
 for(const k of I.nodes.keys()){const L=relationLinks(I,k,{current:false});for(const r of ['appears','speaks','location','environment'])assert.equal(new Set(L[r].map(e=>e.key)).size,L[r].length,k+' '+r);}
 assert.equal(snap(I),s0);assert.equal(JSON.stringify(p),before);
 assert.deepEqual(ids(relationLinks(I,'act/e2').appears),['beto','dani','ana']);});

test('relationLine: personajes fusionados con notas, grupos vacíos fuera, «y N más» y «No existen»',()=>{
 const I=relationIndex(relProject()),line=(k,o)=>relationLine(relationLinks(I,k),o);
 const P1=line('panel/P1');assert.deepEqual(P1.groups.map(g=>[g.rel,g.label]),[['character','Personajes'],['location','Ambiente'],['environment','3D']]);
 assert.deepEqual(P1.groups[0].items.map(x=>[x.label,x.notes,x.tone]),[['Ana Ruiz',[],undefined],['Beto',['fuera de campo'],'off'],['Public Address',['fuera de campo · pa'],'off']]);
 assert.deepEqual(P1.groups[1].items.map(x=>[x.label,x.notes,x.tone,x.route]),[['Plaza',['heredado'],'inherited',{view:'location',location:'plaza'}]]);
 // t3: beto aparece (sin nota) y pa solo habla, fuera de campo; bosque propio sin «heredado»; sin entorno, sin grupo 3D.
 const t3=line('shot/t3');assert.deepEqual(t3.groups.map(g=>g.rel),['character','location']);
 assert.deepEqual(t3.groups[0].items.map(x=>[x.key,x.notes]),[['character/beto',[]],['character/pa',['fuera de campo · pa']]]);assert.deepEqual(t3.groups[1].items[0].notes,[]);
 // Habla en campo sin aparecer (línea de plano sin offscreen de alguien fuera del reparto): «habla»; el que no aparece y habla fuera de campo, su nota.
 const q=relProject();q.episodes[0].sequences.find(s=>s.id==='c1').shots[1].lines=[{id:'l9',character:'dani',text:'x',start:1}];
 assert.deepEqual(relationLine(relationLinks(relationIndex(q),'shot/t2')).groups[0].items.map(x=>[x.label,x.notes,x.tone]),[['Ana Ruiz',[],undefined],['Dani',['habla'],undefined]]);
 // Recorte: max por grupo, el resto por nombre.
 const e1=line('act/e1',{max:1});assert.deepEqual(e1.groups.map(g=>[g.label,g.items.map(x=>x.label),g.more]),[['Personajes',['Ana Ruiz'],['Beto','Public Address']],['Ambientes',['Nave'],['Bosque','Plaza']],['3D',['env-b'],['env-a']]]);
 const many=relationLine(relationLinks(relationIndex(relProjectMany(10)),'seq/c1',{current:false}),{max:1});assert.deepEqual([many.groups[0].items.map(x=>x.label),many.groups[0].more],[['Ana Ruiz'],['Beto']]);
 assert.deepEqual(line('shot/t6').groups.at(-1),{rel:'missing',label:'No existen',items:[{key:'character/fantasma',label:'fantasma',route:null,notes:[]}],more:[]});
 assert.deepEqual(relationLine(relationLinks(I,'seq/f3')),{groups:[]});assert.deepEqual(relationLine(undefined),{groups:[]});});

test('shotLabel: «Pnn · título» sin repetir el prefijo; appearanceTree lo usa',()=>{
 assert.deepEqual(shotLabel(1,'Llegada'),{code:'P01',title:'Llegada',label:'P01 · Llegada'});
 assert.deepEqual(shotLabel(1,'P01 · Llegada'),{code:'P01',title:'Llegada',label:'P01 · Llegada'});
 assert.deepEqual(shotLabel(1,'P03 · X'),{code:'P01',title:'X',label:'P03 · X'});
 assert.deepEqual(shotLabel(12,'P3·X'),{code:'P12',title:'X',label:'P3·X'});
 for(const t of ['',null,undefined,5,'  '])assert.equal(shotLabel(1,t).label,'P01');
 assert.equal(shotLabel(2,'Pasillo').label,'P02 · Pasillo','una palabra que empieza por P no es prefijo');
 const p=relProject();p.episodes[0].sequences.find(s=>s.id==='c1').shots[0].title='P01 · Uno';
 const T=appearanceTree(relationIndex(p),'character/ana',{current:false}),flat=l=>l.flatMap(a=>[a,...flat(a.children)]);
 assert.equal(flat(T.roots).find(a=>a.key==='shot/t1').label,'P01 · Uno');});

test('voiceStatusLabel: valores conocidos legibles, desconocidos tal cual, vacío sin texto',()=>{
 assert.equal(voiceStatusLabel('id-assigned-samples-pending'),'Voz asignada · faltan muestras');assert.equal(voiceStatusLabel('approved'),VOICE_STATUS.approved);
 assert.equal(voiceStatusLabel('algo-raro'),'algo-raro');assert.equal(voiceStatusLabel('toString'),'toString');
 for(const v of [undefined,null,'',3])assert.equal(voiceStatusLabel(v),'');});

test('appearanceOpen: umbral por nodo y por página; actos y escenas abiertos',()=>{
 const a=(kind,panels,shots=0)=>({kind,counts:{panels,shots}}),T=(panels,shots=0)=>({panels,shots});
 assert.deepEqual(APPEARANCE_FOLD,{node:30,page:40});
 assert.equal(appearanceOpen(a('act',100),T(100)),true);assert.equal(appearanceOpen(a('sequence',20,11),T(31)),false);
 assert.equal(appearanceOpen(a('story',5),T(30,11)),false);assert.equal(appearanceOpen(a('sequence',5),T(20)),true);assert.equal(appearanceOpen(a('scene',50),T(50)),true);
 assert.equal(appearanceOpen(a('sequence',30,0),T(40)),true,'los umbrales son estrictos');assert.equal(appearanceOpen(a('sequence',5),T(5),{page:4}),false);
 const B=appearanceTree(relationIndex(relProjectMany(50)),'character/ana',{current:false});assert.ok(B.total.shots+B.total.panels>40);
 assert.equal(appearanceOpen(B.roots[0].children.find(x=>x.kind==='sequence'),B.total),false);});
