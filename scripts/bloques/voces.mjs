#!/usr/bin/env node
// Voces de los personajes con ElevenLabs a través de fal (derechos comerciales incluidos; solo voces de serie y de la biblioteca
// pública). Todo es de pago salvo el ensayo sin --yes: pedir aprobación antes (CLAUDE.md).
//   node scripts/bloques/voces.mjs lineas <episodio> <secuencia> [--linea <id>] [--project id] [--yes] [--force]
//     Genera con eleven-v3 cada línea en cuadro sin audio y la guarda en la línea (l.audio, l.audioDuration).
//     Voz: la del personaje. Estabilidad y etiquetas por defecto («tags», p. ej. "[quietly]"): del casting.json de su carpeta
//     de la biblia. Etiquetas de una frase concreta: campo `delivery` de la línea (p. ej. "[tired] [kindly]"); no se pronuncian.
//   node scripts/bloques/voces.mjs prueba --voz <id|nombre> --texto "<frase>" [--estabilidad 0.4] [--modelo minimax] [--project id] [--yes]
//     Genera una frase suelta para comparar voces, en assets/voces/pruebas/. No toca el proyecto.
//   node scripts/bloques/voces.mjs cambiar <episodio> <secuencia> <línea> <grabación> [--project id] [--yes]
//     Pasa una grabación (la frase dicha por una persona, con la interpretación buscada) por el cambiador de voz con la voz
//     del personaje y la guarda como audio de esa línea.
//   node scripts/bloques/voces.mjs disenar --personaje <id> --descripcion "<voz>" --texto "<frase de muestra>" [--project id] [--yes]
//     Diseña una voz nueva con MiniMax (3 $ por voz) y la guarda como candidata en el casting.json del personaje, con su muestra.
//     Para conservarla hay que usarla en una generación de voz antes de 7 días. Para adoptarla: voz del personaje = su ID y
//     "modelo": "minimax" en la entrada del idioma del casting.json.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {load,save,dir} from '../../app/store.mjs';
import {parseArgs,falClient,ffprobeDuration,writeJSON,cliProject,usageExit} from './lib.mjs';
const {args:[cmd,...rest],opts}=parseArgs(process.argv.slice(2));
const usage='Uso: voces.mjs lineas <episodio> <secuencia> | prueba --voz <id> --texto "…" [--modelo minimax] | disenar --personaje <id> --descripcion "…" --texto "…" | cambiar <episodio> <secuencia> <línea> <grabación>  [--project id] [--yes]';
if(!['lineas','prueba','cambiar','disenar'].includes(cmd))usageExit(usage);
const {project}=cliProject({usage,opts}),base=dir(project);const p=load(project);
// casting.json de la biblia: la entrada del idioma del proyecto cuya voz coincide con la del personaje.
const castings=[];const bib=path.join(base,'biblia','personajes');if(fs.existsSync(bib))for(const d of fs.readdirSync(bib)){const f=path.join(bib,d,'voz','casting.json');if(fs.existsSync(f))castings.push(JSON.parse(fs.readFileSync(f,'utf8')));}
const settingsFor=c=>castings.map(x=>x[p.language]).find(x=>x?.voice===c.voice)||{};
const toWav=(mp3)=>{const wav=mp3.replace(/\.[a-z0-9]+$/,'.wav');execFileSync('ffmpeg',['-y','-v','error','-i',mp3,'-ar','44100','-ac','1',wav]);return wav;};
// Solo por fal: da derechos de uso comercial (la cuenta propia de ElevenLabs del usuario es de uso no comercial). Devuelve el mp3 como Buffer.
const fetchBuf=async url=>Buffer.from(await (await fetch(url)).arrayBuffer());
const tts=async(client,text,voice,stability)=>{const r=await client.subscribe('fal-ai/elevenlabs/tts/eleven-v3',{input:{text,voice,stability,language_code:p.language}});const url=r.data?.audio?.url;if(!url)throw Error('ElevenLabs no devolvió audio');return fetchBuf(url);};
// MiniMax Speech-02 HD: voces de serie de MiniMax o diseñadas con `disenar` (custom_voice_id). Sin etiquetas de interpretación.
const minimax=async(client,text,voice,speed=1)=>{const r=await client.subscribe('fal-ai/minimax/speech-02-hd',{input:{text:text.replace(/\[[^\]]*\]\s*/g,''),voice_setting:{voice_id:voice,speed},language_boost:'English',output_format:'url'}});const url=r.data?.audio?.url;if(!url)throw Error('MiniMax no devolvió audio');return fetchBuf(url);};
const say=(client,text,voice,s)=>s.modelo==='minimax'?minimax(client,text,voice,s.speed??1):tts(client,text,voice,s.stability??.5);
const sts=async(client,recording,voice)=>{const up=await client.storage.upload(new File([fs.readFileSync(recording)],path.basename(recording)));const r=await client.subscribe('fal-ai/elevenlabs/voice-changer',{input:{audio_url:up,voice,remove_background_noise:true}});const url=r.data?.audio?.url;if(!url)throw Error('El cambiador de voz no devolvió audio');return fetchBuf(url);};
const writeMp3=(buf,file)=>{fs.writeFileSync(file,buf);return file;};
const lineText=(c,l)=>[settingsFor(c).tags,l.delivery,l.spokenText||l.text].filter(Boolean).join(' ').trim();

