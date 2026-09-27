// Recorrido a pie automático por un entorno 3D (docs/ENTORNOS-3D.md), contra una app arrancada (servidor de prueba con otro PORT).
// Uso: node scripts/entornos/recorrer.mjs <carpeta> --entorno <id> [--project id] [--url http://127.0.0.1:4320]
// Los pasos salen de `walkthrough` en los datos del entorno (model.json); cada uno registra la posición de la cámara (o el valor de call) y, con snapshot, una captura.
// Un paso falla si su view no existe, si call lanza o no existe, o si su valor no cumple expect; sale con 1 si falla alguno o hay errores en la página.
import {withChrome,VIEWPORTS} from '../../lib/chrome.mjs';
import {parseArgs} from '../../lib/args.mjs';
import {cliProject,usageExit} from '../../lib/cli.mjs';
import {environmentData,walkthroughSteps,matchExpect} from '../../lib/entorno3d.mjs';
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
const r=v=>typeof v==='number'?Math.round(v*100)/100:Array.isArray(v)?v.map(r):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,r(x)])):v;
let fallos=0;
const snap=async n=>{await pg.waitForTimeout(700);const el=await pg.$('.env3d-view');await el.screenshot({path:SP+'/'+n+'.png'});};
for(const s of steps){
  const {value:p,error}=await pg.evaluate(async s=>{try{const e=window.rodaje.environment;if(s.walk)e.setWalk(true);if(s.view&&e.setView(s.view)===false)return {error:'no existe la vista '+s.view};if(s.position){e.camera.position.set(...s.position);e.camera.rotation.set(0,s.yawDeg*Math.PI/180,0,'YXZ');}if(s.noclip)document.querySelector('[data-a=noclip]').click();
    const moved=s.keys?e.walk(s.keys,s.seconds):e.camera.position.toArray();if(!s.call)return {value:moved};
    if(!(s.call in e))return {error:'window.rodaje.environment no tiene '+s.call};const v=e[s.call];
    if(typeof v!=='function'){if(s.args)return {error:s.call+' no es un método y el paso lleva args'};return {value:v};}
    return {value:await v.apply(e,s.args||[])};}catch(err){return {error:String(err?.message||err)};}},s);
  const diffs=error?[error]:s.expect!==undefined?matchExpect(p,s.expect,s.tolerance!==undefined?{tolerance:s.tolerance}:{}):[];
  if(diffs.length)fallos++;
  console.log(s.label.padEnd(34),JSON.stringify(r(p)),diffs.length?'FALLO: '+diffs.join('; '):'OK');
  if(s.snapshot)await snap(s.snapshot);
}
console.log(errs.join('\n')||'sin errores');
console.log(`${steps.length-fallos} de ${steps.length} pasos OK${fallos?` · ${fallos} con FALLO`:''}`);
if(fallos||errs.length)process.exitCode=1;
});
