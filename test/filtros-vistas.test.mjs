// Buscador de Historia e ideas, Pendientes, Generaciones y Montaje (#63): constructores de ítems, firma del sondeo de Generaciones, agrupación del
// selector de lotes y filtros de la ruta con foco (FOCUS_PARAMS). Puro; textos inventados.
import test from 'node:test';import assert from 'node:assert/strict';
import {routeFocused,routeFilters,parseRoute,ideaItems,issueItems,issueBoard,jobItems,jobsSignature,loteSequence,loteItems,loteGroups,filterView,facets,FILTER_SOURCES,viewItems,JOB_TYPE_LABELS,JOB_STATUS_LABELS} from '../app/workflow.mjs';

test('routeFocused y routeFilters: foco de FOCUS_PARAMS en Planos y Montaje',()=>{
 const spy=()=>{const f=()=>{f.calls++;return {q:'mem',f:{}};};f.calls=0;return f;},R=s=>parseRoute('?project=x&'+s);
 let m=spy();assert.deepEqual(routeFilters(R('view=shots&sequence=s1'),m),{q:'',f:{}});assert.equal(m.calls,0,'Planos con sequence ignora la memoria');
 m=spy();assert.deepEqual(routeFilters(R('view=montaje&lote=L2&block=b1'),m),{q:'',f:{}});assert.equal(m.calls,0,'Montaje con block ignora la memoria');
 m=spy();assert.deepEqual(routeFilters(R('view=montaje&lote=L2'),m),{q:'mem',f:{}});assert.equal(m.calls,1,'solo lote: memoria');
 m=spy();assert.deepEqual(routeFilters(R('view=ideas&q=a'),m),{q:'a',f:{}});assert.deepEqual(routeFilters(R('view=issues&f=severity:grave'),m),{q:'',f:{severity:['grave']}});assert.equal(m.calls,0,'la ruta manda');
 m=spy();assert.deepEqual(routeFilters(R('view=tree&node=act/e1'),m),{q:'',f:{}});assert.equal(m.calls,0,'vista sin buscador');
 assert.deepEqual(routeFilters(R('view=jobs')),{q:'',f:{}});assert.deepEqual(routeFilters(R('view=jobs'),()=>null),{q:'',f:{}});
 assert.deepEqual(routeFilters(parseRoute('?view=jobs'),()=>({q:'v',f:{}})),{q:'v',f:{}},'Generaciones sin proyecto usa la memoria');
 assert.deepEqual([R('view=shots&sequence=s').sequence,routeFocused(R('view=shots&sequence=s')),routeFocused(R('view=shots')),routeFocused(R('view=montaje&block=b')),routeFocused(R('view=montaje&lote=L')),routeFocused({view:'__proto__'}),routeFocused(null)],['s',true,false,true,false,false,false]);
 assert.equal(routeFocused(R('view=montaje&lote=L&block=b')),true);
 // Equivalencia con la condición antigua en Planos: r.q==null&&r.f==null&&!(r.view==='shots'&&r.sequence) → memoria.
 const old=(r,mem)=>{const x=r.q==null&&r.f==null&&!(r.view==='shots'&&r.sequence)?mem():null;return x||{q:r.q||'',f:{}};};
 for(const s of ['view=shots','view=shots&sequence=s','view=shots&q=a','view=shots&sequence=s&q=a']){const r=R(s),mem=()=>({q:'m',f:{}});assert.deepEqual(routeFilters(r,mem),old(r,mem),s);}});

test('ideaItems: título y texto sin acentos; defs vacías; ideas sin id no lanzan',()=>{
 const p={ideas:[{id:'i1',title:'Canción del muelle',text:'Una nota'},{id:'i2',title:'Premisa',text:'El FARO se apaga'},{title:'Sin id',text:'x'},null,3]};
 const {items,defs}=ideaItems(p);assert.deepEqual(defs,[]);assert.deepEqual(items.map(i=>i.key),['idea/i1','idea/i2','idea/2']);assert.equal(items[0].ref,p.ideas[0]);
 assert.deepEqual(filterView(items,defs,'cancion',{}).results.map(r=>r.item.id),['i1']);assert.deepEqual(filterView(items,defs,'faro',{}).results.map(r=>r.item.id),['i2']);
 assert.deepEqual(facets(items,'',{},defs),[]);assert.deepEqual(ideaItems(null),{items:[],defs:[]});});

