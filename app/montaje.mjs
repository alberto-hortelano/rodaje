// Vista Montaje: lotes de assets/<lote>/ (lecturas en lib/lotes.mjs); veredictos y remontaje (scripts/bloques/montar.mjs).
import fs from 'node:fs';import path from 'node:path';import {execFile} from 'node:child_process';
import {ROOT} from '../lib/paths.mjs';import {readJSON} from '../lib/json.mjs';import {loteDir,checkName,attemptsPath,updateAttempts,projectRules,listLotes,loteDetail as readLoteDetail} from '../lib/lotes.mjs';import {reviewAttempt} from './workflow.mjs';
export {listLotes};
const running=new Map();
const status=(project,lote)=>running.get(project+'/'+lote)||null;
export function loteDetail(project,lote){return readLoteDetail(project,lote,status(project,lote));}
export function review(project,lote,block,opts){const d=loteDir(project,lote);if(!fs.existsSync(attemptsPath(d,checkName(block,'Bloque'))))throw Error('El bloque no tiene intentos');const b=readJSON(path.join(d,'plan.json')).find(x=>x.id===block);const known=projectRules(project).map(r=>r.id);
 return updateAttempts(d,block,list=>reviewAttempt(list,{...opts,length:b?.length,known}));}
export function montar(project,lote){const key=project+'/'+lote;if(running.get(key)?.state==='running')throw Error('Ya se está montando este lote');loteDir(project,lote);const job={state:'running',started:new Date().toISOString()};running.set(key,job);
 execFile(process.execPath,[path.join(ROOT,'scripts/bloques/montar.mjs'),lote,'--project',project],{cwd:ROOT,maxBuffer:1<<24},(err,stdout,stderr)=>{Object.assign(job,{state:err?'failed':'done',finished:new Date().toISOString(),output:String(stdout).trim().split('\n').at(-1),error:err?String(stderr||err.message).trim().split('\n').slice(-3).join('\n'):null});});return job;}