if(cmd==='prueba'){
 if(!opts.voz||!opts.texto)throw Error(usage);const stability=opts.estabilidad!==undefined?Number(opts.estabilidad):.5;
 console.log(`Prueba${opts.modelo==='minimax'?' (MiniMax)':''}: voz ${opts.voz} · estabilidad ${stability} · «${opts.texto}»`);
 if(!opts.yes){console.log('Ensayo: añade --yes para generarla (ElevenLabs, de pago).');process.exit(0);}
 const client=await falClient();const out=path.join(base,'assets','voces','pruebas');fs.mkdirSync(out,{recursive:true});
 const name=`${String(opts.voz).replace(/[^A-Za-z0-9]/g,'')}-s${stability}-${Date.now()}.mp3`;const wav=toWav(writeMp3(await say(client,opts.texto,opts.voz,{modelo:opts.modelo,stability}),path.join(out,name)));
 console.log('✓',path.relative(base,wav));process.exit(0);}

if(cmd==='disenar'){
 const c=p.characters.find(c=>c.id===opts.personaje);if(!c||!opts.descripcion||!opts.texto)throw Error(usage);
 const folder=fs.existsSync(bib)&&fs.readdirSync(bib).find(d=>new RegExp(`^\\d+-${c.id}$`).test(d));if(!folder)throw Error(`No encuentro la carpeta de ${c.id} en la biblia`);
 const castFile=path.join(bib,folder,'voz','casting.json');console.log(`Diseño de voz MiniMax para ${c.name} (3 $): «${opts.descripcion}»\nMuestra: «${opts.texto}»\nSe guardará como candidata en ${path.relative(base,castFile)}`);
 if(!opts.yes){console.log('Ensayo: añade --yes para diseñarla (de pago).');process.exit(0);}
 const client=await falClient();const r=await client.subscribe('fal-ai/minimax/voice-design',{input:{prompt:opts.descripcion,preview_text:opts.texto}});const id=r.data?.custom_voice_id,url=r.data?.audio?.url;if(!id)throw Error('MiniMax no devolvió custom_voice_id');
 const out=path.join(base,'assets','voces','disenos');fs.mkdirSync(out,{recursive:true});const wav=url?toWav(writeMp3(await fetchBuf(url),path.join(out,`${c.id}-${id}.mp3`))):null;
 fs.mkdirSync(path.dirname(castFile),{recursive:true});const cast=fs.existsSync(castFile)?JSON.parse(fs.readFileSync(castFile,'utf8')):{};
 (cast.candidatas??=[]).push({modelo:'minimax',voice:id,descripcion:opts.descripcion,muestra:wav&&path.relative(base,wav),texto:opts.texto,fecha:new Date().toISOString().slice(0,10),caduca:'se borra si no se usa en una generación antes de 7 días'});
 writeJSON(castFile,cast);console.log('✓ voz',id,'· muestra',wav&&path.relative(base,wav));process.exit(0);}
const [episodeId,sequenceId]=rest;const seq=p.episodes.find(e=>e.id===episodeId)?.sequences.find(s=>s.id===sequenceId);if(!seq)throw Error('Secuencia desconocida. '+usage);
const out=path.join(base,'assets','voces',seq.id);

if(cmd==='cambiar'){
 const [, ,lineId,recording]=rest;const t=seq.shots.find(t=>t.lines.some(l=>l.id===lineId));if(!t||!recording)throw Error(usage);const l=t.lines.find(l=>l.id===lineId);const c=p.characters.find(c=>c.id===l.character);if(!c?.voice)throw Error(`${c?.name||l.character} no tiene voz asignada`);if(!fs.existsSync(recording))throw Error('No existe la grabación '+recording);
 console.log(`${t.title}: ${c.name} «${l.text}» · grabación ${recording} → voz ${c.voice}`);
 if(!opts.yes){console.log('Ensayo: añade --yes para convertirla (ElevenLabs, de pago).');process.exit(0);}
 const client=await falClient();fs.mkdirSync(out,{recursive:true});
 const wav=toWav(writeMp3(await sts(client,recording,c.voice),path.join(out,l.id+'-cambiada.mp3')));l.audio=path.relative(base,wav);l.audioDuration=Math.round((ffprobeDuration(wav)||0)*100)/100;l.audioSource='voice-changer';
 save(p,p.revision);console.log('✓',c.name,l.audio,l.audioDuration+' s · revisión',p.revision);process.exit(0);}

// lineas
const todo=seq.shots.flatMap(t=>t.lines.map(l=>({t,l}))).filter(({l})=>!l.offscreen&&(!opts.linea||l.id===opts.linea)&&(opts.force||!l.audio));
if(!todo.length){console.log('Todas las líneas en cuadro ya tienen audio (--force para regenerarlas).');process.exit(0);}
for(const {t,l} of todo){const c=p.characters.find(c=>c.id===l.character);if(!c?.voice)throw Error(`${c?.name||l.character} no tiene voz asignada`);console.log(`${t.title}: ${c.name} «${lineText(c,l)}» · voz ${c.voice} · estabilidad ${settingsFor(c).stability??.5}`);}
if(!opts.yes){console.log(`Ensayo: ${todo.length} líneas, ${todo.reduce((n,{l})=>n+l.text.length,0)} caracteres. Añade --yes para generarlas (ElevenLabs, de pago).`);process.exit(0);}
const client=await falClient();fs.mkdirSync(out,{recursive:true});
for(const {l} of todo){const c=p.characters.find(c=>c.id===l.character);const s=settingsFor(c);
 const wav=toWav(writeMp3(await say(client,lineText(c,l),c.voice,s),path.join(out,l.id+'.mp3')));
 l.audio=path.relative(base,wav);l.audioDuration=Math.round((ffprobeDuration(wav)||0)*100)/100;delete l.audioSource;console.log('✓',c.name,l.audio,l.audioDuration+' s');}
save(p,p.revision);console.log('Guardado, revisión',p.revision);
