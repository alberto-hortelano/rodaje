// scripts/storyboard-animatica.mjs (#46) con ffmpeg/ffprobe falsos (test/fixtures/bin) y un RODAJE_DATA temporal: versiones sin
// sobrescribir, índice con lo que falta, una sola secuencia, --plan sin escribir e --importar.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {FONT} from '../lib/animaticas.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-anim-cli-')),LOG=path.join(DATA,'mock.jsonl');
const skip=fs.existsSync(FONT)?false:'falta '+FONT;
const w=(id,rel,v)=>{const f=path.join(DATA,id,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v));};
const R=(file,source)=>({file,at:'2026-09-28T10:00:00.000Z',source});
function project(id,sequences){
 w(id,'proyecto.json',{id,name:id,type:'serie',language:'en',revision:1,ideas:[],locations:[],issues:[],characters:[{id:'renaud',name:'Renaud'},{id:'aymer',name:'Aymer'}],
  storyboards:[{id:'sb-a',title:'A',sequences}],
  episodes:[{id:'e1',title:'E',sequences:[{id:'c1',title:'C',storyboard:'sb-a',cast:[],shots:[
   {id:'p1',title:'P1',storyboardShot:'v1',duration:5,lines:[{id:'l1',character:'renaud',text:'He walks.',start:0.5,audio:'audio/l1.mp3',audioDuration:1.2},{id:'l1b',character:'aymer',text:"He's lame.",start:2,offscreen:true,audio:'audio/l1b.mp3',audioDuration:1}]},
   {id:'p2',title:'P2',storyboardShot:'v2',duration:6,lines:[{id:'l2',character:'renaud',text:'He walks.',start:1}]},
   {id:'p3',title:'P3',storyboardShot:'v3',duration:5,lines:[]}]}]}]});
 for(const f of ['3d/A01.png','3d/A02.png','3d/B01.png','render/A01.png','render/B01.png'])w(id,'storyboards/sb-a/'+f,'png');
 w(id,'audio/l1.mp3','mp3');w(id,'audio/l1b.mp3','mp3');}
const shots={s1:[{id:'v1',code:'A01',title:'Uno',duration:4,camera:'Fijo, 85 mm',renders:[R('storyboards/sb-a/3d/A01.png','ensayo 3D'),R('storyboards/sb-a/render/A01.png','ChatGPT')],render:'storyboards/sb-a/render/A01.png'},
 {id:'v2',code:'A02',title:'Dos',duration:6,renders:[R('storyboards/sb-a/3d/A02.png','ensayo 3D')],render:'storyboards/sb-a/3d/A02.png'}],
 s2:[{id:'v3',code:'B01',title:'Tres',duration:5,renders:[R('storyboards/sb-a/3d/B01.png','ensayo 3D')],render:'storyboards/sb-a/render/B01.png'}]};
project('anim',[{id:'s1',title:'Uno',shots:shots.s1},{id:'s2',title:'Dos',shots:shots.s2}]);
const env={...process.env,RODAJE_DATA:DATA,RODAJE_MOCK_LOG:LOG,PATH:[path.join(ROOT,'test/fixtures/bin'),path.dirname(process.execPath),process.env.PATH].join(path.delimiter)};delete env.RODAJE_PROJECT;
const run=(...args)=>spawnSync(process.execPath,[path.join(ROOT,'scripts/storyboard-animatica.mjs'),...args],{cwd:ROOT,encoding:'utf8',timeout:60000,env});
const dir=(id='anim')=>path.join(DATA,id,'storyboards/sb-a/animaticas');
const ls=(id)=>fs.existsSync(dir(id))?fs.readdirSync(dir(id)).sort():[];
const index=(id='anim')=>JSON.parse(fs.readFileSync(path.join(dir(id),'index.json'),'utf8'));
const tree=d=>fs.readdirSync(d,{recursive:true}).sort().map(f=>{const p=path.join(d,f),s=fs.statSync(p);return s.isDirectory()?f+'/':`${f} ${s.size} ${s.mtimeMs}`;});
const last=r=>r.stdout.trim().split('\n').at(-1);

