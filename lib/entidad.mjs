// Ficheros de un personaje o un ambiente que la interfaz no puede conocer (#60): sus assets de registro.json y los documentos que existen
// (hoja, ficha, mapa, referencia). Solo lectura; no lista ref/ ni 3d/. Lo sirve GET /api/entity.
import fs from 'node:fs';
import {projectDir,safe} from './paths.mjs';
import {readJSON} from './json.mjs';

export const ENTITY_DOCS={
 character:[{key:'hoja',label:'Hoja',file:id=>`personajes/${id}/hoja.png`,image:true},{key:'hoja-md',label:'Hoja (texto)',file:id=>`personajes/${id}/hoja.md`},{key:'ficha',label:'Ficha',file:id=>`personajes/${id}/FICHA.md`}],
 location:[{key:'referencia',label:'Referencia',file:id=>`ambientes/${id}/referencia.png`,image:true},{key:'ficha',label:'Ficha',file:id=>`ambientes/${id}/FICHA.md`},{key:'mapa',label:'Mapa',file:id=>`ambientes/${id}/MAPA.md`}]};
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const PROVIDERS=['elevenlabs','minimax'];
// Una entrada del registro sin sha256 ni campos internos; los estados, solo por nombre; la voz, con su proveedor e id.
function assetView(tag,a){const x={tag,kind:a.kind,status:a.status??null};if(a.since)x.since=a.since;x.file=a.file||'';x.descriptor=a.descriptor||'';
 for(const k of ['variant','proxy','voice'])if(typeof a[k]==='string'&&a[k])x[k]=a[k];
 if(isObj(a.states))x.states=Object.keys(a.states);
 const provider=PROVIDERS.find(k=>typeof a[k]==='string'&&a[k]);if(provider){x.provider=provider;x.voiceId=a[provider];}
 if(Array.isArray(a.aliases)&&a.aliases.length)x.aliases=[...a.aliases];if(Array.isArray(a.members))x.members=[...a.members];return x;}
// Assets del registro de un personaje (character y voice propios, y group con alguno de sus tags como miembro) o de un ambiente (location o alias).
export function registryAssetsFor(reg,kind,id){const all=Object.entries(isObj(reg?.assets)?reg.assets:{}).filter(([,a])=>isObj(a));let list;
 if(kind==='character'){const own=all.filter(([,a])=>(a.kind==='character'||a.kind==='voice')&&a.character===id),tags=new Set(own.map(([t])=>t));
  list=[...own,...all.filter(([,a])=>a.kind==='group'&&Array.isArray(a.members)&&a.members.some(t=>tags.has(t)))];}
 else if(kind==='location')list=all.filter(([,a])=>a.kind==='location'&&(a.location===id||(Array.isArray(a.aliases)&&a.aliases.includes(id))));
 else list=[];
 return list.sort(([a],[b])=>a.localeCompare(b)).map(([tag,a])=>assetView(tag,a));}
const fail=(message,status)=>Object.assign(Error(message),{status});
const exists=(base,rel)=>{if(!rel)return false;try{return fs.statSync(safe(base,rel)).isFile();}catch{return false;}};
// Assets y documentos de un personaje o ambiente de p (proyecto ya cargado). Error 400 con un tipo no válido y 404 con un id que no está en p.
export function entityFiles(projectId,p,kind,id){if(!Object.hasOwn(ENTITY_DOCS,kind))throw fail('Tipo no válido: '+kind,400);
 const list=kind==='character'?p?.characters:p?.locations;
 if(typeof id!=='string'||!(Array.isArray(list)?list:[]).some(x=>isObj(x)&&x.id===id))throw fail(kind==='character'?`No existe el personaje ${id}`:`No existe el ambiente ${id}`,404);
 const base=projectDir(projectId),regFile=safe(base,'registro.json'),registry=fs.existsSync(regFile);
 const assets=registry?registryAssetsFor(readJSON(regFile),kind,id).map(a=>({...a,exists:exists(base,a.file)})):[];
 const docs=ENTITY_DOCS[kind].filter(d=>exists(base,d.file(id))).map(({file,...d})=>({...d,file:file(id)}));
 return {kind,id,registry,assets,docs};}
