// Reglas de los proyectos reales: cada REGLAS.md se une a docs/REGLAS.md sin ids repetidos y todo failedRules histórico se resuelve.
// Solo lectura: lee ROOT/proyectos como constructores.test.mjs y nunca escribe. Sin proyectos, los tests se saltan.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {rulesAt} from '../lib/lotes.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),PROJECTS=path.join(ROOT,'proyectos');
const projects=(fs.existsSync(PROJECTS)?fs.readdirSync(PROJECTS).sort():[]).filter(id=>fs.existsSync(path.join(PROJECTS,id,'proyecto.json')));
const attemptsFiles=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{recursive:true}).map(f=>f.split(path.sep).join('/')).filter(f=>f.endsWith('/attempts.json')).sort():[];

for(const id of projects){
 const dir=path.join(PROJECTS,id);
 test(`${id}: sus reglas se unen a las generales sin repetidos`,()=>{assert.doesNotThrow(()=>rulesAt(dir));});
 test(`${id}: los failedRules de todos los attempts.json se resuelven`,()=>{
  let known;try{known=new Set(rulesAt(dir).map(r=>r.id));}catch{return assert.fail('REGLAS.md no se une a docs/REGLAS.md');}
  const fails=[];
  for(const rel of attemptsFiles(path.join(dir,'assets'))){let list;try{list=JSON.parse(fs.readFileSync(path.join(dir,'assets',rel),'utf8'));}catch{continue;}
   const where=rel.replace(/\/attempts\.json$/,'');
   for(const a of Array.isArray(list)?list:[])for(const r of Array.isArray(a?.failedRules)?a.failedRules:[])if(!known.has(r))fails.push(`${id}/${where} v${a.n}: ${r}`);}
  assert.deepEqual(fails,[]);});
}
test('hay proyectos cuyas reglas comprobar',{skip:!projects.length&&'sin proyectos'},()=>assert.ok(projects.length));
