#!/usr/bin/env node
// Inserta el plano MASTER de 1 s al inicio de la primera secuencia de cada ambiente del episodio (PROCESO.md, paso 4).
//   node scripts/bloques/masters.mjs <episodio> [--project id] [--fov 65]
// Idempotente: si la secuencia ya tiene un plano con master:true no añade otro. Guarda con store.save() (nueva revisión).
import {load,save} from '../../app/store.mjs';import {parseArgs,cliProject,usageExit} from './lib.mjs';
const USAGE='Uso: masters.mjs <episodio> [--project id] [--fov 65]';
const {args:[episodeId],opts}=parseArgs(process.argv.slice(2));if(!episodeId)usageExit(USAGE);
const {project}=cliProject({usage:USAGE,opts});const p=load(project);const ep=p.episodes.find(e=>e.id===episodeId);if(!ep)throw Error('Episodio desconocido');
const seen=new Set();let added=0;
for(const s of ep.sequences){if(!s.location||seen.has(s.location))continue;seen.add(s.location);if(s.shots.some(t=>t.master))continue;const l=p.locations.find(l=>l.id===s.location);const size=l?.modelSpace?.size||[10,4,12];const depth=size[2]/2,height=Math.min(size[1]-0.5,2.6);
 const cam={position:[0,height,Math.max(3,depth-1.5)],target:[0,Math.min(height,1.6),-depth+1],fov:Number(opts.fov||65)};
 s.shots.unshift({id:`master-${s.location}`,title:`MASTER · ${l?.name||s.location}`,description:'Master técnico de 1 s: gran angular desde el extremo de proa, blocking congelado, sin líneas. Casi siempre se corta en montaje; su primer fotograma aceptado pasa al registro como plate.',duration:1,camera:cam,cameraEnd:structuredClone(cam),lines:[],history:[],master:true,gravity:s.gravity,variant:s.variant,rehearsal:false});added++;console.log('MASTER añadido en',s.id,'·',l?.name||s.location);}
if(added){save(p);console.log(`${added} masters; revisión ${p.revision}`);}else console.log('Nada que añadir');
