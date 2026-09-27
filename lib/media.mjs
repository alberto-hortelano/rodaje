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
