// Vista Montaje: lotes de assets/<lote>/ (lecturas en lib/lotes.mjs); veredictos y remontaje (scripts/bloques/montar.mjs).
// storyboardMediaFor: tomas y montajes de un storyboard para la vista Storyboards (solo lectura).
import path from 'node:path';import {execFile} from 'node:child_process';
import {ROOT} from '../lib/paths.mjs';import {loteDir,reviewBlock,listLotes,storyboardMediaFor,loteDetail as readLoteDetail} from '../lib/lotes.mjs';
export {listLotes,storyboardMediaFor};export {listAnimatics} from '../lib/animaticas.mjs';
const running=new Map();
const status=(project,lote)=>running.get(project+'/'+lote)||null;
export function loteDetail(project,lote){return readLoteDetail(project,lote,status(project,lote));}
// Veredicto desde la vista: la misma función que estado.mjs --verdict (sin attempt, el último intento).
export function review(project,lote,block,opts){return reviewBlock(project,lote,block,opts).list;}
export function montar(project,lote){const key=project+'/'+lote;if(running.get(key)?.state==='running')throw Error('Ya se está montando este lote');loteDir(project,lote);const job={state:'running',started:new Date().toISOString()};running.set(key,job);
 execFile(process.execPath,[path.join(ROOT,'scripts/bloques/montar.mjs'),lote,'--project',project],{cwd:ROOT,maxBuffer:1<<24},(err,stdout,stderr)=>{Object.assign(job,{state:err?'failed':'done',finished:new Date().toISOString(),output:String(stdout).trim().split('\n').at(-1),error:err?String(stderr||err.message).trim().split('\n').slice(-6).join('\n'):null});});return job;}
