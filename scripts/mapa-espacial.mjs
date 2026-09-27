#!/usr/bin/env node
// Borrador de mapa espacial por landmarks para un ambiente (docs/PROCESO.md, paso 4).
//   node scripts/mapa-espacial.mjs [proyecto] <ambiente> [--project id]   escribe ambientes/<ambiente>/MAPA.md si no existe (o MAPA.borrador.md si ya existe)
// Lee modelSpace.kit del escenario (y la sala de model.json si la hay), agrupa las piezas por nombre y las sitúa por
// signo de X/Z respecto al centro de la sala. Claude convierte la tabla en el párrafo ```prompt``` (skill director-h3).
import fs from 'node:fs';import path from 'node:path';
import {dir,load} from '../app/store.mjs';import {takeOption} from '../lib/args.mjs';import {cliProject,usageExit} from '../lib/cli.mjs';
const USAGE='Uso: mapa-espacial.mjs [proyecto] <ambiente> [--project id]';
const argv=process.argv.slice(2);const p0=takeOption(argv,'--project');if(!argv.length)usageExit(USAGE);
const {project,args:[id]}=cliProject({usage:USAGE,opts:{project:p0},args:argv,positional:1});if(!id)usageExit(USAGE);
const p=load(project);const l=p.locations.find(l=>l.id===id);if(!l){console.error('Ambiente desconocido: '+id);process.exit(2);}
const ms=l.modelSpace||{};let room=null;if(ms.model&&ms.room){const f=path.join(dir(project),ms.model);if(fs.existsSync(f)){const m=JSON.parse(fs.readFileSync(f,'utf8'));room=(m.rooms||[]).find(r=>r.id===ms.room)||null;}}
const kit=ms.kit?.length?ms.kit:(room?.kit||[]);const size=ms.size||room?.size||[10,4,10];
const groups=new Map();for(const k of kit){const g=groups.get(k.name)||{name:k.name,n:0,pos:[],size:k.size};g.n++;g.pos.push([+(k.position[0]).toFixed(1),+(k.position[2]).toFixed(1)]);groups.set(k.name,g);}
const where=([x,z])=>{const sx=Math.abs(x)<size[0]/6?'':x<0?'port (−X)':'starboard (+X)';const sz=Math.abs(z)<size[2]/6?'':z<0?'aft (−Z)':'fore (+Z)';return [sx,sz].filter(Boolean).join(', ')||'centre';};
const rows=[...groups.values()].sort((a,b)=>b.n-a.n).map(g=>`| ${g.name} | ${g.n} | ${g.size?g.size.map(v=>+v.toFixed(1)).join('×'):''} | ${[...new Set(g.pos.map(where))].join('; ')} | _label en inglés_ |`);
const landmarks=[...groups.values()].filter(g=>g.n<=4).map(g=>({kit:g.name,label:`at the ${g.name.toLowerCase()}`,positions:g.pos}));
const md=`# ${l.name} — mapa canónico (borrador ${new Date().toISOString().slice(0,10)})

<!-- borrador: convierte la tabla en prosa por landmarks dentro del bloque \`\`\`prompt\`\`\`; nunca metros, siempre "at the …", "behind the …", "beside the …". Rellena Lado de cámara y Eje de 180°. Luego borra este comentario. -->

Sala: ${ms.room||'—'} · zona ${ms.zone||room?.zone||'—'} · cubierta ${ms.deck||room?.deck||'—'} · tamaño ${size.join('×')} (X ancho, Y alto, Z largo; origen ${ms.origin||'room-centre'}).
Ejes: −X = babor, +X = estribor, −Z = popa, +Z = proa (comprobar contra el snapshot ${ms.snapshot||'—'}).

Lado de cámara:
Eje de 180°:

## Landmarks (del kit 3D)

| Pieza (kit) | N | Tamaño | Dónde | Label en inglés |
|---|---|---|---|---|
${rows.join('\n')}

## Párrafo que se pega en LOCATION MAP

\`\`\`prompt
[[LOCATION MAP]]
\`\`\`

## Posiciones locales de cada landmark (para firstFrameLine)

\`\`\`json landmarks
${JSON.stringify(landmarks,null,1)}
\`\`\`

## Master shot

Plano \`MASTER · ${l.name}\`: 1 s, gran angular, sin líneas, primera secuencia del ambiente. Ruta del master aceptado: —
`;
const target=path.join(dir(project),'ambientes',id,fs.existsSync(path.join(dir(project),'ambientes',id,'MAPA.md'))?'MAPA.borrador.md':'MAPA.md');fs.writeFileSync(target,md);console.log('escrito',path.relative(process.cwd(),target),`(${groups.size} tipos de pieza, ${kit.length} piezas)`);
