// #70: imagen principal de las tarjetas (nodeImage, firstNodeImage) y columnas por tipo (CARD_COLUMNS, cardColumns).
import test from 'node:test';import assert from 'node:assert/strict';
import {relationIndex,nodeImage,firstNodeImage,CARD_COLUMNS,cardColumns} from '../app/workflow.mjs';
import {relProject} from './fixtures/relaciones.mjs';

// Viñeta, secuencia y plano del proyecto de relaciones por id.
const panels=p=>p.storyboards.flatMap(b=>b.sequences.flatMap(s=>s.shots)),panel=(p,id)=>panels(p).find(t=>t.id===id);
const seq=(p,id)=>p.episodes.flatMap(e=>e.sequences).find(s=>s.id===id),shot=(p,id)=>p.episodes.flatMap(e=>e.sequences.flatMap(s=>s.shots)).find(t=>t.id===id);
const img=(p,key)=>nodeImage(relationIndex(p),key);

test('nodeImage: viñeta usa render y, si no, boceto; sin ninguno, null',()=>{
 const p=relProject();Object.assign(panel(p,'P1'),{render:'r1.png',sketch:'s1.png'});panel(p,'P2').sketch='s2.png';
 assert.equal(img(p,'panel/P1'),'r1.png');assert.equal(img(p,'panel/P2'),'s2.png');assert.equal(img(p,'panel/P3'),null);});

test('nodeImage: escena toma la primera viñeta con imagen (salta las vacías)',()=>{
 const p=relProject();panel(p,'P2').sketch='s2.png';assert.equal(img(p,'scene/sb1/sc1'),'s2.png');
 panel(p,'P1').render='r1.png';assert.equal(img(p,'scene/sb1/sc1'),'r1.png');assert.equal(img(p,'scene/sb2/sc2'),null);});

test('nodeImage: story toma la primera escena con imagen e ignora su contenedor',()=>{
 const p=relProject();shot(p,'t2').preview={snapshot:'t2.png'};assert.equal(img(p,'seq/c1'),'t2.png');assert.equal(img(p,'sb/sb1'),null,'el contenedor no cuenta');
 panel(p,'P2').sketch='s2.png';assert.equal(img(p,'sb/sb1'),'s2.png');});

test('nodeImage: ficha con carátula gana; sin carátula, el story vigente; sin storys con imagen, sus planos propios',()=>{
 const p=relProject();panel(p,'P1').render='r1.png';assert.equal(img(p,'seq/f1'),'r1.png','sin vigente con imagen, el siguiente story');
 panel(p,'P3').render='r3.png';assert.equal(img(p,'seq/f1'),'r3.png','sb2 es la vigente aunque sb1 va antes');
 seq(p,'f1').cover='cover.png';assert.equal(img(p,'seq/f1'),'cover.png');
 assert.equal(img(p,'seq/f2'),null);shot(p,'t6').storyboardRender='t6.png';assert.equal(img(p,'seq/f2'),'t6.png');
 shot(p,'t5').preview={snapshot:'t5.png'};assert.equal(img(p,'seq/f2'),'t5.png');assert.equal(img(p,'seq/f3'),null);});

test('nodeImage: prueba y contenedor toman su primer plano con imagen',()=>{
 const p=relProject();panel(p,'P3').render='r3.png';assert.equal(img(p,'seq/k1'),'r3.png','t4 cuelga de P3');assert.equal(img(p,'seq/c2'),'r3.png');
 shot(p,'t2').storyboardRender='t2.png';assert.equal(img(p,'seq/c1'),'t2.png');panel(p,'P1').render='r1.png';assert.equal(img(p,'seq/c1'),'r1.png','t1 va antes');});

