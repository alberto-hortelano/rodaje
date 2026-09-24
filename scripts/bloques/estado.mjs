#!/usr/bin/env node
// Estado de los intentos y registro del veredicto (PROCESO.md, paso 7).
//   node scripts/bloques/estado.mjs <lote> [bloque]                                  consulta la cola, descarga generated-vNN.mp4 y result-vNN.json
//   node scripts/bloques/estado.mjs <lote> <bloque> --verdict accepted|rejected \
//        [--attempt N] [--rules R13,R15] [--notes "…"] [--range 0-9.6,11-14]       registra la revisión (un rechazo exige reglas)
import fs from 'node:fs';import path from 'node:path';
import {parseArgs,loadLote,loadAttempts,saveAttempts,readJSON,writeJSON,ffprobeDuration,falClient} from './lib.mjs';
const {args:[lote,only],opts}=parseArgs(process.argv.slice(2));if(!lote){console.error('Uso: estado.mjs <lote> [bloque] [--verdict …]');process.exit(2);}
const L=loadLote(opts.project||'dead-air',lote);
if(opts.verdict){if(!only)throw Error('Indica el bloque');const list=loadAttempts(L.paths.out,only);const a=opts.attempt?list.find(x=>x.n===Number(opts.attempt)):list.at(-1);if(!a)throw Error('No hay intentos');if(a.status!=='done')throw Error(`El intento ${a.n} no está descargado (estado ${a.status})`);
 if(!['accepted','rejected'].includes(opts.verdict))throw Error('--verdict accepted|rejected');const rules=String(opts.rules||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(opts.verdict==='rejected'&&!rules.length)throw Error('Un rechazo cita al menos una regla (R-número) o crea una nueva en REGLAS.md');
 const known=fs.existsSync(path.join(L.paths.base,'REGLAS.md'))?[...fs.readFileSync(path.join(L.paths.base,'REGLAS.md'),'utf8').matchAll(/^### (R\d+)/gm)].map(m=>m[1]):[];for(const r of rules)if(known.length&&!known.includes(r))throw Error(`Regla desconocida ${r}: añádela a REGLAS.md antes de citarla`);
 a.verdict=opts.verdict;a.failedRules=rules;a.notes=opts.notes||'';a.reviewedAt=new Date().toISOString();if(opts.range)a.usedRange=String(opts.range).split(',').map(r=>r.split('-').map(Number));else if(opts.verdict==='accepted')a.usedRange=[[0,Math.min(a.durationReturned||a.durationRequested,L.plan.find(b=>b.id===only).length)]];
 saveAttempts(L.paths.out,only,list);console.log(`${only} intento ${a.n}: ${a.verdict}${rules.length?' ('+rules.join(', ')+')':''}${a.usedRange?' rango '+JSON.stringify(a.usedRange):''}`);process.exit(0);}
const client=await falClient();
for(const block of L.plan){if(only&&block.id!==only)continue;const list=loadAttempts(L.paths.out,block.id);const dir=path.join(L.paths.out,block.id);let dirty=false;
 for(const a of list){if(a.status!=='submitted'||!a.requestId)continue;const q=await client.queue.status(a.endpoint,{requestId:a.requestId,logs:false});console.log(block.id,'intento',a.n,q.status);
  if(q.status==='COMPLETED'){const r=await client.queue.result(a.endpoint,{requestId:a.requestId});const res=await fetch(r.data.video.url);if(!res.ok)throw Error('Descarga fallida '+block.id);const name=`generated-v${String(a.n).padStart(2,'0')}.mp4`;fs.writeFileSync(path.join(dir,name),Buffer.from(await res.arrayBuffer()));writeJSON(path.join(dir,`result-v${String(a.n).padStart(2,'0')}.json`),r);
   a.status='done';a.video=name;a.seed=r.data.seed;a.inferenceSeconds=r.data.timings?.inference;a.durationReturned=ffprobeDuration(path.join(dir,name));a.verdict=null;dirty=true;console.log('  descargado',name,a.durationReturned?`${a.durationReturned.toFixed(2)} s`:'');}
  else if(['FAILED','CANCELLED'].includes(q.status)){a.status='failed';dirty=true;}}
 if(dirty)saveAttempts(L.paths.out,block.id,list);
 const pending=list.filter(a=>a.status==='done'&&!a.verdict);if(pending.length)console.log(`  ${block.id}: ${pending.length} intento(s) sin veredicto → estado.mjs ${lote} ${block.id} --verdict accepted|rejected --rules …`);}
