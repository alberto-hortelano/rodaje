// Escaleta por niveles (#67): ruta de cada nivel, resolución de node (páginas, redirecciones y claves inexistentes), migas únicas y rutas.
// Puro sobre el fixture de #56 (textos inventados).
import test from 'node:test';import assert from 'node:assert/strict';
import {FOCUS_PARAMS,parseRoute,routeQuery,routeKey,treeModel,levelRoute,levelResolve,levelKey,levelCrumbs,LEVEL_ROOT,storyMigrationPlan} from '../app/workflow.mjs';
import {storysProject,storysSpec,planShot} from './fixtures/escaleta-storys.mjs';

const migrated=()=>storyMigrationPlan(storysProject(),storysSpec()).next;
const seq=(p,id)=>p.episodes.flatMap(e=>e.sequences).find(s=>s.id===id);
// Con un plano del contenedor de v2 sin viñeta (huérfanos) y un story sin ficha.
const withShots=()=>{const m=migrated();seq(m,'x-v2').shots.push(planShot('p9','no-es-vineta'));
 m.storyboards.push({id:'sb-suelto',title:'Suelto',sequences:[{id:'su-e1',title:'Patio',location:'otro',shots:[{id:'su1',code:'Z09',title:'Mirada',duration:3,cast:[],dialogue:[]}]}]});return m;};
const lr=c=>c.map(x=>[x.label,x.route]);
// withShots con un plano propio en x-prologo.
const withOwn=()=>{const m=withShots();seq(m,'x-prologo').shots.push(planShot('pp'));return m;};
const HEAD=[['Escaleta',{view:'tree'}],['Acto I',{view:'tree',node:'act/e1'}],['01 · Prólogo · El Colgado',{view:'tree',node:'seq/x-colgado'}]];

