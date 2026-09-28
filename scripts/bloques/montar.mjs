#!/usr/bin/env node
// Montaje incremental del lote (docs/PROCESO.md, paso 8): rough cut desde el primer día.
//   node scripts/bloques/montar.mjs <lote> [--project id] [--out nombre]
// Por bloque: el intento aceptado (recortado por usedRange) → edit.mp4; si no hay, el último generado sin rechazar (pendiente de
// revisión) y, si tampoco, la guía 3D con las líneas rotuladas.
// Salida: assets/<lote>/montaje/<nombre>.mp4 y cut.json (qué bloque viene de qué fuente y su tramo at/length en el montaje).
// En una toma generada, las líneas fuera de campo con audio (instantánea del lote) se mezclan sobre su audio en su instante del edit
// (el tramo usado desplaza el tiempo; si su inicio cae en un tramo descartado, se omite con aviso). Con guía 3D solo se rotulan.
// Los edit.mp4 cuya toma, tramo y voces fuera de campo no han cambiado (edit.json) no se vuelven a codificar.
import fs from 'node:fs';import path from 'node:path';
import {parseArgs,ff,readJSON,writeJSON,ffprobeDuration,cliProject,usageExit,loteProject} from './lib.mjs';import {loadLote,loadAttempts} from '../../lib/lotes.mjs';import {chosenAttempt,projectChannels,lineOffscreen,blockVoices,offscreenMix} from '../../app/workflow.mjs';import {concatList,editFilterComplex} from '../../lib/media.mjs';
const USAGE='Uso: montar.mjs <lote> [--project id] [--out nombre]';
const {args:[lote],opts}=parseArgs(process.argv.slice(2));if(!lote)usageExit(USAGE);
const L=loadLote(cliProject({usage:USAGE,opts}).project,lote);L.project=loteProject(L);const CH=projectChannels(L.project);const outDir=path.join(L.paths.out,'montaje');fs.mkdirSync(outDir,{recursive:true});
const existing=fs.readdirSync(outDir).filter(f=>/-cut-v\d+\.mp4$/.test(f)).length;const name=opts.out||`${lote}-cut-v${String(existing).padStart(2,'0')}`;
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,'\u2019').replace(/:/g,'\\:').replace(/%/g,'\\%');
const font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';const entries=[],cut=[];let clock=0;
for(const block of L.plan){const dir=path.join(L.paths.out,block.id);const target=path.join(dir,'edit.mp4');const attempts=loadAttempts(L.paths.out,block.id);
 // Sin toma aceptada: la última generada que no esté rechazada, marcada como pendiente de revisión (modo fotograma, sin guía 3D).
 const {attempt:a,pending}=chosenAttempt(attempts,x=>fs.existsSync(path.join(dir,x.video)));
 if(a){const spans=a.usedRange?.length?a.usedRange:[[0,block.length]];
  // edit.json recuerda de qué toma y tramo sale edit.mp4: si no cambian, no se vuelve a codificar.
  const mix=offscreenMix({offscreen:blockVoices(block,L.shots,CH).offscreen,spans});
  const items=mix.items.filter(o=>{if(fs.existsSync(path.join(L.paths.base,o.file)))return true;mix.warnings.push(`${o.character} fuera de campo: no existe ${o.file}; no se mezcla`);return false;});for(const w of mix.warnings)console.log(`aviso: ${block.id}: ${w}`);
  const sig=items.length?{video:a.video,spans,offscreen:items.map(o=>({file:o.file,at:o.at,mtime:fs.statSync(path.join(L.paths.base,o.file)).mtimeMs}))}:{video:a.video,spans},sigFile=path.join(dir,'edit.json'),fresh=fs.existsSync(target)&&fs.existsSync(sigFile)&&JSON.stringify(readJSON(sigFile))===JSON.stringify(sig)&&fs.statSync(target).mtimeMs>=fs.statSync(path.join(dir,a.video)).mtimeMs;
  if(!fresh){ff(['-i',path.join(dir,a.video),...items.flatMap(o=>['-i',path.join(L.paths.base,o.file)]),'-filter_complex',editFilterComplex(spans,items),'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-ac','2',target],`${block.id} (toma ${a.video})`);writeJSON(sigFile,sig);}cut.push({block:block.id,source:'generated',attempt:a.n,video:a.video,usedRange:spans,...(pending?{pending:true}:{}),...(items.length?{offscreen:items.length}:{})});}
 else{const guide=path.join(dir,'motion.mp4');if(!fs.existsSync(guide)){cut.push({block:block.id,source:'missing'});console.warn('sin guía ni generado:',block.id);continue;}
  fs.rmSync(path.join(dir,'edit.json'),{force:true});
  const lines=block.parts.flatMap(p=>(p.lines||[]).map(l=>({...l,start:p.at+l.start})));const draw=lines.map(l=>`drawtext=fontfile=${font}:fontsize=26:fontcolor=white:borderw=2:x=(w-text_w)/2:y=h-60:text='${esc((L.project.characters.find(c=>c.id===l.character)?.name||l.character).split(' ')[0].toUpperCase()+(lineOffscreen(CH,l)?' (OFF)':'')+': '+(l.spokenText||l.text))}':enable='between(t,${l.start.toFixed(2)},${(l.start+Math.max(1.5,(l.estimatedDuration||2))).toFixed(2)})'`);
  const vf=['scale=1280:720,setsar=1,fps=24',`drawtext=fontfile=${font}:fontsize=20:fontcolor=yellow@0.8:x=20:y=20:text='GUÍA 3D ${block.id}'`,...draw].join(',');
  ff(['-i',guide,'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',block.length,'-vf',vf,'-map','0:v:0','-map','1:a:0','-shortest','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','128k',target],`${block.id} (guía 3D)`);cut.push({block:block.id,source:'guide',lines:lines.length});}
 const length=ffprobeDuration(target)||0;Object.assign(cut.at(-1),{at:Math.round(clock*1000)/1000,length:Math.round(length*1000)/1000});clock+=length;entries.push(target);}
const list=path.join(outDir,'concat.txt');fs.writeFileSync(list,concatList(entries,outDir));const outFile=path.join(outDir,name+'.mp4');ff(['-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',outFile],'concat final');
writeJSON(path.join(outDir,name+'.cut.json'),{lote,at:new Date().toISOString(),duration:ffprobeDuration(outFile),blocks:cut});
const gen=cut.filter(c=>c.source==='generated').length,pend=cut.filter(c=>c.pending).length;console.log(`${path.relative(L.paths.base,outFile)}: ${cut.length} bloques, ${gen} generados (${pend} sin revisar), ${cut.filter(c=>c.source==='guide').length} en guía, ${cut.filter(c=>c.source==='missing').length} sin nada`);
