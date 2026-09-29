// Buscador y facetas (#59): normalización, filtrado por términos y facetas, recuentos, estado en la URL y los constructores de ítems de
// Storyboards y Planos sobre los fixtures de #56 (escaleta → storys) y #58 (relaciones). Puro; textos inventados.
import test from 'node:test';import assert from 'node:assert/strict';
import {searchText,queryTerms,filterItems,itemHits,facets,filterView,parseFilters,filtersParam,toggleFilter,activeCount,hasFilters,storyboardItems,storyboardResultSections,shotItems,filterShotGroups,shotGroups,storyMigrationPlan,relationIndexFor,holders} from '../app/workflow.mjs';
import {storysProject,storysSpec,planShot} from './fixtures/escaleta-storys.mjs';
import {relProject} from './fixtures/relaciones.mjs';

const it=(key,text,facets={},subs)=>({key,kind:'x',id:key,text,facets,...(subs?{subs}:{})});
const keys=list=>list.map(i=>i.key);
const ITEMS=[
 it('a','Luna roja',{color:['rojo'],size:['s']},[{key:'a1',text:'cafe fuerte',facets:{who:['ana']}},{key:'a2',text:'noche',facets:{who:['bea']}}]),
 it('b','Sol amarillo',{color:['amarillo'],size:['m']}),
 it('c','Luna azul',{color:['azul'],size:['m']},[{key:'c1',text:'cafe',facets:{who:['bea']}}]),
 it('d','Estrella',{color:['rojo']})];
const DEFS=[{id:'color',label:'Color',values:[{value:'azul',label:'Azul'},{value:'rojo',label:'Rojo'},{value:'amarillo',label:'Amarillo'},{value:'verde',label:'Verde'}]},
 {id:'size',label:'Tamaño',values:[{value:'s',label:'S'},{value:'m',label:'M'}]},{id:'who',label:'Quién',sub:true,values:[]},{id:'solo',label:'Solo',values:[]}];

test('searchText y queryTerms: minúsculas, sin marcas y espacios colapsados',()=>{
 assert.equal(searchText('Ánimo  CAFÉ'),'animo cafe');assert.equal(searchText(null),'');assert.equal(searchText(undefined),'');assert.equal(searchText('  Pingüino\tÑu '),'pinguino nu');
 assert.deepEqual(queryTerms('  Luna   ROJA '),['luna','roja']);assert.deepEqual(queryTerms(''),[]);});

test('filterItems: términos (AND, cualquier orden, también en una misma sub)',()=>{
 assert.deepEqual(keys(filterItems(ITEMS,'roja luna',{})),['a']);assert.deepEqual(keys(filterItems(ITEMS,'LUNA',{})),['a','c']);
 assert.deepEqual(keys(filterItems(ITEMS,'luna café',{})),['a','c'],'el término que falta está en una sub');
 assert.deepEqual(keys(filterItems(ITEMS,'cafe noche',{})),[],'dos términos en dos subs distintas no pasan');
 assert.deepEqual(keys(filterItems(ITEMS,'',{})),keys(ITEMS));assert.deepEqual(filterItems(null,'x',{}),[]);});

test('filterItems: facetas (OR dentro, AND entre, sin la faceta no pasa)',()=>{
 assert.deepEqual(keys(filterItems(ITEMS,'',{color:['rojo','azul']})),['a','c','d']);
 assert.deepEqual(keys(filterItems(ITEMS,'',{color:['rojo','azul'],size:['m']})),['c']);
 assert.deepEqual(keys(filterItems(ITEMS,'',{size:['s','m']})),['a','b','c'],'d no tiene tamaño');
 assert.deepEqual(keys(filterItems(ITEMS,'',{size:[]})),keys(ITEMS),'una faceta vacía no filtra');});

