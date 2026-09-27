// viewer/plugins.mjs: rutas y opciones de viewer, estado inicial, botones y combinación de hooks de varios plugins.
import test from 'node:test';import assert from 'node:assert/strict';
import {esc,pluginPaths,viewerOptions,initialState,buttonHTML,combineHooks,defaultSpawn,framePose,CORE_ACTIONS,CORE_API,HOOKS,assignExpose,checkWalker,walkOptions,handleKey,ignoresKeys,GLB_USERDATA,glbUserData,withGlbUserData,VIEW_VERSION,viewKey,persistEnabled,checkSerializable,buildSavedView,parseSavedView} from '../viewer/plugins.mjs';
import * as T from 'three';

test('pluginPaths y viewerOptions',()=>{
 for(const env of [{},{viewer:'a/explore.js'},{viewer:{camera:1}},{viewer:null},{viewer:['x.js']}])assert.deepEqual(pluginPaths(env),[],JSON.stringify(env));
 assert.deepEqual(pluginPaths({viewer:{plugins:['a.js',3,'',null,'b.mjs']}}),['a.js','b.mjs']);assert.deepEqual(pluginPaths(undefined),[]);
 assert.deepEqual(viewerOptions({viewer:'a/explore.js'}),{});assert.deepEqual(viewerOptions({}),{});
 assert.deepEqual(viewerOptions({viewer:{plugins:['a.js'],fov:40,walk:{eye:1.5}}}),{fov:40,walk:{eye:1.5}});});

test('initialState: copia de defaultState de los datos, sin respaldo del constructor',()=>{
 const data={defaultState:{a:1}},mod={DEFAULT_STATE:{b:2}};
 assert.deepEqual(initialState(data,mod),{a:1});assert.deepEqual(initialState({},mod),{});assert.deepEqual(initialState({}),{});assert.deepEqual(initialState(undefined),{});
 const s=initialState(data);s.a=9;assert.equal(data.defaultState.a,1);});

test('buttonHTML escapa y pone aria-pressed solo si es booleano',()=>{
 assert.equal(buttonHTML({a:'cut',text:'Corte: sin tejados',pressed:false}),'<button data-a="cut" aria-pressed="false">Corte: sin tejados</button>');
 assert.equal(buttonHTML({a:'x"y',text:'<b>&',pressed:true,primary:true}),'<button data-a="x&quot;y" class="primary" aria-pressed="true">&lt;b&gt;&amp;</button>');
 assert.equal(buttonHTML({a:'h',text:'Humo',pressed:'false'}),'<button data-a="h">Humo</button>');assert.equal(esc(null),'');});

test('combineHooks: eventos a todos en orden, primero gana, passable con cualquiera, expose',()=>{const log=[];
 const a={onBuild:m=>log.push('a'+m),onView:(m,c)=>log.push('av'+c.mode),overview:()=>undefined,spawn:()=>({position:[1,2,3],lookAt:[0,0,0]}),passable:o=>o==='puerta',expose:{setCut(){}}};
 const b={onBuild:m=>log.push('b'+m),onView:()=>log.push('bv'),overview:()=>({position:[0,0,1],target:[0,0,0]}),spawn:()=>({position:[9,9,9],lookAt:[0,0,0]}),passable:o=>o==='postigo',collision:()=>'rayos',expose:{ping:()=>'pong'},dispose:()=>log.push('fin')};
 const h=combineHooks([{file:'a.js',hooks:a},{file:'nada.js',hooks:undefined},{file:'b.js',hooks:b}]);
 h.onBuild(1);h.onView({},{mode:'walk'});h.onSky();h.onOverview();h.onFrame(0.1,{mode:'orbit'});h.dispose();
 assert.deepEqual(log,['a1','b1','avwalk','bv','fin']);
 assert.deepEqual(h.overview(),{position:[0,0,1],target:[0,0,0]});assert.deepEqual(h.spawn().position,[1,2,3]);assert.equal(h.collision({}),'rayos');
 assert.equal(h.passable('puerta'),true);assert.equal(h.passable('postigo'),true);assert.equal(h.passable('muro'),false);
 assert.deepEqual(Object.keys(h.expose),['setCut','ping']);assert.equal(h.expose.ping(),'pong');});

