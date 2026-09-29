// #69: Apariciones por niveles. appearanceLevel (qué nivel se pinta para at), appearanceCrumbs (migas) y at en las rutas de personaje y ambiente.
// Fixture de #58 (textos inventados).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {relationIndex,relationCounters,appearanceTree,appearanceLevel,appearanceCrumbs,levelCrumbs,APPEARANCE_LEVELS,parseRoute,routeQuery,routeKey,ROUTE_KEYS} from '../app/workflow.mjs';
import {relProject} from './fixtures/relaciones.mjs';

const P=relProject(),I=relationIndex(P),ana=(current=false)=>appearanceTree(I,'character/ana',{current});
const keys=L=>L.path.map(a=>a.key),lv=(T,at,index=I)=>{const L=appearanceLevel(T,at,index);return [L.key,L.missing];};

test('appearanceLevel: raíz y niveles',()=>{
 const T=ana();
 for(const at of [null,'',undefined])assert.deepEqual(appearanceLevel(T,at,I),{key:null,node:null,path:[],missing:false},String(at));
 const want={'act/e1':['act/e1'],'seq/f1':['act/e1','seq/f1'],'sb/sb1':['act/e1','seq/f1','sb/sb1'],'scene/sb1/sc1':['act/e1','seq/f1','sb/sb1','scene/sb1/sc1'],'seq/c1':['act/e1','seq/f1','sb/sb1','seq/c1']};
 for(const [at,path] of Object.entries(want)){const L=appearanceLevel(T,at,I);assert.equal(L.key,at);assert.equal(L.node.key,at);assert.deepEqual(keys(L),path,at);assert.equal(L.missing,false);}
 assert.deepEqual([...APPEARANCE_LEVELS].sort(),['act','scene','sequence','story']);});

test('appearanceLevel: viñeta y plano van a su nivel sin aviso',()=>{
 const T=ana();
 for(const [at,want] of [['panel/P1','scene/sb1/sc1'],['shot/t1','scene/sb1/sc1'],['shot/t2','seq/c1'],['shot/t6','seq/f2'],['panel/P3','scene/sb2/sc2']])assert.deepEqual(lv(T,at),[want,false],at);
 assert.deepEqual(keys(appearanceLevel(T,'shot/t6',I)),['act/e2','seq/f2']);});

test('appearanceLevel: clave que no está en el árbol',()=>{
 const T=ana(true);
 for(const at of ['scene/sb1/sc1','panel/P1','sb/sb1'])assert.deepEqual(lv(T,at),['seq/f1',true],at);
 for(const at of ['scene/zz/zz','character/ana','basura','act/e9'])assert.deepEqual(lv(T,at),[null,true],at);
 assert.deepEqual(lv(T,'scene/sb1/sc1',null),[null,true],'sin índice, la raíz');
 const plaza=appearanceTree(I,'location/plaza',{current:false,inherited:false});
 assert.deepEqual(lv(plaza,'panel/P1'),['scene/sb1/sc1',true]);assert.deepEqual(lv(plaza,'seq/k1'),['seq/k1',false]);assert.deepEqual(lv(plaza,'seq/f2'),[null,true]);});

test('appearanceLevel: no muta ni lanza',()=>{
 const T=ana(),copy=structuredClone(T),n=I.nodes.size,l=I.links.length;
 for(const at of ['act/e1','panel/P1','scene/zz/zz',7,{},null])appearanceLevel(T,at,I);
 assert.deepEqual(T,copy);assert.equal(I.nodes.size,n);assert.equal(I.links.length,l);
 for(const t of [{roots:[]},null,undefined,{},{roots:[null,3,{key:'x',kind:'act'}]}])assert.doesNotThrow(()=>appearanceLevel(t,'act/e1',I));
 assert.deepEqual(appearanceLevel(null,'act/e1',I),{key:null,node:null,path:[],missing:true});
 assert.deepEqual(appearanceLevel({roots:[]},7,I),{key:null,node:null,path:[],missing:true});});

