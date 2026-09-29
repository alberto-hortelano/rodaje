// Story, escena y viñeta por páginas (#68): página y ruta canónica, lista de escenas del story, mover viñetas entre escenas y opciones del menú.
// Puro sobre un story inventado de dos escenas y otro de una.
import test from 'node:test';import assert from 'node:assert/strict';
import {storyboardPage,storyScenes,movePanel,panelSceneOptions} from '../app/workflow.mjs';

const vin=(id,extra={})=>({id,code:id.toUpperCase(),title:'Viñeta '+id,duration:4,...extra});
const project=()=>({id:'x',storyboards:[
 {id:'b',title:'Story',sequences:[{id:'e1',title:'Camino',shots:[vin('a'),vin('b1'),vin('c')]},{id:'e2',title:'Llegada',shots:[vin('d')]},{id:'e3',title:'Vacía',shots:[]}]},
 {id:'o',title:'Otro',sequences:[{id:'o1',title:'Única',shots:[vin('z')]}]}]});
const ids=(p,sc)=>p.storyboards.flatMap(b=>b.sequences).find(s=>s.id===sc).shots.map(t=>t.id);
const R=(storyboard,scene=null,panel=null)=>({view:'storyboard',storyboard,scene,panel});

test('storyboardPage: story, escena y viñeta',()=>{
 const p=project(),b=p.storyboards[0];
 assert.deepEqual(storyboardPage(p,{storyboard:'b'}),{page:'story',storyboard:b,scene:null,panel:null,route:R('b'),missing:null});
 assert.deepEqual(storyboardPage(p,{storyboard:'b',scene:'e2'}),{page:'scene',storyboard:b,scene:b.sequences[1],panel:null,route:R('b','e2'),missing:null});
 assert.deepEqual(storyboardPage(p,{storyboard:'b',scene:'e1',panel:'c'}),{page:'panel',storyboard:b,scene:b.sequences[0],panel:b.sequences[0].shots[2],route:R('b','e1','c'),missing:null});});

test('storyboardPage: la viñeta manda',()=>{
 const p=project();
 for(const scene of ['e2',null,'','nada']){const r=storyboardPage(p,{storyboard:'b',scene,panel:'d'});assert.deepEqual([r.page,r.scene.id,r.route,r.missing],['panel','e2',R('b','e2','d'),null],String(scene));}
 const r=storyboardPage(p,{storyboard:'b',scene:'e1',panel:'z'});assert.deepEqual([r.page,r.route,r.missing],['scene',R('b','e1'),'No existe la viñeta: z'],'viñeta de otro story');
 assert.deepEqual(storyboardPage(p,{storyboard:'b',panel:'z'}).route,R('b'));});

test('storyboardPage: inexistentes, datos raros y sin mutar',()=>{
 const p=project(),before=structuredClone(p);
 assert.deepEqual(storyboardPage(p,{storyboard:'b',scene:'e1',panel:'nada'}).missing,'No existe la viñeta: nada');
 const s=storyboardPage(p,{storyboard:'b',scene:'nada'});assert.deepEqual([s.page,s.route,s.missing],['story',R('b'),'No existe la escena: nada']);
 assert.equal(storyboardPage(p,{storyboard:'b',scene:'nada',panel:'nada'}).missing,'No existe la viñeta: nada','el primer aviso se queda');
 const none={page:null,storyboard:null,scene:null,panel:null,route:{view:'storyboards'},missing:null};
 for(const [q,r] of [[p,{storyboard:'nada'}],[p,{}],[p,null],[{},{storyboard:'b'}],[null,{storyboard:'b'}],[{storyboards:[null,7]},{storyboard:'b'}]])assert.deepEqual(storyboardPage(q,r),none);
 const odd={storyboards:[{id:'b',sequences:[null,'x',{id:'e',shots:[null,{id:'t'}]}]}]};
 assert.equal(storyboardPage(odd,{storyboard:'b',panel:'t'}).page,'panel');assert.equal(storyboardPage({storyboards:[{id:'b'}]},{storyboard:'b',scene:'e'}).page,'story');
 assert.deepEqual(p,before);});

test('storyScenes: miniatura, recuentos y duración',()=>{
 const b={id:'b',sequences:[{id:'e1',title:'Uno',shots:[vin('a'),vin('b',{sketch:'s.png'}),vin('c',{render:'r.png'})]},null,{id:'e2',shots:[vin('d',{render:'r2.png',sketch:'s2.png',duration:'x'}),vin('e',{duration:null}),vin('f',{duration:2.5})]},{id:'e3'}]};
 assert.deepEqual(storyScenes(b).map(({scene,...x})=>x),[{id:'e1',title:'Uno',number:1,panels:3,seconds:12,thumb:'s.png'},{id:'e2',title:'e2',number:2,panels:3,seconds:2.5,thumb:'r2.png'},{id:'e3',title:'e3',number:3,panels:0,seconds:0,thumb:null}]);
 assert.equal(storyScenes(b)[0].scene,b.sequences[0]);assert.deepEqual(storyScenes(null),[]);assert.deepEqual(storyScenes({sequences:'x'}),[]);});

test('movePanel: entre escenas del mismo story',()=>{
 let p=project();assert.equal(movePanel(p,'a',{scene:'e2'}),true);assert.deepEqual([ids(p,'e1'),ids(p,'e2')],[['b1','c'],['d','a']]);
 p=project();assert.equal(movePanel(p,'c',{before:'a'}),true);assert.deepEqual(ids(p,'e1'),['c','a','b1']);
 p=project();assert.equal(movePanel(p,'a',{before:'c'}),true);assert.deepEqual(ids(p,'e1'),['b1','a','c']);
 p=project();assert.equal(movePanel(p,'a',{before:'d'}),true);assert.deepEqual([ids(p,'e1'),ids(p,'e2')],[['b1','c'],['a','d']]);
 p=project();assert.equal(movePanel(p,'d',{scene:'e3'}),true);assert.deepEqual([ids(p,'e2'),ids(p,'e3')],[[],['d']]);
 for(const [id,to] of [['a',{scene:'o1'}],['a',{before:'z'}],['a',{scene:'nada'}],['a',{before:'nada'}],['a',{before:'a'}],['a',{before:'b1'}],['c',{scene:'e1'}],['a',{}],['a',undefined]]){
  const q=project(),before=structuredClone(q);assert.equal(movePanel(q,id,to),false,id+' '+JSON.stringify(to));assert.deepEqual(q,before);}
 assert.throws(()=>movePanel(project(),'nada',{scene:'e1'}));});

test('panelSceneOptions',()=>{
 const p=project();
 assert.deepEqual(panelSceneOptions(p,'a'),[{id:'e2',label:'Llegada · 1 viñeta'},{id:'e3',label:'Vacía · 0 viñetas'}]);
 assert.deepEqual(panelSceneOptions(p,'d'),[{id:'e1',label:'Camino · 3 viñetas'},{id:'e3',label:'Vacía · 0 viñetas'}]);
 assert.deepEqual(panelSceneOptions(p,'z'),[]);assert.deepEqual(panelSceneOptions(p,'nada'),[]);assert.deepEqual(panelSceneOptions(null,'a'),[]);});
