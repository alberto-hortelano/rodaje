// Navegación (#57, #67): rutas con alias, árbol de la escaleta hasta los planos, versión del story, vista Planos y cifras del proyecto.
// Puro sobre el fixture de #56, más comprobaciones de fuente (menú, vistas, renombrados) y estilo.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {VIEWS,VIEW_ALIASES,ROUTE_PARAMS,ROUTE_KEYS,FILTER_PARAMS,hasFilters,routeView,parseRoute,routeQuery,routeKey,routeHref,sameEntry,historyStep,historyState,entryScroll,navActive,treeModel,treePath,storyVersionOptions,setCurrentStory,shotGroups,projectStats,storyMigrationPlan} from '../app/workflow.mjs';
import {validate} from '../app/store.mjs';
import {storysProject,storysSpec,planShot} from './fixtures/escaleta-storys.mjs';

const migrated=()=>storyMigrationPlan(storysProject(),storysSpec()).next;
const seq=(p,id)=>p.episodes.flatMap(e=>e.sequences).find(s=>s.id===id);
const keys=list=>list.map(n=>n.key);
const leaf=l=>`${l.sequence.id}/${l.shot.id}#${l.number}:${l.role}`;
// Migrado con un plano de prueba enlazado a una viñeta de v2 y un plano del contenedor de v2 sin viñeta.
const withShots=()=>{const m=migrated();seq(m,'x-cruce').shots[0].storyboardShot='v2b';seq(m,'x-v2').shots.push(planShot('p9','no-es-vineta'));return m;};

test('rutas: alias de vistas antiguas',()=>{
 assert.deepEqual(VIEW_ALIASES,{outline:'tree',episodes:'shots',ship:'environments'});
 assert.equal(routeView('outline'),'tree');assert.equal(routeView('episodes'),'shots');assert.equal(routeView('ship'),'environments');
 for(const v of ['tree','overview','toString','',null])assert.equal(routeView(v),v);
 assert.equal(parseRoute('?project=x&view=outline').view,'tree');assert.equal(parseRoute('?project=x&view=episodes').view,'shots');assert.equal(parseRoute('?project=x&view=ship').view,'environments');});

test('rutas: sin vista, library o desconocida → árbol; sin proyecto, library o jobs',()=>{
 for(const q of ['?project=x','?project=x&view=library','?project=x&view=nada','?project=x&view=','?project=x&view=constructor'])assert.equal(parseRoute(q).view,'tree',q);
 assert.equal(parseRoute('').view,'library');assert.equal(parseRoute('?view=jobs').view,'jobs');assert.equal(parseRoute('?view=tree').view,'library');assert.equal(parseRoute('?view=jobs').project,null);
 for(const v of VIEWS)assert.equal(parseRoute('?project=x&view='+v).view,v);
 assert.equal(parseRoute(new URLSearchParams('project=a%20b&view=overview')).project,'a b');
 const movil=fs.readFileSync(new URL('../app/movil.html',import.meta.url),'utf8');assert.ok(movil.includes("'&view=library'"),'el enlace del móvil abre con view=library, que lleva al árbol');});

test('rutas: solo los parámetros de la vista; el resto null',()=>{
 const all='&episode=e&sequence=s&shot=t&storyboard=b&environment=n&character=h&location=l&scene=c&panel=v&node=k';
 assert.deepEqual(parseRoute('?project=x&view=storyboard'+all),{project:'x',view:'storyboard',episode:null,sequence:null,shot:null,storyboard:'b',environment:null,character:null,location:null,scene:'c',panel:'v',node:null,q:null,f:null,at:null,lote:null,block:null});
 assert.deepEqual(parseRoute('?project=x&view=shot'+all),{project:'x',view:'shot',episode:'e',sequence:'s',shot:'t',storyboard:null,environment:null,character:null,location:null,scene:null,panel:null,node:null,q:null,f:null,at:null,lote:null,block:null});
 assert.deepEqual(parseRoute('?project=x&view=shots'+all),{project:'x',view:'shots',episode:null,sequence:'s',shot:null,storyboard:null,environment:null,character:null,location:null,scene:null,panel:null,node:null,q:null,f:null,at:null,lote:null,block:null});
 assert.equal(parseRoute('?project=x&view=tree'+all).node,'k');assert.equal(parseRoute('?project=x&view=environment'+all).environment,'n');assert.equal(parseRoute('?project=x&view=rehearsal'+all).episode,'e');
 assert.deepEqual(Object.values(parseRoute('?project=x&view=overview'+all)).filter(Boolean),['x','overview']);
 assert.equal(parseRoute('?project=x&view=storyboard&storyboard=b&scene=').scene,null);assert.equal(parseRoute('?project=x&view=storyboard&storyboard=b&panel=').panel,null);});

