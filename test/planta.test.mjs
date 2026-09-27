// Editor de plantas (issue #12): lógica pura de viewer/planta.mjs, sustitución de un tramo de JSON (lib/json.mjs) y guardado (lib/planta.mjs).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import * as P from '../viewer/planta.mjs';
import {jsonValueSpan,replaceJsonValue} from '../lib/json.mjs';
import {replacePlantaText} from '../lib/planta.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
// Fixture con la forma de una planta real: una contenedora, una forma con papeles de lados y otras sin ellos.
const PLANTA={version:1,unidades:'metros',nota:'Planta de prueba.',formas:[
 {id:'recinto',nombre:'Muro del recinto',cerrada:true,puntos:[[-10,17.6],[15.9,17.8],[16,-6.5],[11.6,-6.5],[11.5,-12.4],[-11.6,-12.1],[-12.7,5.8]]},
 {id:'casa',nombre:'Casa principal',cerrada:true,puntos:[[-7.5,-6.1],[6.8,-6.8],[7.1,1.3],[-7,2]]},
 {id:'cocina',nombre:'Cocina',cerrada:true,puntos:[[-6.2,2],[-12,5.7],[-13.3,5.7],[-13.3,2],[-12.6,-1.8],[-7.1,-2.1]],lados:['fachada','chimenea','hastial','alero','canal','casa']},
 {id:'camino',nombre:'Camino',cerrada:false,puntos:[[0,18],[0,25],[3,30]],lados:['recto','curva']}],
 marcas:[{id:'puerta',nombre:'Puerta',punto:[2.02,19.15]}],revision:2};
const plant=()=>structuredClone(PLANTA);

test('anadirVertice inserta en el lado y alinea los papeles',()=>{const p=plant(),r=P.anadirVertice(p,2,2,[-13.3,4]);const f=r.formas[2];
 assert.equal(f.puntos.length,7);assert.equal(f.lados.length,7);assert.deepEqual(f.puntos[3],[-13.3,4]);assert.deepEqual(f.lados,['fachada','chimenea','hastial','hastial','alero','canal','casa']);
 assert.deepEqual(p,PLANTA,'la entrada no cambia');
 const cerrando=P.anadirVertice(p,2,5,[-6.5,0]).formas[2];assert.deepEqual(cerrando.puntos.at(-1),[-6.5,0]);assert.deepEqual(cerrando.lados.slice(-2),['casa','casa']);
 const sin=P.anadirVertice(p,1,0,[0,-6.5]).formas[1];assert.equal(sin.puntos.length,5);assert.equal(sin.lados,undefined);});
test('quitarVertice alinea los papeles: el lado fusionado conserva el del lado anterior',()=>{const p=plant();
 const f0=P.quitarVertice(p,2,0).planta.formas[2];assert.deepEqual(f0.lados,['chimenea','hastial','alero','canal','casa']);assert.equal(f0.lados.length,P.numLados(f0));
 const f3=P.quitarVertice(p,2,3).planta.formas[2];assert.deepEqual(f3.lados,['fachada','chimenea','hastial','canal','casa']);assert.deepEqual(f3.puntos[3],[-12.6,-1.8]);
 const f5=P.quitarVertice(p,2,5).planta.formas[2];assert.deepEqual(f5.lados,['fachada','chimenea','hastial','alero','canal']);
 for(const [i,l] of [[0,['curva']],[1,['recto']],[2,['recto']]]){const f=P.quitarVertice(p,3,i).planta.formas[3];assert.deepEqual(f.lados,l,'abierta '+i);assert.equal(f.lados.length,P.numLados(f));}
 assert.equal(P.quitarVertice(p,1,2).planta.formas[1].lados,undefined);assert.deepEqual(p,PLANTA,'la entrada no cambia');});
test('quitarVertice respeta el mínimo de vértices',()=>{const p=plant();p.formas[1].puntos.pop();assert.match(P.quitarVertice(p,1,0).error,/tres vértices/);
 const q=P.quitarVertice(plant(),3,0).planta;assert.match(P.quitarVertice(q,3,0).error,/dos vértices/);});
test('moverVertice devuelve una copia',()=>{const p=plant(),r=P.moverVertice(p,2,1,[-12.1,5.8]);assert.deepEqual(r.formas[2].puntos[1],[-12.1,5.8]);assert.deepEqual(p,PLANTA);assert.notEqual(r.formas[0],p.formas[0]);});
test('colorForma cicla la paleta y contenedora detecta la forma que rodea a otra',()=>{assert.equal(P.colorForma(0),P.PALETA[0]);assert.equal(P.colorForma(P.PALETA.length+2),P.PALETA[2]);assert.equal(P.PALETA.length,new Set(P.PALETA).size);
 const p=plant();assert.equal(P.contenedora(p.formas[0],p.formas),true);assert.equal(P.contenedora(p.formas[1],p.formas),false);assert.equal(P.contenedora(p.formas[3],p.formas),false);});
