// Utilidades compartidas por los scripts de lote (PROCESO.md, pasos 5–8). Lotes y attempts.json: lib/lotes.mjs.
import fs from 'node:fs';import path from 'node:path';import {ffmpeg} from '../../lib/media.mjs';
import {ROOT,loadEnv} from '../../lib/paths.mjs';import {readJSON,writeJSON} from '../../lib/json.mjs';import {parseArgs} from '../../lib/args.mjs';import {cliProject,usageExit} from '../../lib/cli.mjs';
export {ROOT,readJSON,writeJSON,parseArgs,cliProject,usageExit};
export {probeDurationOrNull as ffprobeDuration} from '../../lib/media.mjs';
export function ff(args){ffmpeg(args,{inherit:true});}
export function prices(){const f=path.join(ROOT,'precios.json');return fs.existsSync(f)?readJSON(f):{};}
export async function falClient(){loadEnv();if(!process.env.FAL_KEY){const c=path.join(ROOT,'config.local.json');if(fs.existsSync(c))process.env.FAL_KEY=readJSON(c).falKey||readJSON(c).FAL_KEY||'';}if(!process.env.FAL_KEY)throw Error('Falta FAL_KEY (.env o config.local.json)');const {createFalClient}=await import('@fal-ai/client');return createFalClient({credentials:process.env.FAL_KEY});}