test('combineHooks: sin plugins, todo vacío',()=>{const h=combineHooks([]);assert.deepEqual(Object.keys(h),HOOKS);
 assert.equal(h.overview(),null);assert.equal(h.spawn(),null);assert.equal(h.collision({}),null);assert.equal(h.passable({}),false);assert.deepEqual(h.expose,{});h.onBuild();h.dispose();});

test('combineHooks: errores con el nombre del plugin',()=>{
 assert.throws(()=>combineHooks([{file:'p.js',hooks:{expose:{setView(){}}}}]),/p\.js expone setView/);
 for(const k of CORE_API)assert.throws(()=>combineHooks([{file:'p.js',hooks:{expose:{[k]:1}}}]),new RegExp('expone '+k));
 assert.throws(()=>combineHooks([{file:'q.js',hooks:{onClick(){}}}]),/q\.js declara un hook desconocido: onClick/);
 assert.throws(()=>combineHooks([{file:'r.js',hooks:{onBuild:1}}]),/r\.js: onBuild no es una función/);
 assert.throws(()=>combineHooks([{file:'s.js',hooks:{expose:()=>{}}}]),/s\.js: expose no es un objeto/);
 assert.throws(()=>combineHooks([{file:'t.js',hooks:3}]),/t\.js no devuelve un objeto/);
 assert.deepEqual(CORE_ACTIONS,['overview','preset','walk','noclip','fullscreen','capture','glb']);});

test('defaultSpawn: primer lugar con view y at',()=>{
 assert.deepEqual(defaultSpawn([{id:'a',at:[1,1,1]},{id:'b',view:[1,2,3],at:[4,5,6]},{id:'c',view:[0,0,0],at:[0,0,0]}]),{position:[1,2,3],lookAt:[4,5,6]});
 assert.deepEqual(defaultSpawn([]),{position:[0,1.6,30],lookAt:[0,1.5,0]});assert.deepEqual(defaultSpawn(undefined),{position:[0,1.6,30],lookAt:[0,1.5,0]});});

test('framePose: como viewer/glb.mjs; caja vacía en el origen',()=>{
 assert.deepEqual(framePose([-1,0,-2],[3,2,2]),{position:[1+3.6,1+2.8,0+4.4],target:[1,1,0]});
 assert.deepEqual(framePose([Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]),{position:[0.9,0.7,1.1],target:[0,0,0]});});

const walkerOf=(extra={})=>({keys:new Set(),noclip:false,eye:1.62,place(){},aim(){},look(){},update(){},walk(){return [0,0,0];},...extra});

test('combineHooks: walker del primero no nulo, validado',()=>{const log=[],w=walkerOf();
 const h=combineHooks([{file:'a.js',hooks:{walker:()=>{log.push('a');return null;}}},{file:'b.js',hooks:{walker:c=>{log.push('b'+c.x);return w;}}},{file:'c.js',hooks:{walker:()=>{log.push('c');return walkerOf();}}}]);
 assert.equal(h.walker({x:1}),w);assert.deepEqual(log,['a','b1']);assert.equal(combineHooks([]).walker({}),null);
 const {place,...sin}=walkerOf();assert.throws(()=>combineHooks([{file:'nave.js',hooks:{walker:()=>sin}}]).walker({}),/El plugin nave\.js: el caminante no tiene place/);});

test('checkWalker: contrato del caminante',()=>{const w=walkerOf({walkKeys:[' ','c']});assert.equal(checkWalker(w,'p.js'),w);
 const conGetter={...walkerOf(),get noclip(){return false;},set noclip(v){}};assert.equal(checkWalker(conGetter,'p.js'),conGetter);
 for(const [bad,re] of [[walkerOf({keys:[]}),/keys/],[walkerOf({eye:NaN}),/eye/],[{...walkerOf(),get noclip(){return false;}},/noclip/],[walkerOf({walkKeys:'wasd'}),/walkKeys/],[walkerOf({update:1}),/update/],[3,/p\.js/]])
  assert.throws(()=>checkWalker(bad,'p.js'),re);});

