#!/usr/bin/env node
// Esqueleto del prompt de cada bloque en orden fijo (PROCESO.md, paso 7).
//   node scripts/bloques/prompt.mjs <lote> [bloque] [--project dead-air] [--force]
// Escribe <bloque>/prompt.txt (con huecos [[ACTING]] / [[LOCAL]] si la escena no los aporta) y refs.json.
// Si prompt.txt ya existe (rellenado a mano), escribe prompt.generated.txt para comparar, salvo --force.
import fs from 'node:fs';import path from 'node:path';
import {blockPrompt} from '../../app/workflow.mjs';
import {parseArgs,loadLote,writeJSON} from './lib.mjs';
const {args:[lote,only],opts}=parseArgs(process.argv.slice(2));if(!lote){console.error('Uso: prompt.mjs <lote> [bloque] [--force]');process.exit(2);}
const L=loadLote(opts.project||'dead-air',lote);let gaps=0;
for(const block of L.plan){if(only&&block.id!==only)continue;const dir=path.join(L.paths.out,block.id);fs.mkdirSync(dir,{recursive:true});
 const r=blockPrompt({project:L.project,sequence:L.sequence,shots:L.shots,block,registry:L.registry,map:L.map,scene:L.scene,mode:block.mode});
 const target=path.join(dir,'prompt.txt');const exists=fs.existsSync(target);const file=exists&&!opts.force?path.join(dir,'prompt.generated.txt'):target;fs.writeFileSync(file,r.prompt+'\n');
 writeJSON(path.join(dir,'refs.json'),{images:r.refs.images.map(i=>({tag:i.tag,role:i.role,file:i.file})),audios:r.refs.audios.map(a=>({tag:a.tag,character:a.character,file:a.file})),video:'motion.mp4',durationRequested:r.requested,duration:r.duration,budget:Math.round(r.budget*100)/100});
 const holes=[...r.prompt.matchAll(/\[\[[A-Z ]+\]\]/g)].map(m=>m[0]);gaps+=holes.length;
 console.log(`${block.id}: ${path.basename(file)}${exists&&!opts.force?' (prompt.txt ya existía)':''}  imágenes ${r.refs.images.length}  audios ${r.refs.audios.length}  pide ${r.requested} s${holes.length?'  huecos '+[...new Set(holes)].join(' '):''}`);for(const w of r.warnings)console.log('   aviso:',w);}
if(gaps)console.log(`\nHay ${gaps} huecos: rellénalos con la skill director-h3 (y la escena con interpretacion) antes de enviar.`);
