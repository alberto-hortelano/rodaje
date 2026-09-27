#!/usr/bin/env node
// Registro de assets con descriptores congelados (PROCESO.md, paso 3).
//   node scripts/registro.mjs sync   [proyecto]        crea entradas draft para lo que existe en proyecto.json y aún no está registrado
//   node scripts/registro.mjs freeze [proyecto] TAG… fija sha256 y marca approved (el descriptor no puede estar vacío)
//   node scripts/registro.mjs render [proyecto]       escribe REGISTRO.md
//   node scripts/registro.mjs check  [proyecto]       falla si un prompt usa tags no aprobados, o un MAPA.md mide en metros
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {dir,load} from '../app/store.mjs';import {readJSON,writeJSON} from '../lib/json.mjs';import {tagFor} from '../app/workflow.mjs';
const [cmd,...rest]=process.argv.slice(2);const project=rest[0]&&!/^[A-Z0-9_]+$/.test(rest[0])?rest.shift():'dead-air';
const base=dir(project),file=path.join(base,'registro.json');
const reg=fs.existsSync(file)?readJSON(file):{version:1,summary:'',lighting:{},assets:{}};
const save=()=>writeJSON(file,reg);
const sha=f=>fs.existsSync(path.join(base,f))?createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex'):null;
const today=()=>new Date().toISOString().slice(0,10);
function sync(){const p=load(project);let added=0;const add=(tag,a)=>{if(!reg.assets[tag]){reg.assets[tag]={...a,descriptor:a.descriptor||'',status:'draft'};added++;}};
 for(const c of p.characters){if(c.kind!=='voice'){const variants=Object.entries(c.variants||{}).filter(([,v])=>v?.image);if(c.image)add(tagFor(c.id,'base'),{kind:'character',character:c.id,variant:'',file:c.image});for(const [v,d] of variants)add(tagFor(c.id,v),{kind:'character',character:c.id,variant:v,file:d.image});}
  if(c.voice||c.voicePrompt){const tag=`${c.id.toUpperCase()}_VOICE`;add(tag,{kind:'voice',character:c.id,file:'',elevenlabs:c.voice||'',descriptor:c.voicePrompt||''});if(reg.assets[tag]&&!reg.assets[tag].descriptor&&c.voicePrompt)reg.assets[tag].descriptor=c.voicePrompt;}}
 for(const l of p.locations){if(!l.image)continue;const exists=Object.values(reg.assets).some(a=>a.kind==='location'&&(a.location===l.id||(a.aliases||[]).includes(l.id)));if(!exists)add(`${l.id.toUpperCase().replace(/-/g,'_')}_PLATE`,{kind:'location',location:l.id,aliases:[],file:l.image});}
 save();console.log(`sync: ${added} entradas nuevas (draft). Total ${Object.keys(reg.assets).length}.`);}
function freeze(tags){for(const tag of tags){const a=reg.assets[tag];if(!a)throw Error('No existe el tag '+tag);if(!a.descriptor?.trim())throw Error(`${tag}: descriptor vacío; escríbelo antes de congelar`);if(a.file){const h=sha(a.file);if(!h)throw Error(`${tag}: no existe el fichero ${a.file}`);a.sha256=h;}a.status='approved';a.since=a.since||today();console.log('approved',tag);}save();}
function render(){const rows=Object.entries(reg.assets).sort(([a],[b])=>a.localeCompare(b)).map(([tag,a])=>`| \`${tag}\` | ${a.kind} | ${a.status} | ${a.file?`\`${a.file}\``:''}${a.file&&/\.(png|jpe?g|webp)$/i.test(a.file)?`<br><img src="${a.file}" width="160">`:''} | ${(a.descriptor||'').replace(/\|/g,'\\|')} |`);
 const md=`# Registro de assets · ${project}\n\nGenerado por \`scripts/registro.mjs render\`. No editar: la fuente es \`registro.json\`. Un prompt solo puede citar tags en estado **approved** y pega el descriptor tal cual.\n\nResumen del proyecto: ${reg.summary||'—'}\n\n| Tag | Tipo | Estado | Fichero | Descriptor congelado |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;fs.writeFileSync(path.join(base,'REGISTRO.md'),md);console.log('REGISTRO.md:',rows.length,'assets');}
function walk(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f,out);else out.push(f);}return out;}
function check(){const errors=[];const assetsDir=path.join(base,'assets');
 for(const f of fs.existsSync(assetsDir)?walk(assetsDir):[]){if(!/prompt(-v\d+)?\.txt$/.test(f))continue;const txt=fs.readFileSync(f,'utf8');for(const m of txt.matchAll(/@([A-Z0-9_]+)/g)){const a=reg.assets[m[1]];if(!a)errors.push(`${path.relative(base,f)}: tag desconocido @${m[1]}`);else if(a.status!=='approved')errors.push(`${path.relative(base,f)}: tag sin aprobar @${m[1]}`);}if(/\[\[/.test(txt))errors.push(`${path.relative(base,f)}: huecos [[...]] sin resolver`);}
 for(const l of fs.existsSync(path.join(base,'ambientes'))?fs.readdirSync(path.join(base,'ambientes')):[]){const m=path.join(base,'ambientes',l,'MAPA.md');if(!fs.existsSync(m))continue;const md=fs.readFileSync(m,'utf8');const prompt=/```prompt\s*\n([\s\S]*?)```/.exec(md)?.[1]||'';if(/\b\d+([.,]\d+)?\s?(m|metres|meters|metros)\b/i.test(prompt))errors.push(`ambientes/${l}/MAPA.md: el párrafo del prompt mide en metros; usa landmarks`);if(!prompt.trim())errors.push(`ambientes/${l}/MAPA.md: falta el bloque \`\`\`prompt`);}
 for(const [tag,a] of Object.entries(reg.assets)){if(a.status==='approved'&&a.file&&a.sha256&&sha(a.file)!==a.sha256)errors.push(`${tag}: el fichero ${a.file} cambió desde que se congeló; abre una versión nueva`);if(a.kind==='location'&&a.status==='approved'&&!/not framing/i.test(a.descriptor||''))errors.push(`${tag}: el descriptor de localización debe terminar en "Controls geometry, materials, light and atmosphere ONLY — not framing."`);if(a.kind==='character'&&a.status==='approved'&&!/100% matches the reference/i.test(a.descriptor||''))errors.push(`${tag}: el descriptor de personaje debe terminar en "100% matches the reference."`);}
 if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('check: sin errores');}
({sync,freeze:()=>freeze(rest),render,check}[cmd]||(()=>{console.error('Uso: registro.mjs sync|freeze|render|check [proyecto] [TAG…]');process.exit(2);}))();
