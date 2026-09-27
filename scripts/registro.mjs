#!/usr/bin/env node
// Registro de assets con descriptores congelados (docs/PROCESO.md, paso 3).
//   node scripts/registro.mjs sync   [proyecto]        crea entradas draft para lo que existe en proyecto.json y aún no está registrado
//   node scripts/registro.mjs freeze [proyecto] TAG… fija sha256 y marca approved (el descriptor no puede estar vacío)
//   node scripts/registro.mjs render [proyecto]       escribe REGISTRO.md
//   node scripts/registro.mjs check  [proyecto]       falla si un prompt usa tags no aprobados, un MAPA.md mide en metros o un estado no cuadra
//   node scripts/registro.mjs describe [proyecto] id[@estado]…  imprime el descriptor resuelto (estados en "states" del asset del personaje)
//   node scripts/registro.mjs textos [proyecto] [--desde fichero.json] [--simular]  imprime o aplica los textos de prompt (sound, constraints, texts):
//        en el parche, una clave presente reemplaza, null borra y ausente no toca; --simular solo lista lo que cambiaría
// Proyecto: [proyecto] o --project id, RODAJE_PROJECT o el activo en la app. Con freeze, un proyecto con id en MAYÚSCULAS va con --project;
// con describe, el proyecto posicional solo se toma si hay más argumentos y existe (si no, usa --project).
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {dir,load} from '../app/store.mjs';import {readJSON,writeJSON} from '../lib/json.mjs';import {tagFor,resolveDescriptor,stateErrors,REGISTRY_TEXT_KEYS,registryTextErrors,registryTextIssues,mergeRegistryTexts} from '../app/workflow.mjs';import {DATA} from '../lib/paths.mjs';import {takeOption} from '../lib/args.mjs';import {cliProject,usageExit} from '../lib/cli.mjs';
const USAGE='Uso: registro.mjs sync|render|check [proyecto] · freeze [proyecto] TAG… · describe [proyecto] id[@estado]… · textos [proyecto] [--desde fichero.json] [--simular] · [--project id]';
const argv=process.argv.slice(2);const p0=takeOption(argv,'--project'),desde=takeOption(argv,'--desde'),simular=takeOption(argv,'--simular');const [cmd,...more]=argv;
if(!['sync','freeze','render','check','describe','textos'].includes(cmd))usageExit(USAGE);
if(cmd!=='textos'&&(desde!==undefined||simular!==undefined))usageExit(USAGE,'--desde y --simular solo van con textos');
if(desde===true)usageExit(USAGE,'Falta el fichero de --desde');
const {project,args:rest}=cliProject({usage:USAGE,opts:{project:p0},args:more,positional:cmd==='freeze'?a=>a.length>0&&!/^[A-Z0-9_]+$/.test(a[0]):cmd==='describe'?a=>a.length>1&&!a[0].includes('@')&&fs.existsSync(path.join(DATA,a[0],'proyecto.json')):0});
if(cmd==='freeze'&&!rest.length)usageExit(USAGE,'Falta el TAG');
if(cmd==='describe'&&!rest.length)usageExit(USAGE,'Falta el personaje (id o id@estado)');
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
 const states=Object.entries(reg.assets).sort(([a],[b])=>a.localeCompare(b)).flatMap(([tag,a])=>a.kind==='character'&&a.states&&typeof a.states==='object'?Object.entries(a.states).map(([s,st])=>`| \`${a.character}@${s}\` | \`${tag}\` | ${(st?.drop||[]).map(x=>`«${x}»`).join('<br>').replace(/\|/g,'\\|')} | ${(st?.note||'').replace(/\|/g,'\\|')} |`):[]);
 const md=`# Registro de assets · ${project}\n\nGenerado por \`scripts/registro.mjs render\`. No editar: la fuente es \`registro.json\`. Un prompt solo puede citar tags en estado **approved** y pega el descriptor tal cual.\n\nResumen del proyecto: ${reg.summary||'—'}\n\n| Tag | Tipo | Estado | Fichero | Descriptor congelado |\n|---|---|---|---|---|\n${rows.join('\n')}\n${states.length?`\n## Estados\n\nDescriptor de un personaje en un estado (\`registro.mjs describe id@estado\`): el descriptor base sin las frases quitadas y con la nota al final.\n\n| Estado | Tag | Quita | Nota |\n|---|---|---|---|\n${states.join('\n')}\n`:''}`;fs.writeFileSync(path.join(base,'REGISTRO.md'),md);console.log('REGISTRO.md:',rows.length,'assets');}
