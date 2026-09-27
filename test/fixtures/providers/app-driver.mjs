// Conductor de app/jobs.mjs para las pruebas de proveedores. Solo en subproceso: node --import fal-fetch-mock.mjs app-driver.mjs,
// con RODAJE_DATA temporal, ffmpeg/ffprobe falsos en PATH y FAL_KEY=test:dummy (lo prepara harness.mjs).
// Crea el proyecto fixture-app, ejecuta run(j) por cada trabajo de RODAJE_DRIVER_JOBS (todos si falta) con el registro en
// RODAJE_MOCK_DIR/<nombre>.jsonl y escribe el resumen [{id,status,error,output,endpoint,ext}] en RODAJE_DRIVER_OUT.
import fs from 'node:fs';import path from 'node:path';
const {DATA,save,load,digest}=await import('../../../app/store.mjs');const {run}=await import('../../../app/jobs.mjs');
const id='fixture-app',base=path.join(DATA,id);
for(const f of ['ideas','personajes','ambientes','capitulos','storyboards','assets','versiones','trabajos'])fs.mkdirSync(path.join(base,f),{recursive:true});
for(const f of ['ana.png','ana-v1.png','loc.png','l1-1.5s.wav','l2-1.5s.wav','amb.mp3','snap.png','motion.mp4','padded.wav','audio.wav','frame.png','sketch.png','ref-a.png','ref-b.png','final.mp4'])fs.writeFileSync(path.join(base,'assets',f),'fixture:'+f);
const cam={position:[4,2.5,7],target:[0,1,0],fov:45};
const t={id:'shot-1',title:'Plano 1',description:'Ana waits by the window.',duration:6.2,camera:cam,cameraEnd:cam,lines:[{id:'l1',character:'c-ana',text:'We leave at dawn.',start:1,audio:'assets/l1-1.5s.wav'},{id:'l2',character:'c-beto',text:'Not without the map.',start:3,audio:'assets/l2-1.5s.wav',offscreen:true}],history:[]};
const s={id:'seq-1',title:'La espera',text:'Night before departure.',location:'loc-1',ambience:'assets/amb.mp3',ambienceGain:.2,ambiencePrompt:'Rain on a tin roof',silent:false,cast:[{character:'c-ana',x:0,z:0,yaw:0}],shots:[t]};
const p={id,name:'Fixture app',type:'serie',language:'en',style:'Muted naturalism.',premise:'Two travellers.',ideas:[],
 characters:[{id:'c-ana',name:'Ana',description:'A cartographer.',look:'Short dark hair, green coat.',image:'assets/ana.png',voice:'voz-ana',variants:{v1:{description:'Winter coat',image:'assets/ana-v1.png'}}},{id:'c-beto',name:'Beto',description:'A smuggler with a grey beard.',voice:'voz-beto'}],
 locations:[{id:'loc-1',name:'Cabin',description:'A wooden cabin at night.',image:'assets/loc.png'}],
 episodes:[{id:'ep-1',title:'Acto I',sequences:[s]}],
 storyboards:[{id:'sb-1',title:'Storyboard',style:'Pencil look.',sequences:[{id:'sb-seq',shots:[{id:'sb-shot',sketch:'assets/sketch.png',references:['assets/ref-a.png',{path:'assets/ref-b.png'}],action:'Ana studies the map.',camera:'35mm',cast:['c-ana']}]}]}],issues:[]};
const hash=digest(p,t.id);
t.preview={job:'job-pv0',hash,snapshot:'assets/snap.png',padded:'assets/motion.mp4',paddedAudio:'assets/padded.wav',audio:'assets/audio.wav'};
t.keyframe={job:'job-kf0',hash,file:'assets/frame.png'};t.approval={hash,preview:'job-pv0'};
t.final={job:'job-v0',hash,file:'assets/final.mp4',keyframeJob:'job-kf0',previewJob:'job-pv0'};
save(p);const snapshot=load(id);
const ALL=[['character','character','c-beto'],['character-ref','character','c-ana',{variant:'v1'}],['location','location','loc-1'],['voice','voice','c-ana'],['line','line','shot-1',{line:'l1'}],['ambience','ambience','seq-1'],['keyframe','keyframe','shot-1'],['video','video','shot-1'],['storyboard','storyboard','sb-shot'],['cover','cover','seq-1'],['outline','outline',null,{prompt:'A short chapter.'}],['export','export','ep-1'],['preview','preview','shot-1']];
const want=process.env.RODAJE_DRIVER_JOBS?.split(',');const out=[];
for(const [name,type,target,extra={}] of ALL.filter(([n])=>!want||want.includes(n))){
 process.env.RODAJE_MOCK_LOG=path.join(process.env.RODAJE_MOCK_DIR,name+'.jsonl');
 const j={id:'job-'+name,project:id,type,target,extra,status:'queued',created:'2026-01-01T00:00:00.000Z',snapshot:structuredClone(snapshot),hash:['preview','keyframe','video'].includes(type)?digest(snapshot,target):null};
 await run(j);
 out.push({id:j.id,status:j.status,error:type==='preview'?(j.error?'<omitido>':null):j.error??null,output:j.output??null,endpoint:j.endpoint??null,ext:j.ext??null});}
fs.writeFileSync(process.env.RODAJE_DRIVER_OUT,JSON.stringify(out,null,1)+'\n');process.exit(0);
