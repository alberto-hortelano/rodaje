// Grabador de fetch para las pruebas de proveedores (solo con --import en un subproceso). Sustituye globalThis.fetch sin
// conservar el original: ninguna llamada sale de la máquina. Registra cada llamada en RODAJE_MOCK_LOG (JSONL, leído en cada
// llamada) y responde en falso como fal.ai: subida (initiate + PUT), cola (submit, status COMPLETED, result) y descargas.
// Lanza con cualquier host no simulado o con una clave que no sea de prueba («Key test:…»).
// RODAJE_MOCK_HOOK (opcional): módulo con export default async ({method, url}) => {}, llamado tras registrar cada petición
// y antes de responderla (simula a otro proceso escribiendo mientras tanto). No escribe en el registro.
import fs from 'node:fs';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
if(!process.env.RODAJE_MOCK_LOG)throw Error('fal-fetch-mock: falta RODAJE_MOCK_LOG');
if(process.env.FAL_KEY&&!process.env.FAL_KEY.startsWith('test:'))throw Error('fal-fetch-mock: FAL_KEY debe ser de prueba (test:…)');
const FAL_HOSTS=['rest.fal.ai','queue.fal.run'],MOCK_HOSTS=['upload.mock.invalid','files.mock.invalid'];
let n=0,seq=0,next=0;const ready=new Map();
const hook=process.env.RODAJE_MOCK_HOOK?(await import(pathToFileURL(process.env.RODAJE_MOCK_HOOK).href)).default:null;
// Las entradas se escriben en el orden de llamada aunque el cuerpo (Blob) se resuelva después.
function flush(){while(ready.has(next)){const line=ready.get(next);ready.delete(next);next++;fs.appendFileSync(process.env.RODAJE_MOCK_LOG,line+'\n');}}
const slug=s=>s.replace(/[^A-Za-z0-9]+/g,'_');
const json=(data,headers={})=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json',...headers}});
function resultFor(id){const f=`https://files.mock.invalid/result/${id}`;
 if(/h3/.test(id))return {video:{url:f+'.mp4'},seed:1234,timings:{inference:1.5}};
 if(/nano_banana/.test(id))return {images:[{url:f+'.png'}]};
 if(/voice_design/.test(id))return {custom_voice_id:'mock-voz',audio:{url:f+'.mp3'}};
 if(/openrouter/.test(id))return {output:'{"title":"Mock","synopsis":"","sequences":[]}'};
 return {audio:{url:f+'.mp3'}};}
async function record(entry,body){let b=null;if(typeof body==='string')b=body;else if(body instanceof Blob){const buf=Buffer.from(await body.arrayBuffer());b={sha256:createHash('sha256').update(buf).digest('hex'),size:buf.length,type:body.type};}else if(body!=null)b={unsupported:Object.prototype.toString.call(body)};return JSON.stringify({...entry,body:b});}
globalThis.fetch=async function mockFetch(input,init={}){
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);const method=(init.method||input?.method||'GET').toUpperCase();
 const h=new Headers(init.headers||input?.headers||{});const auth=h.get('authorization');
 if(!FAL_HOSTS.includes(url.hostname)&&!MOCK_HOSTS.includes(url.hostname))throw Error('fal-fetch-mock: host no simulado '+url.href);
 if(FAL_HOSTS.includes(url.hostname)&&!auth?.startsWith('Key test:'))throw Error('fal-fetch-mock: clave que no es de prueba');
 if(auth&&!auth.startsWith('Key test:'))throw Error('fal-fetch-mock: clave que no es de prueba');
 const headers=Object.fromEntries([...h].filter(([k])=>k!=='authorization'&&k!=='user-agent').sort(([a],[b])=>a<b?-1:1));
 const mine=seq++;const pending=record({kind:'fetch',method,url:url.href,auth,headers},init.body);
 let res;
 if(url.hostname==='rest.fal.ai'&&url.pathname==='/storage/upload/initiate'){const k=++n;const {file_name}=JSON.parse(init.body);res=json({upload_url:`https://upload.mock.invalid/${k}`,file_url:`https://files.mock.invalid/${k}/${file_name}`});}
 else if(url.hostname==='upload.mock.invalid'&&method==='PUT')res=new Response(null,{status:200});
 else if(url.hostname==='files.mock.invalid'&&method==='GET')res=new Response(Buffer.from('mock:'+url.pathname),{status:200,headers:{'content-type':'application/octet-stream'}});
 else if(url.hostname==='queue.fal.run'){let m;
  if(method==='GET'&&(m=url.pathname.match(/\/requests\/([^/]+)\/status$/)))res=json({status:'COMPLETED',request_id:m[1]});
  else if(method==='GET'&&(m=url.pathname.match(/\/requests\/([^/]+)$/)))res=json(resultFor(m[1]),{'x-fal-request-id':m[1]});
  else if(method==='POST'){const endpoint=url.pathname.slice(1),id=`mock-${++n}-${slug(endpoint)}`,base=`https://queue.fal.run/${endpoint.split('/').slice(0,2).join('/')}/requests/${id}`;res=json({request_id:id,status:'IN_QUEUE',status_url:base+'/status',response_url:base});}}
 const line=await pending;ready.set(mine,line);flush();
 if(hook)await hook({method,url:url.href});
 if(!res)throw Error(`fal-fetch-mock: ruta no simulada ${method} ${url.href}`);
 return res;};
