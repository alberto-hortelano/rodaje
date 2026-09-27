#!/usr/bin/env node
// Perfil maestro de interpretación y voice prompt por personaje (PROCESO.md, paso 3; skill `interpretacion`).
// La fuente de verdad es proyecto.json: este script la edita con store.save(), que regenera hoja.md.
//   node scripts/perfil.mjs show [proyecto] <id>
//   node scripts/perfil.mjs set  [proyecto] <id> --acting <fichero.txt> --voice "<voice prompt>"
//   node scripts/perfil.mjs set  [proyecto] <id> --acting-text "<párrafo>"
//   node scripts/perfil.mjs list [proyecto]
// Proyecto: [proyecto] o --project id, RODAJE_PROJECT o el activo en la app (se imprime «Proyecto: X» en stderr).
import fs from 'node:fs';
import {load,save} from '../app/store.mjs';import {forbiddenEmotionWords} from '../app/workflow.mjs';import {takeOption} from '../lib/args.mjs';import {cliProject,usageExit} from '../lib/cli.mjs';
const USAGE='Uso: perfil.mjs list [proyecto] · show|set [proyecto] <id> [--acting fichero | --acting-text texto] [--voice texto] · [--project id]';
const argv=process.argv.slice(2);const p0=takeOption(argv,'--project');const cmd=argv.shift();
if(!['list','show','set'].includes(cmd))usageExit(USAGE);
// Posicionales hasta la primera --opción; el resto son opciones.
const cut=argv.findIndex(a=>a.startsWith('--')),pos=cut<0?argv:argv.slice(0,cut),flags=cut<0?[]:argv.slice(cut);
const {project,args:[id]}=cliProject({usage:USAGE,opts:{project:p0},args:pos,positional:cmd==='list'?0:1});
if(cmd!=='list'&&!id)usageExit(USAGE,'Falta el personaje');
const opt=k=>{const i=flags.indexOf(k);return i>=0?flags[i+1]:undefined;};
const p=load(project);
if(cmd==='list'){for(const c of p.characters)console.log(`${c.id.padEnd(8)} ${c.kind||'person'}  acting=${c.acting?c.acting.split(/\s+/).length+' palabras':'—'}  voicePrompt=${c.voicePrompt?'sí':'—'}`);process.exit(0);}
const c=p.characters.find(c=>c.id===id);if(!c){console.error('Personaje desconocido: '+id);process.exit(2);}
if(cmd==='show'){console.log(`# ${c.name}\n\n## Interpretación\n${c.acting||'—'}\n\n## Voice prompt\n${c.voicePrompt||'—'}`);process.exit(0);}
const acting=opt('--acting')?fs.readFileSync(opt('--acting'),'utf8').trim():opt('--acting-text');const voice=opt('--voice');
if(acting!==undefined){const words=acting.split(/\s+/).filter(Boolean).length;if(words<120||words>240)console.warn(`Aviso: el perfil tiene ${words} palabras (objetivo 150–220)`);const emo=forbiddenEmotionWords(acting);if(emo.length){console.error('El perfil nombra emociones ('+emo.join(', ')+'); escríbelas como conducta');process.exit(1);}if(/\b(camera|lens|shot|frame|wearing|jacket|suit|helmet colour|color)\b/i.test(acting))console.warn('Aviso: el perfil parece incluir vestuario o cámara; deben ir fuera');c.acting=acting;}
if(voice!==undefined){if(voice.split(/\s+/).length>60)console.warn('Aviso: el voice prompt debería ser una o dos frases');c.voicePrompt=voice.trim();}
save(p);console.log(`Guardado ${c.id} (revisión ${p.revision}). Recuerda: node scripts/registro.mjs sync ${project} para copiar el voice prompt al registro si su descriptor está vacío.`);
