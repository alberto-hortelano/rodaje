#!/usr/bin/env node
// Envía un bloque a H3 Max y registra el intento (docs/PROCESO.md, paso 7; REGLAS R23, R26).
// Bloques en modo fotograma (planificar --por-plano): image-to-video con el fotograma del storyboard como primer fotograma y la voz de la línea como target_audio.
// Si refs.json trae endImage, va como end_image_url (fotograma final): con el mismo fotograma ancla el encuadre en planos casi quietos.
// --changed-ref "…": en un reintento, el cambio es de referencias (p. ej. fotograma final) y no de una línea del prompt.
//   node scripts/bloques/enviar.mjs <lote> <bloque> [--project id] [--changed "línea nueva"] [--changed-ref "…"] [--modelo h3] [--yes]
// Sin --yes es un ensayo: muestra lo que enviaría y no gasta créditos. Cada envío crea prompt-vNN.txt, request-vNN.json
// y una entrada en attempts.json. A partir del segundo intento exige --changed (una línea); rechaza el séptimo.
import fs from 'node:fs';import path from 'node:path';import {ffmpeg} from '../../lib/media.mjs';import {uploadFile,submit} from '../../lib/fal.mjs';
import {parseArgs,readJSON,writeJSON,falClient,cliProject,usageExit} from './lib.mjs';import {loadLote,loadAttempts,saveAttempts} from '../../lib/lotes.mjs';
const USAGE='Uso: enviar.mjs <lote> <bloque> [--project id] [--changed "línea"] [--changed-ref "…"] [--modelo h3] [--yes]';
const {args:[lote,blockId],opts}=parseArgs(process.argv.slice(2));if(!lote||!blockId)usageExit(USAGE);
const L=loadLote(cliProject({usage:USAGE,opts}).project,lote);const block=L.plan.find(b=>b.id===blockId);if(!block)throw Error('Bloque desconocido: '+blockId);
const dir=path.join(L.paths.out,blockId);const promptFile=path.join(dir,'prompt.txt'),refsFile=path.join(dir,'refs.json'),motion=path.join(dir,'motion.mp4');
const frameMode=block.mode==='fotograma';
for(const [f,why] of [[promptFile,'ejecuta prompt.mjs y rellena los huecos'],[refsFile,'ejecuta prompt.mjs'],...(frameMode?[]:[[motion,'ejecuta render.mjs']])])if(!fs.existsSync(f))throw Error(`Falta ${path.relative(L.paths.base,f)}: ${why}`);
const prompt=fs.readFileSync(promptFile,'utf8').trim();if(/\[\[/.test(prompt))throw Error('El prompt tiene huecos [[...]] sin resolver');
const refs=readJSON(refsFile);
// Modo fotograma: el fotograma debe existir y todo el reparto debe tener su descriptor aprobado en el registro.
if(frameMode){if(!refs.image||!fs.existsSync(path.join(L.paths.base,refs.image)))throw Error(`No existe el fotograma ${refs.image}`);for(const id of refs.cast||[]){const e=Object.entries(L.registry.assets).find(([,a])=>a.kind==='character'&&a.character===id);if(!e||e[1].status!=='approved')throw Error(`Tag sin aprobar para ${id}: congélalo con registro.mjs freeze`);}}
// Pista de voz: silencio hasta el inicio de la línea + la frase, hasta la duración pedida.
if(frameMode&&block.voices?.length&&!refs.lineAudio)console.warn('Aviso: el bloque tiene diálogo y la línea no tiene audio; genera las voces con voces.mjs y repite prompt.mjs, o el modelo inventará la voz.');
let voiceTrack=null;if(frameMode&&refs.lineAudio){const src=path.join(L.paths.base,refs.lineAudio.file);if(!fs.existsSync(src))throw Error(`No existe el audio de la línea ${refs.lineAudio.file}`);voiceTrack=path.join(dir,'voz.wav');ffmpeg(['-i',src,'-af',`adelay=${Math.round(refs.lineAudio.start*1000)}:all=1,apad,atrim=0:${refs.durationRequested}`,'-ar','44100','-ac','1',voiceTrack]);}for(const r of [...refs.images,...refs.audios]){if(!r.file)throw Error(`Referencia sin fichero: ${r.tag}`);if(!fs.existsSync(path.join(L.paths.base,r.file)))throw Error(`No existe ${r.file} (${r.tag})`);const a=L.registry.assets[r.tag];if(!a||a.status!=='approved')throw Error(`Tag sin aprobar: ${r.tag}`);}
const attempts=loadAttempts(L.paths.out,blockId);const n=attempts.length+1;const prev=attempts.at(-1);
if(n>6)throw Error('R26: seis intentos sobre el mismo bloque; cambia el bloque (divide, quita una acción, inserto de objeto u otra cámara) y crea un lote nuevo');
if(n>=5)console.warn('R26: quinto intento o más; el protocolo pide cambiar el bloque, no la frase.');
if(n>=2&&!opts.changed&&!opts['changed-ref'])throw Error('R26: a partir del segundo intento indica la única línea cambiada con --changed "…" (o el único cambio de referencias con --changed-ref "…")');
if(prev&&prev.status==='submitted'&&!prev.verdict)throw Error(`El intento ${prev.n} aún no tiene veredicto; ejecuta estado.mjs`);
if(opts.changed&&!prompt.includes(String(opts.changed).trim()))throw Error('La línea de --changed no aparece literal en prompt.txt');
if(prev&&fs.existsSync(path.join(dir,prev.prompt))){const old=fs.readFileSync(path.join(dir,prev.prompt),'utf8').trim().split('\n'),now=prompt.split('\n');const changed=now.filter(l=>!old.includes(l)).length+old.filter(l=>!now.includes(l)).length;if(changed>2)console.warn(`Aviso R26: hay ${changed} líneas distintas respecto al intento ${prev.n}; el protocolo es una sola.`);}
const input=frameMode?{duration:refs.durationRequested,resolution:'768P',prompt_expansion_mode:'disabled',prompt}:{duration:refs.durationRequested,resolution:'768P',aspect_ratio:'16:9',prompt_expansion_mode:'disabled',prompt};
console.log(frameMode?`${lote}/${blockId} intento ${n} (fotograma): pide ${input.duration} s · primer fotograma ${refs.image} · voz ${voiceTrack?path.relative(L.paths.base,voiceTrack):'—'}`:`${lote}/${blockId} intento ${n}: pide ${input.duration} s · imágenes ${refs.images.map(i=>i.tag).join(', ')} · audios ${refs.audios.map(a=>a.tag).join(', ')||'—'} · vídeo motion.mp4`);
if(!opts.yes){console.log('Ensayo: no se ha enviado nada. Añade --yes para enviar (coste ≈ '+(input.duration*(opts.modelo==='h3'?0.06:0.08)).toFixed(2)+' $ a 768P'+(opts.modelo==='h3'?', H3 original':'')+').');process.exit(0);}
const client=await falClient();const cacheFile=L.paths.uploads;const cache=fs.existsSync(cacheFile)?readJSON(cacheFile):{};
async function upload(rel,type){const abs=path.join(L.paths.base,rel);const key=rel+':'+fs.statSync(abs).mtimeMs;if(!cache[key]){cache[key]=await uploadFile(client,abs,{type});writeJSON(cacheFile,cache);}return cache[key];}
if(frameMode){input.image_url=await upload(refs.image,'image/png');if(refs.endImage)input.end_image_url=await upload(refs.endImage,'image/png');if(voiceTrack)input.target_audio_url=await upload(path.relative(L.paths.base,voiceTrack),'audio/wav');}
else{const motionRel=path.relative(L.paths.base,motion);
input.reference_image_urls=await Promise.all(refs.images.map(i=>upload(i.file,'image/png')));input.reference_video_urls=[await upload(motionRel,'video/mp4')];if(refs.audios.length)input.reference_audio_urls=await Promise.all(refs.audios.map(a=>upload(a.file,'audio/wav')));}
const promptName=`prompt-v${String(n).padStart(2,'0')}.txt`,requestName=`request-v${String(n).padStart(2,'0')}.json`;fs.copyFileSync(promptFile,path.join(dir,promptName));
// --modelo h3: el H3 original (image-to-video) en lugar de H3 Max; mismos parámetros, 0,06 $/s a 768P.
const endpoint=frameMode?(opts.modelo==='h3'?'minimax/h3/image-to-video':'minimax/h3-max/image-to-video'):'minimax/h3-max/reference-to-video';const attempt={n,at:new Date().toISOString(),endpoint,prompt:promptName,request:requestName,refs:frameMode?[refs.image,...(refs.endImage?['fin:'+refs.endImage]:[]),...(voiceTrack?['voz.wav']:[])]:[...refs.images.map(i=>i.tag),...refs.audios.map(a=>a.tag)],durationRequested:input.duration,resolution:'768P',changedLine:opts.changed||(opts['changed-ref']?'[referencias] '+opts['changed-ref']:null),status:'submitting'};
writeJSON(path.join(dir,requestName),{status:'submitting',endpoint,input});attempts.push(attempt);saveAttempts(L.paths.out,blockId,attempts);
const q=await submit(client,endpoint,input);attempt.requestId=q.request_id;attempt.status='submitted';writeJSON(path.join(dir,requestName),{status:'submitted',endpoint,input,requestId:q.request_id});saveAttempts(L.paths.out,blockId,attempts);
console.log('ENVIADO',blockId,'intento',n,q.request_id,'→ node scripts/bloques/estado.mjs',lote,blockId);