test('snap: 10 cm o 1 cm',()=>{assert.equal(P.snap(1.234),1.2);assert.equal(P.snap(-6.26),-6.3);assert.equal(P.snap(1.234,true),1.23);});
test('cajaPlanta, encuadre y conversión de coordenadas',()=>{const p=plant(),c=P.cajaPlanta(p);assert.deepEqual(c,{min:[-13.3,-12.4],max:[16,30]});
 const v=P.encuadre(p,1000,800);for(const f of p.formas)for(const q of f.puntos){const [x,y]=P.aPantalla(v,q);assert.ok(x>=39.9&&x<=960.1&&y>=39.9&&y<=760.1,JSON.stringify([q,x,y]));}
 assert.deepEqual(P.encuadre({formas:[]},1000,800),{x:-22,z:-20,s:22});assert.equal(P.cajaPlanta({formas:[]}),null);
 assert.equal(P.encuadre({formas:[{puntos:[[0,0],[0.01,0.01]]}]},1000,800).s,120);assert.equal(P.encuadre({formas:[{puntos:[[0,0],[1000,1000]]}]},1000,800).s,6);
 const [x,z]=P.aMundo(v,...P.aPantalla(v,[3.5,-7.25]));assert.ok(Math.abs(x-3.5)<1e-9&&Math.abs(z+7.25)<1e-9);});
test('ladoMasCercano: proyección, tolerancia y preferencia por la forma activa',()=>{const p=plant();
 const h=P.ladoMasCercano(p,[-13.2,4],0.5);assert.equal(h.forma,2);assert.equal(h.lado,2);assert.deepEqual(h.punto.map(v=>Math.round(v*100)/100),[-13.3,4]);assert.ok(Math.abs(h.d-0.1)<1e-9);
 assert.equal(P.ladoMasCercano(p,[100,100],1),null);
 // Un punto a igual distancia de dos lados: gana la forma activa.
 const t={version:1,formas:[{id:'a',cerrada:false,puntos:[[0,0],[10,0]]},{id:'b',cerrada:false,puntos:[[0,2],[10,2]]}]};assert.equal(P.ladoMasCercano(t,[5,1],1.5).forma,0);assert.equal(P.ladoMasCercano(t,[5,1],1.5,1).forma,1);
 assert.equal(P.ladoMasCercano({formas:[{id:'l',cerrada:false,puntos:[[0,0],[10,0],[10,10]]}]},[5,5],1),null,'la abierta no tiene lado de cierre');});
test('validarPlanta acepta la planta y rechaza lo que el editor no puede hacer',()=>{const a=plant();assert.deepEqual(P.validarPlanta(plant(),a),[]);assert.deepEqual(P.validarPlanta(P.anadirVertice(a,2,1,[-12.5,5.7]),a),[]);
 const casos={version:p=>{p.version=2;},sinVersion:p=>{delete p.version;},ids:p=>{p.formas[1].id='otra';},orden:p=>{p.formas.reverse();},borrada:p=>{p.formas.pop();},marcas:p=>{p.marcas[0].id='x';},cerrada:p=>{p.formas[3].cerrada=true;},
  nan:p=>{p.formas[1].puntos[0]=[NaN,1];},texto:p=>{p.formas[1].puntos[0]=['1',2];},trio:p=>{p.formas[1].puntos[0]=[1,2,3];},pocos:p=>{p.formas[1].puntos=[[0,0],[1,1]];},desalineados:p=>{p.formas[2].puntos.pop();},perdidos:p=>{delete p.formas[2].lados;},sinFormas:p=>{delete p.formas;},marcaRota:p=>{p.marcas[0].punto=null;}};
 for(const [k,fn] of Object.entries(casos)){const p=plant();fn(p);assert.ok(P.validarPlanta(p,a).length>0,k);}
 assert.deepEqual(P.validarPlanta(null,a),['La planta no es un objeto JSON.']);assert.ok(P.validarPlanta([],a).length);});
