#!/usr/bin/env node
// Valida uno o todos los proyectos: node scripts/proyecto-check.mjs <id>|--all [--report]
// Sin --report sale con 1 si hay errores. Solo lee.
import fs from 'node:fs';
import path from 'node:path';
import {DATA,ID_RE,projectDir,safe} from '../lib/paths.mjs';
import {readJSON} from '../lib/json.mjs';
import {parseArgs} from '../lib/args.mjs';
import {RULES,checkProject} from '../lib/proyecto-check.mjs';
import {listProjectFiles} from '../lib/proyecto-ficheros.mjs';

const USAGE = 'Uso: node scripts/proyecto-check.mjs <id>|--all [--report]';

function checkOne(id){const dir=projectDir(id),files=listProjectFiles(dir);let manifest={};const extra=[];
 try{manifest=readJSON(path.join(dir,'proyecto.json'));}catch(e){extra.push({rule:'R-manifest',level:'error',file:'proyecto.json',detail:'JSON no válido: '+e.message});}
 const found=checkProject({manifest,files,read:f=>fs.readFileSync(safe(dir,f),'utf8')});
 return {id,files:files.length,found:[...found,...extra].sort((a,b)=>RULES.indexOf(a.rule)-RULES.indexOf(b.rule))};}

function report({id,files,found}){const errors=found.filter(x=>x.level==='error'),warnings=found.filter(x=>x.level==='aviso');
 if(!found.length)return console.log(`${id} · sin fallos`);
 console.log(`${id} · ${errors.length} errores, ${warnings.length} avisos en ${files} ficheros`);
 for(const group of [errors,warnings]){const byRule=Map.groupBy(group,x=>x.rule);
  for(const [rule,items] of byRule){console.log(`  ${rule}${items[0].level==='aviso'?' (aviso)':''} · ${items.length}`);
   for(const x of items)console.log(`    ${x.file}${x.line?':'+x.line:''}  ${x.detail}`);}}}

const {args,opts}=parseArgs(process.argv.slice(2));
for(const k of ['all','report'])if(typeof opts[k]==='string'){args.push(opts[k]);opts[k]=true;} // parseArgs es voraz
// --all sin carpeta de datos: ningún proyecto, total a cero.
const ids=opts.all?!fs.existsSync(DATA)?[]:fs.readdirSync(DATA,{withFileTypes:true}).filter(e=>e.isDirectory()&&ID_RE.test(e.name)&&fs.existsSync(path.join(DATA,e.name,'proyecto.json'))).map(e=>e.name).sort():args.slice(0,1);
if(opts.all?args.length:!ids.length){console.error(USAGE);process.exit(2);}
if(!opts.all&&!ID_RE.test(ids[0])){console.error('ID de proyecto no válido: '+ids[0]);process.exit(2);}
if(!opts.all&&!fs.existsSync(projectDir(ids[0]))){console.error('No existe el proyecto: '+ids[0]);process.exit(2);}
const results=ids.map(checkOne);results.forEach(report);
const errors=results.reduce((n,r)=>n+r.found.filter(x=>x.level==='error').length,0);
if(opts.all){const warnings=results.reduce((n,r)=>n+r.found.filter(x=>x.level==='aviso').length,0);
 const distinct=new Set(results.flatMap(r=>r.found.map(x=>r.id+'/'+x.file))).size;
 console.log(`Total: ${errors} errores, ${warnings} avisos en ${distinct} ficheros distintos`);}
process.exitCode=opts.report?0:errors>0?1:0;