test('issueItems: texto con código, gravedad y estado',()=>{
 const p={issues:[{id:'a',title:'Fallo de raccord',text:'Luz',code:'A2',severity:'grave',status:'abierto'},{id:'b',title:'Ritmo lento',severity:'ritmo',status:'cerrado'},
  {id:'c',title:'Duda',severity:'rara',status:'perdido'},{id:'d',title:'Nota suelta',status:'en-curso'},{id:'e',title:'Otra grave',severity:'grave',status:'cerrado'}]};
 const {items,defs}=issueItems(p),by=id=>items.find(i=>i.id===id).facets;
 assert.deepEqual(defs.map(d=>[d.id,d.label]),[['severity','Gravedad'],['status','Estado']]);assert.deepEqual(defs[0].values.map(v=>v.value),['grave','medio','ritmo','nota','-']);
 assert.deepEqual([by('c'),by('d')],[{severity:['-'],status:['abierto']},{severity:['-'],status:['en-curso']}]);
 assert.deepEqual(filterView(items,defs,'a2',{}).results.map(r=>r.item.id),['a']);
 const f=facets(items,'',{},defs);assert.deepEqual(f.find(x=>x.id==='severity').values.map(v=>[v.value,v.count]),[['grave',2],['ritmo',1],['-',2]]);
 assert.deepEqual(f.find(x=>x.id==='status').values.map(v=>[v.value,v.count]),[['abierto',2],['en-curso',1],['cerrado',2]]);
 const m=filterView(items,defs,'',{severity:['grave','-']}),board=issueBoard({issues:m.results.map(r=>r.item.ref)});
 assert.deepEqual(board.map(c=>[c.key,c.items.map(i=>i.id)]),[['abierto',['a','c']],['en-curso',['d']],['cerrado',['e']]],'orden relativo de p.issues');
 assert.deepEqual(issueItems({issues:[null,'x']}).items,[]);});

test('jobItems: filtra por proyecto, ordena por created y etiqueta',()=>{
 const J=[{id:'1',project:'a',type:'video',status:'failed',created:'2026-09-01',summary:'Plano P1',error:'Tiempo agotado',target:'shot-abc'},
  {id:'2',project:'a',type:'cover',status:'remote',created:'2026-09-03'},{id:'3',project:'b',type:'preview',status:'running',progress:40,created:'2026-09-02'},null];
 const {items,defs}=jobItems(J,'a');assert.deepEqual(items.map(i=>i.key),['job/2','job/1']);assert.deepEqual(jobItems(J).items.map(i=>i.id),['2','3','1']);assert.deepEqual(jobItems(J,null).items.map(i=>i.id),['2','3','1']);
 assert.deepEqual(filterView(items,defs,'vídeo',{}).results.map(r=>r.item.id),['1']);assert.deepEqual(filterView(items,defs,'agotado',{}).results.map(r=>r.item.id),['1']);
 assert.deepEqual(filterView(items,defs,'shot-abc',{}).results.map(r=>r.item.id),['1']);
 const f=facets(items,'',{},defs);assert.deepEqual(f.find(x=>x.id==='type').values.map(v=>[v.value,v.label]),[['video','Vídeo H3 Max'],['cover','cover']]);
 assert.deepEqual(f.find(x=>x.id==='status').values.map(v=>[v.value,v.label]),[['remote','Generando'],['failed','Error']]);
 assert.deepEqual(JOB_TYPE_LABELS,{preview:'Previsualización 3D',keyframe:'Fotograma visual',video:'Vídeo H3 Max',character:'Hoja de personaje',location:'Ambiente visual',voice:'Prueba de voz',line:'Diálogo',ambience:'Sonido ambiente',outline:'Desglose de capítulo',export:'Montaje',storyboard:'Fotograma de storyboard',animatic:'Animáticas de storyboard',anim3d:'Animación 3D de viñeta'});
 assert.deepEqual(JOB_STATUS_LABELS,{queued:'En cola',running:'Procesando',submitting:'Enviando',remote:'Generando',done:'Listo',failed:'Error',interrupted:'Interrumpido'});
 const before=JSON.stringify(J);jobItems(J,'a');assert.equal(JSON.stringify(J),before,'no muta ni reordena');assert.deepEqual(jobItems(null).items,[]);assert.deepEqual(jobItems('x','a').items,[]);});