function walk(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f,out);else out.push(f);}return out;}
function check(){const errors=[];const assetsDir=path.join(base,'assets');
 for(const f of fs.existsSync(assetsDir)?walk(assetsDir):[]){if(!/prompt(-v\d+)?\.txt$/.test(f))continue;const txt=fs.readFileSync(f,'utf8');for(const m of txt.matchAll(/@([A-Z0-9_]+)/g)){const a=reg.assets[m[1]];if(!a)errors.push(`${path.relative(base,f)}: tag desconocido @${m[1]}`);else if(a.status!=='approved')errors.push(`${path.relative(base,f)}: tag sin aprobar @${m[1]}`);}if(/\[\[/.test(txt))errors.push(`${path.relative(base,f)}: huecos [[...]] sin resolver`);}
 for(const l of fs.existsSync(path.join(base,'ambientes'))?fs.readdirSync(path.join(base,'ambientes')):[]){const m=path.join(base,'ambientes',l,'MAPA.md');if(!fs.existsSync(m))continue;const md=fs.readFileSync(m,'utf8');const prompt=/```prompt\s*\n([\s\S]*?)```/.exec(md)?.[1]||'';if(/\b\d+([.,]\d+)?\s?(m|metres|meters|metros)\b/i.test(prompt))errors.push(`ambientes/${l}/MAPA.md: el párrafo del prompt mide en metros; usa landmarks`);if(!prompt.trim())errors.push(`ambientes/${l}/MAPA.md: falta el bloque \`\`\`prompt`);}
 for(const [tag,a] of Object.entries(reg.assets)){if(a.status==='approved'&&a.file&&a.sha256&&sha(a.file)!==a.sha256)errors.push(`${tag}: el fichero ${a.file} cambió desde que se congeló; abre una versión nueva`);if(a.kind==='location'&&a.status==='approved'&&!/not framing/i.test(a.descriptor||''))errors.push(`${tag}: el descriptor de localización debe terminar en "Controls geometry, materials, light and atmosphere ONLY — not framing."`);errors.push(...stateErrors(tag,a));if(a.kind==='character'&&a.status==='approved'&&!/100% matches the reference/i.test(a.descriptor||''))errors.push(`${tag}: el descriptor de personaje debe terminar en "100% matches the reference."`);}
 errors.push(...registryTextErrors(reg).map(e=>'registro.json: '+e));for(const w of registryTextIssues(reg,loadOrNull()))console.log('aviso: registro.json: '+w);
 if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('check: sin errores');}
function describe(refs){let failed=false;for(const ref of refs){const r=resolveDescriptor(reg,ref);if(r.errors.length){failed=true;console.error(r.errors.map(e=>`${ref}: ${e}`).join('\n'));}else console.log(r.descriptor);}if(failed)process.exit(1);}
const loadOrNull=()=>{try{return load(project);}catch{return null;}};
// Textos de prompt del registro (docs/PROCESO.md, paso 3). Sin --desde los imprime; con --desde aplica el parche (errores: código 1 sin escribir).
function textos(){let out=reg;
 if(desde===undefined)console.log(JSON.stringify(Object.fromEntries(REGISTRY_TEXT_KEYS.map(k=>[k,reg[k]??null])),null,2));
 else{let patch;try{patch=readJSON(path.resolve(desde));}catch(e){console.error(`--desde ${desde}: ${e.message}`);process.exit(1);}
  const r=mergeRegistryTexts(reg,patch);if(r.errors.length){console.error(r.errors.map(e=>'registro.json: '+e).join('\n'));process.exit(1);}out=r.registry;
  if(!r.changed.length)console.log('textos: sin cambios');else if(simular)console.log(`textos: cambiaría ${r.changed.join(', ')} (simulación, no se escribe)`);else{writeJSON(file,r.registry);console.log(`textos: ${r.changed.join(', ')} actualizados en registro.json`);}}
 for(const w of registryTextIssues(out,loadOrNull()))console.log('aviso: '+w);}
({sync,freeze:()=>freeze(rest),render,check,describe:()=>describe(rest),textos}[cmd])();
