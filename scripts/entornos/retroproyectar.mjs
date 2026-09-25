// Proyecta al suelo (plano y = h) píxeles de la imagen de referencia con la cámara calibrada. Uso: node scripts/entornos/retroproyectar.mjs '[[nombre,[px,py],h],...]' (edita aquí la cámara que dé calibrar.mjs).
import * as T from 'three';
const W=1254,cam=new T.PerspectiveCamera(47.4,1,0.1,500);cam.position.set(12.42,18.45,40.81);cam.lookAt(2.29,0.82,6.36);cam.updateMatrixWorld();cam.updateProjectionMatrix();
const pts=JSON.parse(process.argv[2]);
for(const [n,[px,py],h] of pts){const ndc=new T.Vector3(px/W*2-1,1-py/W*2,0.5).unproject(cam);const dir=ndc.sub(cam.position).normalize();const t=(h-cam.position.y)/dir.y;const p=cam.position.clone().addScaledVector(dir,t);console.log(n.padEnd(28),'x',p.x.toFixed(1),'z',p.z.toFixed(1),'(y',h+')');}