test('primera ejecución: los tres pasos por secuencia y enteros en v01, con índice y faltantes; segunda en v02 sin tocar v01',{skip},()=>{
 const r=run('sb-a','--project','anim');assert.equal(r.status,0,r.stderr);assert.ok(r.stderr.split('\n').includes('Proyecto: anim (--project)'),r.stderr);
 const v1=['3d-v01.mp4','3d.s1-v01.mp4','3d.s2-v01.mp4','fotogramas-v01.mp4','fotogramas.s1-v01.mp4','fotogramas.s2-v01.mp4','index.json','voces-v01.mp4','voces.s1-v01.mp4','voces.s2-v01.mp4'];
 assert.deepEqual(ls('anim'),v1);
 assert.equal(last(r),'3d v01 · 16.0 s · 2 secuencias · completa | fotogramas v01 · 16.0 s · 2 secuencias · incompleta (1 viñeta sin fotograma) | voces v01 · 16.0 s · 2 secuencias · incompleta (1 viñeta sin fotograma, 1 línea sin audio)');
 const idx=index();assert.equal(idx.storyboard,'sb-a');assert.equal(idx.entries.length,9);
 const whole=step=>idx.entries.find(e=>e.step===step&&e.sequence===null);
 assert.deepEqual(whole('3d'),{file:'storyboards/sb-a/animaticas/3d-v01.mp4',step:'3d',version:1,at:whole('3d').at,source:{episode:'e1',sequence:'c1',candidates:1},subtitles:'en',audio:false,imported:false,note:'',sequence:null,duration:16,shots:3,incomplete:false,missing:[],warnings:[]});
 assert.deepEqual(whole('voces').missing,[{shot:'v2',code:'A02',kind:'fotograma'},{shot:'v2',code:'A02',kind:'audio',line:'l2',text:'He walks.'}]);assert.equal(whole('voces').audio,true);
 assert.deepEqual(idx.entries.filter(e=>e.step==='voces').map(e=>[e.sequence,e.incomplete,e.shots,e.duration]),[['s1',true,2,11],['s2',false,1,5],[null,true,3,16]]);
 assert.equal(new Set(idx.entries.map(e=>e.at)).size,1);
 const log=fs.readFileSync(LOG,'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(x=>x.bin==='ffmpeg');
 const seg=log.find(x=>x.argv.includes(path.join(DATA,'anim','audio/l1.mp3')));assert.ok(seg,'segmento de voces con el audio de l1');assert.ok(seg.argv.includes(path.join(DATA,'anim','audio/l1b.mp3')),'también la fuera de campo');
 assert.ok(log.some(x=>x.argv.join(' ').includes('color=black')),'placa negra donde falta el fotograma');
 assert.ok(log.filter(x=>x.argv.includes('concat')).every(x=>x.argv.includes('copy')&&x.argv.at(-1).endsWith('.part.mp4')));
 const before=Object.fromEntries(v1.filter(f=>f.endsWith('.mp4')).map(f=>{const p=path.join(dir(),f);return [f,[fs.statSync(p).mtimeMs,fs.readFileSync(p,'utf8')]];}));
 const r2=run('anim','sb-a');assert.equal(r2.status,0,r2.stderr);assert.ok(r2.stderr.includes('Proyecto: anim (argumento)'));assert.match(last(r2),/^3d v02 · .* \| fotogramas v02 · .* \| voces v02 · /);
 assert.equal(ls('anim').length,19);assert.equal(index().entries.length,18);
 for(const [f,[m,c]] of Object.entries(before)){const p=path.join(dir(),f);assert.equal(fs.statSync(p).mtimeMs,m,f);assert.equal(fs.readFileSync(p,'utf8'),c,f);}
 assert.equal(ls('anim').some(f=>f.includes('.part.')),false);
});

test('--paso voces --secuencia s1: solo voces.s1-vNN (versión compartida del paso), sin animática entera',{skip},()=>{
 const before=ls('anim');const r=run('sb-a','--project','anim','--paso','voces','--secuencia','s1');assert.equal(r.status,0,r.stderr);
 assert.deepEqual(ls('anim').filter(f=>!before.includes(f)),['voces.s1-v03.mp4']);assert.equal(last(r),'voces v03 · 11.0 s · 1 secuencia · incompleta (1 viñeta sin fotograma, 1 línea sin audio)');
 const e=index().entries.at(-1);assert.deepEqual([e.step,e.version,e.sequence],['voces',3,'s1']);
 assert.equal(run('sb-a','--project','anim','--secuencia','nada').status,1);});

test('--plan: JSON de la línea de tiempo y resumen, sin escribir nada',{skip},()=>{
 const before=tree(path.join(DATA,'anim'));const r=run('sb-a','--project','anim','--plan');assert.equal(r.status,0,r.stderr);
 const lines=r.stdout.trim().split('\n');const plan=JSON.parse(lines.slice(0,-1).join('\n'));
 assert.deepEqual(plan.map(t=>[t.step,t.duration,t.incomplete,t.sequences.length]),[['3d',16,false,2],['fotogramas',16,true,2],['voces',16,true,2]]);
 assert.equal(lines.at(-1),'3d · 16.0 s · 2 secuencias · completa | fotogramas · 16.0 s · 2 secuencias · incompleta (1 viñeta sin fotograma) | voces · 16.0 s · 2 secuencias · incompleta (1 viñeta sin fotograma, 1 línea sin audio)');
 assert.match(r.stderr,/Secuencia de capítulo: c1 \(1 candidata\)/);assert.deepEqual(tree(path.join(DATA,'anim')),before);});

test('--importar: mueve la animática hecha a mano a <paso>-vNN.mp4 y la indexa como importada',{skip},()=>{
 w('anim','storyboards/sb-a/animatica.mp4','a mano');const r=run('sb-a','--project','anim','--importar','animatica.mp4','--paso','3d','--subtitulos','es','--nota','hecha a mano; sin audio');
 assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(path.join(DATA,'anim','storyboards/sb-a/animatica.mp4')),false);
 assert.equal(fs.readFileSync(path.join(dir(),'3d-v03.mp4'),'utf8'),'a mano');
 const e=index().entries.at(-1);assert.deepEqual({...e,at:null},{file:'storyboards/sb-a/animaticas/3d-v03.mp4',step:'3d',version:3,sequence:null,at:null,duration:9.5,shots:3,incomplete:false,missing:[],warnings:[],source:null,subtitles:'es',audio:false,imported:true,note:'hecha a mano; sin audio'});
 assert.equal(run('sb-a','--project','anim','--importar','no-existe.mp4','--paso','3d').status,1);
 const u=run('sb-a','--project','anim','--importar','x.mp4');assert.equal(u.status,2);assert.match(u.stderr,/--importar necesita --paso/);});

test('un destino que ya existe lanza sin sobrescribir el fichero',{skip},()=>{
 // Dos secuencias con el mismo nombre de fichero: «s 2» (índice 2, sec-02) y una llamada sec-02.
 project('dup',[{id:'s1',title:'Uno',shots:shots.s1},{id:'s 2',title:'Dos',shots:shots.s2},{id:'sec-02',title:'Tres',shots:[{...shots.s2[0],id:'v4',code:'C01'}]}]);
 const r=run('sb-a','--project','dup','--paso','3d');assert.equal(r.status,1);assert.match(r.stderr,/Ya existe 3d\.sec-02-v01\.mp4; no se sobrescribe/);
 assert.deepEqual(ls('dup'),['3d.s1-v01.mp4','3d.sec-02-v01.mp4']);assert.equal(fs.readFileSync(path.join(dir('dup'),'3d.sec-02-v01.mp4'),'utf8'),'shim:ffmpeg:3d.sec-02-v01.part.mp4');});
