// Captura UNA vez, con el código previo a la #42, el prompt de cada caso de casos-42.mjs sobre `base` en ref-42/<caso>.txt.
// Uso: node --import ./test/setup.mjs test/fixtures/ep01-s01-b02/capturar-42.mjs
import fs from 'node:fs';import path from 'node:path';
import {blockPrompt} from '../../../app/workflow.mjs';
import {base} from './datos.mjs';import {casos} from './casos-42.mjs';
const out=path.join(import.meta.dirname,'ref-42');fs.mkdirSync(out,{recursive:true});
for(const {name,args} of casos(base)){fs.writeFileSync(path.join(out,name+'.txt'),blockPrompt(args).prompt);console.log(name);}
