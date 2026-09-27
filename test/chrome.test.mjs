// lib/chrome.mjs: único lanzador de Chrome (issue #6). Sin lanzar Chrome.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {CHROME_DEFAULT,CHROME_ARGS,VIEWPORTS,FIXED_NOW,chromePath,chromeArgs,launchOptions,contextOptions,withChrome,newRenderContext,pinClock} from '../lib/chrome.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const ARGS=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'];

test('chromeArgs: lista exacta, copia nueva y extras sin duplicados',()=>{
 assert.deepEqual(chromeArgs(),ARGS);assert.deepEqual([...CHROME_ARGS],ARGS);assert.ok(Object.isFrozen(CHROME_ARGS));
 const a=chromeArgs();a.push('--x');assert.deepEqual(chromeArgs(),ARGS);assert.notEqual(chromeArgs(),chromeArgs());
 assert.deepEqual(chromeArgs(['--use-gl=angle','--no-sandbox','--use-gl=angle']),[...ARGS,'--use-gl=angle']);
});
test('chromePath: CHROME_PATH o /usr/bin/google-chrome (vacío = por defecto)',()=>{
 assert.equal(CHROME_DEFAULT,'/usr/bin/google-chrome');
 assert.equal(chromePath({}),CHROME_DEFAULT);assert.equal(chromePath({CHROME_PATH:''}),CHROME_DEFAULT);assert.equal(chromePath({CHROME_PATH:'/opt/chrome'}),'/opt/chrome');
});
test('launchOptions y contextOptions exactos',()=>{
 assert.deepEqual(launchOptions({env:{}}),{executablePath:CHROME_DEFAULT,headless:true,args:ARGS});
 assert.deepEqual(launchOptions({env:{CHROME_PATH:'/c'},extraArgs:['--use-gl=angle'],headless:false}),{executablePath:'/c',headless:false,args:[...ARGS,'--use-gl=angle']});
 assert.equal('viewport' in launchOptions({env:{}}),false);
 const o=contextOptions(VIEWPORTS.guia);assert.deepEqual(o,{viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'});
 o.viewport.width=1;assert.equal(VIEWPORTS.guia.width,1280);
});
test('VIEWPORTS: el tamaño de cada llamador no cambia y cada uno usa su clave',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(VIEWPORTS)),{preview:{width:1280,height:720},guia:{width:1280,height:720},captura:{width:1400,height:1300},recorrido:{width:1500,height:1100},lineaBase:{width:1280,height:800}});
 assert.ok(Object.isFrozen(VIEWPORTS));for(const v of Object.values(VIEWPORTS))assert.ok(Object.isFrozen(v));
 const uses={'app/jobs.mjs':'preview','scripts/bloques/render.mjs':'guia','scripts/entornos/capturar.mjs':'captura','scripts/entornos/recorrer.mjs':'recorrido','scripts/linea-base.mjs':'lineaBase'};
 for(const [f,k] of Object.entries(uses)){const s=src(f);assert.match(s,new RegExp(`VIEWPORTS\\.${k}\\b`),f);assert.match(s,/withChrome\(/,f);}
 // El reloj se fija en los renders de stage, nunca en los entornos (el paseo usa el dt real).
 for(const f of ['app/jobs.mjs','scripts/bloques/render.mjs','scripts/linea-base.mjs'])assert.match(src(f),/pinClock\(/,f);
 for(const f of ['scripts/entornos/capturar.mjs','scripts/entornos/recorrer.mjs'])assert.doesNotMatch(src(f),/pinClock/,f);
});
test('withChrome cierra el navegador si fn acaba bien o lanza, y propaga',async()=>{
 const log=[];const launch=async opts=>{log.push(['launch',opts]);return {close:async()=>log.push(['close'])};};
 assert.equal(await withChrome(async b=>{log.push(['fn',typeof b.close]);return 7;},{extraArgs:['--x']},launch),7);
 assert.deepEqual(log,[['launch',{extraArgs:['--x']}],['fn','function'],['close']]);
 log.length=0;await assert.rejects(withChrome(async()=>{throw Error('falla');},{},launch),/falla/);assert.deepEqual(log.map(x=>x[0]),['launch','close']);
});
test('newRenderContext pasa contextOptions al navegador',async()=>{
 let got;await newRenderContext({newContext:async o=>{got=o;return 'ctx';}},VIEWPORTS.lineaBase);
 assert.deepEqual(got,{viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
});
test('pinClock fija performance.now en FIXED_NOW (o el valor dado)',async()=>{
 const run=async(...a)=>{let fn,arg;await pinClock({addInitScript:async(f,x)=>{fn=f;arg=x;}},...a);const ctx={performance:{now:()=>123}};vm.runInNewContext(`(${fn})(${JSON.stringify(arg)})`,ctx);return [ctx.performance.now(),ctx.performance.now()];};
 assert.equal(FIXED_NOW,1000);assert.deepEqual(await run(),[1000,1000]);assert.deepEqual(await run(42),[42,42]);
});
test('solo lib/chrome.mjs lanza Chrome; playwright se importa al lanzar; check-ui.mjs no existe; stage.js sin performance.now',()=>{
 const re=/chromium\.launch|google-chrome|swiftshader|from ['"]playwright['"]|import\(['"]playwright['"]\)/,hits=[];
 for(const d of ['app','lib','scripts','viewer','test'])for(const f of fs.readdirSync(path.join(ROOT,d),{recursive:true})){
  const rel=d+'/'+f.split(path.sep).join('/');if(rel==='lib/chrome.mjs'||rel==='test/chrome.test.mjs'||!/\.(mjs|js|html)$/.test(rel)||!fs.statSync(path.join(ROOT,rel)).isFile())continue;
  if(re.test(src(rel)))hits.push(rel);}
 assert.deepEqual(hits,[]);
 const lib=src('lib/chrome.mjs');assert.doesNotMatch(lib,/from ['"]playwright['"]/);assert.match(lib,/await import\(['"]playwright['"]\)/);assert.doesNotMatch(lib,/from ['"][^'"]*app\//);
 assert.equal(fs.existsSync(path.join(ROOT,'scripts/check-ui.mjs')),false);
 assert.doesNotMatch(src('app/stage.js'),/performance\.now/);
});