test('nodeImage: acto toma la primera ficha con imagen y no cuenta las pruebas',()=>{
 const p=relProject();shot(p,'t4').preview={snapshot:'t4.png'};assert.equal(img(p,'seq/k1'),'t4.png');assert.equal(img(p,'act/e1'),null);
 shot(p,'t5').preview={snapshot:'t5.png'};assert.equal(img(p,'act/e2'),'t5.png');
 seq(p,'f1').cover='f1.png';assert.equal(img(p,'act/e1'),'f1.png');});

test('nodeImage: plano preview.snapshot > storyboardRender > imagen de su viñeta; sin nada, null',()=>{
 const p=relProject(),t=shot(p,'t1');assert.equal(img(p,'shot/t1'),null);panel(p,'P1').sketch='s1.png';assert.equal(img(p,'shot/t1'),'s1.png');
 t.storyboardRender='sr.png';assert.equal(img(p,'shot/t1'),'sr.png');t.preview={snapshot:'pv.png'};assert.equal(img(p,'shot/t1'),'pv.png');
 t.preview={snapshot:''};assert.equal(img(p,'shot/t1'),'sr.png');t.preview='pv.png';assert.equal(img(p,'shot/t1'),'sr.png');});

test('nodeImage: personaje, ambiente y entorno usan image; valores no cadena o vacíos se ignoran; clave inexistente, null',()=>{
 const p=relProject();p.characters[0].image='ana.png';p.characters[1].image=['x.png'];p.locations[0].image='plaza.png';p.locations[1].image='';p.environments[0].image='env.png';p.environments[1].image=7;
 assert.deepEqual(['character/ana','character/beto','location/plaza','location/nave','environment/env-a','environment/env-b'].map(k=>img(p,k)),['ana.png',null,'plaza.png',null,'env.png',null]);
 panel(p,'P1').render={file:'x.png'};assert.equal(img(p,'panel/P1'),null);
 assert.equal(img(p,'panel/nada'),null);assert.equal(nodeImage(null,'panel/P1'),null);assert.equal(nodeImage({},'panel/P1'),null);assert.equal(nodeImage(relationIndex({}),'act/e1'),null);});

test('firstNodeImage: primera no nula en orden; lista vacía, null',()=>{
 const p=relProject();panel(p,'P2').sketch='s2.png';panel(p,'P3').render='r3.png';const I=relationIndex(p);
 assert.equal(firstNodeImage(I,['panel/P1','panel/P3','panel/P2']),'r3.png');assert.equal(firstNodeImage(I,['nada','panel/P2']),'s2.png');
 assert.equal(firstNodeImage(I,[]),null);assert.equal(firstNodeImage(I,null),null);assert.equal(firstNodeImage(I,['panel/P1']),null);});

test('nodeImage: memoriza por índice; un índice nuevo recalcula',()=>{
 const p=relProject(),I=relationIndex(p);assert.equal(nodeImage(I,'seq/f1'),null);panel(p,'P3').render='r3.png';
 p.characters[0].image='ana.png';
 assert.equal(nodeImage(I,'seq/f1'),null,'mismo índice, misma respuesta');assert.equal(nodeImage(I,'panel/P3'),null);assert.equal(nodeImage(I,'character/ana'),'ana.png','clave no pedida antes');
 p.revision++;assert.equal(nodeImage(relationIndex(p),'seq/f1'),'r3.png');});

test('CARD_COLUMNS: tabla de #70, enteros 1..5; cardColumns de un tipo desconocido, 3',()=>{
 assert.deepEqual({...CARD_COLUMNS},{act:5,group:5,test:5,scene:4,shot:4,story:4,'ap-level':4,ficha:3,'story-list':3,environment:3,'ap-leaf':3,panel:3,character:2,location:2});
 assert.ok(Object.isFrozen(CARD_COLUMNS));for(const [k,n] of Object.entries(CARD_COLUMNS)){assert.ok(Number.isInteger(n)&&n>=1&&n<=5,k);assert.equal(cardColumns(k),n);}
 for(const k of ['nada','toString','',undefined,null])assert.equal(cardColumns(k),3,String(k));});
