// Carga bajo demanda de índices de solo lectura del servidor (#64 estados de planos; #65 producción). Sin DOM: fetchJSON inyectado
// (el api() de la app), así que se prueba en Node. Cada índice cachea por URL (proyecto y parámetros) y revisión del cliente, comparte la
// petición en curso y no guarda los fallos (get resuelve null y el siguiente render reintenta). invalidate(project) vacía todo el grupo.
export function lazyGroup(fetchJSON){const indexes=[];
 function index(urlFor){const cache=new Map();indexes.push(cache);
  const get=(project,revision,params)=>{const url=urlFor(project,params),hit=cache.get(url);if(hit&&hit.revision===revision)return hit.promise;
   const entry={project,revision,data:undefined,promise:null};cache.set(url,entry);
   entry.promise=Promise.resolve().then(()=>fetchJSON(url)).then(data=>{if(cache.get(url)===entry)entry.data=data;return data;},()=>{if(cache.get(url)===entry)cache.delete(url);return null;});
   return entry.promise;};
  const peek=(project,revision,params)=>{const hit=cache.get(urlFor(project,params));return hit&&hit.revision===revision?hit.data:undefined;};
  return {get,peek};}
 function invalidate(project){for(const cache of indexes)for(const [url,e] of cache)if(project===undefined||e.project===project)cache.delete(url);}
 return {index,invalidate};}
