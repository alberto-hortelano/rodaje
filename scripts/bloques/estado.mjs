#!/usr/bin/env node
// Estado de los intentos y registro del veredicto (docs/PROCESO.md, paso 7).
//   node scripts/bloques/estado.mjs <lote> [bloque] [--project id]                   consulta la cola, descarga generated-vNN.mp4 y result-vNN.json
//   node scripts/bloques/estado.mjs <lote> <bloque> --verdict accepted|rejected|none \
//        [--attempt N] [--rules R13,R15] [--notes "…"] [--range 0-9.6,11-14]
// Sin --attempt, el último intento. Una sola toma aceptada por bloque: aceptar otra la sustituye (replacedBy).
// Al aceptar no se guardan reglas; sin --range se conserva el rango anterior (o el bloque entero). none quita la revisión.
// Misma semántica que la vista Montaje (reviewBlock en lib/lotes.mjs). Cada escritura relee attempts.json y solo toca su intento.
import fs from 'node:fs';import path from 'node:path';
import {parseArgs,readJSON,writeJSON,ffprobeDuration,falClient,cliProject,usageExit,fail} from './lib.mjs';import {loadLote,loadAttempts,patchAttempt,reviewBlock} from '../../lib/lotes.mjs';import {parseRange,parseVerdict} from '../../app/workflow.mjs';import {status,result,download} from '../../lib/fal.mjs';
const USAGE='Uso: estado.mjs <lote> [bloque] [--project id] [--verdict accepted|rejected|none --attempt N --rules R13 --notes "…" --range 0-9.6]';
const {args:[lote,only],opts}=parseArgs(process.argv.slice(2));if(!lote)usageExit(USAGE);
const project=cliProject({usage:USAGE,opts}).project;
if(opts.verdict!==undefined){if(!only)fail('Indica el bloque');
 try{const verdict=parseVerdict(opts.verdict),rules=String(opts.rules||'').split(',').map(s=>s.trim()).filter(Boolean);
  const {attempt:a,replaced}=reviewBlock(project,lote,only,{attempt:opts.attempt,verdict,rules,notes:opts.notes||'',range:opts.range!==undefined?parseRange(String(opts.range)):undefined});
  if(verdict==='accepted'&&rules.length)console.warn(`Aviso: al aceptar no se guardan reglas (${rules.join(', ')}).`);
  console.log(`${only} intento ${a.n}: ${a.verdict===null?'sin veredicto':a.verdict}${a.failedRules?.length?' ('+a.failedRules.join(', ')+')':''}${a.verdict==='accepted'&&a.usedRange?' rango '+JSON.stringify(a.usedRange):''}${replaced.length?' (sustituye a '+replaced.map(n=>'v'+n).join(', ')+')':''}`);}
 catch(e){fail(e.message);}
 process.exit(0);}
const L=loadLote(project,lote);const client=await falClient();
const vNN=n=>String(n).padStart(2,'0');
for(const block of L.plan){if(only&&block.id!==only)continue;const list=loadAttempts(L.paths.out,block.id);const dir=path.join(L.paths.out,block.id);
 // Envío que se cortó antes de guardar su requestId en attempts.json: se recupera de request-vNN.json.
 for(const a of list){if(a.status!=='submitting'||a.requestId||!a.request)continue;const f=path.join(dir,a.request);const requestId=fs.existsSync(f)?readJSON(f).requestId:null;if(!requestId)continue;
  Object.assign(a,patchAttempt(L.paths.out,block.id,a.n,x=>x.status==='submitting'&&!x.requestId?{status:'submitted',requestId}:null));}
 for(const a of list){if(a.status!=='submitted'||!a.requestId)continue;const q=await status(client,a.endpoint,a.requestId);console.log(block.id,'intento',a.n,q.status);
  // Parche condicional: solo si el intento sigue esperando este mismo envío (otro proceso pudo descargarlo o revisarlo mientras tanto).
  const still=x=>x.status==='submitted'&&x.requestId===a.requestId;
  if(q.status==='COMPLETED'){const r=await result(client,a.endpoint,a.requestId);const video=await download(r.data.video.url,{error:'Descarga fallida '+block.id});const name=`generated-v${vNN(a.n)}.mp4`;fs.writeFileSync(path.join(dir,name),video);writeJSON(path.join(dir,`result-v${vNN(a.n)}.json`),r);
   const durationReturned=ffprobeDuration(path.join(dir,name));patchAttempt(L.paths.out,block.id,a.n,x=>still(x)?{status:'done',video:name,seed:r.data.seed,inferenceSeconds:r.data.timings?.inference,durationReturned,verdict:x.verdict??null}:null);console.log('  descargado',name,durationReturned?`${durationReturned.toFixed(2)} s`:'');}
  else if(['FAILED','CANCELLED'].includes(q.status))patchAttempt(L.paths.out,block.id,a.n,x=>still(x)?{status:'failed'}:null);}
 const pending=loadAttempts(L.paths.out,block.id).filter(a=>a.status==='done'&&!a.verdict);if(pending.length)console.log(`  ${block.id}: ${pending.length} intento(s) sin veredicto → estado.mjs ${lote} ${block.id} --verdict accepted|rejected --rules …`);}
