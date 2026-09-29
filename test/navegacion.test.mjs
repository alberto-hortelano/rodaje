// Navegación (#57): rutas con alias, árbol de la escaleta hasta los planos, migas y versión del story, vista Planos y cifras del proyecto.
// Puro sobre el fixture de #56, más comprobaciones de fuente (menú, vistas, renombrados) y estilo.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {VIEWS,VIEW_ALIASES,ROUTE_PARAMS,ROUTE_KEYS,routeView,parseRoute,routeQuery,routeKey,navActive,treeModel,treePath,treeOpenKeys,storyCrumbs,storyVersionOptions,setCurrentStory,shotGroups,projectStats,storyMigrationPlan} from '../app/workflow.mjs';
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
 const all='&episode=e&sequence=s&shot=t&storyboard=b&environment=n&character=h&location=l&scene=c&node=k';
 assert.deepEqual(parseRoute('?project=x&view=storyboard'+all),{project:'x',view:'storyboard',episode:null,sequence:null,shot:null,storyboard:'b',environment:null,character:null,location:null,scene:'c',node:null});
 assert.deepEqual(parseRoute('?project=x&view=shot'+all),{project:'x',view:'shot',episode:'e',sequence:'s',shot:'t',storyboard:null,environment:null,character:null,location:null,scene:null,node:null});
 assert.deepEqual(parseRoute('?project=x&view=shots'+all),{project:'x',view:'shots',episode:null,sequence:'s',shot:null,storyboard:null,environment:null,character:null,location:null,scene:null,node:null});
 assert.equal(parseRoute('?project=x&view=tree'+all).node,'k');assert.equal(parseRoute('?project=x&view=environment'+all).environment,'n');assert.equal(parseRoute('?project=x&view=rehearsal'+all).episode,'e');
 assert.deepEqual(Object.values(parseRoute('?project=x&view=overview'+all)).filter(Boolean),['x','overview']);
 assert.equal(parseRoute('?project=x&view=storyboard&storyboard=b&scene=').scene,null);});

test('rutas: routeQuery ida y vuelta y la forma de linea-base',()=>{
 assert.equal(routeQuery({project:'x',view:'environment',environment:'y'}),'?project=x&view=environment&environment=y');
 assert.equal(routeQuery({project:'x',view:'overview',episode:'e',storyboard:'b'}),'?project=x&view=overview');
 assert.equal(routeQuery({project:'x',view:'storyboard',storyboard:'b',scene:null}),'?project=x&view=storyboard&storyboard=b');
 assert.equal(routeQuery({project:'a b',view:'tree',node:'seq/x&y'}),'?project=a%20b&view=tree&node=seq%2Fx%26y');
 assert.equal(routeQuery({project:null,view:'library'}),'?view=library');
 for(const q of ['?project=x&view=shot&episode=e&sequence=s&shot=t','?project=x&view=storyboard&storyboard=b&scene=c','?project=x&view=tree&node=seq%2Fa','?project=x&view=shots&sequence=s','?project=x&view=anim&episode=e&sequence=s&shot=t','?project=x&view=rehearsal&episode=e','?view=jobs'])
  assert.equal(routeQuery(parseRoute(q)),q);
 assert.deepEqual(Object.keys(ROUTE_PARAMS).filter(v=>!VIEWS.includes(v)),[]);});

test('rutas: routeKey ignora scene, node y la secuencia de Planos',()=>{
 const k=q=>routeKey(parseRoute(q));
 assert.equal(k('?project=x&view=storyboard&storyboard=b&scene=c'),k('?project=x&view=storyboard&storyboard=b'));
 assert.notEqual(k('?project=x&view=storyboard&storyboard=b'),k('?project=x&view=storyboard&storyboard=b2'));
 assert.equal(k('?project=x&view=tree&node=seq/a'),k('?project=x&view=tree'));assert.equal(k('?project=x&view=shots&sequence=s'),k('?project=x&view=shots'));
 assert.notEqual(k('?project=x&view=shot&episode=e&sequence=s&shot=t'),k('?project=x&view=shot&episode=e&sequence=s2&shot=t'));
 assert.equal(k('?project=x&view=tree'),JSON.stringify(['x','tree']));assert.equal(routeKey({view:'library'}),JSON.stringify(['','library']));});