test('levelRoute: acto, ficha, prueba y grupos son páginas de la Escaleta; story, escena y planos sin viñeta van a su vista',()=>{
 const m=treeModel(withShots());
 for(const k of ['act/e1','seq/x-colgado','seq/x-cruce','tests','unlinked'])assert.deepEqual(levelRoute(m,k),{view:'tree',node:k},k);
 assert.deepEqual(levelRoute(m,'sb/sb-v2'),{view:'storyboard',storyboard:'sb-v2'});
 assert.deepEqual(levelRoute(m,'scene/sb-v2/sb-v2-e1'),{view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1'});
 assert.deepEqual(levelRoute(m,'orphans/sb-v2'),{view:'shots',sequence:'x-v2'});
 assert.equal(levelRoute(m,'nada'),null);assert.equal(levelRoute(m,null),null);assert.equal(levelRoute({},'act/e1'),null);});

test('levelResolve: raíz, existentes, nivel superior y aviso',()=>{
 const m=treeModel(withShots()),root={key:null,route:{view:'tree'}};
 for(const k of [null,undefined,''])assert.deepEqual(levelResolve(m,k),{...root,missing:false});
 assert.deepEqual(levelResolve(m,'seq/x-colgado'),{key:'seq/x-colgado',route:{view:'tree',node:'seq/x-colgado'},missing:false});
 assert.deepEqual(levelResolve(m,'sb/sb-v1'),{key:'sb/sb-v1',route:{view:'storyboard',storyboard:'sb-v1'},missing:false});
 assert.deepEqual(levelResolve(m,'scene/sb-v2/nada'),{key:'sb/sb-v2',route:{view:'storyboard',storyboard:'sb-v2'},missing:true});
 assert.deepEqual(levelResolve(m,'orphans/sb-v1'),{key:'sb/sb-v1',route:{view:'storyboard',storyboard:'sb-v1'},missing:true},'v1 no tiene huérfanos');
 for(const k of ['sb/nada','seq/nada','nada','scene/nada/x','orphans/nada',7])assert.deepEqual(levelResolve(m,k),{...root,missing:true},String(k));
 assert.doesNotThrow(()=>levelResolve({},'act/e1'));assert.deepEqual(levelResolve({},'act/e1'),{...root,missing:true});assert.deepEqual(levelResolve(undefined,'x'),{...root,missing:true});});

test('levelCrumbs: Escaleta, acto, ficha, prueba, Pruebas y Sin secuencia',()=>{
 const p=withShots(),c=node=>lr(levelCrumbs(p,{view:'tree',node}));
 assert.deepEqual(LEVEL_ROOT,{key:null,kind:'root',label:'Escaleta',route:{view:'tree'}});
 assert.deepEqual(c(null),[['Escaleta',null]]);assert.deepEqual(c('nada'),[['Escaleta',null]]);
 assert.deepEqual(c('act/e1'),[['Escaleta',{view:'tree'}],['Acto I',null]]);
 assert.deepEqual(c('seq/x-colgado'),[['Escaleta',{view:'tree'}],['Acto I',{view:'tree',node:'act/e1'}],['01 · Prólogo · El Colgado',null]]);
 assert.deepEqual(c('seq/x-cruce'),[['Escaleta',{view:'tree'}],['Pruebas',{view:'tree',node:'tests'}],['Prueba 3D · El cruce',null]]);
 assert.deepEqual(c('tests'),[['Escaleta',{view:'tree'}],['Pruebas',null]]);assert.deepEqual(c('unlinked'),[['Escaleta',{view:'tree'}],['Sin secuencia',null]]);
 assert.deepEqual(levelCrumbs(p,{view:'tree',node:'seq/x-colgado'}).map(x=>[x.key,x.kind]),[[null,'root'],['act/e1','act'],['seq/x-colgado','ficha']]);});

test('levelCrumbs: story con ficha y escena, sin ficha, escena inexistente y story inexistente',()=>{
 const m=migrated(),c=(p,storyboard,scene)=>lr(levelCrumbs(p,{view:'storyboard',storyboard,scene}));
 const head=[['Escaleta',{view:'tree'}],['Acto I',{view:'tree',node:'act/e1'}],['01 · Prólogo · El Colgado',{view:'tree',node:'seq/x-colgado'}]];
 assert.deepEqual(c(m,'sb-v2','sb-v2-e1'),[...head,['Story v2',{view:'storyboard',storyboard:'sb-v2'}],['Camino',null]]);
 assert.deepEqual(c(m,'sb-v1','nada'),[...head,['Story v1',null]]);
 assert.deepEqual(c(m,'sb-carga').map(x=>x[0]),['Escaleta','Acto I','02 · Prólogo · La carga','Story v1']);
 const p=storysProject();
 assert.deepEqual(c(p,'sb-v1','sb-v1-e1'),[['Escaleta',{view:'tree'}],['Sin secuencia',{view:'tree',node:'unlinked'}],['Prólogo · El Colgado',{view:'storyboard',storyboard:'sb-v1'}],['Cruce',null]]);
 assert.deepEqual(c(p,'sb-v1'),[['Escaleta',{view:'tree'}],['Sin secuencia',{view:'tree',node:'unlinked'}],['Prólogo · El Colgado',null]]);
 assert.deepEqual(levelCrumbs(m,{view:'storyboard',storyboard:'nada',scene:'x'}),[]);
 assert.equal(levelKey(m,{view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1'},treeModel(m)),'scene/sb-v2/sb-v2-e1');
 assert.equal(levelKey(m,{view:'storyboard',storyboard:'sb-v2',scene:'nada'},treeModel(m)),'sb/sb-v2');
 assert.equal(levelKey(m,{view:'tree',node:'nada'},treeModel(m)),null);assert.equal(levelKey(m,{view:'shots'},treeModel(m)),null);});

test('levelCrumbs: personaje y ambiente',()=>{
 const m=migrated();
 assert.deepEqual(levelCrumbs(m,{view:'character',character:'ana'}),[{key:'character/ana',kind:'list',label:'Personajes y voces',route:{view:'characters'}},{key:'character/ana',kind:'character',label:'Ana',route:null}]);
 assert.deepEqual(lr(levelCrumbs(m,{view:'location',location:'loc'})),[['Ambientes',{view:'locations'}],['Loc',null]]);
 assert.deepEqual(levelCrumbs(m,{view:'character',character:'nada'}),[]);assert.deepEqual(levelCrumbs(m,{view:'location',location:null}),[]);
 for(const view of ['shots','overview','storyboards','characters'])assert.deepEqual(levelCrumbs(m,{view}),[],view);
 assert.deepEqual(levelCrumbs({},{view:'character',character:'ana'}),[]);});

test('levelCrumbs y levelKey no mutan y aceptan el modelo ya construido',()=>{
 const p=withShots(),before=structuredClone(p),model=treeModel(p);
 for(const r of [{view:'tree',node:'seq/x-colgado'},{view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1'},{view:'tree',node:'unlinked'},{view:'tree'}]){
  assert.deepEqual(levelCrumbs(p,r,model),levelCrumbs(p,r));levelKey(p,r,model);levelResolve(model,r.node);}
 assert.deepEqual(p,before);levelCrumbs(p,{view:'tree'})[0].label='x';assert.equal(LEVEL_ROOT.label,'Escaleta');});

test('rutas: node, scene y panel son página',()=>{
 const k=q=>routeKey(parseRoute(q));
 assert.deepEqual(FOCUS_PARAMS,{shots:['sequence']});
 assert.notEqual(k('?project=x&view=tree&node=seq/a'),k('?project=x&view=tree'));assert.notEqual(k('?project=x&view=tree&node=seq/a'),k('?project=x&view=tree&node=act/e1'));
 const sb='?project=x&view=storyboard&storyboard=b';assert.equal(new Set([sb,sb+'&scene=c',sb+'&scene=c&panel=v']).size,3);assert.equal(new Set([k(sb),k(sb+'&scene=c'),k(sb+'&scene=c&panel=v')]).size,3);
 assert.equal(routeQuery(parseRoute(sb+'&scene=c&panel=v')),sb+'&scene=c&panel=v');assert.equal(routeQuery(parseRoute(sb+'&panel=v&scene=c')),sb+'&scene=c&panel=v');
 for(const v of ['tree','shot','anim','shots','character'])assert.equal(parseRoute('?project=x&view='+v+'&panel=v').panel,null,v);
 assert.equal(k('?project=x&view=shots&sequence=s'),k('?project=x&view=shots'));
 assert.equal(routeQuery(parseRoute('?project=x&view=tree&node=seq%2Fa')),'?project=x&view=tree&node=seq%2Fa');assert.equal(parseRoute('?project=x&view=outline&node=act/e1').node,'act/e1');});

test('treeModel: viñetas y planos fuera del índice (#68)',()=>{
 const p=withOwn(),before=structuredClone(p),m=treeModel(p);assert.deepEqual(p,before);
 const sc=m.index.get('scene/sb-v2/sb-v2-e1').node,e=m.panels.get('panel/v2a');
 assert.equal(e.parent,'scene/sb-v2/sb-v2-e1');assert.equal(e.node,sc.panels[0]);assert.deepEqual([e.node.key,e.node.kind,e.node.storyboard.id,e.node.scene.id,e.node.panel.id],['panel/v2a','panel','sb-v2','sb-v2-e1','v2a']);
 assert.deepEqual([...m.panels.keys()],['panel/v1a','panel/v1b','panel/v2a','panel/v2b','panel/v2c','panel/ca','panel/cb','panel/cc','panel/su1']);
 const par=k=>m.shots.get(k)?.parent;
 assert.deepEqual(['shot/p3','shot/p9','shot/pp','shot/p8'].map(par),['panel/v2a','orphans/sb-v2','seq/x-prologo','seq/x-cruce']);
 assert.deepEqual((({key,kind,number,role})=>({key,kind,number,role}))(m.shots.get('shot/p9').node),{key:'shot/p9',kind:'shot',number:4,role:'container'});
 assert.equal(m.shots.get('shot/p3').node.episode.id,'e1');assert.equal(m.shots.get('shot/p3').node.sequence.id,'x-v2');
 assert.ok([...m.index.keys()].every(k=>!/^(panel|shot)\//.test(k)),'el índice no cambia');
 // La viñeta gana a la prueba; con ids repetidos, la primera aparición.
 const q=withOwn();seq(q,'x-cruce').shots[0].storyboardShot='v2b';q.storyboards[2].sequences[0].shots.push({id:'v2a',code:'Z',title:'Otra'});
 const n=treeModel(q);assert.equal(n.shots.get('shot/p8').parent,'panel/v2b');assert.equal(n.panels.get('panel/v2a').node.panel.code,'A01');
 assert.deepEqual(treeModel({}).panels,new Map());assert.deepEqual(treeModel({}).shots,new Map());});

test('levelRoute y levelResolve con viñeta y plano (#68)',()=>{
 const m=treeModel(withOwn());
 assert.deepEqual(levelRoute(m,'panel/v2b'),{view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1',panel:'v2b'});
 assert.deepEqual(levelRoute(m,'shot/p3'),{view:'shot',episode:'e1',sequence:'x-v2',shot:'p3'});assert.deepEqual(levelRoute(m,'shot/p8'),{view:'shot',episode:'e1',sequence:'x-cruce',shot:'p8'});
 assert.deepEqual(levelResolve(m,'panel/v2b'),{key:'panel/v2b',route:levelRoute(m,'panel/v2b'),missing:false});assert.deepEqual(levelResolve(m,'shot/p9'),{key:'shot/p9',route:levelRoute(m,'shot/p9'),missing:false});
 for(const k of ['panel/nada','shot/nada'])assert.deepEqual(levelResolve(m,k),{key:null,route:{view:'tree'},missing:true},k);
 assert.equal(levelRoute({index:new Map()},'panel/v2a'),null);});

test('levelKey con viñeta, plano y Animación (#68)',()=>{
 const p=withOwn(),m=treeModel(p),k=r=>levelKey(p,r,m);
 assert.equal(k({view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1',panel:'v2a'}),'panel/v2a');
 assert.equal(k({view:'storyboard',storyboard:'sb-v1',scene:'sb-v1-e1',panel:'v2a'}),'scene/sb-v1/sb-v1-e1','viñeta de otro story: su escena');
 assert.equal(k({view:'storyboard',storyboard:'sb-v1',panel:'v2a'}),'sb/sb-v1');assert.equal(k({view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1',panel:'nada'}),'scene/sb-v2/sb-v2-e1');
 for(const view of ['shot','anim']){assert.equal(k({view,episode:'e1',sequence:'x-v2',shot:'p3'}),'shot/p3');assert.equal(k({view,shot:'nada'}),null);assert.equal(k({view}),null);}});

test('levelCrumbs del estudio: con viñeta, sin viñeta, propio, prueba, fuera del árbol e inexistente (#68)',()=>{
 const p=withOwn(),c=shot=>lr(levelCrumbs(p,{view:'shot',shot}));
 assert.deepEqual(c('p3'),[...HEAD,['Story v2',{view:'storyboard',storyboard:'sb-v2'}],['Camino',{view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1'}],['A01 · Viñeta A01',{view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1',panel:'v2a'}],['P01 · p3',null]]);
 assert.deepEqual(c('p9'),[...HEAD,['Story v2',{view:'storyboard',storyboard:'sb-v2'}],['Planos sin viñeta',{view:'shots',sequence:'x-v2'}],['P04 · p9',null]]);
 assert.deepEqual(c('pp'),[...HEAD.slice(0,2),['02 · Prólogo · La carga',{view:'tree',node:'seq/x-prologo'}],['P01 · pp',null]]);
 assert.deepEqual(c('p8'),[['Escaleta',{view:'tree'}],['Pruebas',{view:'tree',node:'tests'}],['Prueba 3D · El cruce',{view:'tree',node:'seq/x-cruce'}],['P01 · p8',null]]);
 assert.deepEqual(levelCrumbs(p,{view:'shot',shot:'p3'}).at(-1),{key:'shot/p3',kind:'shot',label:'P01 · p3',route:null});
 // Fuera del árbol (no está en model.shots): Planos › plano, buscando en la secuencia de la ruta y, si no, en todas.
 const bare={...treeModel(p),shots:new Map()},loose=[{key:'shots',kind:'list',label:'Planos',route:{view:'shots',sequence:'x-v2'}},{key:'shot/p4',kind:'shot',label:'P02 · p4',route:null}];
 assert.deepEqual(levelCrumbs(p,{view:'shot',episode:'e1',sequence:'x-v2',shot:'p4'},bare),loose);assert.deepEqual(levelCrumbs(p,{view:'shot',sequence:'otra',shot:'p4'},bare),loose);
 assert.deepEqual(levelCrumbs(p,{view:'anim',sequence:'x-v2',shot:'p4'},bare).map(x=>[x.label,x.route]),[['Planos',{view:'shots',sequence:'x-v2'}],['P02 · p4',{view:'shot',episode:'e1',sequence:'x-v2',shot:'p4'}],['Animación',null]]);
 assert.deepEqual(levelCrumbs(p,{view:'shot',shot:'nada'}),[]);assert.deepEqual(levelCrumbs(p,{view:'shot'}),[]);assert.deepEqual(levelCrumbs({},{view:'shot',shot:'p3'}),[]);});

test('levelCrumbs de Animación: la miga del plano enlaza al estudio y detrás «Animación» (#68)',()=>{
 const p=withOwn(),c=shot=>lr(levelCrumbs(p,{view:'anim',episode:'e1',sequence:'x-cruce',shot}));
 assert.deepEqual(c('p8'),[['Escaleta',{view:'tree'}],['Pruebas',{view:'tree',node:'tests'}],['Prueba 3D · El cruce',{view:'tree',node:'seq/x-cruce'}],['P01 · p8',{view:'shot',episode:'e1',sequence:'x-cruce',shot:'p8'}],['Animación',null]]);
 assert.deepEqual(levelCrumbs(p,{view:'anim',shot:'p8'}).at(-1),{key:'anim/p8',kind:'anim',label:'Animación',route:null});
 assert.deepEqual(levelCrumbs(p,{view:'anim',shot:'nada'}),[]);});

test('levelCrumbs de la viñeta (#68)',()=>{
 const p=withOwn(),c=r=>lr(levelCrumbs(p,{view:'storyboard',...r}));
 assert.deepEqual(c({storyboard:'sb-v2',scene:'sb-v2-e1',panel:'v2b'}),[...HEAD,['Story v2',{view:'storyboard',storyboard:'sb-v2'}],['Camino',{view:'storyboard',storyboard:'sb-v2',scene:'sb-v2-e1'}],['A02 · Viñeta A02',null]]);
 assert.deepEqual(c({storyboard:'sb-suelto',scene:'su-e1',panel:'su1'}).map(x=>x[0]),['Escaleta','Sin secuencia','Suelto','Patio','Z09 · Mirada']);});
