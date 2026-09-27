// Ficheros de un proyecto como rutas POSIX relativas: con git, los versionados y los no ignorados; si no, un recorrido del disco.
// Se salta .git, trabajos/, versiones/ y node_modules/. Lo usan proyecto-check y proyecto-rutas.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export const SKIP_DIRS = new Set(['.git','trabajos','versiones','node_modules']);

function walkFiles(root,rel=''){const out=[];
 for(const e of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){const p=rel?rel+'/'+e.name:e.name;
  if(e.isDirectory()){if(!SKIP_DIRS.has(e.name))out.push(...walkFiles(root,p));}else if(e.isFile())out.push(p);}
 return out;}

export function listProjectFiles(dir){
 if(fs.existsSync(path.join(dir,'.git'))){
  try{return execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:dir,encoding:'utf8',maxBuffer:1<<28}).split('\0')
   .filter(f=>f&&!f.split('/').slice(0,-1).some(d=>SKIP_DIRS.has(d))&&fs.existsSync(path.join(dir,f)));}catch{}}
 return walkFiles(dir).sort();}