test('viewer/planta.mjs y planta.html no conocen ningún escenario ni proyecto',()=>{for(const f of ['planta.mjs','planta.html'])assert.doesNotMatch(fs.readFileSync(path.join(ROOT,'viewer',f),'utf8'),/conjurados|dead-air|caser[oó]n|girart|cocina|recinto|torre|cobertizo/i,f);
 const imports=[...fs.readFileSync(path.join(ROOT,'viewer/planta.mjs'),'utf8').matchAll(/^\s*import\b[^;]*from\s*['"]([^'"]+)['"]/gm)].map(m=>m[1]);assert.deepEqual(imports,['./kit.mjs']);});

// Texto con la forma de un model.json real: una línea compacta, cadenas con llaves y comillas, claves repetidas en otro nivel y sin salto final.
const MODEL=`{
  "version": 1,
  "name": "Prueba \\"con\\" {llaves}",
  "planta": {"no": "es esta"},
  "dims": {
    "enclosure": {
      "note": "la planta está en dims.planta } ] \\\\",
      "wall": 0.8
    },
    "planta": ${JSON.stringify(PLANTA,null,2).replace(/\n/g,'\n    ')},
    "otra": [1, 2]
  },
  "defaultState": {"puerta": "cerrada", "sala": "limpia"},
  "walkthrough": [
    {"label": "a"}
  ]
}`;
test('jsonValueSpan sigue la ruta de claves sin confundirse con cadenas ni otros niveles',()=>{const [s,e]=jsonValueSpan(MODEL,['dims','planta']);assert.deepEqual(JSON.parse(MODEL.slice(s,e)),PLANTA);
 const [a,b]=jsonValueSpan(MODEL,['planta']);assert.equal(MODEL.slice(a,b),'{"no": "es esta"}');assert.equal(MODEL.slice(...jsonValueSpan(MODEL,['name'])),'"Prueba \\"con\\" {llaves}"');
 assert.equal(MODEL.slice(...jsonValueSpan(MODEL,['dims','enclosure','wall'])),'0.8');assert.equal(jsonValueSpan(MODEL,['dims','nada']),null);assert.equal(jsonValueSpan(MODEL,['version','x']),null);
 const dup='{"a":1,"a":{"b":2}}';assert.equal(dup.slice(...jsonValueSpan(dup,['a'])),'{"b":2}','con claves repetidas, la última, como JSON.parse');});
test('replaceJsonValue cambia solo el tramo y deja el resto byte a byte',()=>{const p=plant();p.formas[2].puntos[1]=[-12.1,5.8];const out=replaceJsonValue(MODEL,['dims','planta'],p);
 assert.deepEqual(JSON.parse(out).dims.planta,p);assert.ok(!out.endsWith('\n'));assert.ok(out.includes('  "defaultState": {"puerta": "cerrada", "sala": "limpia"},\n'));
 const a=MODEL.split('\n'),b=out.split('\n');assert.equal(a.length,b.length);assert.equal(a.filter((l,i)=>l!==b[i]).length,2);
 assert.equal(replaceJsonValue(MODEL,['dims','planta'],PLANTA),MODEL,'el mismo valor no cambia nada');
 assert.throws(()=>replaceJsonValue(MODEL,['dims','nada'],1),/No existe dims\.nada/);assert.throws(()=>replaceJsonValue(MODEL,['dims','planta'],undefined),/serializable/);});
test('replacePlantaText: revisión antigua 409, no válida 400 y válida sube la revisión con un diff de tres líneas',()=>{const p=plant();p.formas[2].puntos[1]=[-12.1,5.8];
 const r=replacePlantaText(MODEL,{revision:2,planta:p});assert.equal(r.revision,3);assert.equal(r.planta.revision,3);
 const a=MODEL.split('\n'),b=r.text.split('\n');assert.equal(a.length,b.length);assert.equal(a.filter((l,i)=>l!==b[i]).length,3);assert.deepEqual(JSON.parse(r.text).dims.planta,{...p,revision:3});
 assert.equal(Object.keys(JSON.parse(r.text).dims.planta).at(-1),'revision','conserva la posición de la clave');
 assert.equal(replacePlantaText(MODEL,{revision:2,planta:{...p,revision:99}}).revision,3,'ignora la revisión del cliente');
 assert.throws(()=>replacePlantaText(MODEL,{revision:1,planta:p}),e=>e.status===409&&/revisión 2 en disco, 1 en el editor/.test(e.message));
 assert.throws(()=>replacePlantaText(MODEL,{revision:2,planta:{...p,formas:p.formas.slice(1)}}),e=>e.status===400);
 assert.throws(()=>replacePlantaText('{"dims":{}}',{revision:0,planta:p}),e=>e.status===404);
 const sin=replacePlantaText(MODEL.replace('"revision": 2','"sinrev": 2'),{revision:0,planta:(({revision,...x})=>x)(p)});assert.equal(sin.revision,1);});
