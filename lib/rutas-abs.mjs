// Rutas absolutas en los datos de un proyecto → relativas u origen:<nombre>/… (docs/scripts.md, «Rutas en los datos de un proyecto»).
// Puro: transforma texto y valores JSON; no toca el disco. Lo usa scripts/proyecto-rutas.mjs.
import path from 'node:path';
import {ABS_RE} from './proyecto-check.mjs';

export const ORIGIN_PREFIX = 'origen:';
export const ORIGIN_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
// (file://)?/home/… o file://…, cortando en espacio y " ' ` , ; ) ] \ < >. Un /home/ pegado a una palabra (assets/home/) no es token.
const TOKEN_RE = /(?:file:\/\/)?(?<![\w.~-])\/home\/[^\s"'`,;)\]\\<>]*|file:\/\/[^\s"'`,;)\]\\<>]*/g;
const CONCAT_RE = /(^|[-.])concat\.txt$|^list\.txt$/;

// Tokens de ruta absoluta de una línea, sin . ni : finales (fin de frase).
export function absTokens(line){const out=[];
 for(const m of String(line).matchAll(TOKEN_RE)){const token=m[0].replace(/[.:]+$/,'');if(token&&token!=='file://')out.push({token,index:m.index});}
 return out;}

// roots: rutas absolutas de la raíz del proyecto (alias); origins {nombre: rutaAbs}. Gana el prefijo más largo, siempre con separador.
export function makeResolver({roots=[],origins={}}={}){
 for(const n of Object.keys(origins))if(!ORIGIN_NAME_RE.test(n))throw Error('Nombre de origen no válido: '+n);
 const trim=p=>p.length>1?p.replace(/\/+$/,''):p;
 const bases=[...roots.map(r=>({base:trim(r),origin:null})),...Object.entries(origins).map(([n,r])=>({base:trim(r),origin:n}))].sort((a,b)=>b.base.length-a.base.length);
 return token=>{const p=trim(String(token).replace(/^file:\/\//,''));
  for(const {base,origin} of bases){if(p!==base&&!p.startsWith(base+'/'))continue;const rest=p.slice(base.length+1);
   if(origin)return rest?{kind:'origen',value:ORIGIN_PREFIX+origin+'/'+rest,base}:{kind:'origen-raiz',value:ORIGIN_PREFIX+origin,base};
   return rest?{kind:'proyecto',value:rest,base}:{kind:'raiz-proyecto',value:null,base};}
  return {kind:'desconocida',value:null};};}

// Sustituye los tokens de un texto. rel(value) convierte una ruta del proyecto (listas concat: relativa a la carpeta de la lista).
// Un reemplazo que siguiera cumpliendo ABS_RE se deja sin tocar y se lista como no resuelto.
function replaceTokens(str,resolve,rel=v=>v){let out='',at=0;const changes=[],unresolved=[];
 for(const {token,index} of absTokens(str)){const r=resolve(token);
  const to=r.value===null?null:r.kind==='proyecto'?rel(r.value):r.value;
  if(to===null||ABS_RE.test(to)){unresolved.push({token,kind:r.kind});continue;}
  out+=str.slice(at,index)+to;at=index+token.length;changes.push({from:token,to,kind:r.kind});}
 return {str:changes.length?out+str.slice(at):str,changes,unresolved};}

// file: ruta del fichero relativa al proyecto. Solo cambian los tokens; el resto, byte a byte. Idempotente.
export function rewriteText(text,{file,resolve}){const changes=[],unresolved=[];
 const concat=CONCAT_RE.test(path.posix.basename(file||'')),dir=path.posix.dirname(file||'.');
 const lines=String(text).split('\n').map((line,i)=>{
  const rel=concat&&line.trimStart().startsWith("file '")?v=>path.posix.relative(dir,v):undefined;
  const r=replaceTokens(line,resolve,rel);
  for(const c of r.changes)changes.push({line:i+1,...c});for(const u of r.unresolved)unresolved.push({line:i+1,...u});
  return r.str;});
 return {text:changes.length?lines.join('\n'):text,changes,unresolved};}

// Copia profunda con las cadenas reescritas; path es la ruta JSON (a.0.b). No muta value.
export function rewriteValue(value,{resolve}){const changes=[],unresolved=[];
 const walk=(v,keys)=>{if(typeof v==='string'){const r=replaceTokens(v,resolve),p=keys.join('.');
   for(const c of r.changes)changes.push({path:p,...c});for(const u of r.unresolved)unresolved.push({path:p,...u});return r.str;}
  if(Array.isArray(v))return v.map((x,i)=>walk(x,[...keys,i]));
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x,[...keys,k])]));
  return v;};
 return {value:walk(value,[]),changes,unresolved};}
