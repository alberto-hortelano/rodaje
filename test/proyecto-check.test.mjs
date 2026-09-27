import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {DATA} from '../lib/paths.mjs';
import {stripCode,builderIssues,checkProject} from '../lib/proyecto-check.mjs';

const mk=(manifest,fileMap)=>checkProject({manifest,files:Object.keys(fileMap),read:f=>{if(!(f in fileMap))throw Error('no leer '+f);if(fileMap[f]===null)throw Error('binario '+f);return fileMap[f];}});
const rules=(found,rule)=>found.filter(x=>x.rule===rule);
const lines=s=>s.split('\n').length;

test('stripCode: división, regex, strings y plantillas',()=>{
 assert.equal(stripCode('x=a/b/c'),'x=a/b/c');
 assert.equal(stripCode('r=/[/]window/g;'),'r="";');
 assert.equal(stripCode('x=/a\\/b/g.test(y)'),'x="".test(y)');
 const tpl='a=`uno\ndocument\ntres`;\nb=1';assert.equal(stripCode(tpl),'a=``;\nb=1');
 const src='// window\nx=1 /* a\nb */ + "s"\ny=/re/;\nz=`a\nb`';assert.ok(lines(stripCode(src))<=lines(src));
 const keep='a\n// c\nb="x"\nc=/r/\n';assert.equal(lines(stripCode(keep)),lines(keep));});

test('stripCode: plantillas anidadas y strings cortados',()=>{
 assert.equal(stripCode('a=`<p>${`<b>x</b>`}</p>`;document.body'),'a=`${``}`;document.body');
 assert.equal(stripCode('a=`${ {k:`}`}.k }`;b'),'a=`${ {k:``}.k }`;b');
 assert.equal(lines(stripCode("a='x\nb=1")),2);assert.equal(stripCode("a='x\nb=1"),"a=''\nb=1");
 assert.equal(lines(stripCode("a='x\\\ny';b")),2);});

test('builderIssues: sin falsos positivos',()=>{
 for(const src of ['// uses window','/* document */',"'window'",'"import x"','`fetch`','/window/.test(s)','obj.process','obj . process','({window: 1})','export function build(T,data,kit){}'])
  assert.deepEqual(builderIssues(src),[],src);});

test('builderIssues: detecta globales, módulos y exports',()=>{
 assert.deepEqual(builderIssues('if(typeof document!=="undefined"){}'),['document']);
 for(const [src,t] of [["import x from 'y'",'import'],['const u=import.meta.url','import'],["require('x')",'require'],['f(...window)','window'],['globalThis.a=1','globalThis'],['eval(s)','eval']])
  assert.deepEqual(builderIssues(src),[t],src);
 assert.deepEqual(builderIssues('eval(a);eval(b)'),['eval']);
 for(const [src,t] of [['h=`<p>${`<b>x</b>`}</p>`;document.body','document'],['h=`<p>${`<b>x</b>`}</p>`;window.x','window'],['h=`${`${window.w}`}`','window'],
  ['localStorage.x=1','localStorage'],['sessionStorage.getItem(k)','sessionStorage'],['module.exports={}','module.exports'],['exports.x = 1','exports'],["exports['x']=1",'exports']])
  assert.deepEqual(builderIssues(src),[t],src);
 for(const src of ['const module=1;module.id','const exports=new Set()','a.localStorage'])assert.deepEqual(builderIssues(src),[],src);
 assert.deepEqual(builderIssues("export * from 'x';\nexport function build(){}"),['export *']);
 // Conservador: una desestructuración también se marca.
 assert.deepEqual(builderIssues('const {document}=kit'),['document']);
 assert.deepEqual(builderIssues('export const A=1;\nlet a;export {a as b};\nexport default 1;\nexport async function f(){}\nexport function build(){}'),['export A','export b','export default','export f']);});

test('R-code ignora el constructor declarado',()=>{
 const found=mk({environments:[{builder:'a/b.js'}]},{'a/b.js':'export function build(){}','x.mjs':'','y.py':'','z.html':'','n.json':'{}'});
 assert.deepEqual(rules(found,'R-code').map(x=>x.file),['x.mjs','y.py','z.html']);});

