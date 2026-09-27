// Utilidades compartidas por los scripts de lote (docs/PROCESO.md, pasos 5–8). Lotes y attempts.json: lib/lotes.mjs.
import fs from 'node:fs';import path from 'node:path';import {ffmpeg} from '../../lib/media.mjs';
import {ROOT} from '../../lib/paths.mjs';import {readJSON,writeJSON} from '../../lib/json.mjs';import {parseArgs} from '../../lib/args.mjs';import {cliProject,usageExit} from '../../lib/cli.mjs';
export {ROOT,readJSON,writeJSON,parseArgs,cliProject,usageExit};
export {probeDurationOrNull as ffprobeDuration} from '../../lib/media.mjs';
export function ff(args){ffmpeg(args,{inherit:true});}
export function prices(){const f=path.join(ROOT,'precios.json');return fs.existsSync(f)?readJSON(f):{};}
export {falClient} from '../../lib/fal.mjs';
