// Guardianes de la documentación (#19): rutas citadas que existen, documentos movidos a docs/, formato de docs/REGLAS.md,
// catálogo de scripts completo y fuentes de la interfaz nombradas. Solo lectura.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {parseRules} from '../app/workflow.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const SKIP=new Set(['node_modules','.git','proyectos','pruebas-desarrollo','backups']);
const walk=(dir,ok)=>fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true}).flatMap(e=>{const rel=dir?dir+'/'+e.name:e.name;
 if(e.isDirectory())return SKIP.has(e.name)?[]:walk(rel,ok);return ok(rel)?[rel]:[];});
const MD=walk('',f=>f.endsWith('.md')).sort();
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
// Líneas fuera de bloques ``` con su número.
const prose=rel=>{let fence=false;return read(rel).split('\n').flatMap((l,i)=>{if(/^\s*```/.test(l)){fence=!fence;return [];}return fence?[]:[[i+1,l]];});};

test('las rutas del repositorio citadas entre comillas invertidas existen',()=>{
 const missing=[];
 for(const rel of MD)for(const [n,l] of prose(rel))for(const m of l.matchAll(/`([^`]+)`/g)){
  const token=m[1].trim().split(/\s/)[0];
  if(!/^(docs|app|lib|viewer|scripts|test|\.claude)\//.test(token)||/[<{*…]/.test(token))continue;
  if(!fs.existsSync(path.join(ROOT,token)))missing.push(`${rel}:${n} ${token}`);}
 assert.deepEqual(missing,[]);
});

test('nadie cita los documentos movidos sin docs/',()=>{
 const re=new RegExp('(^|[^/\\w])('+['PROCESO','ENTORNOS-3D','UI-DEVELOPMENT'].join('|')+')\\.md');
 const code=['app','lib','scripts','viewer','test','.claude'].flatMap(d=>walk(d,f=>/\.(mjs|js|md)$/.test(f))).filter(f=>f!=='app/app.js');
 const hits=[];
 for(const rel of [...new Set([...MD,...code])])read(rel).split('\n').forEach((l,i)=>{if(re.test(l))hits.push(`${rel}:${i+1}`);});
 assert.deepEqual(hits,[]);
 assert.equal(fs.existsSync(path.join(ROOT,'app','UI-DEVELOPMENT'+'.md')),false);
});

test('docs/REGLAS.md: reglas generales por modo, cada una con Regla, Fallo y Dónde',()=>{
 const text=read('docs/REGLAS.md'),sections={};let current=null,rule=null;
 for(const l of text.split('\n')){
  if(l.startsWith('## ')){current=l.slice(3).trim();sections[current]=[];rule=null;continue;}
  const h=l.match(/^### ([A-Z]\d+) · /);
  if(h){assert.ok(current,`${h[1]} fuera de sección`);rule={id:h[1],lines:[]};sections[current].push(rule);continue;}
  if(rule&&l.trim())rule.lines.push(l);}
 assert.deepEqual(sections['Todos los modos'].map(r=>r.id),['R01','R05','R06','R12','R21','R22','R23','R26']);
 assert.deepEqual(sections['Modo guía 3D'].map(r=>r.id),['R02','R03','R04','R09','R10','R11']);
 for(const r of [...sections['Todos los modos'],...sections['Modo guía 3D']]){
  assert.deepEqual(r.lines.map(l=>l.split(':')[0]),['Regla','Fallo','Dónde'],r.id);
  assert.match(r.lines[1],/= failed take|protocolo roto/,r.id);}
 assert.equal(parseRules(text).length,14);
});

test('docs/scripts.md nombra cada scripts/**/*.mjs',()=>{
 const text=read('docs/scripts.md');
 const all=fs.readdirSync(path.join(ROOT,'scripts'),{recursive:true}).filter(f=>f.endsWith('.mjs')).map(f=>'scripts/'+f.split(path.sep).join('/')).sort();
 assert.deepEqual(all.filter(f=>!text.includes('`'+f+'`')),[]);
});

test('docs/UI.md nombra cada app/*.source.js',()=>{
 const text=read('docs/UI.md'),all=fs.readdirSync(path.join(ROOT,'app')).filter(f=>f.endsWith('.source.js')).map(f=>'app/'+f);
 assert.ok(all.length);assert.deepEqual(all.filter(f=>!text.includes('`'+f+'`')),[]);
});