test('navActive: vistas de detalle marcan su lista',()=>{
 assert.deepEqual(['environment','storyboard','shot','anim','rehearsal','tree','overview','shots','jobs','library'].map(navActive),['environments','storyboards','shots','shots','shots','tree','overview','shots','jobs','library']);
 assert.deepEqual(['character','location','characters','locations'].map(navActive),['characters','locations','characters','locations']);});

test('rutas: páginas de personaje y de ambiente (#60)',()=>{
 const all='&episode=e&sequence=s&shot=t&storyboard=b&environment=n&character=h&location=l&scene=c&node=k';
 assert.deepEqual(parseRoute('?project=x&view=character'+all),{project:'x',view:'character',episode:null,sequence:null,shot:null,storyboard:null,environment:null,character:'h',location:null,scene:null,node:null});
 assert.deepEqual(parseRoute('?project=x&view=location'+all),{project:'x',view:'location',episode:null,sequence:null,shot:null,storyboard:null,environment:null,character:null,location:'l',scene:null,node:null});
 for(const v of ['tree','storyboard','shot','characters','locations','environment'])assert.deepEqual([parseRoute('?project=x&view='+v+all).character,parseRoute('?project=x&view='+v+all).location],[null,null],v);
 assert.equal(parseRoute('?project=x&view=character&character=').character,null);assert.equal(parseRoute('?view=character&character=h').view,'library');
 for(const q of ['?project=x&view=character&character=ana','?project=x&view=location&location=plaza%20mayor','?project=x&view=character'])assert.equal(routeQuery(parseRoute(q)),q);
 assert.equal(routeQuery({project:'x',view:'character',character:'a/b',location:'l'}),'?project=x&view=character&character=a%2Fb');
 const k=q=>routeKey(parseRoute(q));assert.notEqual(k('?project=x&view=character&character=a'),k('?project=x&view=character&character=b'));
 assert.notEqual(k('?project=x&view=location&location=a'),k('?project=x&view=location&location=b'));assert.equal(k('?project=x&view=location&location=a'),JSON.stringify(['x','location','a']));
 assert.deepEqual(ROUTE_KEYS.filter(x=>!Object.values(ROUTE_PARAMS).flat().includes(x)),[]);});

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

test('treePath y treeOpenKeys',()=>{
 const m=treeModel(withShots());
 assert.deepEqual(treePath(m,'scene/sb-v2/sb-v2-e1'),['act/e1','seq/x-colgado','sb/sb-v2','scene/sb-v2/sb-v2-e1']);
 assert.deepEqual(treePath(m,'seq/x-cruce'),['tests','seq/x-cruce']);assert.deepEqual(treePath(m,'act/e2'),['act/e2']);
 assert.deepEqual(treePath(m,'nada'),[]);assert.deepEqual(treePath(m,null),[]);
 assert.deepEqual(treeOpenKeys(m,null),['act/e1','act/e2']);assert.deepEqual(treeOpenKeys(m,'x'),['act/e1','act/e2']);
 assert.deepEqual(treeOpenKeys(m,[]),[]);assert.deepEqual(treeOpenKeys(m,['seq/x-colgado','borrado','tests']),['seq/x-colgado','tests']);});

