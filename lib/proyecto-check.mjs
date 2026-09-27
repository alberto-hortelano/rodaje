// Validador de un proyecto: reglas sobre el manifiesto y la lista de ficheros. Puro: recibe el manifiesto,
// las rutas POSIX relativas y una función read(ruta) → texto; no toca el disco.
import path from 'node:path';

export const CODE_RE = /\.(js|mjs|cjs|ts|py|sh|html?)$/i;
export const ABS_RE = /\/home\/|file:\/\//;
// Claves del manifiesto cuyo valor es una ruta que la app resuelve.
export const RESOLVED_KEYS = new Set(['builder','data','glb','viewer','image','references','file','scene','script']);
const TEXT_RE = /\.(json|md|txt)$/i;
const TOKEN_RE = /\b(import|require|document|window|process|fetch|eval|globalThis)\b/g;
const EXPORT_RE = /\bexport\s+(?:(default)\b|(?:async\s+)?function\*?\s+([\w$]+)|(?:const|let|var|class)\s+([\w$]+)|\{([^}]*)\})/g;
export const RULES = ['R-code','R-builder','R-manifest','R-before','R-abs'];

// Quita comentarios, vacía strings y literales regex. Conserva los saltos de línea fuera de comentarios de bloque.
// Heurístico: no interpreta ${} de las plantillas.
export function stripCode(src){let out='',i=0,prev='';const n=src.length;
 while(i<n){const c=src[i],d=src[i+1];
  if(c==='/'&&d==='/'){while(i<n&&src[i]!=='\n')i++;continue;}
  if(c==='/'&&d==='*'){const end=src.indexOf('*/',i+2);i=end<0?n:end+2;out+=' ';continue;}
  if(c==='"'||c==="'"||c==='`'){i++;while(i<n&&src[i]!==c){if(src[i]==='\\')i++;else if(src[i]==='\n'&&c!=='`')break;i++;}i++;out+=c+c;prev=c;continue;}
  if(c==='/'&&!/[\w$)\]]/.test(prev)){let j=i+1,inClass=false;
   while(j<n&&src[j]!=='\n'){if(src[j]==='\\')j++;else if(src[j]==='[')inClass=true;else if(src[j]===']')inClass=false;else if(src[j]==='/'&&!inClass)break;j++;}
   if(src[j]==='/'){i=j+1;while(/[a-z]/i.test(src[i]||''))i++;out+='""';prev='"';continue;}}
  out+=c;if(!/\s/.test(c))prev=c;i++;}
 return out;}

// Lo que un constructor no debe usar: globales y módulos (una vez cada uno) y exports distintos de build.
export function builderIssues(src){const s=stripCode(src),tokens=new Set(),exports=new Set();
 for(const m of s.matchAll(TOKEN_RE)){const before=s.slice(0,m.index).trimEnd(),after=s.slice(m.index+m[0].length).trimStart();
  if((before.endsWith('.')&&!before.endsWith('...'))||after.startsWith(':'))continue;tokens.add(m[1]);}
 for(const m of s.matchAll(EXPORT_RE)){if(m[1])exports.add('default');else if(m[2]||m[3])exports.add(m[2]||m[3]);
  else for(const item of m[4].split(','))if(item.trim())exports.add(item.trim().split(/\s+as\s+/).pop());}
 exports.delete('build');
 return [...tokens,...[...exports].map(e=>'export '+e)];}

function walkStrings(value,keys,cb){if(typeof value==='string')cb(keys,value);else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))walkStrings(v,[...keys,k],cb);}

// Hallazgos {rule, level:'error'|'aviso', file, detail, line?} en orden de regla y, dentro, de files.
export function checkProject({manifest,files,read}){const found=[];
 const add=(rule,level,file,detail,line)=>found.push({rule,level,file,detail,...(line?{line}:{})});
 const environments=Array.isArray(manifest?.environments)?manifest.environments:[];
 const builders=new Set(environments.map(e=>e?.builder).filter(b=>typeof b==='string'));
 const fileSet=new Set(files);
 for(const f of files)if(CODE_RE.test(f)&&!builders.has(f))add('R-code','error',f,'código fuera de un constructor declarado');
 environments.forEach((env,i)=>{const b=env?.builder;if(typeof b!=='string')return;
  if(path.posix.isAbsolute(b)||b.split(/[\\/]/).includes('..'))return add('R-builder','error','proyecto.json',`environments[${i}].builder fuera del proyecto: ${b}`);
  if(!fileSet.has(b))return add('R-builder','error','proyecto.json',`environments[${i}].builder no existe: ${b}`);
  let src;try{src=read(b);}catch(e){return add('R-builder','error',b,'no se puede leer: '+e.message);}
  for(const issue of builderIssues(src))add('R-builder','error',b,issue);});
 const manifestAbs=[];
 if(manifest&&typeof manifest==='object'){
  for(const k of ['shipModel','shipModelHistory'])if(Object.hasOwn(manifest,k))add('R-manifest','error','proyecto.json',k);
  walkStrings(manifest,[],(keys,v)=>{const jsonPath=keys.join('.'),inEnv=keys[0]==='environments',last=keys.at(-1);
   if(inEnv&&last==='viewer')add('R-manifest','error','proyecto.json',`${jsonPath}: ${v}`);
   else if(CODE_RE.test(v)&&!(inEnv&&last==='builder'))add('R-manifest','error','proyecto.json',`${jsonPath}: ${v}`);
   if(ABS_RE.test(v)&&keys.some(k=>RESOLVED_KEYS.has(k)))manifestAbs.push(jsonPath);});}
 for(const f of files){const base=path.posix.basename(f);if(/^before([-.]|$)/.test(base)||base.includes('.before-'))add('R-before','error',f,'copia before');}
 for(const p of manifestAbs)add('R-abs','error','proyecto.json',p);
 for(const f of files){const code=CODE_RE.test(f);if(!code&&!TEXT_RE.test(f))continue;
  let text;try{text=read(f);}catch{continue;}
  const lines=[];text.split('\n').forEach((l,i)=>{if(ABS_RE.test(l))lines.push(i+1);});
  if(lines.length)add('R-abs',code?'error':'aviso',f,`${lines.length} líneas`,lines[0]);}
 return found;}