test('facets: recuento sin la propia, ocultas las de un valor, activas con 0 visibles, orden de la definición',()=>{
 const f=facets(ITEMS,'',{color:['rojo']},DEFS),by=id=>f.find(x=>x.id===id);
 assert.deepEqual(f.map(x=>x.id),['color','size'],'who solo está en las subs y solo no tiene valores: se ocultan');
 assert.deepEqual(by('color').values.map(v=>[v.value,v.count,v.active]),[['azul',1,false],['rojo',2,true],['amarillo',1,false]],'verde no aparece en ningún ítem');
 assert.equal(by('color').active,true);assert.equal(by('size').active,false);
 assert.deepEqual(by('size').values.map(v=>[v.value,v.count]),[['s',1]],'con color=rojo, m tiene 0 y se oculta');
 const one=facets([it('x','',{k:['a']}),it('y','',{k:['a']})],'',{},[{id:'k',label:'K',values:[]}]);assert.deepEqual(one,[],'un solo valor en todo el conjunto');
 const act=facets(ITEMS,'',{color:['morado']},DEFS).find(x=>x.id==='color');assert.deepEqual(act.values.at(-1),{value:'morado',label:'morado',count:0,active:true},'desconocido y activo: visible con 0');
 assert.deepEqual(facets(ITEMS,'luna',{},DEFS).find(x=>x.id==='color').values.map(v=>[v.value,v.count]),[['azul',1],['rojo',1]],'con la búsqueda');});

test('itemHits: subs con los términos que faltan y las facetas de sub activas',()=>{
 const [a,,c]=ITEMS;
 assert.deepEqual(keys(itemHits(a,'luna cafe',{},DEFS)),['a1']);assert.deepEqual(itemHits(a,'luna',{},DEFS),[],'todo en el ítem, sin facetas de sub');
 assert.deepEqual(keys(itemHits(a,'',{who:['bea']},DEFS)),['a2']);assert.deepEqual(keys(itemHits(c,'cafe',{who:['ana']},DEFS)),[],'la sub cumple el texto, no la faceta');
 assert.deepEqual(itemHits(a,'',{color:['rojo']},DEFS),[],'color no es de sub');assert.deepEqual(keys(itemHits(a,'',{who:['ana','bea']},DEFS)),['a1','a2']);});

test('filterView: descarta facetas desconocidas; cifras y resultados',()=>{
 const v=filterView(ITEMS,DEFS,'luna',{color:['azul'],nada:['x'],size:[]});
 assert.deepEqual(v.filters,{color:['azul']});assert.equal(v.total,4);assert.equal(v.shown,1);assert.equal(v.active,2);assert.deepEqual(v.results.map(r=>[r.item.key,r.hits]),[['c',[]]]);
 assert.equal(filterView([],DEFS,'',{}).shown,0);});

test('parseFilters y filtersParam: ida y vuelta con :, ,, % y espacios; trozos inválidos',()=>{
 const x={cast:['ana','a:b','c,d'],loc:['50% más','plaza mayor'],'raro:id':['v']};
 assert.deepEqual(parseFilters(filtersParam(x)),x);assert.equal(filtersParam(parseFilters(filtersParam(x))),filtersParam(x));
 assert.equal(filtersParam({act:['e1'],cast:['ana']}),'act:e1,cast:ana');assert.equal(filtersParam({}),'');assert.equal(filtersParam({a:[]}),'');assert.equal(filtersParam(null),'');
 assert.deepEqual(parseFilters('act:e1,,nada,:v,k:,cast:ana,cast:ana,x:%E0%A4%A,__proto__:x'),{act:['e1'],cast:['ana']});
 assert.deepEqual(parseFilters(null),{});assert.deepEqual(parseFilters(''),{});});

test('toggleFilter no muta y quita la faceta vacía; activeCount; hasFilters',()=>{
 const f={cast:['ana']},g=toggleFilter(f,'cast','bea');assert.deepEqual(f,{cast:['ana']});assert.deepEqual(g,{cast:['ana','bea']});
 assert.deepEqual(toggleFilter(g,'cast','ana'),{cast:['bea']});assert.deepEqual(toggleFilter({cast:['ana']},'cast','ana'),{});assert.deepEqual(toggleFilter(undefined,'k','v'),{k:['v']});
 assert.equal(activeCount('',{}),0);assert.equal(activeCount('  ',{a:['x']}),1);assert.equal(activeCount('luna',{a:['x','y'],b:['z']}),4);
 assert.deepEqual(['storyboards','shots','tree','storyboard','characters','shot',undefined].map(hasFilters),[true,true,false,false,false,false,false]);});

