// Ajusta la cámara que mejor proyecta puntos 3D del modelo sobre sus píxeles en la referencia A (1254×1254) y lista el error de cada punto.
import * as T from 'three';
const W=1254;
const pts=JSON.parse(process.argv[2]); // [[nombre,[x,y,z],[px,py]],...]
function proj(p,[cx,cy,cz,yaw,pitch,fov]){const cam=new T.PerspectiveCamera(fov,1,0.1,500);cam.position.set(cx,cy,cz);cam.rotation.set(pitch,yaw,0,'YXZ');cam.updateMatrixWorld();cam.updateProjectionMatrix();const v=new T.Vector3(...p).project(cam);return [(v.x+1)/2*W,(1-v.y)/2*W];}
const err=q=>pts.reduce((s,[,p,px])=>{const r=proj(p,q);return s+(r[0]-px[0])**2+(r[1]-px[1])**2;},0);
let best=null,be=Infinity;
for(let i=0;i<20000;i++){const az=(Math.random()*80-10)*Math.PI/180,el=(25+Math.random()*35)*Math.PI/180,dist=25+Math.random()*60,fov=20+Math.random()*50;const tx=-2+Math.random()*6,ty=Math.random()*5,tz=-3+Math.random()*6;
 const cx=tx+dist*Math.cos(el)*Math.sin(az),cy=ty+dist*Math.sin(el),cz=tz+dist*Math.cos(el)*Math.cos(az);const q=[cx,cy,cz,az,-el,fov];const e=err(q);if(e<be){be=e;best=q;}}
// refinamiento local
let step=[2,2,2,0.05,0.05,3];
for(let it=0;it<6000;it++){const q=best.map((v,k)=>v+(Math.random()-0.5)*2*step[k]);const e=err(q);if(e<be){be=e;best=q;}if(it%1000===999)step=step.map(s=>s*0.5);}
const [cx,cy,cz,yaw,pitch,fov]=best;const dir=new T.Vector3(0,0,-1).applyEuler(new T.Euler(pitch,yaw,0,'YXZ'));
console.log(JSON.stringify({pos:[cx,cy,cz].map(v=>+v.toFixed(2)),target:[cx+dir.x*40,cy+dir.y*40,cz+dir.z*40].map(v=>+v.toFixed(2)),fov:+fov.toFixed(1),rms:+Math.sqrt(be/pts.length).toFixed(1)}));
for(const [n,p,px] of pts){const r=proj(p,best);console.log(n.padEnd(22),'ref',px,'modelo',r.map(v=>Math.round(v)),'err',Math.round(Math.hypot(r[0]-px[0],r[1]-px[1])));}
