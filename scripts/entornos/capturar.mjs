// Captura un entorno del visor desde ángulos dados (docs/ENTORNOS-3D.md), contra una app arrancada (servidor de prueba con otro PORT).
// Uso: node scripts/entornos/capturar.mjs <carpeta> '[[nombre,azimut,elevación,distancia,fov,tx,ty,tz],...]' --entorno <id> [--project id] [--url http://127.0.0.1:4320]
// Qué se oculta sale de `capture` en los datos del entorno (model.json): root, group con los hijos visibles en keep y fog.
import {withChrome,VIEWPORTS} from '../../lib/chrome.mjs';
import {parseArgs} from '../../lib/args.mjs';
import {cliProject,usageExit} from '../../lib/cli.mjs';
import {environmentData,captureSetup} from '../../lib/entorno3d.mjs';
const USAGE="Uso: node scripts/entornos/capturar.mjs <carpeta> '[[nombre,azimut,elevación,distancia,fov,tx,ty,tz],...]' --entorno <id> [--project id] [--url http://127.0.0.1:4320]";
const {args:[SP,spec],opts}=parseArgs(process.argv.slice(2));
if(!SP||!spec||typeof opts.entorno!=='string'||(opts.url!==undefined&&typeof opts.url!=='string'))usageExit(USAGE);
let cands;try{cands=JSON.parse(spec);}catch{}if(!Array.isArray(cands))usageExit(USAGE,'Los ángulos van en una lista JSON');
const {project}=cliProject({usage:USAGE,opts});
let setup;try{setup=captureSetup(environmentData(project,opts.entorno).data,opts.entorno);}catch(e){console.error(e.message);process.exit(1);}
const url=`${(opts.url||`http://127.0.0.1:${process.env.PORT||4320}`).replace(/\/$/,'')}/?project=${encodeURIComponent(project)}&view=environment&environment=${encodeURIComponent(opts.entorno)}`;
await withChrome(async b=>{
const pg=await b.newPage({viewport:VIEWPORTS.captura});
await pg.goto(url);
await pg.waitForFunction(()=>window.rodaje?.environment,null,{timeout:30000});await pg.waitForTimeout(3500);
await pg.evaluate(({root,group,keep,fog})=>{const v=document.querySelector('.env3d-view');v.style.aspectRatio='1/1';const e=window.rodaje.environment;const m=e.scene.children.find(o=>o.name===root);if(!m)throw Error('No está el objeto raíz '+root);if(group)m.getObjectByName(group).children.forEach(c=>c.visible=keep.includes(c.name));if(fog===false)e.scene.fog=null;const note=document.querySelector('.env3d-note');if(note)note.style.display='none';},setup);
await pg.waitForTimeout(800);
for(const [name,az,el,dist,fov,tx,ty,tz] of cands){
  await pg.evaluate(([az,el,dist,fov,tx,ty,tz])=>{const e=window.rodaje.environment;const a=az*Math.PI/180,l=el*Math.PI/180;e.camera.fov=fov;e.camera.updateProjectionMatrix();e.camera.position.set(tx+dist*Math.cos(l)*Math.sin(a),ty+dist*Math.sin(l),tz+dist*Math.cos(l)*Math.cos(a));e.controls.target.set(tx,ty,tz);e.controls.update();e.scene.background=null;e.renderer.setClearColor('#b7bcc0');},[az,el,dist,fov,tx,ty,tz]);
  await pg.waitForTimeout(900);const c=await pg.$('.env3d-view canvas');await c.screenshot({path:SP+'/'+name+'.png'});
}
});