test('jobsSignature: estable sin cambios; cambia con status, progress o un trabajo nuevo del proyecto; no cambia con otro proyecto',()=>{
 const J=()=>[{id:'1',project:'a',type:'preview',status:'running',progress:10,created:'2026-09-01'},{id:'2',project:'b',type:'video',status:'queued',created:'2026-09-02'}];
 const s=jobsSignature(J(),'a');assert.equal(jobsSignature(J(),'a'),s);
 const x=J();x[0].progress=20;assert.notEqual(jobsSignature(x,'a'),s);const y=J();y[0].status='done';assert.notEqual(jobsSignature(y,'a'),s);
 const z=J();z.push({id:'3',project:'a',type:'voice',status:'queued',created:'2026-09-03'});assert.notEqual(jobsSignature(z,'a'),s);
 const o=J();o[1].status='failed';o.push({id:'4',project:'b',status:'queued',created:'2026-09-09'});assert.equal(jobsSignature(o,'a'),s,'otro proyecto');assert.notEqual(jobsSignature(o,null),jobsSignature(J(),null));
 for(const k of ['summary','error','output','requestId']){const w=J();w[0][k]='v';assert.notEqual(jobsSignature(w,'a'),s,k);}
 assert.equal(jobsSignature(null),'[]');});

// Serie con dos capítulos: e1 (s1, s2) y e2 (s3).
const P=()=>({type:'serie',episodes:[{id:'e1',title:'Uno',sequences:[{id:'s1',title:'Muelle',shots:[]},{id:'s2',title:'Faro',shots:[]}]},{id:'e2',title:'Dos',sequences:[{id:'s3',title:'Taberna',shots:[]}]}]});
const LOTES=[{id:'L4',episode:'e2',sequence:'s3',blocks:2},{id:'L3',episode:'e1',sequence:'borrada',blocks:1},{id:'L2',episode:'e1',sequence:'s2',blocks:3},{id:'L1',episode:'e1',sequence:'s1',blocks:4},{id:'L0',blocks:5},{id:'L9',episode:'nope',sequence:'s1',blocks:1}];

test('loteSequence y loteItems: lote sin lote.json, secuencia borrada y acto inexistente',()=>{
 const p=P();assert.deepEqual(loteSequence(p,LOTES[2]),{act:'e1',sequence:'s2',group:'e1/s2',label:'Uno › Faro',actTitle:'Uno'});
 assert.deepEqual([loteSequence(p,LOTES[1]),loteSequence(p,LOTES[4]),loteSequence(p,LOTES[5])].map(x=>[x.act,x.sequence,x.group,x.label]),[['e1','-','-','Sin secuencia'],['-','-','-','Sin secuencia'],['-','-','-','Sin secuencia']]);
 assert.equal(loteSequence(p,{id:'x',episode:'e2',sequence:'s1'}).sequence,'-','la secuencia tiene que ser de ese acto');
 const {items,defs}=loteItems(p,LOTES);assert.deepEqual(items.map(i=>i.key),LOTES.map(l=>'lote/'+l.id));
 assert.deepEqual(filterView(items,defs,'faro',{}).results.map(r=>r.item.id),['L2']);assert.deepEqual(filterView(items,defs,'l4',{}).results.map(r=>r.item.id),['L4']);
 assert.deepEqual(filterView(items,defs,'',{sequence:['-']}).results.map(r=>r.item.id),['L3','L0','L9']);
 assert.deepEqual(defs.map(d=>[d.id,d.label]),[['act','Capítulo'],['sequence','Secuencia']]);assert.deepEqual(defs[0].values.at(-1),{value:'-',label:'Sin capítulo'});
 assert.deepEqual(defs[1].values.map(v=>v.value),['s1','s2','s3','-']);assert.deepEqual(loteItems({...p,type:'pelicula'},LOTES).defs[0].values.at(-1),{value:'-',label:'Sin acto'});
 assert.equal(loteItems({type:'pelicula'},[]).defs[0].label,'Acto');
 const f=facets(items,'',{},defs).find(x=>x.id==='act');assert.deepEqual(f.values.map(v=>[v.value,v.count]),[['e1',3],['e2',1],['-',2]]);});

