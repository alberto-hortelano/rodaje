// viewer/plugins.mjs: rutas y opciones de viewer, estado inicial, botones y combinación de hooks de varios plugins.
import test from 'node:test';import assert from 'node:assert/strict';
import {esc,pluginPaths,viewerOptions,initialState,buttonHTML,combineHooks,defaultSpawn,framePose,CORE_ACTIONS,CORE_API,HOOKS} from '../viewer/plugins.mjs';

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
