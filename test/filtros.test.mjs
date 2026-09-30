// Buscador y facetas (#59): normalización, filtrado por términos y facetas, recuentos, estado en la URL y los constructores de ítems de
// Storyboards, Planos (#59), Personajes, Ambientes y Entornos 3D (#62) sobre los fixtures de #56 (escaleta → storys) y #58 (relaciones). Puro; textos inventados.
import test from 'node:test';import assert from 'node:assert/strict';
import {searchText,queryTerms,filterItems,itemHits,facets,filterView,parseFilters,filtersParam,toggleFilter,activeCount,hasFilters,storyboardItems,storyboardResultSections,shotItems,filterShotGroups,shotGroups,storyMigrationPlan,relationIndexFor,holders,characterItems,locationItems,environmentItems,ENVIRONMENT_KIND_LABELS,FILTER_SOURCES,viewItems,ROUTE_PARAMS,SHOT_STATE_LABELS,shotStateValues,heldFilters} from '../app/workflow.mjs';
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
 assert.deepEqual(['storyboards','shots','tree','storyboard','character','shot',undefined].map(hasFilters),[true,true,false,false,false,false,false]);
 assert.deepEqual(['ideas','issues','jobs','montaje','overview','library'].map(hasFilters),[true,true,true,true,false,false]);});

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

// #62: Personajes, Ambientes y Entornos 3D.
test('characterItems: orden, texto y facetas; sin kind cuenta como persona',()=>{
 const p=relProject();p.characters.push({id:'eli',name:'Elías',description:'Pescador de ÁNIMO triste',voice:'v1',sample:'m.mp3',images:['x'],variants:{norte:{description:'d'}}});
 const {items,defs}=characterItems(p),by=id=>items.find(i=>i.id===id);
 assert.deepEqual(items.map(i=>i.id),['ana','beto','pa','dani','eli']);assert.deepEqual(items.map(i=>i.key),['character/ana','character/beto','character/pa','character/dani','character/eli']);
 assert.deepEqual([by('eli').facets.kind,by('pa').facets.kind,by('ana').facets.kind],[['person'],['voice'],['person']]);
 assert.deepEqual([by('eli').facets.voice,by('eli').facets.sample,by('eli').facets.image,by('eli').facets.variants],[['yes'],['yes'],['yes'],['yes']],'images sin image cuenta como imagen');
 assert.deepEqual([by('ana').facets.voice,by('ana').facets.sample,by('ana').facets.image,by('ana').facets.variants],[['no'],['no'],['no'],['no']]);
 assert.ok(by('eli').text.includes('pescador de animo triste'));assert.ok(by('eli').text.includes('elias eli'));
 assert.equal(by('ana').ref,p.characters[0]);assert.equal(by('ana').group,null);assert.equal(by('ana').subs,undefined);
 assert.deepEqual(defs.map(d=>d.id),['kind','act','sequence','voice','sample','image','variants']);assert.equal(defs[1].label,'Capítulo');
 assert.deepEqual(defs[2].values,[{value:'f1',label:'01 · Ficha uno'},{value:'f2',label:'02 · Ficha dos'},{value:'f3',label:'03 · Ficha tres'},{value:'k1',label:'Prueba · Prueba'}]);});

test('characterItems: aparece en solo con storys vigentes; la secuencia, solo fichas y pruebas',()=>{
 const p=relProject();p.characters.push({id:'eva',name:'Eva',kind:'person'});p.storyboards[0].sequences[0].shots[1].cast=['eva'];
 const {items,defs}=characterItems(p),by=id=>items.find(i=>i.id===id).facets,idx=relationIndexFor(p);
 assert.deepEqual(holders(idx,'character/eva','act',{rel:['appears','speaks']}),['act/e1'],'control: sin current sí cuenta');
 assert.deepEqual([by('eva').act,by('eva').sequence],[[],[]]);assert.deepEqual(by('ana').act,['e1','e2']);assert.deepEqual(by('beto').sequence,['f1','k1','f2']);
 const allowed=new Set(defs.find(d=>d.id==='sequence').values.map(v=>v.value));
 for(const i of items)for(const s of i.facets.sequence)assert.ok(allowed.has(s),i.id+': '+s);assert.ok(!allowed.has('c1')&&!allowed.has('c2'));});

