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

test('rutas: node es página',()=>{
 const k=q=>routeKey(parseRoute(q));
 assert.deepEqual(FOCUS_PARAMS,{storyboard:['scene'],shots:['sequence']});
 assert.notEqual(k('?project=x&view=tree&node=seq/a'),k('?project=x&view=tree'));assert.notEqual(k('?project=x&view=tree&node=seq/a'),k('?project=x&view=tree&node=act/e1'));
 assert.equal(k('?project=x&view=storyboard&storyboard=b&scene=c'),k('?project=x&view=storyboard&storyboard=b'));assert.equal(k('?project=x&view=shots&sequence=s'),k('?project=x&view=shots'));
 assert.equal(routeQuery(parseRoute('?project=x&view=tree&node=seq%2Fa')),'?project=x&view=tree&node=seq%2Fa');assert.equal(parseRoute('?project=x&view=outline&node=act/e1').node,'act/e1');});
