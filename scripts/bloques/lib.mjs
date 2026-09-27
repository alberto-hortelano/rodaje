// Utilidades compartidas por los scripts de lote (PROCESO.md, pasos 5–8).
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {ROOT,dir,loadEnv} from '../../lib/paths.mjs';import {readJSON,writeJSON} from '../../lib/json.mjs';import {parseArgs} from '../../lib/args.mjs';import {parseMapa} from '../../app/workflow.mjs';
export {ROOT,readJSON,writeJSON,parseArgs};
// Un lote vive en proyectos/<proyecto>/assets/<lote>/ y congela su propio snapshot del proyecto.
export function lotePaths(project,lote){const base=dir(project);const out=path.join(base,'assets',lote);return {base,out,plan:path.join(out,'plan.json'),snapshot:path.join(out,'project-snapshot.json'),meta:path.join(out,'lote.json'),registry:path.join(base,'registro.json'),uploads:path.join(out,'uploads.json')};}
export function loadLote(project,lote){const paths=lotePaths(project,lote);if(!fs.existsSync(paths.plan))throw Error(`No existe ${paths.plan}; ejecuta planificar.mjs`);const plan=readJSON(paths.plan),meta=readJSON(paths.meta),snapshot=readJSON(paths.snapshot);const registry=fs.existsSync(paths.registry)?readJSON(paths.registry):{assets:{}};const episode=snapshot.episodes.find(e=>e.id===meta.episode);const sequence=episode.sequences.find(s=>s.id===meta.sequence);const shots=Object.fromEntries(sequence.shots.map(t=>[t.id,t]));return {paths,plan,meta,project:snapshot,registry,episode,sequence,shots,map:mapaFor(paths.base,registry,sequence.location),scene:sceneFor(paths.base,episode,sequence)};}
// MAPA.md del ambiente, o del ambiente al que la plate del registro lo hace alias.
export function mapaFor(base,registry,locationId){const direct=path.join(base,'ambientes',locationId,'MAPA.md');if(fs.existsSync(direct))return parseMapa(fs.readFileSync(direct,'utf8'));const plate=Object.values(registry.assets||{}).find(a=>a.kind==='location'&&(a.aliases||[]).includes(locationId));if(plate){const f=path.join(base,'ambientes',plate.location,'MAPA.md');if(fs.existsSync(f))return parseMapa(fs.readFileSync(f,'utf8'));}return null;}
// Interpretación de la escena: capitulos/<episodio>/escenas/sNN.json, con NN = sourceScene del primer plano o el índice de la secuencia.
export function sceneNumber(episode,sequence){const n=sequence.shots.find(t=>t.sourceScene)?.sourceScene;return n||episode.sequences.indexOf(sequence)+1;}
export function sceneFor(base,episode,sequence){const f=path.join(base,'capitulos',episode.id,'escenas',`s${String(sceneNumber(episode,sequence)).padStart(2,'0')}.json`);return fs.existsSync(f)?readJSON(f):null;}
export function ffprobeDuration(file){try{return Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]).toString().trim());}catch{return null;}}
export function ff(args){execFileSync('ffmpeg',['-y','-v','error',...args.map(String)],{stdio:'inherit'});}
export function attemptsPath(out,blockId){return path.join(out,blockId,'attempts.json');}
export function loadAttempts(out,blockId){const f=attemptsPath(out,blockId);return fs.existsSync(f)?readJSON(f):[];}
export function saveAttempts(out,blockId,list){fs.mkdirSync(path.join(out,blockId),{recursive:true});writeJSON(attemptsPath(out,blockId),list);}
export function acceptedAttempt(list){return [...list].reverse().find(a=>a.verdict==='accepted')||null;}
export function prices(){const f=path.join(ROOT,'precios.json');return fs.existsSync(f)?readJSON(f):{};}
export async function falClient(){loadEnv();if(!process.env.FAL_KEY){const c=path.join(ROOT,'config.local.json');if(fs.existsSync(c))process.env.FAL_KEY=readJSON(c).falKey||readJSON(c).FAL_KEY||'';}if(!process.env.FAL_KEY)throw Error('Falta FAL_KEY (.env o config.local.json)');const {createFalClient}=await import('@fal-ai/client');return createFalClient({credentials:process.env.FAL_KEY});}
