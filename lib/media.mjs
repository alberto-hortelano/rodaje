// ffmpeg y ffprobe síncronos para la app y los scripts. Sin timeouts. Nunca importa app/.
// Fuera: el vídeo en streaming de scripts/bloques/render.mjs (spawn) y la comprobación ffmpeg -version de app/server.mjs.
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const PROBE=['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1'];
export const CAPTURE={maxBuffer:10*1024*1024};
// Segundos del fichero. Lanza si ffprobe falla (app). Salida vacía → 0.
export function probeDuration(file){return Number(execFileSync('ffprobe',[...PROBE,file],{encoding:'utf8'}).trim());}
// Igual, pero null si falla (scripts).
export function probeDurationOrNull(file){try{return probeDuration(file);}catch{return null;}}
// ffmpeg -y -v error …args. Por defecto captura la salida (10 MB; si falla, el error trae el stderr en su mensaje).
// inherit: salida heredada (scripts y montaje).
export function ffmpeg(args,{inherit=false}={}){const argv=['-y','-v','error',...args.map(String)];return inherit?execFileSync('ffmpeg',argv,{stdio:'inherit'}):execFileSync('ffmpeg',argv,CAPTURE);}
// ffmpeg -v error …args sin -y; devuelve stdout (Buffer). Para salidas a '-'.
export function ffmpegStdout(args){return execFileSync('ffmpeg',['-v','error',...args.map(String)],CAPTURE);}
// Lista para ffmpeg -f concat: rutas relativas (POSIX) a la carpeta de la lista, ' escapada como '\''. Lanza si alguna ruta no es absoluta.
export function concatList(files,listDir){return files.map(f=>{if(!path.isAbsolute(f))throw Error('concatList: ruta no absoluta: '+f);
 return `file '${path.relative(listDir,f).split(path.sep).join('/').replace(/'/g,"'\\''")}'`;}).join('\n')+'\n';}
// Argumentos de ffmpeg (sin -y/-v) para voz.wav: cada línea en su inicio, silencio hasta la duración pedida, 44,1 kHz mono.
// items: [{src, start}] en segundos de bloque. Con una sola línea, la cadena -af de siempre; con varias, amix sin normalizar (cada voz a su nivel).
export function voiceTrackArgs(items,duration,out){if(!items?.length)throw Error('voiceTrackArgs: ninguna línea con audio');const ms=s=>Math.round(s*1000),tail=['-ar','44100','-ac','1',out];
 if(items.length===1)return ['-i',items[0].src,'-af',`adelay=${ms(items[0].start)}:all=1,apad,atrim=0:${duration}`,...tail];
 const f=items.map((x,i)=>`[${i}:a]adelay=${ms(x.start)}:all=1[v${i}]`);f.push(`${items.map((_,i)=>`[v${i}]`).join('')}amix=inputs=${items.length}:normalize=0:duration=longest,apad,atrim=0:${duration}[out]`);
 return [...items.flatMap(x=>['-i',x.src]),'-filter_complex',f.join(';'),'-map','[out]',...tail];}
// -filter_complex de edit.mp4 en montar.mjs: tramos de la toma (entrada 0) concatenados, 1280×720 a 24 fps y audio a 48 kHz.
// overlays: [{at}] voces fuera de campo (entradas 1…n), cada una en su instante del edit y mezclada sin normalizar sobre el audio de la toma.
export function editFilterComplex(spans,overlays=[]){const f=[],labels=[];spans.forEach(([s,e],i)=>{f.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`,`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);labels.push(`[v${i}][a${i}]`);});
 f.push(`${labels.join('')}concat=n=${spans.length}:v=1:a=1[cv][ca]`,'[cv]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24[v]');
 if(!overlays.length){f.push('[ca]afade=t=in:d=0.015,aresample=48000[a]');return f.join(';');}
 f.push('[ca]afade=t=in:d=0.015,aresample=48000,aformat=channel_layouts=stereo[base]');overlays.forEach((o,i)=>f.push(`[${i+1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(o.at*1000)}:all=1[o${i}]`));
 f.push(`[base]${overlays.map((_,i)=>`[o${i}]`).join('')}amix=inputs=${overlays.length+1}:normalize=0:duration=first[a]`);return f.join(';');}