test('rutas: routeQuery ida y vuelta y la forma de linea-base',()=>{
 assert.equal(routeQuery({project:'x',view:'environment',environment:'y'}),'?project=x&view=environment&environment=y');
 assert.equal(routeQuery({project:'x',view:'overview',episode:'e',storyboard:'b'}),'?project=x&view=overview');
 assert.equal(routeQuery({project:'x',view:'storyboard',storyboard:'b',scene:null}),'?project=x&view=storyboard&storyboard=b');
 assert.equal(routeQuery({project:'a b',view:'tree',node:'seq/x&y'}),'?project=a%20b&view=tree&node=seq%2Fx%26y');
 assert.equal(routeQuery({project:null,view:'library'}),'?view=library');
 for(const q of ['?project=x&view=shot&episode=e&sequence=s&shot=t','?project=x&view=storyboard&storyboard=b&scene=c','?project=x&view=storyboard&storyboard=b&scene=c&panel=v','?project=x&view=tree&node=seq%2Fa','?project=x&view=shots&sequence=s','?project=x&view=anim&episode=e&sequence=s&shot=t','?project=x&view=rehearsal&episode=e','?view=jobs'])
  assert.equal(routeQuery(parseRoute(q)),q);
 assert.deepEqual(Object.keys(ROUTE_PARAMS).filter(v=>!VIEWS.includes(v)),[]);});

test('rutas: routeKey distingue story, escena y viñeta (#68) e ignora la secuencia de Planos',()=>{
 const k=q=>routeKey(parseRoute(q));
 assert.notEqual(k('?project=x&view=storyboard&storyboard=b&scene=c'),k('?project=x&view=storyboard&storyboard=b'));
 assert.notEqual(k('?project=x&view=storyboard&storyboard=b&scene=c&panel=v'),k('?project=x&view=storyboard&storyboard=b&scene=c'));
 assert.notEqual(k('?project=x&view=storyboard&storyboard=b'),k('?project=x&view=storyboard&storyboard=b2'));
 assert.notEqual(k('?project=x&view=tree&node=seq/a'),k('?project=x&view=tree'));assert.equal(k('?project=x&view=shots&sequence=s'),k('?project=x&view=shots'));
 assert.notEqual(k('?project=x&view=shot&episode=e&sequence=s&shot=t'),k('?project=x&view=shot&episode=e&sequence=s2&shot=t'));
 assert.equal(k('?project=x&view=tree'),JSON.stringify(['x','tree','']));assert.equal(routeKey({view:'library'}),JSON.stringify(['','library']));});

test('navActive: vistas de detalle marcan su lista',()=>{
 assert.deepEqual(['environment','storyboard','shot','anim','rehearsal','tree','overview','shots','jobs','library'].map(navActive),['environments','storyboards','shots','shots','shots','tree','overview','shots','jobs','library']);
 assert.deepEqual(['character','location','characters','locations'].map(navActive),['characters','locations','characters','locations']);});

test('rutas: páginas de personaje y de ambiente (#60)',()=>{
 const all='&episode=e&sequence=s&shot=t&storyboard=b&environment=n&character=h&location=l&scene=c&panel=v&node=k&at=seq/f1';
 assert.deepEqual(parseRoute('?project=x&view=character'+all),{project:'x',view:'character',episode:null,sequence:null,shot:null,storyboard:null,environment:null,character:'h',location:null,scene:null,panel:null,node:null,q:null,f:null,at:'seq/f1',lote:null,block:null});
 assert.deepEqual(parseRoute('?project=x&view=location'+all),{project:'x',view:'location',episode:null,sequence:null,shot:null,storyboard:null,environment:null,character:null,location:'l',scene:null,panel:null,node:null,q:null,f:null,at:'seq/f1',lote:null,block:null});
 for(const v of ['tree','storyboard','shot','characters','locations','environment'])assert.deepEqual([parseRoute('?project=x&view='+v+all).character,parseRoute('?project=x&view='+v+all).location,parseRoute('?project=x&view='+v+all).at],[null,null,null],v);
 assert.equal(parseRoute('?project=x&view=character&character=').character,null);assert.equal(parseRoute('?view=character&character=h').view,'library');
 for(const q of ['?project=x&view=character&character=ana','?project=x&view=location&location=plaza%20mayor','?project=x&view=character'])assert.equal(routeQuery(parseRoute(q)),q);
 assert.equal(routeQuery({project:'x',view:'character',character:'a/b',location:'l'}),'?project=x&view=character&character=a%2Fb');
 const k=q=>routeKey(parseRoute(q));assert.notEqual(k('?project=x&view=character&character=a'),k('?project=x&view=character&character=b'));
 assert.notEqual(k('?project=x&view=location&location=a'),k('?project=x&view=location&location=b'));assert.equal(k('?project=x&view=location&location=a'),JSON.stringify(['x','location','a','']));
 assert.notEqual(k('?project=x&view=character&character=a&at=act%2Fe1'),k('?project=x&view=character&character=a'));
 for(const q of ['?project=x&view=character&character=ana&at=seq%2Ff1','?project=x&view=location&location=plaza&at=scene%2Fsb1%2Fsc1'])assert.equal(routeQuery(parseRoute(q)),q);
 assert.deepEqual(ROUTE_KEYS.filter(x=>!Object.values(ROUTE_PARAMS).flat().includes(x)),[]);});

