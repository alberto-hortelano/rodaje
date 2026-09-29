// #60: assets del registro de un personaje o ambiente (registryAssetsFor) y documentos de la página (ENTITY_DOCS). Textos inventados.
import test from 'node:test';import assert from 'node:assert/strict';
import {registryAssetsFor,ENTITY_DOCS} from '../lib/entidad.mjs';
import {entityRegistry} from './fixtures/entidad.mjs';

test('registryAssetsFor: personaje con sus character y voice, grupos que lo incluyen, proveedor, estados y sin sha256',()=>{
 const list=registryAssetsFor(entityRegistry(),'character','ana');
 assert.deepEqual(list.map(a=>a.tag),['ANA','ANA_ROJA','ANA_VOICE','GRUPO']);
 assert.deepEqual(list[0],{tag:'ANA',kind:'character',status:'draft',file:'personajes/ana/ref/base.png',descriptor:'Mujer.',states:['herida','dormida']});
 assert.deepEqual(list[1],{tag:'ANA_ROJA',kind:'character',status:'approved',since:'2026-01-01',file:'personajes/ana/ref/roja.png',descriptor:'Mujer de rojo.',variant:'roja',proxy:'Crema',voice:'ANA_VOICE'});
 assert.deepEqual(list[2],{tag:'ANA_VOICE',kind:'voice',status:'approved',file:'',descriptor:'Voz grave.',provider:'elevenlabs',voiceId:'abcdefghij0123456789'});
 assert.deepEqual(list[3],{tag:'GRUPO',kind:'group',status:'approved',file:'g.png',descriptor:'Los dos.',variant:'roja',members:['ANA_ROJA','BETO']});
 const beto=registryAssetsFor(entityRegistry(),'character','beto');assert.deepEqual(beto.map(a=>a.tag),['BETO','BETO_VOICE','GRUPO','OTRO_GRUPO']);
 assert.deepEqual([beto[1].provider,beto[1].voiceId],['minimax','ttv-1']);
 for(const a of [...list,...beto])assert.ok(!('sha256' in a),a.tag);});

test('registryAssetsFor: ambiente por location o por alias; registro vacío, raro o tipo desconocido, []',()=>{
 const reg=entityRegistry();
 assert.deepEqual(registryAssetsFor(reg,'location','plaza').map(a=>a.tag),['PLAZA','PLAZA_NOCHE']);
 assert.deepEqual(registryAssetsFor(reg,'location','plaza')[1].aliases,['plaza','plaza-vieja']);assert.ok(!('aliases' in registryAssetsFor(reg,'location','plaza')[0]),'sin alias vacíos');
 assert.ok(!('master' in registryAssetsFor(reg,'location','plaza')[0]));
 assert.deepEqual(registryAssetsFor(reg,'location','plaza-vieja').map(a=>a.tag),['PLAZA_NOCHE']);
 assert.deepEqual(registryAssetsFor(reg,'location','nave').map(a=>a.tag),['NAVE']);
 for(const r of [{},{assets:{}},null,{assets:[1,2]},{assets:{X:null,Y:'z'}}])assert.deepEqual(registryAssetsFor(r,'character','ana'),[]);
 assert.deepEqual(registryAssetsFor(reg,'environment','plaza'),[]);assert.deepEqual(registryAssetsFor(reg,'character','nadie'),[]);
 const before=entityRegistry(),copy=structuredClone(before);registryAssetsFor(before,'character','ana');assert.deepEqual(before,copy);});

test('ENTITY_DOCS: hoja, ficha, mapa y referencia en las carpetas de siempre',()=>{
 assert.deepEqual(ENTITY_DOCS.character.map(d=>[d.key,d.file('ana'),!!d.image]),[['hoja','personajes/ana/hoja.png',true],['hoja-md','personajes/ana/hoja.md',false],['ficha','personajes/ana/FICHA.md',false]]);
 assert.deepEqual(ENTITY_DOCS.location.map(d=>[d.key,d.file('plaza'),!!d.image]),[['referencia','ambientes/plaza/referencia.png',true],['ficha','ambientes/plaza/FICHA.md',false],['mapa','ambientes/plaza/MAPA.md',false]]);});
