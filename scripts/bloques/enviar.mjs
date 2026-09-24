#!/usr/bin/env node
// Envía un bloque a H3 Max y registra el intento (PROCESO.md, paso 7; REGLAS R23, R26).
//   node scripts/bloques/enviar.mjs <lote> <bloque> [--project dead-air] [--changed "línea nueva"] [--yes]
// Sin --yes es un ensayo: muestra lo que enviaría y no gasta créditos. Cada envío crea prompt-vNN.txt, request-vNN.json
// y una entrada en attempts.json. A partir del segundo intento exige --changed (una línea); rechaza el séptimo.
import fs from 'node:fs';import path from 'node:path';
import {parseArgs,loadLote,loadAttempts,saveAttempts,readJSON,writeJSON,falClient} from './lib.mjs';
const {args:[lote,blockId],opts}=parseArgs(process.argv.slice(2));if(!lote||!blockId){console.error('Uso: enviar.mjs <lote> <bloque> [--changed "línea"] [--yes]');process.exit(2);}
const L=loadLote(opts.project||'dead-air',lote);const block=L.plan.find(b=>b.id===blockId);if(!block)throw Error('Bloque desconocido: '+blockId);
const dir=path.join(L.paths.out,blockId);const promptFile=path.join(dir,'prompt.txt'),refsFile=path.join(dir,'refs.json'),motion=path.join(dir,'motion.mp4');
for(const [f,why] of [[promptFile,'ejecuta prompt.mjs y rellena los huecos'],[refsFile,'ejecuta prompt.mjs'],[motion,'ejecuta render.mjs']])if(!fs.existsSync(f))throw Error(`Falta ${path.relative(L.paths.base,f)}: ${why}`);
const prompt=fs.readFileSync(promptFile,'utf8').trim();if(/\[\[/.test(prompt))throw Error('El prompt tiene huecos [[...]] sin resolver');
const refs=readJSON(refsFile);for(const r of [...refs.images,...refs.audios]){if(!r.file)throw Error(`Referencia sin fichero: ${r.tag}`);if(!fs.existsSync(path.join(L.paths.base,r.file)))throw Error(`No existe ${r.file} (${r.tag})`);const a=L.registry.assets[r.tag];if(!a||a.status!=='approved')throw Error(`Tag sin aprobar: ${r.tag}`);}
const attempts=loadAttempts(L.paths.out,blockId);const n=attempts.length+1;const prev=attempts.at(-1);
if(n>6)throw Error('R26: seis intentos sobre el mismo bloque; cambia el bloque (divide, quita una acción, inserto de objeto u otra cámara) y crea un lote nuevo');
if(n>=5)console.warn('R26: quinto intento o más; el protocolo pide cambiar el bloque, no la frase.');
if(n>=2&&!opts.changed)throw Error('R26: a partir del segundo intento indica la única línea cambiada con --changed "…"');
if(prev&&prev.status==='submitted'&&!prev.verdict)throw Error(`El intento ${prev.n} aún no tiene veredicto; ejecuta estado.mjs`);
if(opts.changed&&!prompt.includes(String(opts.changed).trim()))throw Error('La línea de --changed no aparece literal en prompt.txt');
if(prev&&fs.existsSync(path.join(dir,prev.prompt))){const old=fs.readFileSync(path.join(dir,prev.prompt),'utf8').trim().split('\n'),now=prompt.split('\n');const changed=now.filter(l=>!old.includes(l)).length+old.filter(l=>!now.includes(l)).length;if(changed>2)console.warn(`Aviso R26: hay ${changed} líneas distintas respecto al intento ${prev.n}; el protocolo es una sola.`);}
const input={duration:refs.durationRequested,resolution:'768P',aspect_ratio:'16:9',prompt_expansion_mode:'disabled',prompt};
console.log(`${lote}/${blockId} intento ${n}: pide ${input.duration} s · imágenes ${refs.images.map(i=>i.tag).join(', ')} · audios ${refs.audios.map(a=>a.tag).join(', ')||'—'} · vídeo motion.mp4`);
if(!opts.yes){console.log('Ensayo: no se ha enviado nada. Añade --yes para enviar (coste ≈ '+(input.duration*0.08).toFixed(2)+' $ a 768P).');process.exit(0);}
const client=await falClient();const cacheFile=L.paths.uploads;const cache=fs.existsSync(cacheFile)?readJSON(cacheFile):{};
async function upload(rel,type){const abs=path.join(L.paths.base,rel);const key=rel+':'+fs.statSync(abs).mtimeMs;if(!cache[key]){cache[key]=await client.storage.upload(new File([fs.readFileSync(abs)],path.basename(abs),{type}));writeJSON(cacheFile,cache);}return cache[key];}
const motionRel=path.relative(L.paths.base,motion);
input.reference_image_urls=await Promise.all(refs.images.map(i=>upload(i.file,'image/png')));input.reference_video_urls=[await upload(motionRel,'video/mp4')];if(refs.audios.length)input.reference_audio_urls=await Promise.all(refs.audios.map(a=>upload(a.file,'audio/wav')));
const promptName=`prompt-v${String(n).padStart(2,'0')}.txt`,requestName=`request-v${String(n).padStart(2,'0')}.json`;fs.copyFileSync(promptFile,path.join(dir,promptName));
const endpoint='minimax/h3-max/reference-to-video';const attempt={n,at:new Date().toISOString(),endpoint,prompt:promptName,request:requestName,refs:[...refs.images.map(i=>i.tag),...refs.audios.map(a=>a.tag)],durationRequested:input.duration,resolution:'768P',changedLine:opts.changed||null,status:'submitting'};
writeJSON(path.join(dir,requestName),{status:'submitting',endpoint,input});attempts.push(attempt);saveAttempts(L.paths.out,blockId,attempts);
const q=await client.queue.submit(endpoint,{input});attempt.requestId=q.request_id;attempt.status='submitted';writeJSON(path.join(dir,requestName),{status:'submitted',endpoint,input,requestId:q.request_id});saveAttempts(L.paths.out,blockId,attempts);
console.log('ENVIADO',blockId,'intento',n,q.request_id,'→ node scripts/bloques/estado.mjs',lote,blockId);