test('loteGroups: optgroup en orden del proyecto, «Sin secuencia» al final y orden de lotes dentro',()=>{
 const p=P(),lotes=[...LOTES,{id:'L5',episode:'e1',sequence:'s1',blocks:1}],G=(v,c)=>loteGroups(p,lotes,v,c).map(g=>[g.label,g.options.map(o=>o.id+(o.outside?'*':''))]);
 assert.deepEqual(G(null,null),[['Uno › Muelle',['L1','L5']],['Uno › Faro',['L2']],['Dos › Taberna',['L4']],['Sin secuencia',['L3','L0','L9']]]);
 assert.equal(loteGroups(p,lotes)[0].options[0].label,'L1 · 4 bloques');
 assert.deepEqual(G(new Set(['L1']),'L2'),[['Uno › Muelle',['L1']],['Uno › Faro',['L2*']]],'el cargado sigue, fuera del filtro; los demás excluidos no están');
 assert.deepEqual(G(new Set(['L1','L2']),'L2'),[['Uno › Muelle',['L1']],['Uno › Faro',['L2']]]);
 assert.deepEqual(G(new Set(),'L0'),[['Sin secuencia',['L0*']]]);assert.deepEqual(G(new Set(),null),[]);
 assert.ok(loteGroups(p,lotes,null,'L1').every(g=>g.options.every(o=>!o.outside)));
 assert.deepEqual(loteGroups(null,[null,{id:3},{id:'a',blocks:1}]).map(g=>g.label),['Sin secuencia']);assert.deepEqual(loteGroups(p,null),[]);});

test('FILTER_SOURCES: las nuevas entradas aceptan (p) y (p, opts) y entradas raras',()=>{
 const p={id:'a',...P(),ideas:[{id:'i',title:'t',text:'x'}],issues:[{id:'s',title:'t'}]};
 assert.deepEqual(FILTER_SOURCES.jobs(p).items,[]);assert.deepEqual(FILTER_SOURCES.jobs(null,null).items,[]);assert.deepEqual(FILTER_SOURCES.montaje(p).items,[]);
 assert.deepEqual(FILTER_SOURCES.montaje(p,{lotes:[null,{id:3}]}).items,[]);
 assert.deepEqual(viewItems('jobs',p,{jobs:[{id:'1',project:'a',created:'1'},{id:'2',project:'b',created:'2'}]}).items.map(i=>i.id),['1']);
 assert.deepEqual(viewItems('jobs',null,{jobs:[{id:'1',project:'a',created:'1'},{id:'2',project:'b',created:'2'}]}).items.map(i=>i.id),['2','1'],'sin proyecto, todos');
 assert.deepEqual(viewItems('montaje',p,{lotes:LOTES}).items.length,LOTES.length);
 assert.deepEqual(viewItems('ideas',p).items.map(i=>i.id),['i']);assert.deepEqual(viewItems('issues',p).items.map(i=>i.id),['s']);});
