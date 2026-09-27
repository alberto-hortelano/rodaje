#!/usr/bin/env node
// Guía 3D por bloque (docs/PROCESO.md, paso 6): motion.mp4 sin rótulos, frame-start.png y frame-mid.png.
//   node scripts/bloques/render.mjs <lote> [bloque] [--project id] [--labels] [--force]
// Necesita la app abierta (./abrir.sh) porque renderiza con /stage.js en Chrome headless. No genera nada de pago.
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {once} from 'node:events';
import {withChrome,newRenderContext,pinClock,VIEWPORTS} from '../../lib/chrome.mjs';
import {parseArgs,cliProject,usageExit} from './lib.mjs';import {loadLote} from '../../lib/lotes.mjs';import {load} from '../../app/store.mjs';import {stageFallback,rehearsalConfig} from '../../app/workflow.mjs';
const USAGE='Uso: render.mjs <lote> [bloque] [--project id] [--labels] [--force]';
const {args:[lote,only],opts}=parseArgs(process.argv.slice(2));if(!lote)usageExit(USAGE);
const {project:id}=cliProject({usage:USAGE,opts});
const L=loadLote(id,lote);const project=stageFallback(L.project,L.project.stage?null:load(id));const port=process.env.PORT||4320,url=`http://127.0.0.1:${port}/`;
try{await fetch(url);}catch{console.error(`La app no responde en ${url}. Arranca ./abrir.sh y repite.`);process.exit(1);}
await withChrome(async browser=>{for(const block of L.plan){if(only&&block.id!==only)continue;const dir=path.join(L.paths.out,block.id);fs.mkdirSync(dir,{recursive:true});if(fs.existsSync(path.join(dir,'motion.mp4'))&&!opts.force){console.log('ya existe',block.id);continue;}
 const ctx=await newRenderContext(browser,VIEWPORTS.guia);await pinClock(ctx);const page=await ctx.newPage();
 if(!opts.labels)await page.route('**/stage.js',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:(await res.text()).replace('group.add(label);','label.visible=false;group.add(label);')});});
 await page.goto(url);await page.waitForTimeout(800);await page.evaluate(()=>{document.body.innerHTML='<div id="render"></div>';});
 const total=block.length,frames=Math.ceil(total*12);const tmp=path.join(dir,'motion.tmp.mp4');
 const enc=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','12','-i','pipe:0','-vf','scale=960:540,fps=24','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-an',tmp],{stdio:['pipe','ignore','pipe']});let err='';enc.stderr.on('data',d=>err+=d);const done=once(enc,'close');let last='';
 for(let i=0;i<frames;i++){const time=i/12;const part=block.parts.find(a=>time>=a.at&&time<a.at+a.to-a.from)||block.parts.at(-1);const t=L.shots[part.shot];const local=Math.min(part.to-.001,part.from+time-part.at);
  if(last!==t.id){await page.evaluate(async({p,s,t,key})=>{if(window.st&&window.stageKey===key)st.updateShot(t);else{window.st?.dispose();window.st=await(await import('/stage.js')).createStage(document.querySelector('#render'),{project:p,sequence:s,shot:t});window.stageKey=key;}},{p:project,s:L.sequence,t,key:JSON.stringify([!!t.detail,rehearsalConfig(project,t).exteriorKey])});last=t.id;}
  const png=await page.evaluate(({t,local})=>{const l=t.lines.find(l=>local>=l.start&&local<l.start+(l.estimatedDuration||3));st.setSpeaker(l||null);return st.frame(local);},{t,local});const buf=Buffer.from(png.split(',')[1],'base64');
  if(i===0)fs.writeFileSync(path.join(dir,'frame-start.png'),buf);if(i===Math.floor(frames/2))fs.writeFileSync(path.join(dir,'frame-mid.png'),buf);
  if(!enc.stdin.write(buf))await once(enc.stdin,'drain');}
 enc.stdin.end();const [code]=await done;if(code)throw Error(err);fs.renameSync(tmp,path.join(dir,'motion.mp4'));await ctx.close();console.log('guía lista',block.id,`${total.toFixed(2)} s`);}});