// Migrado (ficha x-colgado con v1 y v2 vigente, x-prologo con sb-carga, pruebas x-fuego y x-cruce) más un story sin ficha, una zona, una viñeta
// con otro personaje que habla y una prueba con reparto.
const sbProject=()=>{const p=storyMigrationPlan(storysProject(),storysSpec()).next;p.stage={zones:[{id:'norte',label:'Norte'}]};
 const v2=p.storyboards.find(b=>b.id==='sb-v2');Object.assign(v2.sequences[0].shots[1],{zone:'norte',dialogue:[{who:'Bea',text:'Hola.'}]});
 p.storyboards.push({id:'sb-suelto',title:'Suelto',subtitle:'Borrador',sequences:[{id:'su-e1',title:'Patio',location:'otro',shots:[{id:'su1',code:'Z09',title:'Mirada',duration:3,cast:[],dialogue:[]}]}]});
 p.episodes[0].sequences.find(s=>s.id==='x-cruce').cast=[{character:'bea',x:0,z:0,yaw:0}];return p;};

test('storyboardItems: orden del árbol, grupos, estado y versión, subs de escena y viñeta, reparto, ambiente y zona',()=>{
 const {items,defs}=storyboardItems(sbProject()),by=k=>items.find(i=>i.key===k);
 assert.deepEqual(keys(items),['sb/sb-v1','sb/sb-v2','sb/sb-carga','seq/x-fuego','seq/x-cruce','sb/sb-suelto']);
 assert.deepEqual(items.map(i=>[i.kind,i.group.section,i.group.ficha?.code??null]),[['story','acts','01'],['story','acts','01'],['story','acts','02'],['test','tests',null],['test','tests',null],['story','unlinked',null]]);
 assert.deepEqual([by('sb/sb-v1').facets.kind,by('sb/sb-v1').facets.version,by('sb/sb-v2').facets.kind,by('sb/sb-v2').facets.version],[['other'],['v1'],['current'],['v2']]);
 assert.deepEqual([by('sb/sb-v2').ref.version,by('sb/sb-v2').ref.current],[2,true]);assert.deepEqual(by('sb/sb-suelto').facets,{kind:['unlinked'],cast:[],loc:['otro'],zone:['other']});
 const v2=by('sb/sb-v2');assert.deepEqual(v2.subs.map(s=>[s.key,s.kind,s.scene,s.label]),[['scene/sb-v2/sb-v2-e1','scene','sb-v2-e1','Camino'],['panel/v2a','panel','sb-v2-e1','Camino · A01 Viñeta A01'],['panel/v2b','panel','sb-v2-e1','Camino · A02 Viñeta A02'],['panel/v2c','panel','sb-v2-e1','Camino · A03 Viñeta A03']]);
 assert.deepEqual(v2.subs.map(s=>s.panel??null),[null,'v2a','v2b','v2c'],'las subs de viñeta llevan su id (#68)');
 assert.deepEqual(v2.subs[2].facets,{cast:['ana','bea'],loc:['loc'],zone:['norte']},'bea habla; ambiente heredado de la escena');assert.deepEqual(v2.subs[1].facets.zone,['other'],'sin zona: la base');
 assert.deepEqual(v2.facets,{act:['e1'],sequence:['x-colgado'],kind:['current'],version:['v2'],cast:['ana','bea'],loc:['loc'],zone:['other','norte']});
 assert.ok(v2.text.includes('acto i')&&v2.text.includes('01 prologo · el colgado'),'título del acto y de la ficha');
 assert.deepEqual(by('seq/x-cruce').facets,{act:['e1'],kind:['test'],cast:['bea'],loc:['loc']});assert.equal(by('seq/x-cruce').subs,undefined);
 assert.deepEqual(defs.map(d=>[d.id,!!d.sub]),[['act',false],['sequence',false],['kind',false],['version',false],['cast',true],['loc',true],['zone',true]]);
 assert.equal(defs[0].label,'Acto');assert.deepEqual(defs[1].values,[{value:'x-colgado',label:'01 · Prólogo · El Colgado'},{value:'x-prologo',label:'02 · Prólogo · La carga'},{value:'x-camino',label:'03 · El camino'},{value:'y-uno',label:'04 · Uno'}]);
 assert.deepEqual(defs[3].values.map(v=>v.value),['v1','v2']);assert.deepEqual(defs[6].values.map(v=>v.value),['norte','other'],'orden de projectZones');
 const hit=filterView(items,defs,'z09',{});assert.deepEqual(hit.results.map(r=>[r.item.key,r.hits.map(h=>h.key)]),[['sb/sb-suelto',['panel/su1']]],'código de viñeta');
 const cast=filterView(items,defs,'',{cast:['bea']});assert.deepEqual(cast.results.map(r=>[r.item.key,r.hits.map(h=>h.key)]),[['sb/sb-v2',['panel/v2b']],['seq/x-cruce',[]]]);});