test('appearanceLevel no llama a relatedTo',()=>{
 const T=ana(),n=relationCounters.relatedTo;for(const at of ['act/e1','panel/P1','nada'])appearanceLevel(T,at,I);assert.equal(relationCounters.relatedTo,n);});

test('appearanceCrumbs: nombre enlazado y un paso por nivel',()=>{
 const r={view:'character',character:'ana'},T=ana();
 assert.deepEqual(appearanceCrumbs(P,r),levelCrumbs(P,r));assert.deepEqual(appearanceCrumbs(P,r,appearanceLevel(T,null,I)),levelCrumbs(P,r));
 const C=appearanceCrumbs(P,r,appearanceLevel(T,'scene/sb1/sc1',I));
 assert.deepEqual(C.map(c=>c.label),['Personajes y voces','Ana Ruiz','Acto I','Ficha uno','v1 · Uno','Escena uno']);
 assert.deepEqual(C.map(c=>c.route),[{view:'characters'},{view:'character',character:'ana'},{view:'character',character:'ana',at:'act/e1'},{view:'character',character:'ana',at:'seq/f1'},{view:'character',character:'ana',at:'sb/sb1'},null]);
 assert.deepEqual(C.slice(2).map(c=>c.kind),['act','sequence','story','scene']);
 const plaza=appearanceTree(I,'location/plaza',{current:false,inherited:false}),Lc=appearanceCrumbs(P,{view:'location',location:'plaza'},appearanceLevel(plaza,'seq/k1',I));
 assert.deepEqual(Lc.map(c=>[c.label,c.route]),[['Ambientes',{view:'locations'}],['Plaza',{view:'location',location:'plaza'}],['Acto I',{view:'location',location:'plaza',at:'act/e1'}],['Prueba',null]]);
 assert.deepEqual(appearanceCrumbs(P,{view:'character',character:'nadie'},appearanceLevel(T,'act/e1',I)),[]);assert.deepEqual(appearanceCrumbs({},r,null),[]);});

test('rutas: at en personaje y ambiente',()=>{
 assert.equal(parseRoute('?project=x&view=character&character=ana&at=seq%2Ff1').at,'seq/f1');assert.equal(parseRoute('?project=x&view=location&location=plaza&at=act%2Fe1').at,'act/e1');
 assert.equal(routeQuery({project:'x',view:'character',character:'ana',at:'seq/f1'}),'?project=x&view=character&character=ana&at=seq%2Ff1');
 for(const q of ['?project=x&view=character&character=ana&at=scene%2Fsb1%2Fsc1','?project=x&view=location&location=plaza&at=seq%2Fk1'])assert.equal(routeQuery(parseRoute(q)),q);
 for(const v of ['tree','storyboard','characters','environment'])assert.equal(parseRoute(`?project=x&view=${v}&at=seq%2Ff1`).at,null,v);
 assert.equal(routeQuery({project:'x',view:'tree',at:'seq/f1'}),'?project=x&view=tree');
 const k=q=>routeKey(parseRoute(q));assert.notEqual(k('?project=x&view=character&character=ana&at=act%2Fe1'),k('?project=x&view=character&character=ana&at=act%2Fe2'));
 assert.notEqual(k('?project=x&view=character&character=ana&at=act%2Fe1'),k('?project=x&view=character&character=ana'));assert.ok(ROUTE_KEYS.includes('at'));});

test('fuente: sin plegado ni «Desplegar/Plegar todo»',()=>{
 const src=fs.readFileSync(new URL('../app/app.source.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 for(const x of ['ap-open','ap-fold','appearanceOpen','details class="ap-node','Desplegar todo'])assert.ok(!src.includes(x),x);
 for(const x of ['.ap-node','.ap-kids'])assert.ok(!css.includes(x),x);
 for(const x of ['appearanceLevel(T,apAt,index)','appearanceCrumbs(p,','replaceNext=true'])assert.ok(src.includes(x),x);});