test('R-builder: fuera del proyecto, inexistente y contenido',()=>{
 assert.match(rules(mk({environments:[{builder:'../x.js'}]},{}),'R-builder')[0].detail,/environments\[0\]\.builder fuera del proyecto: \.\.\/x\.js/);
 assert.match(rules(mk({environments:[{builder:'no.js'}]},{}),'R-builder')[0].detail,/no existe: no\.js/);
 const found=rules(mk({environments:[{builder:'b.js'}]},{'b.js':'document.body;\nexport const K=1;\nexport function build(){}'}),'R-builder');
 assert.deepEqual(found.map(x=>[x.file,x.detail]),[['b.js','document'],['b.js','export K']]);});

test('R-manifest: claves de nave, viewer y rutas de código',()=>{
 const found=rules(mk({shipModel:{},shipModelHistory:[],environments:[{builder:'e.js',viewer:'e/explore.js'},{viewer:{camera:1}}],ideas:[{sourceFile:'x/index.html'}]},{'e.js':''}),'R-manifest');
 assert.deepEqual(found.map(x=>x.detail),['shipModel','shipModelHistory','environments.0.viewer: e/explore.js (viewer como ruta ya no se admite: usa builder + data y viewer.plugins)','ideas.0.sourceFile: x/index.html']);});

test('plugins del visor: R-code, R-builder (contenido) y R-manifest (declaración)',()=>{
 const env=plugins=>({environments:[{builder:'b.js',data:'m.json',viewer:{plugins}}]});
 let found=mk(env(['v.js']),{'b.js':'export function build(){}','v.js':'export function plugin(api){}','m.json':'{}','x.mjs':''});
 assert.deepEqual(rules(found,'R-code').map(x=>x.file),['x.mjs']);assert.deepEqual(rules(found,'R-builder'),[]);assert.deepEqual(rules(found,'R-manifest'),[]);
 found=mk(env(['v.js','w.mjs']),{'b.js':'export function plugin(){}\nexport function build(){}','v.js':'document.body;\nexport const K=1;\nexport function plugin(){}','w.mjs':'export function build(){}'});
 assert.deepEqual(rules(found,'R-builder').map(x=>[x.file,x.detail]),[['b.js','export plugin'],['v.js','document'],['v.js','export K'],['w.mjs','export build'],['w.mjs','falta export plugin']]);
 found=mk(env(['no.js','../x.js','/abs/y.js','v.json','v.js']),{'b.js':'export function build(){}','v.json':'{}','v.js':null});
 assert.deepEqual(rules(found,'R-manifest').map(x=>x.detail),['environments[0].viewer.plugins[0] no existe: no.js','environments[0].viewer.plugins[1] fuera del proyecto: ../x.js','environments[0].viewer.plugins[2] fuera del proyecto: /abs/y.js','environments[0].viewer.plugins[3] no es .js/.mjs: v.json']);
 assert.deepEqual(rules(found,'R-builder').map(x=>[x.file,x.detail]),[['v.js','no se puede leer: binario v.js']]);
 for(const plugins of ['v.js',[1],{a:'v.js'}])assert.ok(rules(mk(env(plugins),{'v.js':''}),'R-manifest').some(x=>x.detail==='environments[0].viewer.plugins no es una lista de rutas'),JSON.stringify(plugins));
 const abs=rules(mk(env(['/home/u/v.js']),{}),'R-abs');assert.deepEqual(abs.map(x=>x.detail),['environments.0.viewer.plugins.0']);});

test('shipModel.builder ya no es un constructor declarado',()=>{
 const found=mk({shipModel:{builder:'n/t.js',viewer:'n/v.js'}},{'n/t.js':'document.x;\nexport function build(T,data,kit){}','n/v.js':''});
 assert.deepEqual(rules(found,'R-manifest').map(x=>x.detail),['shipModel','shipModel.builder: n/t.js','shipModel.viewer: n/v.js']);
 assert.deepEqual(rules(found,'R-code').map(x=>x.file),['n/t.js','n/v.js']);
 assert.deepEqual(rules(found,'R-builder'),[]);});

test('shipModel.builder que también es environments[].builder: sin R-code',()=>{
 const found=mk({shipModel:{builder:'n/t.js'},environments:[{builder:'n/t.js',data:'n/m.json'}]},{'n/t.js':'export function build(T,data,kit){}','n/m.json':'{}'});
 assert.deepEqual(rules(found,'R-code'),[]);
 assert.deepEqual(rules(found,'R-manifest').map(x=>x.detail),['shipModel','shipModel.builder: n/t.js']);
 assert.deepEqual(rules(found,'R-builder'),[]);});

