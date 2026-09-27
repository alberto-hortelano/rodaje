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

test('builderIssues: sin falsos positivos',()=>{
 for(const src of ['// uses window','/* document */',"'window'",'"import x"','`fetch`','/window/.test(s)','obj.process','obj . process','({window: 1})','export function build(T,data,kit){}'])
  assert.deepEqual(builderIssues(src),[],src);});

test('builderIssues: detecta globales, módulos y exports',()=>{
 assert.deepEqual(builderIssues('if(typeof document!=="undefined"){}'),['document']);
 for(const [src,t] of [["import x from 'y'",'import'],['const u=import.meta.url','import'],["require('x')",'require'],['f(...window)','window'],['globalThis.a=1','globalThis'],['eval(s)','eval']])
  assert.deepEqual(builderIssues(src),[t],src);
 assert.deepEqual(builderIssues('eval(a);eval(b)'),['eval']);
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
 assert.deepEqual(found.map(x=>x.detail),['shipModel','shipModelHistory','environments.0.viewer: e/explore.js','ideas.0.sourceFile: x/index.html']);});

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
 r=run();assert.equal(r.status,2);assert.match(r.stderr,/Uso:/);});
