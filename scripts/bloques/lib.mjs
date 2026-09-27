// Utilidades compartidas por los scripts de lote (docs/PROCESO.md, pasos 5–8). Lotes y attempts.json: lib/lotes.mjs.
import fs from 'node:fs';import path from 'node:path';import {ffmpeg} from '../../lib/media.mjs';
import {ROOT} from '../../lib/paths.mjs';import {readJSON,writeJSON} from '../../lib/json.mjs';import {parseArgs} from '../../lib/args.mjs';import {cliProject,usageExit} from '../../lib/cli.mjs';
export {ROOT,readJSON,writeJSON,parseArgs,cliProject,usageExit};
export {probeDurationOrNull as ffprobeDuration} from '../../lib/media.mjs';
// ffmpeg con la salida heredada. Si falla: una línea propia tras su stderr (la vista Montaje se queda con la cola) y exit 1, sin traza.
export function ff(args,step='ffmpeg'){try{ffmpeg(args,{inherit:true});}catch(e){console.error(`${path.basename(process.argv[1]||'script','.mjs')}: ffmpeg falló (${e.status!=null?'código '+e.status:e.signal||e.code||e.message}) en ${step}`);process.exit(1);}}
// Error de uso o de datos: una línea con el nombre del script en stderr y exit 1, sin traza.
export function fail(msg){console.error(`${path.basename(process.argv[1]||'script','.mjs')}: ${msg}`);process.exit(1);}
export function prices(){const f=path.join(ROOT,'precios.json');return fs.existsSync(f)?readJSON(f):{};}
export {falClient} from '../../lib/fal.mjs';