test('R-before',()=>{
 const yes=['before.json','before-explore.js','before','explore.js.before-roll','dir/before.js'],no=['beforehand.md','x-before.json'];
 const map=Object.fromEntries([...yes,...no].map(f=>[f,'']));
 assert.deepEqual(rules(mk({},map),'R-before').map(x=>x.file),yes);});

test('R-abs: código, texto, manifiesto y binarios',()=>{
 const manifest={environments:[{data:'/home/x/m.json'}],ideas:[{note:'/home/y'}],references:['/home/a.png']};
 const found=rules(mk(manifest,{'a.mjs':'x="/home/a"\ny="/home/b"','notas.md':'ver file:///tmp/x','proyecto.json':JSON.stringify(manifest,null,1),'foto.png':null}),'R-abs');
 assert.deepEqual(found.map(({file,level,detail,line})=>[file,level,detail,line]),[
  ['proyecto.json','error','environments.0.data',undefined],['proyecto.json','error','references.0',undefined],
  ['a.mjs','error','2 líneas',1],['notas.md','aviso','1 líneas',1],['proyecto.json','aviso','3 líneas',found.at(-1).line]]);});

test('checkProject es puro: no muta y solo lee rutas de files',()=>{
 const manifest={environments:[{builder:'b.js'}],shipModel:{viewer:'v.js'}},files=['b.js','x.md','img.png'],copyM=structuredClone(manifest),copyF=[...files],reads=[];
 checkProject({manifest,files,read:f=>{reads.push(f);return f==='b.js'?'window':'texto';}});
 assert.deepEqual(manifest,copyM);assert.deepEqual(files,copyF);assert.ok(reads.every(f=>files.includes(f)));assert.ok(!reads.includes('img.png'));});

test('CLI: salida, códigos de salida y --all',()=>{
 const dir=path.join(DATA,'pc-test');fs.mkdirSync(path.join(dir,'trabajos'),{recursive:true});
 fs.writeFileSync(path.join(dir,'proyecto.json'),'{"id":"pc-test"}');fs.writeFileSync(path.join(dir,'suelto.mjs'),'');fs.writeFileSync(path.join(dir,'trabajos','x.mjs'),'');
 fs.writeFileSync(path.join(DATA,'fusiones.json'),'{}');
 const run=(...a)=>spawnSync(process.execPath,['scripts/proyecto-check.mjs',...a],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8',env:{...process.env,RODAJE_DATA:DATA}});
 let r=run('pc-test');assert.equal(r.status,1);assert.match(r.stdout,/R-code · 1/);assert.match(r.stdout,/suelto\.mjs/);assert.doesNotMatch(r.stdout,/trabajos/);
 r=run('pc-test','--report');assert.equal(r.status,0);
 r=run('--all','--report');assert.equal(r.status,0);assert.match(r.stdout,/pc-test ·/);assert.match(r.stdout,/^Total: /m);
 r=run();assert.equal(r.status,2);assert.match(r.stderr,/Uso:/);
 r=run('--all','pc-test');assert.equal(r.status,2);assert.match(r.stderr,/Uso:/);});

test('CLI: con git también se salta trabajos/',()=>{
 const dir=path.join(DATA,'pc-git');fs.mkdirSync(path.join(dir,'trabajos'),{recursive:true});
 fs.writeFileSync(path.join(dir,'proyecto.json'),'{"id":"pc-git"}');fs.writeFileSync(path.join(dir,'suelto.mjs'),'');fs.writeFileSync(path.join(dir,'trabajos','x.mjs'),'');
 assert.equal(spawnSync('git',['init','-q'],{cwd:dir}).status,0);
 const r=spawnSync(process.execPath,['scripts/proyecto-check.mjs','pc-git'],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8',env:{...process.env,RODAJE_DATA:DATA}});
 assert.equal(r.status,1);assert.match(r.stdout,/R-code · 1/);assert.match(r.stdout,/suelto\.mjs/);assert.doesNotMatch(r.stdout,/trabajos/);});

test('CLI: --all sin carpeta de datos sale con 0 y total a cero',()=>{
 const r=spawnSync(process.execPath,['scripts/proyecto-check.mjs','--all'],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8',env:{...process.env,RODAJE_DATA:path.join(DATA,'no','existe')}});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/^Total: 0 errores, 0 avisos en 0 ficheros distintos$/m);});

test('package.json: check:proyectos es estricto (sin --report)',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../package.json'),'utf8'));
 assert.equal(pkg.scripts['check:proyectos'],'node scripts/proyecto-check.mjs --all');});
