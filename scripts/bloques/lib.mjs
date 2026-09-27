// Utilidades compartidas por los scripts de lote (PROCESO.md, pasos 5–8). Lotes y attempts.json: lib/lotes.mjs.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {ROOT,loadEnv} from '../../lib/paths.mjs';import {readJSON,writeJSON} from '../../lib/json.mjs';import {parseArgs} from '../../lib/args.mjs';import {cliProject,usageExit} from '../../lib/cli.mjs';
export {ROOT,readJSON,writeJSON,parseArgs,cliProject,usageExit};
export function ffprobeDuration(file){try{return Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]).toString().trim());}catch{return null;}}
export function ff(args){execFileSync('ffmpeg',['-y','-v','error',...args.map(String)],{stdio:'inherit'});}
export function prices(){const f=path.join(ROOT,'precios.json');return fs.existsSync(f)?readJSON(f):{};}
export async function falClient(){loadEnv();if(!process.env.FAL_KEY){const c=path.join(ROOT,'config.local.json');if(fs.existsSync(c))process.env.FAL_KEY=readJSON(c).falKey||readJSON(c).FAL_KEY||'';}if(!process.env.FAL_KEY)throw Error('Falta FAL_KEY (.env o config.local.json)');const {createFalClient}=await import('@fal-ai/client');return createFalClient({credentials:process.env.FAL_KEY});}
