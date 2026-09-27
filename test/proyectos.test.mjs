import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const {DATA,create,listProjects}=await import('../app/store.mjs');
// Biblioteca de /api/state (#29): un proyecto a medio crear o corrupto en RODAJE_DATA (test/setup.mjs) no la rompe.
test('listProjects omite con aviso los proyectos sin listas o con JSON corrupto y resume los completos',t=>{
 const put=(id,txt)=>{fs.mkdirSync(path.join(DATA,id),{recursive:true});fs.writeFileSync(path.join(DATA,id,'proyecto.json'),txt);};
 put('pc-test','{"id":"pc-test"}\n');put('pc-corrupto','{"id":');fs.mkdirSync(path.join(DATA,'sin-proyecto'),{recursive:true});
 const p=create('Completo','pelicula');
 const warn=t.mock.method(console,'warn',()=>{});
 let list;assert.doesNotThrow(()=>{list=listProjects();});
 assert.deepEqual(list.find(x=>x.id===p.id),{id:p.id,name:'Completo',type:'pelicula',updated:p.updated,episodes:0,characters:0});
 assert.deepEqual(list.map(x=>x.id).filter(id=>['pc-test','pc-corrupto','sin-proyecto'].includes(id)),[]);
 const avisos=warn.mock.calls.map(c=>c.arguments.join(' '));for(const id of ['pc-test','pc-corrupto'])assert.ok(avisos.some(a=>a.includes(id)),id);
 // id = nombre de la carpeta, aunque proyecto.json diga otro.
 put('carpeta-real',JSON.stringify({...p,id:'otro-id'}));assert.ok(listProjects().some(x=>x.id==='carpeta-real'&&x.name==='Completo'));
 assert.equal(listProjects().some(x=>x.id==='otro-id'),false);});