test('storyboardResultSections: actos › fichas en orden, pruebas y sin secuencia, sin vacíos',()=>{
 const {items,defs}=storyboardItems(sbProject()),sec=r=>storyboardResultSections(r).map(s=>[s.kind,s.kind==='act'?[s.episode.id,s.fichas.map(f=>[f.code,f.ficha.id,f.results.map(x=>x.item.id)])]:s.results.map(x=>x.item.id)]);
 assert.deepEqual(sec(filterView(items,defs,'',{}).results),[['act',['e1',[['01','x-colgado',['sb-v1','sb-v2']],['02','x-prologo',['sb-carga']]]]],['tests',['x-fuego','x-cruce']],['unlinked',['sb-suelto']]]);
 assert.deepEqual(sec(filterView(items,defs,'',{kind:['current']}).results),[['act',['e1',[['01','x-colgado',['sb-v2']],['02','x-prologo',['sb-carga']]]]]]);
 assert.deepEqual(storyboardResultSections([]),[]);});

test('shotItems: reparto heredado (visibleCast, reparto de la secuencia, proxies), ambiente heredado, viñeta y tipo',()=>{
 const p=relProject(),{items,defs}=shotItems(p),by=k=>items.find(i=>i.key===k).facets;
 assert.deepEqual(keys(items),['shot/t1','shot/t2','shot/t3','shot/t4','shot/t5','shot/t6']);
 assert.deepEqual(by('shot/t2'),{act:['e1'],role:['container'],sequence:['c1'],loc:['plaza'],cast:['ana'],panel:['no']},'sin cast propio: reparto de la secuencia; ambiente heredado');
 assert.deepEqual(by('shot/t3').cast,['beto','pa'],'visibleCast y la voz que habla');assert.deepEqual(by('shot/t3').loc,['bosque']);
 assert.deepEqual(by('shot/t5').cast,['beto','dani'],'reparto de la secuencia y proxy');assert.deepEqual([by('shot/t4').role,by('shot/t4').panel,by('shot/t5').role],[['test'],['yes'],['outline']]);
 assert.ok(items[0].text.includes('texto l1')&&items[0].text.includes('planos v1'),'líneas y título de la secuencia');
 assert.deepEqual(items[1].ref.index,1);assert.deepEqual(defs.map(d=>d.id),['act','role','sequence','loc','cast','panel']);assert.equal(defs[0].label,'Capítulo');
 const idx=relationIndexFor(p);for(const c of ['ana','beto','dani','pa']){const want=holders(idx,'character/'+c,'shot',{rel:['appears','speaks']}).map(k=>k.slice(5));
  assert.deepEqual(filterView(items,defs,'',{cast:[c]}).results.map(r=>r.item.id),want,c);}});

test('filterShotGroups: índices originales, sin vacíos; null no cambia',()=>{
 const p=storyMigrationPlan(storysProject(),storysSpec()).next,g=shotGroups(p),all=filterShotGroups(g,null);
 assert.deepEqual(all.map(x=>[x.episode.id,x.groups.map(y=>[y.role,y.sequences.map(s=>[s.sequence.id,s.shots.map(t=>t.index)])]),x.empty.map(s=>s.id)]),
  g.map(x=>[x.episode.id,x.groups.map(y=>[y.role,y.sequences.map(s=>[s.sequence.id,s.sequence.shots.map((t,i)=>i)])]),x.empty.map(s=>s.id)]));
 assert.equal(all[0].groups[0].sequences[0].storyboard.id,'sb-v1','conserva los datos del grupo');
 const some=filterShotGroups(g,new Set(['p4','p7']));
 assert.deepEqual(some.map(x=>[x.episode.id,x.groups.map(y=>[y.role,y.sequences.map(s=>[s.sequence.id,s.shots.map(t=>[t.shot.id,t.index])])]),x.empty]),[['e1',[['container',[['x-v2',[['p4',1]]]]],['test',[['x-fuego',[['p7',1]]]]]],[]]]);
 assert.deepEqual(filterShotGroups(g,new Set()),[]);assert.deepEqual(filterShotGroups([],null),[]);
 const q=storyMigrationPlan(storysProject(),storysSpec()).next;q.episodes[1].sequences[0].shots.push(planShot('p10'));assert.deepEqual(filterShotGroups(shotGroups(q),new Set(['p10'])).map(x=>x.episode.id),['e2']);});