test('combineHooks: onKey y view paran en el primero que devuelve true; onMode a todos',()=>{const log=[];
 const h=combineHooks([{file:'a.js',hooks:{onKey:(k,c)=>{log.push('a'+k+c.mode);return k==='f'?1:false;},view:id=>{log.push('va'+id);return id==='x';},onMode:m=>log.push('ma'+m)}},
  {file:'b.js',hooks:{onKey:k=>{log.push('b'+k);return k==='f';},view:id=>{log.push('vb'+id);return true;},onMode:m=>log.push('mb'+m)}},
  {file:'c.js',hooks:{onKey:k=>{log.push('c'+k);return true;},view:()=>{log.push('vc');return true;}}}]);
 assert.equal(h.onKey('f',{down:true,mode:'walk'}),true);assert.deepEqual(log.splice(0),['afwalk','bf']);
 assert.equal(h.view('x',{mode:'orbit'}),true);assert.deepEqual(log.splice(0),['vax']);
 assert.equal(h.view('y',{mode:'orbit'}),true);assert.deepEqual(log.splice(0),['vay','vby']);
 h.onMode('walk');assert.deepEqual(log.splice(0),['mawalk','mbwalk']);
 const vacio=combineHooks([]);assert.equal(vacio.onKey('f',{}),false);assert.equal(vacio.view('x',{}),false);vacio.onMode('orbit');});

test('expose conserva getters; setNoclip y noclip son del visor',()=>{let n=0;
 const h=combineHooks([{file:'a.js',hooks:{expose:{get position(){return ++n;},ping:()=>'pong'}}}]);
 const target=assignExpose({setView(){}},h.expose);assert.equal(n,0);assert.equal(target.position,1);assert.equal(target.position,2);
 assert.deepEqual(Object.keys(target),['setView','position','ping']);assert.equal(target.ping(),'pong');
 for(const k of ['setNoclip','noclip']){assert.ok(CORE_API.includes(k));assert.throws(()=>combineHooks([{file:'p.js',hooks:{expose:{[k]:1}}}]),new RegExp('p\\.js expone '+k));assert.throws(()=>assignExpose({},{[k]:1}),new RegExp(k));}});

test('handleKey: campos de texto, onKey, modo y walkKeys',()=>{const log=[];
 const walker={keys:new Set()},onKey=(k,c)=>{log.push([k,c.down,c.mode]);return k==='f';};
 const ctx=mode=>({mode,onKey,walker,walkKeys:['w','q',' ','c']});
 for(const tag of ['INPUT','SELECT','TEXTAREA','input']){assert.equal(handleKey({key:'W',down:true,tag},ctx('walk')),false);}
 assert.equal(handleKey({key:'w',down:true,tag:'DIV',editable:true},ctx('walk')),false);assert.deepEqual(log,[]);assert.equal(walker.keys.size,0);
 walker.keys.add('w');assert.equal(handleKey({key:'W',down:false,tag:'SELECT'},ctx('walk')),false);assert.equal(walker.keys.has('w'),false,'keyup suelta la tecla aunque haya foco en un campo');
 assert.equal(handleKey({key:'F',down:true,tag:'CANVAS'},ctx('walk')),true);assert.equal(walker.keys.has('f'),false);assert.deepEqual(log.pop(),['f',true,'walk']);
 assert.equal(handleKey({key:'w',down:true},ctx('orbit')),false);assert.equal(walker.keys.size,0);
 for(const k of [' ','C','w'])assert.equal(handleKey({key:k,down:true},ctx('walk')),true,k);assert.deepEqual([...walker.keys],[' ','c','w']);
 assert.equal(handleKey({key:'e',down:true},ctx('walk')),false,'fuera de walkKeys');assert.equal(walker.keys.has('e'),false);
 assert.equal(handleKey({key:'C',down:false},ctx('walk')),false);assert.equal(walker.keys.has('c'),false);
 const w2={keys:new Set()};assert.equal(handleKey({key:'q',down:true},{mode:'walk',onKey:()=>false,walker:w2}),true,'sin walkKeys, las del paseo');
 assert.equal(ignoresKeys({tag:'BUTTON'}),false);assert.equal(ignoresKeys({tag:'textarea'}),true);});

test('walkOptions: valores por defecto, opciones y errores',()=>{
 assert.deepEqual(walkOptions({}),{step:0.3,radius:0.32});assert.deepEqual(walkOptions(undefined),{step:0.3,radius:0.32});
 assert.deepEqual(walkOptions({walk:{eye:1.5,radius:0.4}}),{step:0.3,radius:0.4,eye:1.5});
 assert.throws(()=>walkOptions({walk:{salto:1}}),/viewer\.walk\.salto/);assert.throws(()=>walkOptions({walk:{eye:'1'}}),/viewer\.walk\.eye/);
 assert.throws(()=>walkOptions({walk:{run:Infinity}}),/viewer\.walk\.run/);assert.throws(()=>walkOptions({walk:[1]}),/viewer\.walk/);});

