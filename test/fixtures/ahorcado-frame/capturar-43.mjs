// Captura UNA vez, con el código previo a la #43, los argumentos de framePrompt de los 42 bloques de conjurados/ahorcado-v01
// (datos.json, sin la instantánea entera) y su prompt crudo, antes de applyDireccion, en ref-43/<bloque>.txt; y sin-ambiente-<bloque>.txt.
// Uso (lee proyectos, no escribe en ellos): RODAJE_DATA=<copia de proyectos> node test/fixtures/ahorcado-frame/capturar-43.mjs
import fs from 'node:fs';import path from 'node:path';
import {framePrompt} from '../../../app/workflow.mjs';import {loadLote} from '../../../lib/lotes.mjs';import {loteProject} from '../../../scripts/bloques/lib.mjs';
const L=loadLote('conjurados','ahorcado-v01');L.project=loteProject(L);
const {shots:_,...sequence}=L.sequence;
const project={characters:L.project.characters.map(c=>({id:c.id,name:c.name})),...(L.project.stage?{stage:L.project.stage}:{})};
const registry={summary:L.registry.summary,lighting:L.registry.lighting,assets:Object.fromEntries(Object.entries(L.registry.assets||{}).filter(([,a])=>a.kind==='character'||a.kind==='voice'))};
const blocks=L.plan.filter(b=>b.mode==='fotograma').map(block=>{const t=L.shots[block.parts[0].shot];const sb=(L.project.storyboards||[]).flatMap(b=>b.sequences||[]).flatMap(s=>s.shots||[]).find(x=>x.id===t.storyboardShot);return {block,cast:(sb?.cast||[]).filter(id=>L.project.characters.some(c=>c.id===id))};});
const used=new Set(blocks.flatMap(b=>b.block.parts.map(p=>p.shot)));const shots=Object.fromEntries(Object.entries(L.shots).filter(([k])=>used.has(k)));
const dir=import.meta.dirname,out=path.join(dir,'ref-43');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(dir,'datos.json'),JSON.stringify({project,sequence,shots,registry,map:L.map,scene:L.scene,blocks},null,1)+'\n');
for(const {block,cast} of blocks)fs.writeFileSync(path.join(out,block.id+'.txt'),framePrompt({project:L.project,sequence:L.sequence,shots:L.shots,block,registry:L.registry,map:L.map,scene:L.scene,cast}).prompt);
// Un caso más para el sonido de respaldo: el primer bloque con la secuencia sin ambiencePrompt.
{const {block,cast}=blocks[0];fs.writeFileSync(path.join(dir,'sin-ambiente-'+block.id+'.txt'),framePrompt({project:L.project,sequence:{...L.sequence,ambiencePrompt:''},shots:L.shots,block,registry:L.registry,map:L.map,scene:L.scene,cast}).prompt);}
console.log(blocks.length,'bloques');