test('locationItems: tipo, zona y entorno 3D (también por modelSpace)',()=>{
 const p=relProject();p.stage={zones:[{id:'norte',label:'Norte'}]};Object.assign(p.locations[2],{kind:'forest',zone:'norte',description:'Árboles altos'});
 const {items,defs}=locationItems(p),by=id=>items.find(i=>i.id===id).facets;
 assert.deepEqual(items.map(i=>i.id),['plaza','nave','bosque']);assert.equal(items[1].ref,p.locations[1]);
 assert.deepEqual([by('plaza').env,by('nave').env,by('bosque').env],[['yes'],['yes'],['no']],'nave, solo por modelSpace');
 assert.deepEqual([by('plaza').zone,by('plaza').kind,by('bosque').zone,by('bosque').kind],[['other'],['-'],['norte'],['forest']]);
 assert.deepEqual(by('plaza').act,['e1']);assert.ok(items[2].text.includes('arboles altos'));
 assert.deepEqual(defs.map(d=>d.id),['kind','zone','env','act']);assert.deepEqual(defs[0].values,[{value:'forest',label:'forest'},{value:'-',label:'Sin tipo'}]);
 assert.deepEqual(filterView(items,defs,'',{env:['yes']}).results.map(r=>r.item.id),['plaza','nave']);});

test('environmentItems: tipo del visor y ambientes que lo usan',()=>{
 const p=relProject();p.environments.push({id:'env-g',name:'Nave GLB',glb:'a/b.glb'},{id:'env-v'},{id:'env-x',viewer:'x.js'});
 const {items,defs}=environmentItems(p),by=id=>items.find(i=>i.id===id);
 assert.deepEqual(items.map(i=>i.id),['env-a','env-b','env-g','env-v','env-x']);
 assert.deepEqual([by('env-a').facets,by('env-b').facets.loc],[{kind:['mount'],loc:['plaza']},['nave']]);
 assert.deepEqual(['env-g','env-v','env-x'].map(id=>by(id).facets.kind[0]),['glb','none','invalido']);
 assert.deepEqual(by('env-g').ref,{id:'env-g',name:'Nave GLB',description:'',image:'',glb:'a/b.glb',kind:'glb',invalid:'',action:'env-open:env-g'},'la entrada de environmentList');
 assert.deepEqual(defs[0].values,Object.entries(ENVIRONMENT_KIND_LABELS).map(([value,label])=>({value,label})));assert.deepEqual(defs[0].values.map(v=>v.label),['Visor 3D','GLB','Visor no válido','Sin modelo']);
 assert.deepEqual(defs[1].values.map(v=>v.value),['plaza','nave','bosque']);});

test('facets oculta las de un solo valor en personajes, ambientes y entornos',()=>{
 const p=relProject(),ids=({items,defs})=>filterView(items,defs,'',{}).facets.map(f=>f.id);
 assert.ok(!ids(characterItems(p)).includes('variants'));assert.ok(ids(characterItems(p)).includes('kind'));
 assert.deepEqual(ids(environmentItems(p)),['loc'],'los dos entornos son mount');assert.deepEqual(ids(locationItems(p)),['env','act']);});

test('filterView sobre characterItems: q por descripción y faceta voice',()=>{
 const p=relProject();p.characters[0].description='Maestra de escuela';p.characters[1].voice='abc';
 const {items,defs}=characterItems(p);
 assert.deepEqual(filterView(items,defs,'escuela',{}).results.map(r=>r.item.id),['ana']);
 const m=filterView(items,defs,'',{voice:['yes']});assert.deepEqual([m.total,m.shown,m.active],[4,1,1]);
 assert.deepEqual(m.facets.find(f=>f.id==='voice').values.map(v=>[v.value,v.count,v.active]),[['yes',1,true],['no',3,false]]);
 assert.deepEqual(m.facets.find(f=>f.id==='kind').values.map(v=>[v.value,v.count]),[['person',1]]);});

test('FILTER_SOURCES cubre toda vista con buscador',()=>{
 assert.deepEqual(Object.keys(ROUTE_PARAMS).filter(hasFilters).sort(),Object.keys(FILTER_SOURCES).sort());
 for(const [v,f] of Object.entries(FILTER_SOURCES))for(const x of [{},null,{characters:[1,null,{id:3}],locations:'x',environments:[{},null,{id:5}],ideas:[null,1,{}],issues:'x',episodes:[{id:'e'}]}])for(const o of [[],[undefined],[null],[{}],[{jobs:[null,{id:1}],lotes:[null,{id:3}]}]]){const r=f(x,...o);assert.ok(Array.isArray(r.items)&&Array.isArray(r.defs),v);}
 const p=relProject();assert.equal(viewItems('tree',p),null);assert.equal(viewItems('__proto__',p),null);assert.deepEqual(viewItems('characters',p).items.map(i=>i.id),characterItems(p).items.map(i=>i.id));});