test('storyCrumbs: con ficha, sin ficha, escena inexistente y story inexistente',()=>{
 const m=migrated(),r=c=>c.map(x=>[x.label,x.route]);
 assert.deepEqual(r(storyCrumbs(m,'sb-v2','sb-v2-e1')),[['Acto I',{view:'tree',node:'act/e1'}],['01 · Prólogo · El Colgado',{view:'tree',node:'seq/x-colgado'}],['Story v2',{view:'storyboard',storyboard:'sb-v2'}],['Camino',null]]);
 assert.deepEqual(r(storyCrumbs(m,'sb-v1','nada')),[['Acto I',{view:'tree',node:'act/e1'}],['01 · Prólogo · El Colgado',{view:'tree',node:'seq/x-colgado'}],['Story v1',null]]);
 assert.deepEqual(r(storyCrumbs(m,'sb-carga')).map(x=>x[0]),['Acto I','02 · Prólogo · La carga','Story v1']);
 const p=storysProject();assert.deepEqual(r(storyCrumbs(p,'sb-v1','sb-v1-e1')),[['Sin secuencia',{view:'tree',node:'unlinked'}],['Prólogo · El Colgado',{view:'storyboard',storyboard:'sb-v1'}],['Cruce',null]]);
 assert.deepEqual(r(storyCrumbs(p,'sb-v1')),[['Sin secuencia',{view:'tree',node:'unlinked'}],['Prólogo · El Colgado',null]]);
 assert.deepEqual(storyCrumbs(m,'nada','x'),[]);});

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
 for(const x of ["view==='tree'","view==='shots'",'navActive(view)','applyRoute(r)','parseRoute(location.search)','routeQuery(currentRoute())'])assert.ok(src.includes(x),'falta '+x);
 assert.match(reh,/>Secuencia<select data-scene>/);assert.doesNotMatch(reh,/>Escena<select/);assert.ok(mont.includes('<dt>Secuencia</dt>'));assert.ok(!mont.includes('<dt>Escena</dt>'));
 for(const x of ["'Sin escenario'","'+ Escenario'","'Escenarios'",'Sin escenario','Escenario al crear'])assert.ok(!src.includes(x),'queda '+x);
 for(const x of ['Escena 3D y tiempos · JSON','Escenario y cámara','Elemento del escenario','la viñeta del storyboard y la secuencia'])assert.ok(src.includes(x),'falta '+x);});

test('fuente: árbol perezoso, migas, versión, escena y posición sin esperar a las imágenes perezosas',()=>{
 assert.match(src,/#workspace img:not\(\[loading="lazy"\]\)/);
 for(const d of ['data-tree=','data-route','data-sb-version','data-sb-scene=','data-shots-seq=','data-loaded','class="tree-kids"','loading="lazy" class="tree-thumb"','aria-current="page"','aria-label="Ruta"'])assert.ok(src.includes(d),'falta '+d);
 for(const a of ["'tree-fold'","'sb-current:'","'shots:'","'tree:seq/'"])assert.ok(src.includes(a),'falta '+a);
 assert.match(src,/'rodaje-tree-'\+p\.id/);assert.match(src,/function bind\(root\)/);assert.match(src,/bind\(kids\)/);});

test('estilos: árbol, miniaturas, migas y foco',()=>{
 const rule=sel=>new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}').exec(css)?.[1]||'';
 assert.match(rule('.tree-thumb'),/aspect-ratio:16\/9/);assert.match(rule('.tree-thumb'),/width:96px/);assert.match(rule('.tree-thumb'),/object-fit:cover/);
 assert.match(rule('.tree-kids'),/margin-left:18px/);assert.match(rule('.tree-kids'),/border-left:1px solid var\(--line\)/);
 assert.match(rule('.crumbs ol'),/display:flex/);assert.match(rule('.crumbs li+li::before'),/content:'›'/);
 assert.match(rule('.tree-node>summary'),/list-style:none/);assert.match(rule('.tree-node>summary:focus-visible'),/outline/);
 assert.match(rule('.sb-seq.target'),/outline/);assert.match(css,/\.tree-node\[open\]>summary::before\{transform:rotate\(90deg\)\}/);});

test('fuente: rutas y tarjetas de personaje y ambiente (#60)',()=>{
 assert.match(src,/\['project','view',\.\.\.ROUTE_KEYS\]/);assert.ok(!src.includes('data-kind="${view}"'),'el selector de versión no usa la vista');
 assert.ok(src.includes("el.dataset.kind==='character'?p.characters:p.locations"));
 for(const x of ['const characterCard=','const locationCard=',"list.map(chars?characterCard:locationCard)","'rodaje-appear-all-'+p.id",'data-appear-all','/api/entity?project=',"'No existe el personaje '","'No existe el ambiente '"])assert.ok(src.includes(x),'falta '+x);});