test('rutas: q y f del buscador (#59, #62) solo en las vistas con buscador, fuera del scroll',()=>{
 const f='act:e1,cast:ana';
 for(const q of ['?project=x&view=storyboards&q=luna%20roja&f='+f,'?project=x&view=shots&sequence=s&q=caf%C3%A9&f='+f,'?project=x&view=storyboards&f=cast:a%253Ab'])assert.equal(routeQuery(parseRoute(q)),q);
 assert.deepEqual([parseRoute('?project=x&view=storyboards&q=luna&f='+f).q,parseRoute('?project=x&view=storyboards&q=luna&f='+f).f],['luna',f]);
 for(const v of ['tree','storyboard','character','shot','overview'])assert.deepEqual([parseRoute('?project=x&view='+v+'&q=a&f='+f).q,parseRoute('?project=x&view='+v+'&q=a&f='+f).f],[null,null],v);
 assert.equal(routeQuery({project:'x',view:'shots',q:'a b',f}),'?project=x&view=shots&q=a%20b&f=act:e1,cast:ana');assert.equal(routeQuery({project:'x',view:'tree',q:'a',f}),'?project=x&view=tree');
 assert.equal(routeQuery({project:'x',view:'storyboards',q:'',f:null}),'?project=x&view=storyboards');
 const k=q=>routeKey(parseRoute(q));assert.equal(k('?project=x&view=storyboards&q=a&f='+f),k('?project=x&view=storyboards'));assert.equal(k('?project=x&view=shots&sequence=s&q=a'),JSON.stringify(['x','shots']));
 assert.deepEqual(FILTER_PARAMS,['q','f']);assert.deepEqual(Object.keys(ROUTE_PARAMS).filter(hasFilters).sort(),['characters','environments','locations','shots','storyboards']);
 for(const v of ['characters','locations','environments']){const q='?project=x&view='+v+'&q=a&f=kind:voice';assert.equal(routeQuery(parseRoute(q)),q,v);assert.equal(k(q),k('?project=x&view='+v),v);}
 assert.deepEqual(Object.values(ROUTE_PARAMS).flat().filter(x=>!ROUTE_KEYS.includes(x)),[],'todo parámetro de vista está en ROUTE_KEYS');});

