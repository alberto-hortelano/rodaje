// Recorrido a pie automático por un entorno 3D (ENTORNOS-3D.md), contra una app arrancada (servidor de prueba con otro PORT).
// Uso: node scripts/entornos/recorrer.mjs <carpeta> --entorno <id> [--project id] [--url http://127.0.0.1:4320]
// Los pasos salen de `walkthrough` en los datos del entorno (model.json); cada uno registra la posición de la cámara y, con snapshot, una captura.
import {withChrome,VIEWPORTS} from '../../lib/chrome.mjs';
import {parseArgs} from '../../lib/args.mjs';
import {cliProject,usageExit} from '../../lib/cli.mjs';
import {environmentData,walkthroughSteps} from '../../lib/entorno3d.mjs';
const USAGE='Uso: node scripts/entornos/recorrer.mjs <carpeta> --entorno <id> [--project id] [--url http://127.0.0.1:4320]';
const {args:[SP],opts}=parseArgs(process.argv.slice(2));
if(!SP||typeof opts.entorno!=='string'||(opts.url!==undefined&&typeof opts.url!=='string'))usageExit(USAGE);
const {project}=cliProject({usage:USAGE,opts});
let steps;try{steps=walkthroughSteps(environmentData(project,opts.entorno).data);}catch(e){console.error(e.message);process.exit(1);}
const url=`${(opts.url||`http://127.0.0.1:${process.env.PORT||4320}`).replace(/\/$/,'')}/?project=${encodeURIComponent(project)}&view=environment&environment=${encodeURIComponent(opts.entorno)}`;
await withChrome(async b=>{
const pg=await b.newPage({viewport:VIEWPORTS.recorrido});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(url);
await pg.waitForFunction(()=>window.rodaje?.environment,null,{timeout:30000});await pg.waitForTimeout(2500);
const r=a=>a.map(v=>Math.round(v*100)/100);
const snap=async n=>{await pg.waitForTimeout(700);const el=await pg.$('.env3d-view');await el.screenshot({path:SP+'/'+n+'.png'});};
for(const s of steps){
  const p=await pg.evaluate(s=>{const e=window.rodaje.environment;if(s.walk)e.setWalk(true);if(s.view)e.setView(s.view);if(s.position){e.camera.position.set(...s.position);e.camera.rotation.set(0,s.yawDeg*Math.PI/180,0,'YXZ');}if(s.noclip)document.querySelector('[data-a=noclip]').click();return s.keys?e.walk(s.keys,s.seconds):e.camera.position.toArray();},s);
  console.log(s.label.padEnd(34),JSON.stringify(r(p)));
  if(s.snapshot)await snap(s.snapshot);
}
console.log(errs.join('\n')||'sin errores');
});
