// Vista Storyboard reestructurada (#55): reproductor único por paso y cabecera de escena. Puro, más comprobaciones de fuente y estilo.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {STORYBOARD_PLAYER_STEPS,storyboardPlayer,storyboardSequenceHeader,storyboardMedia} from '../app/workflow.mjs';

const v=(n,extra={})=>({version:n,file:`animaticas/v0${n}.mp4`,at:'t'+n,duration:10+n,...extra});
const lote=(id,created,links,attempts={},cuts=[])=>({id,created,links,attempts,cuts});

test('storyboardPlayer: sin pasos',()=>{
 for(const [a,c] of [[null,null],[{},undefined],[{'3d':{list:[]}},null],[{'3d':{current:null,list:[v(1)]}},{current:null,list:[]}]])
  assert.deepEqual(storyboardPlayer(a,c),{steps:[],initial:null});
 assert.deepEqual(STORYBOARD_PLAYER_STEPS.map(([k])=>k),['3d','fotogramas','voces','montaje']);});

test('storyboardPlayer: solo montaje',()=>{
 const cut={current:{lote:'l1',name:'c1',file:'c1.mp4'},list:[{lote:'l1',name:'c0',file:'c0.mp4'},{lote:'l1',name:'c1',file:'c1.mp4'}]};
 const r=storyboardPlayer(null,cut);
 assert.deepEqual(r.steps.map(s=>[s.key,s.label,s.list.length]),[['montaje','Montaje',2]]);assert.equal(r.initial,'montaje');assert.equal(r.steps[0].current,cut.current);});

test('storyboardPlayer: solo animáticas, en orden, clave desconocida ignorada y list ausente → [current]',()=>{
 const a={voces:{current:v(2),list:[v(1),v(2)]},raro:{current:v(9),list:[v(9)]},'3d':{current:v(1)}};
 const r=storyboardPlayer(a,undefined);
 assert.deepEqual(r.steps.map(s=>s.key),['3d','voces']);assert.equal(r.initial,'voces');
 assert.deepEqual(r.steps[0].list,[v(1)]);assert.equal(r.steps[1].list.length,2);
 assert.deepEqual(storyboardPlayer({fotogramas:{current:v(3),list:[]}},null).steps[0].list,[v(3)]);});

test('storyboardPlayer: cuatro pasos en orden, inicial montaje y no muta',()=>{
 const a={montaje:{current:v(7)},fotogramas:{current:v(2),list:[v(2)]},voces:{current:v(3),list:[v(3)]},'3d':{current:v(1),list:[v(1)]}},cut={current:{lote:'l2',file:'x.mp4'},list:[{lote:'l2',file:'x.mp4'}]};
 const before=structuredClone({a,cut}),r=storyboardPlayer(a,cut);
 assert.deepEqual(r.steps.map(s=>[s.key,s.label]),[['3d','Ensayo 3D'],['fotogramas','Fotogramas'],['voces','Con voces'],['montaje','Montaje']]);
 assert.equal(r.initial,'montaje');assert.equal(r.steps[3].current.file,'x.mp4');assert.deepEqual({a,cut},before);});

test('storyboardPlayer: cortes antiguos sin sequences (storyboardMedia)',()=>{
 const sb={id:'sb-a',sequences:[{id:'sq-1',title:'Cruce',shots:[{id:'v1'}]}]};
 const m=storyboardMedia(sb,[lote('l1','a',{b1:'v1'},{},[{name:'c0',file:'f',at:'t',duration:1}])]);
 const r=storyboardPlayer(null,m.cuts);assert.deepEqual(r.steps.map(s=>s.key),['montaje']);assert.equal(r.steps[0].current.lote,'l1');
 assert.deepEqual(storyboardPlayer(undefined,m.sequences['sq-1']),{steps:[],initial:null});});

test('storyboardSequenceHeader: eyebrow y meta sin separadores sueltos',()=>{
 const locs=[{id:'bar',name:'El bar'}],shots=[{duration:4},{duration:6}];
 assert.deepEqual(storyboardSequenceHeader({shots}),{eyebrow:'Escena · 2 viñetas · 10',meta:''});
 assert.equal(storyboardSequenceHeader({shots,location:'bar'},locs).meta,'El bar');
 assert.equal(storyboardSequenceHeader({shots,location:'sotano'},locs).meta,'sotano');
 assert.equal(storyboardSequenceHeader({shots,note:'Llega tarde',location:'bar'},locs).meta,'Llega tarde · El bar');
 assert.equal(storyboardSequenceHeader({shots:[{duration:5}]}).eyebrow,'Escena · 1 viñeta · 5');
 assert.equal(storyboardSequenceHeader({}).eyebrow,'Escena · 0 viñetas');
 assert.equal(storyboardSequenceHeader({shots:[{duration:0},{}]}).eyebrow,'Escena · 2 viñetas');
 assert.equal(storyboardSequenceHeader({shots:[{duration:'4'},{duration:3.5}]},[],n=>`<${n}>`).eyebrow,'Escena · 2 viñetas · <7.5>');});

const src=fs.readFileSync(new URL('../app/app.source.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');

test('vista Storyboard: conserva acciones y data-sb-*, menús y «Montaje →» de la toma sin nextElementSibling',()=>{
 for(const a of ['sb-to-episode:','sb-animaticas:','edit-storyboard:','new-sb-sequence:','sb-current:','sb-export:','delete-storyboard:','sb-sequence:','new-sb-shot:','delete-sb-sequence:','sb-shot:','upload-sb-sketch:','upload-sb-render:','gen-sb:','sb-prompt:','sb-move:','sb-move-to:','delete-sb-shot:','sb-montaje:','anim:'])
  assert.ok(src.includes(`'${a}`)||src.includes(`"${a}`),'falta la acción '+a);
 for(const d of ['data-sb-grid','data-sb-drag','data-sb-toggle','data-sb-pill','data-sb-take','data-sb-take-go','data-sb-src','data-sb-vid','data-sb-render','data-sb-step','data-sb-player','data-sb-pills','data-sb-go','data-sb-version','data-sb-scene','data-sb-panel'])
  assert.match(src,new RegExp(d+'[=>\s]'),'falta '+d);
 const i=src.indexOf("querySelectorAll('[data-sb-take]')"),block=src.slice(i,src.indexOf("querySelectorAll('[data-sb-src]')",i));
 assert.ok(i>0&&block.length>0);assert.doesNotMatch(block,/nextElementSibling/);
 assert.match(src,/class="menu down/);assert.match(src,/storyboardSequenceHeader\(s,/);assert.ok(src.includes("'+ Escena'"));assert.ok(src.includes('Vídeos de la escena'));
 assert.ok(!src.includes('sobre el hueco final de una escena'),'la ayuda describe las páginas (#68)');assert.ok(src.includes('«Mover a escena…» la lleva al final de otra escena del story'));});

test('vista Storyboard: estilos de tarjeta, menús hacia abajo y tres columnas',()=>{
 const rule=sel=>new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}').exec(css)?.[1];
 assert.doesNotMatch(rule('.sb-card')||'',/overflow:hidden/);assert.match(rule('.sb-frame')||'',/overflow:hidden/);
 assert.match(rule('details.menu.down>div')||'',/top:/);assert.match(rule('.sb-grid')||'',/320px/);});
