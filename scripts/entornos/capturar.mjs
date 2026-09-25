// Captura un entorno del visor desde ángulos dados. Uso: node scripts/entornos/capturar.mjs <carpeta> '[[nombre,azimut,elevación,distancia,fov,tx,ty,tz],...]' (servidor de prueba en :4399).
import {chromium} from 'playwright';
const [SP,spec]=process.argv.slice(2);const cands=JSON.parse(spec);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage({viewport:{width:1400,height:1300}});
await pg.goto('http://127.0.0.1:4399/?project=conjurados&view=environment&environment=caseron');
await pg.waitForFunction(()=>window.rodaje?.environment,null,{timeout:30000});await pg.waitForTimeout(3500);
await pg.evaluate(()=>{const v=document.querySelector('.env3d-view');v.style.aspectRatio='1/1';const e=window.rodaje.environment;const m=e.scene.children.find(o=>o.name==='caseron');m.getObjectByName('terreno').children.forEach(c=>c.visible=['plataforma','fondo-pozo-luz'].includes(c.name));e.scene.fog=null;document.querySelector('.env3d-note').style.display='none';});
await pg.waitForTimeout(800);
for(const [name,az,el,dist,fov,tx,ty,tz] of cands){
  await pg.evaluate(([az,el,dist,fov,tx,ty,tz])=>{const e=window.rodaje.environment;const a=az*Math.PI/180,l=el*Math.PI/180;e.camera.fov=fov;e.camera.updateProjectionMatrix();e.camera.position.set(tx+dist*Math.cos(l)*Math.sin(a),ty+dist*Math.sin(l),tz+dist*Math.cos(l)*Math.cos(a));e.controls.target.set(tx,ty,tz);e.controls.update();e.scene.background=null;e.renderer.setClearColor('#b7bcc0');},[az,el,dist,fov,tx,ty,tz]);
  await pg.waitForTimeout(900);const c=await pg.$('.env3d-view canvas');await c.screenshot({path:SP+'/'+name+'.png'});
}
await b.close();
