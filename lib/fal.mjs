// Clave y cliente de fal.ai para la app y los scripts: subida, cola, suscripción y descarga. Nunca importa app/.
// Importarlo no toca el disco ni carga @fal-ai/client (se importa al crear el primer cliente).
import fs from 'node:fs';import path from 'node:path';import {parseEnv} from 'node:util';
import {ROOT} from './paths.mjs';import {readJSON} from './json.mjs';
// Carpeta de config.local.json y .env: RODAJE_CONFIG_DIR o la raíz del repositorio (los tests la fijan en test/setup.mjs).
export const CONFIG_DIR=process.env.RODAJE_CONFIG_DIR?path.resolve(process.env.RODAJE_CONFIG_DIR):ROOT;
export const SETTINGS_FILE=path.join(CONFIG_DIR,'config.local.json');
export const ENV_FILE=path.join(CONFIG_DIR,'.env');
export const MISSING_KEY='Falta FAL_KEY (.env o config.local.json)';
export const readSettings=(file=SETTINGS_FILE)=>fs.existsSync(file)?readJSON(file):{};
// config.local.json (falKey|FAL_KEY) > FAL_KEY del entorno > FAL_KEY de .env. No muta process.env. '' si no hay.
export function falKey({settings=readSettings(),env=process.env,envFile=ENV_FILE}={}){
 const s=settings.falKey||settings.FAL_KEY;if(s)return s;if(env.FAL_KEY)return env.FAL_KEY;
 try{return parseEnv(fs.readFileSync(envFile,'utf8')).FAL_KEY||'';}catch{return '';}}
export async function falClient({key=falKey(),message=MISSING_KEY}={}){if(!key)throw Error(message);const {createFalClient}=await import('@fal-ai/client');return createFalClient({credentials:key});}
// Subida: nombre = basename del fichero; Content-Type solo si se da (sin él, el cliente manda application/octet-stream).
export function uploadFile(client,file,{name=path.basename(file),type}={}){return client.storage.upload(new File([fs.readFileSync(file)],name,type?{type}:undefined));}
export const submit=(client,endpoint,input)=>client.queue.submit(endpoint,{input});
export const status=(client,endpoint,requestId)=>client.queue.status(endpoint,{requestId,logs:false});
export const result=(client,endpoint,requestId)=>client.queue.result(endpoint,{requestId});
export const subscribe=(client,endpoint,input)=>client.subscribe(endpoint,{input});
// URL del fichero devuelto: vídeo, audio o primera imagen.
export const outputUrl=data=>data.video?.url||data.audio?.url||data.images?.[0]?.url;
export async function download(url,{error='No se pudo descargar el resultado'}={}){const res=await fetch(url);if(!res.ok)throw Error(error);return Buffer.from(await res.arrayBuffer());}