test('glbUserData y withGlbUserData: solo las claves de GLB_USERDATA y restaura la raíz',async()=>{
 assert.deepEqual(GLB_USERDATA,['state','units']);
 const ud={units:'metres',ship:{x:[1]},state:{a:1}};assert.deepEqual(Object.keys(glbUserData(ud)),['units','state']);assert.deepEqual(glbUserData(undefined),{});
 const root={userData:ud};const r=await withGlbUserData(root,()=>{assert.deepEqual(root.userData,{units:'metres',state:{a:1}});return 'glb';});
 assert.equal(r,'glb');assert.equal(root.userData,ud);
 await assert.rejects(withGlbUserData(root,async()=>{throw Error('falla');}),/falla/);assert.equal(root.userData,ud);});

test('viewKey y persistEnabled',()=>{assert.equal(VIEW_VERSION,1);assert.equal(viewKey('dead-air','toledo'),'rodaje:visor:dead-air:toledo');
 assert.equal(persistEnabled({persist:false}),false);assert.equal(persistEnabled({search:'?persist=0'}),false);assert.equal(persistEnabled({search:'?project=a&persist=0'}),false);
 for(const search of ['','?persist=1','?x=0'])assert.equal(persistEnabled({search}),true,search);
 assert.equal(persistEnabled({persist:true,search:'?persist=0'}),false);assert.equal(persistEnabled(),true);assert.equal(persistEnabled({persist:undefined}),true);});

test('checkSerializable: planos sí; funciones, undefined, no finitos, instancias y ciclos no, con la ruta',()=>{
 const nulo=Object.create(null);nulo.a=[1,{b:'x'}];
 for(const v of [null,true,'a',0,-1.5,[],{},{a:[1,{b:[null,false]}]},nulo])assert.doesNotThrow(()=>checkSerializable(v),JSON.stringify(v));
 const ciclo={a:[]};ciclo.a.push(ciclo);
 for(const [v,re] of [[{a:[0,{b:()=>1}]},/\(function\) en \.a\[1\]\.b/],[{a:undefined},/\(undefined\) en \.a/],[{a:NaN},/NaN/],[[Infinity],/Infinity.*\[0\]/],[{a:1n},/bigint/],[{a:Symbol('s')},/symbol/],
  [{p:new T.Vector3()},/Vector3.*\.p/],[{m:new Map()},/Map/],[ciclo,/ciclo/],[undefined,/undefined/]])assert.throws(()=>checkSerializable(v),re,String(re));
 assert.throws(()=>checkSerializable({f(){}},'El plugin x.js: saveView'),/^Error: El plugin x\.js: saveView: valor no serializable \(function\) en \.f$/);});

const DATA={states:{luz:{label:'Luz',options:{on:'Encendida',off:'Apagada'}},puerta:{label:'Puerta',options:{abierta:'A',cerrada:'C'}}},defaultState:{luz:'on',puerta:'cerrada'}};
const vista=(extra={})=>({mode:'walk',position:[1,1.62,-2],quaternion:[0,0.5,0,0.5],target:[0,1,0],noclip:false,state:{luz:'off'},plugins:{'a.js':{x:1}},...extra});
test('buildSavedView y parseSavedView: ida y vuelta, cuaternión normalizado',()=>{
 const v=buildSavedView(vista());assert.deepEqual(Object.keys(v),['v','mode','camera','target','noclip','state','plugins']);assert.equal(v.v,1);
 const {quaternion:q,...r}=parseSavedView(JSON.stringify(v),{data:DATA,plugins:['a.js']});
 assert.deepEqual(r,{mode:'walk',position:[1,1.62,-2],target:[0,1,0],noclip:false,state:{luz:'off'},plugins:{'a.js':{x:1}}});
 [0,Math.SQRT1_2,0,Math.SQRT1_2].forEach((x,i)=>assert.ok(Math.abs(q[i]-x)<1e-12,String(q)));
 assert.throws(()=>buildSavedView(vista({plugins:{'a.js':{f:()=>1}}})),/no serializable \(function\) en \.plugins\.a\.js\.f/);});

