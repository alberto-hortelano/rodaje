#!/usr/bin/env node
// Planifica los bloques de una secuencia (docs/PROCESO.md, paso 5) y congela el snapshot del proyecto en el lote.
//   node scripts/bloques/planificar.mjs <lote> <episodio> <secuencia> [--project id] [--max 15] [--min 5] [--por-plano] [--force]
// Reglas: bloque 5–15 s; nunca parte una línea; presupuesto de diálogo ≤ duración − 1 (R12); un trayecto por bloque (R10);
// los planos MASTER van solos; corte preferente donde cambia la cobertura.
import fs from 'node:fs';import path from 'node:path';
import {load} from '../../app/store.mjs';import {dialogueBudget} from '../../app/workflow.mjs';
import {parseArgs,writeJSON,cliProject,usageExit} from './lib.mjs';import {lotePaths} from '../../lib/lotes.mjs';
const USAGE='Uso: planificar.mjs <lote> <episodio> <secuencia> [--project id] [--max 15] [--min 5] [--por-plano] [--force]';
const {args:[lote,episodeId,sequenceId],opts}=parseArgs(process.argv.slice(2));
if(!lote||!episodeId||!sequenceId)usageExit(USAGE);
const {project}=cliProject({usage:USAGE,opts}),MAX=Number(opts.max||15),MIN=Number(opts.min||5);
const p=load(project);const episode=p.episodes.find(e=>e.id===episodeId);if(!episode)throw Error('Episodio desconocido');const sequence=episode.sequences.find(s=>s.id===sequenceId);if(!sequence)throw Error('Secuencia desconocida');
const words=l=>String(l.spokenText||l.text||'').trim().split(/\s+/).filter(Boolean).length;
const lineEnd=l=>l.start+Math.max(words(l)/4,l.estimatedDuration||0)+0.3;
// Un plano más largo que MAX se parte en huecos sin diálogo.
function chunks(t){if(t.duration<=MAX)return [[0,t.duration]];const busy=t.lines.map(l=>[l.start,Math.min(t.duration,lineEnd(l))]);const out=[];let from=0;while(t.duration-from>MAX){let cut=null;for(let c=from+MAX;c>from+MIN;c-=.1){if(!busy.some(([a,b])=>a<c&&c<b)){cut=Math.round(c*100)/100;break;}}if(cut===null)throw Error(`El plano ${t.id} no admite un corte sin partir una línea; divídelo en el capítulo`);out.push([from,cut]);from=cut;}out.push([from,t.duration]);return out;}
const isMaster=t=>t.master===true||/^MASTER\b/i.test(t.title||'');
const isMove=t=>Object.keys(t.staging?.moves||{}).length>0;
// --por-plano (modo fotograma, image-to-video): un bloque por plano, que arranca en el fotograma de su viñeta de storyboard.
const perShot=!!opts['por-plano'];
const units=[];for(const t of sequence.shots)for(const [from,to] of chunks(t))units.push({shot:t,from,to,solo:perShot||isMaster(t)||isMove(t),mode:perShot?'fotograma':isMaster(t)?'master':'block',rules:isMaster(t)?['MASTER']:isMove(t)?['R10']:[]});
const blocks=[];let cur=null;const close=()=>{if(cur){blocks.push(cur);cur=null;}};
for(const u of units){const len=u.to-u.from;const lines=u.shot.lines.filter(l=>l.start>=u.from&&l.start<u.to).map(l=>({...l,start:Math.round((l.start-u.from)*1000)/1000}));
 const fits=cur&&!cur.solo&&!u.solo&&cur.length+len<=MAX+1e-6&&cur.parts.every(pt=>pt.shot!==u.shot.id||pt.to<=u.from)&&dialogueBudget([...cur.allLines,...lines.map(l=>({...l,start:l.start+cur.length}))])<=cur.length+len-1+1e-6;
 if(!fits){close();cur={id:'',mode:u.mode,solo:u.solo,length:0,parts:[],allLines:[],rules:new Set(['R12',...u.rules])};}
 cur.parts.push({shot:u.shot.id,from:u.from,to:u.to,at:Math.round(cur.length*1000)/1000,lines});cur.allLines.push(...lines.map(l=>({...l,start:l.start+cur.length})));cur.length=Math.round((cur.length+len)*1000)/1000;for(const r of u.rules)cur.rules.add(r);}
close();
const plan=blocks.map((b,i)=>{const spoken=b.allLines.filter(l=>!l.offscreen&&l.channel!=='pa'&&l.channel!=='ext');const budget=dialogueBudget(spoken);if(budget>MAX-1)console.warn(`Aviso R12: el bloque ${i+1} tiene ${budget.toFixed(1)} s de diálogo para un máximo de ${MAX} s; divide el plano ${b.parts[0].shot} en el capítulo o acorta una línea`);return {id:'b'+String(i+1).padStart(2,'0'),mode:b.mode,duration:Math.min(MAX,Math.max(MIN,Math.ceil(Math.max(b.length,spoken.length?budget+1:0)))),length:b.length,voices:[...new Set(spoken.map(l=>l.character))],offscreen:[...new Set(b.allLines.filter(l=>!spoken.includes(l)).map(l=>l.character))],budget:Math.round(dialogueBudget(spoken)*100)/100,parts:b.parts,rules:[...b.rules]};});
const paths=lotePaths(project,lote);if(fs.existsSync(paths.plan)&&!opts.force)throw Error(`${paths.plan} ya existe; usa --force para reescribirlo (los intentos existentes se conservan)`);
fs.mkdirSync(paths.out,{recursive:true});writeJSON(paths.plan,plan);writeJSON(paths.snapshot,p);writeJSON(paths.meta,{project,episode:episodeId,sequence:sequenceId,created:new Date().toISOString(),max:MAX,min:MIN,revision:p.revision});
console.log(`${lote}: ${plan.length} bloques para ${sequence.shots.length} planos (${sequence.shots.reduce((n,t)=>n+t.duration,0).toFixed(1)} s)`);for(const b of plan)console.log(` ${b.id} ${b.mode.padEnd(6)} ${b.length.toFixed(2).padStart(6)} s  pide ${String(b.duration).padStart(2)} s  diálogo ${String(b.budget).padStart(5)} s  voces ${b.voices.join(',')||'—'}${b.offscreen.length?'  off '+b.offscreen.join(','):''}  planos ${b.parts.map(x=>x.shot.replace(/^.*-p/,'p')).join('+')}`);
