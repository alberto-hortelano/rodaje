import test from 'node:test';import assert from 'node:assert/strict';
import {ORIGIN_PREFIX,ORIGIN_NAME_RE,absTokens,makeResolver,rewriteText,rewriteValue} from '../lib/rutas-abs.mjs';
import {ABS_RE} from '../lib/proyecto-check.mjs';

const P='/home/u/rodaje/proyectos/serie',resolve=makeResolver({roots:[P,'/data/serie','/mnt/real/serie'],origins:{fuente:'/home/u/fuente',codex:'/home/u/.codex/img'}});
const tokens=line=>absTokens(line).map(t=>t.token);

test('absTokens: /home y file://, cortes y signos finales',()=>{
 assert.deepEqual(tokens('ver /home/u/a.png y file:///tmp/x.txt.'),['/home/u/a.png','file:///tmp/x.txt']);
 assert.deepEqual(tokens('"/home/u/a" \'/home/u/b\' `/home/u/c`,(/home/u/d) [/home/u/e] /home/u/f\\n;/home/u/g<x>'),['/home/u/a','/home/u/b','/home/u/c','/home/u/d','/home/u/e','/home/u/f','/home/u/g']);
 assert.deepEqual(tokens('bajo /home/u/serie/: fin'),['/home/u/serie/']);assert.deepEqual(tokens('file:///home/u/x.png'),['file:///home/u/x.png']);
 assert.deepEqual(absTokens('a /home/u/x'),[{token:'/home/u/x',index:2}]);
 for(const s of ['','sin rutas','assets/home/x','relativa/a.png','file://'])assert.deepEqual(tokens(s),[],s);});

test('makeResolver: alias de raíz, orígenes, límite de prefijo y nombres',()=>{
 const kv=t=>{const r=resolve(t);return [r.kind,r.value];};
 assert.deepEqual(kv(P+'/assets/a.png'),['proyecto','assets/a.png']);assert.deepEqual(kv('/data/serie/b.json'),['proyecto','b.json']);assert.deepEqual(kv('file:///mnt/real/serie/c/d.md'),['proyecto','c/d.md']);
 assert.deepEqual(kv(P),['raiz-proyecto',null]);assert.deepEqual(kv(P+'/'),['raiz-proyecto',null]);
 assert.deepEqual(kv('/home/u/fuente/personajes/a.png'),['origen',ORIGIN_PREFIX+'fuente/personajes/a.png']);assert.deepEqual(kv('/home/u/fuente'),['origen-raiz','origen:fuente']);
 assert.deepEqual(kv('/home/u/.codex/img/x/y.png'),['origen','origen:codex/x/y.png']);
 assert.deepEqual(kv('/home/u/fuente-otra/a.png'),['desconocida',null]);assert.deepEqual(kv(P+'-copia/a'),['desconocida',null]);assert.deepEqual(kv('/home/v/a'),['desconocida',null]);
 assert.deepEqual(makeResolver({roots:['/home/u'],origins:{x:'/home/u/sub'}})('/home/u/sub/a').value,'origen:x/a');
 for(const n of ['Mayus','-guion','con espacio','a_b',''])assert.throws(()=>makeResolver({origins:{[n]:'/x'}}),/origen no válido/,n);
 assert.ok(ORIGIN_NAME_RE.test('conjuntos-2'));});

test('rewriteText: listas concat relativas a su carpeta, resto relativo al proyecto, byte a byte e idempotente',()=>{
 const concat=`file '${P}/assets/l/b01/edit.mp4'\nfile '${P}/assets/l/montaje/x.mp4'\n# ${P}/assets/l/b02/a.mp4\n`;
 for(const file of ['assets/l/montaje/concat.txt','assets/l/montaje/guide-concat.txt','assets/l/montaje/a.concat.txt','assets/l/montaje/list.txt']){
  const r=rewriteText(concat,{file,resolve});assert.equal(r.text,`file '../b01/edit.mp4'\nfile 'x.mp4'\n# assets/l/b02/a.mp4\n`,file);}
 const json=`{\n  "filename": "${P}/assets/l/a.mp4",\n  "refs": ["/home/u/fuente/r.png", "/home/u/.codex/img/i/e.png"],\r\n  "n": 1\n}`;
 const r=rewriteText(json,{file:'assets/l/probe.json',resolve});
 assert.equal(r.text,`{\n  "filename": "assets/l/a.mp4",\n  "refs": ["origen:fuente/r.png", "origen:codex/i/e.png"],\r\n  "n": 1\n}`);
 assert.deepEqual(r.changes.map(c=>[c.line,c.kind,c.to]),[[2,'proyecto','assets/l/a.mp4'],[3,'origen','origen:fuente/r.png'],[3,'origen','origen:codex/i/e.png']]);
 for(const c of r.changes)assert.equal(ABS_RE.test(c.to),false);
 const again=rewriteText(r.text,{file:'assets/l/probe.json',resolve});assert.equal(again.text,r.text);assert.deepEqual(again.changes,[]);
 const prose=`Bajo ${P}/. Ver /home/otro/x.png y file:///tmp/y.\nFuente: /home/u/fuente.`;
 const p=rewriteText(prose,{file:'informe.txt',resolve});
 assert.equal(p.text,`Bajo ${P}/. Ver /home/otro/x.png y file:///tmp/y.\nFuente: origen:fuente.`);
 assert.deepEqual(p.unresolved,[{line:1,token:P+'/',kind:'raiz-proyecto'},{line:1,token:'/home/otro/x.png',kind:'desconocida'},{line:1,token:'file:///tmp/y',kind:'desconocida'}]);
 const same='sin rutas\n';assert.equal(rewriteText(same,{file:'a.md',resolve}).text,same);
 // Un resultado que seguiría siendo absoluto no se aplica.
 const odd=rewriteText('/home/u/fuente/home/x',{file:'a.md',resolve});assert.equal(odd.text,'/home/u/fuente/home/x');assert.equal(odd.unresolved.length,1);});

test('rewriteValue: profundo, sin mutar y con ruta JSON',()=>{
 const v={a:[{sourceFile:'/home/u/fuente/p/r.png',refs:['/home/u/.codex/img/x.png','rel.png']}],idea:{text:'Material en /home/u/fuente.\nY en /home/nadie/z.'},n:3,ok:true,nulo:null},copy=structuredClone(v);
 const r=rewriteValue(v,{resolve});assert.deepEqual(v,copy);
 assert.deepEqual(r.value,{a:[{sourceFile:'origen:fuente/p/r.png',refs:['origen:codex/x.png','rel.png']}],idea:{text:'Material en origen:fuente.\nY en /home/nadie/z.'},n:3,ok:true,nulo:null});
 assert.deepEqual(r.changes.map(c=>[c.path,c.kind]),[['a.0.sourceFile','origen'],['a.0.refs.0','origen'],['idea.text','origen-raiz']]);
 assert.deepEqual(r.unresolved,[{path:'idea.text',token:'/home/nadie/z',kind:'desconocida'}]);
 assert.deepEqual(rewriteValue(r.value,{resolve}).changes,[]);});