test('parseSavedView: lo inválido da null sin lanzar; estado y plugins se filtran clave a clave',()=>{const ctx={data:DATA,plugins:['a.js','b.js']};
 const txt=o=>JSON.stringify({...buildSavedView(vista()),...o});
 for(const t of [null,undefined,3,'','{roto','null','[]',txt({v:2}),txt({mode:'map'}),txt({camera:{position:[NaN,0,0],quaternion:[0,0,0,1]}}),JSON.stringify({...buildSavedView(vista()),camera:{position:[0,0,0],quaternion:[0,0,0,0]}}),
  txt({camera:{position:[0,0],quaternion:[0,0,0,1]}}),txt({target:[0,0,'1']}),txt({noclip:undefined}),txt({noclip:'no'})])assert.equal(parseSavedView(t,ctx),null,String(t));
 assert.equal(parseSavedView(JSON.stringify({...buildSavedView(vista()),camera:{position:[0,0,0],quaternion:[1e-9,0,0,0]}}),ctx),null,'norma < 1e-6');
 const r=parseSavedView(txt({state:{luz:'fantasma',puerta:'abierta',otra:'x',n:1},plugins:{'a.js':42,'otro.js':{},'b.js':null}}),ctx);
 assert.deepEqual(r.state,{puerta:'abierta'});assert.deepEqual(r.plugins,{'a.js':42,'b.js':null});
 assert.deepEqual(parseSavedView(txt({state:'x',plugins:[1]}),ctx).state,{});assert.deepEqual(parseSavedView(txt({plugins:'x'}),ctx).plugins,{});
 assert.deepEqual(parseSavedView(txt({state:{toString:'off'}}),{data:{}}).state,{});assert.deepEqual(parseSavedView(txt({}),{data:DATA}).plugins,{});});

test('initialState: mezcla el estado guardado sin mutar',()=>{const saved={state:{luz:'off'}};
 const s=initialState(DATA,saved);assert.deepEqual(s,{luz:'off',puerta:'cerrada'});assert.deepEqual(DATA.defaultState,{luz:'on',puerta:'cerrada'});assert.deepEqual(saved.state,{luz:'off'});
 assert.deepEqual(initialState(DATA,null),{luz:'on',puerta:'cerrada'});assert.deepEqual(initialState(undefined,{state:{a:1}}),{a:1});});

test('combineHooks: saveView por ruta y restoreView con su parte',()=>{
 assert.deepEqual(HOOKS.slice(-2),['saveView','restoreView']);assert.deepEqual(Object.keys(combineHooks([])),HOOKS);
 const log=[];
 const h=combineHooks([{file:'a.js',hooks:{saveView:()=>({x:[1,{y:'z'}]}),restoreView:(s,c)=>log.push(['a',s,c.mode])}},{file:'b.js',hooks:{saveView:()=>undefined,restoreView:s=>{log.push(['b',s]);throw Error('roto');}}},
  {file:'c.js',hooks:{restoreView:s=>log.push(['c',s])}},{file:'d.js',hooks:{saveView:()=>0}}]);
 assert.deepEqual(h.saveView(),{'a.js':{x:[1,{y:'z'}]},'d.js':0});
 const errs=h.restoreView({'a.js':1,'b.js':undefined,'otro.js':2},{mode:'walk'});
 assert.deepEqual(log,[['a',1,'walk'],['b',undefined]]);assert.equal(errs.length,1);assert.equal(errs[0].file,'b.js');assert.match(errs[0].error.message,/roto/);
 assert.deepEqual(h.restoreView(null,{mode:'orbit'}),[]);assert.deepEqual(combineHooks([]).saveView(),{});assert.deepEqual(combineHooks([]).restoreView({},{}),[]);
 assert.throws(()=>combineHooks([{file:'m.js',hooks:{saveView:()=>({v:new T.Vector3()})}}]).saveView(),/^Error: El plugin m\.js: saveView: valor no serializable \(Vector3\) en \.v$/);
 assert.throws(()=>combineHooks([{file:'m.js',hooks:{saveView:()=>({v:NaN})}}]).saveView(),/El plugin m\.js: saveView/);
 for(const k of ['saveView','restoreView'])assert.throws(()=>combineHooks([{file:'r.js',hooks:{[k]:{}}}]),new RegExp('r\\.js: '+k+' no es una función'));
 assert.ok(CORE_API.includes('saveView'));assert.throws(()=>combineHooks([{file:'p.js',hooks:{expose:{saveView(){}}}}]),/p\.js expone saveView/);assert.throws(()=>assignExpose({},{saveView:1}),/saveView/);});
