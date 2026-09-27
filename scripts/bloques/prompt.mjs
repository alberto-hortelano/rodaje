#!/usr/bin/env node
// Esqueleto del prompt de cada bloque en orden fijo (docs/PROCESO.md, paso 7).
//   node scripts/bloques/prompt.mjs <lote> [bloque] [--project id] [--force]
// Escribe <bloque>/prompt.txt (con huecos [[ACTING]] / [[LOCAL]] si la escena no los aporta) y refs.json.
// Si prompt.txt ya existe (rellenado a mano), escribe prompt.generated.txt para comparar, salvo --force.
// Modo fotograma con assets/<lote>/direccion.json: rellena los huecos con la entrada del bloque («fin» pone endImage).
// Un bloque sin entrada y con prompt.txt (dirigido a mano) no se toca salvo que se nombre. refs.json conserva endImage.
import fs from 'node:fs';import path from 'node:path';
import {blockPrompt,framePrompt,applyDireccion,direccionErrors,direccionBlock,promptTargets,mergeRefs} from '../../app/workflow.mjs';
import {parseArgs,writeJSON,readJSON,cliProject,usageExit} from './lib.mjs';import {loadLote,direccionFor} from '../../lib/lotes.mjs';
const USAGE='Uso: prompt.mjs <lote> [bloque] [--project id] [--force]';
const {args:[lote,only],opts}=parseArgs(process.argv.slice(2));if(!lote)usageExit(USAGE);
const L=loadLote(cliProject({usage:USAGE,opts}).project,lote);let gaps=0;
let D=null;try{D=direccionFor(L.paths.out);}catch(e){console.error(`direccion.json: ${e.message}`);process.exit(1);}
if(D){const errs=direccionErrors(D);if(errs.length){console.error(errs.map(e=>'direccion.json: '+e).join('\n'));process.exit(1);}}
const undirected=[];
// Decide dónde escribir y guarda prompt y refs.json (conservando o poniendo endImage). Devuelve el fichero escrito o null.
function write(block,dir,{directed,ignored=false,prompt,fresh,patch={}}){const exists=fs.existsSync(path.join(dir,'prompt.txt'));const t=promptTargets({exists,force:!!opts.force,hasDireccion:!!D,directed,named:only===block.id});
 if(D&&!directed&&!ignored)undirected.push(block.id);if(t.skip){if(!ignored)console.log(`${block.id}: sin dirección en direccion.json; se conserva`);return null;}
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,t.promptFile),prompt+'\n');
 const rf=path.join(dir,'refs.json'),old=fs.existsSync(rf)?readJSON(rf):null,refs=mergeRefs(fresh,old,{directed,patch});
 if(old?.endImage&&!refs.endImage)console.log(`   aviso: ${block.id}: se quita el endImage anterior (la dirección no pide fin)`);writeJSON(rf,refs);
 return {file:t.promptFile,exists};}
for(const block of L.plan){if(only&&block.id!==only)continue;const dir=path.join(L.paths.out,block.id);const d=D?direccionBlock(D,block.id):null;
 // Modo fotograma: el reparto sale de la viñeta del storyboard de la que viene el plano.
 if(block.mode==='fotograma'){const t=L.shots[block.parts[0].shot];const sbShot=(L.project.storyboards||[]).flatMap(b=>b.sequences||[]).flatMap(s=>s.shots||[]).find(x=>x.id===t.storyboardShot);const cast=(sbShot?.cast||[]).filter(id=>L.project.characters.some(c=>c.id===id));
  const r=framePrompt({project:L.project,sequence:L.sequence,shots:L.shots,block,registry:L.registry,map:L.map,scene:L.scene,cast});const a=d?applyDireccion(r.prompt,d,{names:r.names,locks:D.locks,image:r.image}):{prompt:r.prompt,refsPatch:{},warnings:[]};
  const audio=(block.parts||[]).flatMap(p=>p.lines||[]).map(l=>t.lines.find(x=>x.id===l.id)).find(l=>l?.audio);
  const w=write(block,dir,{directed:!!d,prompt:a.prompt,patch:a.refsPatch,fresh:{mode:'fotograma',image:r.image,shot:t.title,cast,lineAudio:audio?{file:audio.audio,start:block.parts[0].lines.find(l=>l.id===audio.id).start}:null,images:[],audios:[],durationRequested:r.requested,duration:r.duration,budget:Math.round(r.budget*100)/100}});if(!w)continue;
  const holes=[...a.prompt.matchAll(/\[\[[A-Z ]+\]\]/g)].map(m=>m[0]);gaps+=holes.length;
  console.log(`${block.id} ${t.title}: ${w.file}${w.exists&&!opts.force?' (prompt.txt ya existía)':''}${d?'  dirigido':''}  pide ${r.requested} s${holes.length?'  huecos '+[...new Set(holes)].join(' '):''}`);for(const x of [...r.warnings,...a.warnings])console.log('   aviso:',x);continue;}
 const r=blockPrompt({project:L.project,sequence:L.sequence,shots:L.shots,block,registry:L.registry,map:L.map,scene:L.scene,mode:block.mode});
 const w=write(block,dir,{directed:false,ignored:!!d,prompt:r.prompt,fresh:{images:r.refs.images.map(i=>({tag:i.tag,role:i.role,file:i.file})),audios:r.refs.audios.map(a=>({tag:a.tag,character:a.character,file:a.file})),video:'motion.mp4',durationRequested:r.requested,duration:r.duration,budget:Math.round(r.budget*100)/100}});
 if(d)console.log(`   aviso: ${block.id}: dirección ignorada: solo modo fotograma`);if(!w)continue;
 const holes=[...r.prompt.matchAll(/\[\[[A-Z ]+\]\]/g)].map(m=>m[0]);gaps+=holes.length;
 console.log(`${block.id}: ${w.file}${w.exists&&!opts.force?' (prompt.txt ya existía)':''}  imágenes ${r.refs.images.length}  audios ${r.refs.audios.length}  pide ${r.requested} s${holes.length?'  huecos '+[...new Set(holes)].join(' '):''}`);for(const x of r.warnings)console.log('   aviso:',x);}
if(undirected.length)console.log(`\nSin dirección: ${undirected.join(' ')}`);
if(gaps)console.log(`\nHay ${gaps} huecos: rellénalos con la skill director-h3 (y la escena con interpretacion) antes de enviar.`);
