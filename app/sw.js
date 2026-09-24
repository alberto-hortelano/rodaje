// Service worker de Rodaje: guarda la interfaz y lo que se visita para poder abrir la app en el móvil sin servidor (solo lectura).
// Las reglas (qué va a caché, con qué clave, qué se sirve primero) están en workflow.mjs para poder probarlas. movil.html rellena la caché con un proyecto entero.
import {CACHES,offlineRoute,cacheName,cacheKey} from '/workflow.mjs';
const SHELL=['/','/app.js','/style.css','/stage.js','/workflow.mjs','/manifest.webmanifest','/movil.html','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHES.shell).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!Object.values(CACHES).includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const json=(data,status)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const offline=req=>req.mode==='navigate'?new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><p style="font:16px system-ui;padding:24px">No hay servidor y esta página no está guardada en el dispositivo. Abre <a href="/movil.html">/movil.html</a> con el servidor encendido y guarda el proyecto.</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}}):json({error:'Sin conexión con el servidor: la copia del móvil es de solo lectura'},503);
// Un vídeo o audio guardado entero se sirve por rangos cuando el reproductor los pide.
async function partial(res,range){const m=range&&/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return res;const blob=await res.blob(),size=blob.size,start=Number(m[1]),end=Math.min(m[2]?Number(m[2]):size-1,size-1);if(start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});return new Response(blob.slice(start,end+1),{status:206,headers:{'Content-Type':res.headers.get('Content-Type')||'application/octet-stream','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});}
async function handle(req,url,route){const key=cacheKey(url),range=req.headers.get('range'),cache=await caches.open(cacheName(url.pathname));
 if(route==='cache-first'){const hit=await cache.match(key);if(hit)return partial(hit,range);}
 else try{const res=await fetch(req);if(res.status===200&&!range)cache.put(key,res.clone());return res;}catch{}
 const hit=await cache.match(key);if(hit)return partial(hit,range);
 if(route==='cache-first')try{const res=await fetch(req);if(res.status===200&&!range)cache.put(key,res.clone());return res;}catch{}
 return offline(req);}
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(url.origin!==location.origin)return;const route=offlineRoute(url.pathname,e.request.method);if(route==='network')e.respondWith(fetch(e.request).catch(()=>offline(e.request)));else e.respondWith(handle(e.request,url,route));});