test('fuente: buscador de Storyboards y Planos (#59)',()=>{
 const filt=fs.readFileSync(new URL('../app/filtros.source.js',import.meta.url),'utf8');
 assert.match(src,/import \{filterBarHTML,mountFilters,loadFilters,saveFilters\} from '\.\/filtros\.source\.js'/);
 for(const x of ['filterMount?.dispose();filterMount=null;','data-filter-results','storyboardItems(p)','shotItems(p,{states})','shotStatesIndex.get(p.id,p.revision)',"hold:['state']",'filterShotGroups(shotGroups(p),','La secuencia enfocada queda oculta por los filtros',"btn('+ Storyboard','new-storyboard','primary')","btn('Importar JSON','import-storyboard')"])assert.ok(src.includes(x),'falta '+x);
 for(const x of ["'rodaje-filtros-'",'role="search"','data-filter-q','aria-pressed','aria-live="polite"','e.isComposing','setTimeout(','data-filter-clear'])assert.ok(filt.includes(x),'falta '+x);
 assert.ok(!/\brender\(|\bsave\(|\bdirty\b|\bapi\(/.test(filt.replace(/^\/\/.*$/gm,'')),'filtrar no repinta la vista ni escribe');
 const rule=sel=>new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}').exec(css)?.[1]||'';
 assert.match(rule('.filter-bar'),/position:sticky/);assert.match(rule('.filter-bar'),/top:var\(--sticky-top,0\)/);assert.match(rule('.filter-row input'),/font-size:16px/);assert.match(rule('.chip'),/border-radius:20px/);});

test('treeModel sin migrar: todas son fichas; los storys van a Sin secuencia con su secuencia de planos',()=>{
 const p=storysProject(),before=structuredClone(p),m=treeModel(p);assert.deepEqual(p,before);
 assert.deepEqual(keys(m.acts),['act/e1','act/e2']);assert.deepEqual(m.acts.map(a=>[a.minutes,a.episode.id]),[[18.5,'e1'],[5,'e2']]);
 const [v1]=m.acts[0].children;assert.deepEqual([v1.key,v1.kind,v1.code,v1.number,v1.minutes,v1.current,v1.cover],['seq/x-v1','ficha','01',1,4,null,null]);
 assert.deepEqual(v1.children,[]);assert.deepEqual(v1.shots.map(leaf),['x-v1/p1#1:outline','x-v1/p2#2:outline']);
 assert.equal(m.index.get('seq/x-prologo').node.cover,'assets/c.png');
 assert.deepEqual(m.groups.map(g=>[g.key,g.kind]),[['unlinked','unlinked']]);
 const [sb1,carga,sb2]=m.groups[0].children;assert.deepEqual(keys([sb1,carga,sb2]),['sb/sb-v1','sb/sb-carga','sb/sb-v2']);
 assert.deepEqual([sb1.version,sb1.current,sb1.container.sequence.id,sb1.counts],[null,false,'x-v1',{scenes:1,panels:2,shots:2}]);assert.equal(carga.container,null);
 assert.deepEqual(sb1.children[0].panels.map(x=>[x.panel.id,x.shots.map(leaf)]),[['v1a',['x-v1/p1#1:outline']],['v1b',['x-v1/p2#2:outline']]]);
 assert.equal(m.index.get('sb/sb-v1').parent,'unlinked');});

test('treeModel migrado: ficha con v1 y v2 (vigente), contenedores, escenas y viñetas en orden, planos por viñeta, pruebas y planos sin viñeta',()=>{
 const p=withShots(),before=structuredClone(p),m=treeModel(p);assert.deepEqual(p,before);
 assert.deepEqual(m.acts.map(a=>keys(a.children)),[['seq/x-colgado','seq/x-prologo','seq/x-camino'],['seq/y-uno']]);
 const f=m.index.get('seq/x-colgado').node;assert.equal(f.current,'sb-v2');assert.deepEqual(f.shots,[]);
 assert.deepEqual(f.children.map(s=>[s.key,s.version,s.current,s.container.sequence.id,s.counts]),[['sb/sb-v1',1,false,'x-v1',{scenes:1,panels:2,shots:2}],['sb/sb-v2',2,true,'x-v2',{scenes:1,panels:3,shots:4}]]);
 const v2=f.children[1];assert.deepEqual(keys(v2.children),['scene/sb-v2/sb-v2-e1','orphans/sb-v2']);
 const sc=v2.children[0];assert.equal(sc.scene.id,'sb-v2-e1');assert.equal(sc.storyboard.id,'sb-v2');
 assert.deepEqual(sc.panels.map(x=>[x.panel.id,x.thumb,x.shots.map(leaf)]),[['v2a',null,['x-v2/p3#1:container']],['v2b',null,['x-v2/p4#2:container','x-cruce/p8#1:test']],['v2c',null,['x-v2/p5#3:container']]]);
 assert.deepEqual(v2.children[1].shots.map(leaf),['x-v2/p9#4:container']);
 const carga=m.index.get('sb/sb-carga').node;assert.deepEqual([carga.version,carga.current,carga.container,carga.counts.shots],[1,true,null,0]);
 assert.deepEqual(m.groups.map(g=>[g.key,keys(g.children)]),[['tests',['seq/x-fuego','seq/x-cruce']]]);
 assert.deepEqual(m.index.get('seq/x-fuego').node.shots.map(leaf),['x-fuego/p6#1:test','x-fuego/p7#2:test']);
 assert.equal(m.index.get('seq/x-v1'),undefined,'los contenedores no son nodos');});

test('treeModel: miniatura de la viñeta (render, si no boceto) y arrays ausentes',()=>{
 const p=migrated();const [a,b]=p.storyboards[0].sequences[0].shots;a.render='r.png';a.sketch='s.png';b.sketch='s2.png';
 assert.deepEqual(treeModel(p).index.get('scene/sb-v1/sb-v1-e1').node.panels.map(x=>x.thumb),['r.png','s2.png']);
 for(const q of [{},{episodes:null,storyboards:null},{episodes:[{id:'e',title:'E'}],storyboards:[{id:'b'}]}]){const m=treeModel(q);assert.ok(Array.isArray(m.acts)&&Array.isArray(m.groups));}
 const m=treeModel({episodes:[{id:'e',title:'E',sequences:[{id:'s'}]}],storyboards:[{id:'b',sequences:[{id:'c'}]}]});
 assert.deepEqual(keys(m.acts[0].children),['seq/s']);assert.deepEqual(m.acts[0].children[0].shots,[]);assert.deepEqual(keys(m.groups[0].children[0].children),['scene/b/c']);assert.deepEqual(m.index.get('scene/b/c').node.panels,[]);});

test('treeModel: claves únicas e índice completo con su padre',()=>{
 for(const p of [storysProject(),withShots()]){const m=treeModel(p),seen=[];
  const walk=(n,parent)=>{seen.push(n.key);assert.equal(m.index.get(n.key)?.node,n,n.key);assert.equal(m.index.get(n.key).parent,parent,n.key);for(const c of n.children||[])walk(c,n.key);};
  for(const n of [...m.acts,...m.groups])walk(n,null);
  assert.equal(new Set(seen).size,seen.length);assert.equal(m.index.size,seen.length);}});

test('treePath',()=>{
 const m=treeModel(withShots());
 assert.deepEqual(treePath(m,'scene/sb-v2/sb-v2-e1'),['act/e1','seq/x-colgado','sb/sb-v2','scene/sb-v2/sb-v2-e1']);
 assert.deepEqual(treePath(m,'seq/x-cruce'),['tests','seq/x-cruce']);assert.deepEqual(treePath(m,'act/e2'),['act/e2']);
 assert.deepEqual(treePath(m,'panel/v2a'),['act/e1','seq/x-colgado','sb/sb-v2','scene/sb-v2/sb-v2-e1','panel/v2a']);
 assert.deepEqual(treePath(m,'shot/p3'),['act/e1','seq/x-colgado','sb/sb-v2','scene/sb-v2/sb-v2-e1','panel/v2a','shot/p3']);
 assert.deepEqual(treePath(m,'shot/p8'),['act/e1','seq/x-colgado','sb/sb-v2','scene/sb-v2/sb-v2-e1','panel/v2b','shot/p8'],'la viñeta gana a la prueba');
 assert.deepEqual(treePath(m,'shot/p9'),['act/e1','seq/x-colgado','sb/sb-v2','orphans/sb-v2','shot/p9']);assert.deepEqual(treePath(m,'shot/p6'),['tests','seq/x-fuego','shot/p6']);
 assert.deepEqual(treePath(m,'nada'),[]);assert.deepEqual(treePath(m,null),[]);assert.deepEqual(treePath(m,'panel/nada'),[]);assert.deepEqual(treePath({},'panel/v2a'),[]);});

test('storyVersionOptions: versiones de la ficha con la vigente marcada; sin ficha, ninguna',()=>{
 const m=migrated();
 assert.deepEqual(storyVersionOptions(m,'sb-v1'),[{id:'sb-v1',version:1,label:'v1',current:false,selected:true},{id:'sb-v2',version:2,label:'v2 · vigente',current:true,selected:false}]);
 assert.deepEqual(storyVersionOptions(m,'sb-v2').map(o=>o.selected),[false,true]);
 assert.deepEqual(storyVersionOptions(m,'sb-carga'),[{id:'sb-carga',version:1,label:'v1 · vigente',current:true,selected:true}]);
 assert.deepEqual(storyVersionOptions(storysProject(),'sb-v1'),[]);assert.deepEqual(storyVersionOptions(m,'nada'),[]);});

test('setCurrentStory: copia válida con el nuevo vigente; sin ficha, lanza',()=>{
 const m=migrated(),before=structuredClone(m),q=setCurrentStory(m,'sb-v1');
 assert.deepEqual(m,before);assert.equal(seq(q,'x-colgado').currentStoryboard,'sb-v1');assert.doesNotThrow(()=>validate(q));
 assert.equal(storyVersionOptions(q,'sb-v1')[0].label,'v1 · vigente');
 assert.throws(()=>setCurrentStory(storysProject(),'sb-v1'),/El story no tiene secuencia/);assert.throws(()=>setCurrentStory(m,'nada'),/El story no tiene secuencia/);});

test('shotGroups: por acto, storys, propios y pruebas en ese orden; fichas sin planos aparte',()=>{
 const m=withShots(),g=shotGroups(m),ids=x=>x.map(s=>s.sequence.id);
 assert.deepEqual(g.map(x=>x.episode.id),['e1','e2']);
 assert.deepEqual(g[0].groups.map(x=>[x.role,ids(x.sequences)]),[['container',['x-v1','x-v2']],['test',['x-fuego','x-cruce']]]);
 assert.deepEqual(g[0].groups[0].sequences.map(x=>[x.storyboard.id,x.version,x.ficha.id]),[['sb-v1',1,'x-colgado'],['sb-v2',2,'x-colgado']]);
 assert.deepEqual(g[0].empty.map(s=>s.id),['x-colgado','x-prologo','x-camino']);assert.deepEqual(g[1],{episode:m.episodes[1],groups:[],empty:[m.episodes[1].sequences[0]]});
 const p=storysProject();assert.deepEqual(shotGroups(p)[0].groups.map(x=>[x.role,ids(x.sequences)]),[['outline',['x-v1','x-v2','x-fuego','x-cruce']]]);
 assert.deepEqual(shotGroups({}),[]);});

test('projectStats',()=>{
 const m=withShots();m.environments=[{id:'a'}];
 assert.deepEqual(projectStats(m),{acts:2,sequences:4,minutes:14,storys:3,shots:6,tests:2,characters:2,locations:2,environments:1});
 assert.deepEqual(projectStats(storysProject()).sequences,7);
 assert.deepEqual(projectStats({}),{acts:0,sequences:0,minutes:0,storys:0,shots:0,tests:0,characters:0,locations:0,environments:0});});

const src=fs.readFileSync(new URL('../app/app.source.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
const reh=fs.readFileSync(new URL('../app/rehearsal.source.js',import.meta.url),'utf8'),mont=fs.readFileSync(new URL('../app/montaje.source.js',import.meta.url),'utf8');

test('fuente: menú, vistas nuevas, sin las antiguas y renombrados',()=>{
 assert.ok(src.includes("[['tree','Escaleta'],['overview','Proyecto'],['ideas','Historia e ideas'],['characters','Personajes y voces'],['locations','Ambientes'],['environments','Entornos 3D'],['storyboards','Storyboards'],['shots','Planos'],['montaje','Montaje'],['issues','Pendientes'],['jobs','Generaciones']]"));
 for(const x of ["view==='outline'","view==='episodes'","'nav:episodes'","view='episodes'","['outline','Escaleta']","'Vista del proyecto'"])assert.ok(!src.includes(x),'queda '+x);
 for(const x of ["view==='tree'","view==='shots'",'navActive(view)','applyRoute(r)','parseRoute(location.search)','historyStep(location.search,r'])assert.ok(src.includes(x),'falta '+x);
 assert.match(reh,/>Secuencia<select data-scene>/);assert.doesNotMatch(reh,/>Escena<select/);assert.ok(mont.includes('<dt>Secuencia</dt>'));assert.ok(!mont.includes('<dt>Escena</dt>'));
 for(const x of ["'Sin escenario'","'+ Escenario'","'Escenarios'",'Sin escenario','Escenario al crear'])assert.ok(!src.includes(x),'queda '+x);
 for(const x of ['Escena 3D y tiempos · JSON','Escenario y cámara','Elemento del escenario','la viñeta del storyboard y la secuencia'])assert.ok(src.includes(x),'falta '+x);});

test('fuente: Escaleta por niveles, migas únicas, versión, escena y posición sin esperar a las imágenes perezosas',()=>{
 assert.match(src,/#workspace img:not\(\[loading="lazy"\]\)/);
 for(const d of ['data-level=',"linkCls:'level-link'",'data-route','data-sb-version','data-sb-scene=','data-shots-seq=','loading="lazy" decoding="async"','class="tiles','data-cols="','aria-current="page"','aria-label="Ruta"'])assert.ok(src.includes(d),'falta '+d);
 for(const a of ["'sb-current:'","'shots:'","'tree:seq/'"])assert.ok(src.includes(a),'falta '+a);
 for(const x of ['levelCrumbs(','levelResolve(','crumbsNav(levelCrumbs(',"'No existe en la escaleta: '","localStorage.removeItem('rodaje-tree-'"])assert.ok(src.includes(x),'falta '+x);
 for(const x of ['treeStore','tree-node','storyCrumbs','treeOpen',"'tree-fold'",'data-tree=','data-loaded','class="tree-kids"','bind(kids)','<nav class="crumbs" aria-label="Ruta"><ol>${crumbs.map'])assert.ok(!src.includes(x),'queda '+x);
 for(const x of ['storyboardPage(p,','storyPageHTML(','scenePageHTML(','panelPageHTML(',"levelCrumbs(p,{view:'shot',","levelCrumbs(p,{view:'anim',",'movePanel(p,'])assert.ok(src.includes(x),'falta '+x);
 for(const x of ['sbMove(','ol.scrollLeft=ol.scrollWidth',"['sb-scene',sceneId]","' target'"])assert.ok(!src.includes(x),'queda '+x);
 assert.equal(src.split('<nav class="crumbs"').length,2,'un solo sitio pinta migas');assert.match(src,/function bind\(root\)/);});

test('estilos: tarjetas 16:9, rejilla por columnas, migas sin desbordar y foco',()=>{
 const rule=sel=>new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}').exec(css)?.[1]||'';
 assert.match(rule('.tile-media'),/aspect-ratio:16\/9/);assert.match(rule('.tile-media'),/overflow:hidden/);assert.match(rule('.tile-media>img'),/object-fit:cover/);
 assert.match((/\n\.tiles\{([^}]*)\}/.exec(css)?.[1]||''),/repeat\(var\(--cols/);assert.match((/\n\.tile\{([^}]*)\}/.exec(css)?.[1]||''),/flex-direction:column/);assert.doesNotMatch((/\n\.tile\{([^}]*)\}/.exec(css)?.[1]||''),/overflow/);for(const x of ['.tree-thumb','.levels{','.grid.cast'])assert.ok(!css.includes(x),'queda '+x);
 assert.match(rule('.crumbs ol'),/display:flex/);assert.match(rule('.crumbs li+li::before'),/content:'›'/);assert.match(rule('.crumbs li>a,.crumbs li>span'),/text-overflow:ellipsis/);
 const movil=/@media\(max-width:750px\)\{\.crumbs ol\{([^}]*)\}/.exec(css)?.[1]||'';assert.match(movil,/flex-wrap:wrap/);assert.match(movil,/overflow:visible/);assert.doesNotMatch(movil,/overflow-x:auto/);
 assert.match(css,/\.crumbs li>span\[aria-current\]\{max-width:none;white-space:normal/);assert.ok(!css.includes('.sb-seq.target'),'la escena ya no es foco');for(const x of ['.tree-kids','.tree-node','.tree-panel'])assert.ok(!css.includes(x),'queda '+x);});

test('fuente: rutas y tarjetas de personaje y ambiente (#60)',()=>{
 assert.match(fs.readFileSync(new URL('../app/workflow.mjs',import.meta.url),'utf8'),/ROUTE_NAMES=\['project','view',\.\.\.ROUTE_KEYS\]/);assert.ok(!src.includes('data-kind="${view}"'),'el selector de versión no usa la vista');
 assert.ok(src.includes("el.dataset.kind==='character'?p.characters:p.locations"));
 for(const x of ['const characterCard=','const locationCard=',"card=chars?characterCard:locationCard","'rodaje-appear-all-'+p.id",'data-appear-all','/api/entity?project=',"'No existe el personaje '","'No existe el ambiente '"])assert.ok(src.includes(x),'falta '+x);});

// Historial (#66): push si cambia la ruta sin q/f; replace en filtros, en la misma ruta y si se fuerza.
test('historial: push si cambia la ruta sin q/f',()=>{
 const R=q=>parseRoute('?project=x&'+q),step=(prev,q,o)=>historyStep(prev,typeof q==='string'?(q.startsWith('?')?parseRoute(q):R(q)):q,o).method;
 const push=[['?project=x&view=tree','view=tree&node=act/e1'],['?project=x&view=tree&node=act/e1','view=tree&node=seq/x'],['?project=x&view=storyboard&storyboard=a','view=storyboard&storyboard=a&scene=c'],['?project=x&view=storyboard&storyboard=a&scene=c','view=storyboard&storyboard=a&scene=c&panel=v'],
  ['?project=x&view=storyboard&storyboard=a','view=storyboard&storyboard=b'],['?project=x&view=tree','view=shots&sequence=s'],['?project=x&view=shots','view=shot&episode=e&sequence=s&shot=t'],
  ['?project=x&view=shot&episode=e&sequence=s&shot=t','view=anim&episode=e&sequence=s&shot=t'],['?project=x&view=shots','view=rehearsal&episode=e'],['?project=x&view=environments','view=environment&environment=n'],
  ['?project=x&view=characters','view=character&character=h'],['?project=x&view=tree','view=montaje'],['?view=library','?project=x&view=tree'],['?project=x&view=tree','?view=library']];
 for(const [a,b] of push)assert.equal(step(a,b),'push',a+' → '+b);
 const replace=[['?project=x&view=storyboards&q=a','view=storyboards&q=b'],['?project=x&view=storyboards&f=act:e1','view=storyboards&f=act:e2'],['?project=x&view=storyboards','view=storyboards&q=a&f=cast:ana'],
  ['?project=x&view=shot&episode=e&sequence=s&shot=t','view=shot&episode=e&sequence=s&shot=t'],['?project=x&view=outline','view=tree'],['','?view=library'],['?project=x&view=library','view=tree']];
 for(const [a,b] of replace)assert.equal(step(a,b),'replace',a+' → '+b);
 for(const [a,b] of push)assert.equal(step(a,b,{replace:true}),'replace','forzado: '+a+' → '+b);
 assert.equal(historyStep('?project=x&view=tree',R('view=shots&sequence=s')).search,'?project=x&view=shots&sequence=s');});

test('historial: routeHref conserva los parámetros ajenos',()=>{
 const prev='?project=x&view=environment&environment=a&persist=0&foo=1';
 assert.equal(routeHref(prev,{project:'x',view:'tree',node:'act/e1'}),'?project=x&view=tree&node=act%2Fe1&persist=0&foo=1');
 assert.equal(routeHref(prev,{project:'x',view:'overview'}),'?project=x&view=overview&persist=0&foo=1','quita environment');
 assert.equal(routeHref('?project=x&view=storyboards&q=a',{project:'x',view:'storyboards',q:'b',f:'act:e1'}),'?project=x&view=storyboards&q=b&f=act:e1');
 assert.equal(historyStep(prev,{project:'x',view:'environment',environment:'a'}).method,'replace');assert.ok(sameEntry(prev,{project:'x',view:'environment',environment:'a'}));
 assert.ok(!sameEntry(prev,{project:'x',view:'environment',environment:'b'}));});

test('historial: historyState y entryScroll',()=>{
 const shots=parseRoute('?project=x&view=shots'),shotsSeq=parseRoute('?project=x&view=shots&sequence=s'),sbs=parseRoute('?project=x&view=storyboards'),sbsQ=parseRoute('?project=x&view=storyboards&q=a');
 assert.deepEqual(historyState(shots,[0,120]),{key:routeKey(shots),scroll:[0,120]});assert.equal(historyState(shots).key,historyState(shotsSeq).key);assert.equal(historyState(sbs).key,historyState(sbsQ).key);
 assert.ok(!('scroll' in historyState(shots)));assert.ok(!('scroll' in historyState(shots,[1,NaN])));assert.ok(!('scroll' in historyState(shots,['1',2])));
 assert.deepEqual(entryScroll(historyState(shots,[3,4]),shotsSeq),[3,4]);
 for(const st of [null,undefined,{},historyState(sbs,[3,4]),{key:routeKey(shots),scroll:[1,NaN]},{key:routeKey(shots),scroll:['1',2]},{key:routeKey(shots),scroll:[1]},{key:routeKey(shots)}])assert.equal(entryScroll(st,shots),null,JSON.stringify(st));});

test('historial: fuente',()=>{
 assert.ok(!src.includes('history.replaceState(null'));assert.equal(src.split('history.pushState(historyState').length,2,'un solo push de ruta');
 assert.equal(src.split("addEventListener('popstate'").length,2);assert.doesNotMatch(src,/if\(a==='open'\)[^}]*history\./,'open no escribe la URL a mano');
 for(const f of ['mountAnim(','mountRehearsal(','mountMontaje(','mountEnvironment(','mountGlb(','createStage(']){const i=src.indexOf('await '+(['mountEnvironment(','mountGlb('].includes(f)?'module.':'')+f);assert.ok(i>0,f);
  const rest=src.slice(i),g=rest.indexOf('generation!==renderGeneration'),a=rest.indexOf('stage=');assert.ok(g>0&&g<a,'guarda antes de stage= tras '+f);}
 assert.match(src,/commitRoute\(fromHistory\|\|replaceNext\?'replace':'auto'\);replaceNext=false;/);assert.match(src,/async function act\(action\)\{fromHistory=false;/);});

test('rutas: Montaje con lote y block (#65)',()=>{
 const q='?project=x&view=montaje&lote=l1&block=b2',r=parseRoute(q);assert.deepEqual([r.lote,r.block],['l1','b2']);assert.equal(routeQuery(r),q);
 assert.equal(routeQuery({project:'x',view:'montaje',lote:'l1',block:null}),'?project=x&view=montaje&lote=l1');
 const k=s=>routeKey(parseRoute(s));assert.equal(k(q),k('?project=x&view=montaje&lote=l1&block=b9'));assert.equal(k(q),k('?project=x&view=montaje&lote=l1'));assert.notEqual(k(q),k('?project=x&view=montaje&lote=l2&block=b2'));
 assert.equal(parseRoute('?project=x&view=tree&lote=a').lote,null);assert.equal(parseRoute('?project=x&view=shots&block=a').block,null);
 assert.equal(historyStep('?project=x&view=tree',r).method,'push');assert.equal(historyStep('?project=x&view=montaje&lote=l1&block=b1',r).method,'push','block en la ruta: la app reemplaza con syncRoute, no historyStep');
 assert.deepEqual(ROUTE_PARAMS.montaje,['lote','block']);assert.deepEqual(ROUTE_KEYS.slice(-2),['lote','block']);});

test('fuente: Montaje por ruta, sin montajeFocus (#65)',()=>{
 assert.ok(!src.includes('montajeFocus'));assert.ok(src.includes("goRoute({view:'montaje',lote:b"));assert.ok(src.includes('onWrite:()=>lazy.invalidate(p.id)'));assert.ok(src.includes('({lote:montajeLote,block:montajeBlock}=m.route())'));
 for(const x of ['montajeStart(','onRoute(','onWrite();','route:inUse'])assert.ok(mont.includes(x),'falta '+x);assert.ok(!mont.includes('focus?.lote'));
 assert.match(mont,/send=async verdict=>\{[^]*?b\.attempts=await api\('\/api\/lote-review'[^]*?onWrite\(\);/,'send llama a onWrite tras un veredicto correcto');});