// Faceta Estado de Planos (#64): valores de /api/shot-states, filtros guardados de facetas sin fuente y opts en viewItems.
const ST=(preview,approved=false,final='none')=>({preview,approved,final});
test('shotStateValues: acumulativo y robusto',()=>{
 assert.deepEqual(shotStateValues(ST('none')),['preview-none']);assert.deepEqual(shotStateValues(ST('stale',false,'stale')),['preview-stale']);
 assert.deepEqual(shotStateValues(ST('current')),['preview-current']);assert.deepEqual(shotStateValues(ST('current',true)),['preview-current','approved']);
 assert.deepEqual(shotStateValues(ST('current',true,'current')),['preview-current','approved','final']);
 for(const x of [undefined,null,{},{preview:'x'},'current',[1]])assert.deepEqual(shotStateValues(x),[],JSON.stringify(x));
 assert.deepEqual(Object.keys(SHOT_STATE_LABELS),['preview-none','preview-stale','preview-current','approved','final']);});

test('shotItems sin estados es idéntico al de hoy',()=>{const p=relProject(),base=shotItems(p);
 for(const o of [undefined,null,{},{states:null},{states:'x'},{states:[1]}])assert.deepEqual(shotItems(p,o),base,JSON.stringify(o));
 assert.ok(!base.defs.some(d=>d.id==='state'));assert.ok(base.items.every(i=>!('state' in i.facets)));});

test('shotItems con estados: faceta Estado tras Tipo; un plano sin entrada tiene []',()=>{const p=relProject();
 const states={t1:ST('current',true,'current'),t2:ST('current',true),t3:ST('stale'),t4:ST('none'),t5:ST('current')};
 const {items,defs}=shotItems(p,{states}),by=id=>items.find(i=>i.id===id).facets.state;
 assert.deepEqual(defs.map(d=>d.id),['act','role','state','sequence','loc','cast','panel']);assert.equal(defs[2].label,'Estado');
 assert.deepEqual(defs[2].values.map(v=>v.label),['Sin preview','Preview desactualizada','Preview vigente','Aprobado','Final vigente']);
 assert.deepEqual([by('t1'),by('t2'),by('t6')],[['preview-current','approved','final'],['preview-current','approved'],[]]);
 assert.deepEqual(filterView(items,defs,'',{state:['approved']}).results.map(r=>r.item.id),['t1','t2']);
 assert.deepEqual(filterView(items,defs,'',{state:['final','preview-none']}).results.map(r=>r.item.id),['t1','t4']);
 const f=facets(items,'',{},defs).find(x=>x.id==='state');assert.deepEqual(f.values.map(v=>[v.value,v.count]),[['preview-none',1],['preview-stale',1],['preview-current',3],['approved',2],['final',1]]);
 const same=Object.fromEntries(items.map(i=>[i.id,ST('stale',false,'stale')])),m=shotItems(p,{states:same});
 assert.equal(facets(m.items,'',{},m.defs).find(x=>x.id==='state'),undefined,'todo con el mismo valor: oculta');});

test('heldFilters: conserva las facetas retenidas que no están en defs',()=>{const defs=[{id:'act'},{id:'cast'}];
 assert.deepEqual(heldFilters({state:['approved'],act:['e1']},['state'],defs),{state:['approved']});
 assert.deepEqual(heldFilters({state:['approved'],act:['e1']},['state'],[...defs,{id:'state'}]),{});
 assert.deepEqual(heldFilters({state:['approved']},[],defs),{});assert.deepEqual(heldFilters({state:['approved']},undefined,defs),{});
 assert.deepEqual(heldFilters({state:[]},['state'],defs),{});assert.deepEqual(heldFilters({state:'approved'},['state'],defs),{});
 for(const [f,h,d] of [[null,['state'],defs],[undefined,null,null],[{state:['a']},['state'],null],[{state:['a']},'state',defs]])assert.doesNotThrow(()=>heldFilters(f,h,d));
 assert.deepEqual(heldFilters({state:['a']},['state'],null),{state:['a']});
 const src={state:['a']},out=heldFilters(src,['state'],defs);out.state.push('b');assert.deepEqual(src.state,['a'],'copia');});

test('viewItems pasa opts a shotItems; los demás constructores lo ignoran',()=>{const p=relProject(),states={t1:ST('current',true)};
 assert.deepEqual(viewItems('shots',p,{states}),shotItems(p,{states}));assert.ok(viewItems('shots',p,{states}).defs.some(d=>d.id==='state'));
 assert.deepEqual(viewItems('shots',p),shotItems(p));assert.deepEqual(viewItems('shots',p,null),shotItems(p));
 for(const v of ['storyboards','characters','locations','environments'])assert.deepEqual(viewItems(v,p,{states}),FILTER_SOURCES[v](p),v);});
