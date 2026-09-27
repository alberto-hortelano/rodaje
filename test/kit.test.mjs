import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import * as T from 'three';
import {createKit,polyContains,polyDist,centroid,insetPolygon,xAtZ,zAtX,rectMinus,segDist,mulberry32} from '../viewer/kit.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),KIT=path.join(ROOT,'viewer/kit.mjs');
const P={stone:'#8e887d',plaster:'#a89f8f'};
const uvOf=m=>Array.from(m.geometry.attributes.uv.array);
const close=(a,b,msg,eps=1e-6)=>{assert.equal(a.length,b.length,msg);for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>eps)assert.fail(`${msg}: [${i}] ${a[i]} ≠ ${b[i]}`);};
const noUuid=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==='uuid'?undefined:v));
// Árbol comparable: tipo, nombre, orden, transformaciones, sombras, geometría y material.
const describe=o=>({type:o.type,name:o.name,pos:o.position.toArray(),rot:o.rotation.toArray().slice(0,3),scale:o.scale.toArray(),cast:o.castShadow,receive:o.receiveShadow,
 geo:o.geometry&&{type:o.geometry.type,params:o.geometry.parameters&&JSON.stringify(noUuid(o.geometry.parameters)),position:Array.from(o.geometry.attributes.position.array),uv:Array.from(o.geometry.attributes.uv?.array||[]),index:Array.from(o.geometry.index?.array||[])},
 mat:o.material&&noUuid(o.material.toJSON()),children:o.children.map(describe)});
const same=(a,b,where='raíz')=>{assert.equal(a.type,b.type,where);assert.equal(a.name,b.name,where);for(const k of ['pos','rot','scale'])close(a[k],b[k],`${where} ${k}`);assert.equal(a.cast,b.cast,where);assert.equal(a.receive,b.receive,where);
 assert.equal(!!a.geo,!!b.geo,where);if(a.geo){assert.equal(a.geo.type,b.geo.type,where);assert.equal(a.geo.params,b.geo.params,where);for(const k of ['position','uv','index'])close(a.geo[k],b.geo[k],`${where} ${k}`);}
 assert.deepEqual(a.mat,b.mat,where);assert.equal(a.children.length,b.children.length,where);a.children.forEach((c,i)=>same(c,b.children[i],`${where}/${i}:${c.name}`));};

test('kit.mjs se importa sin DOM y no trae nada del proyecto',()=>{assert.equal(typeof document,'undefined');assert.equal(typeof window,'undefined');const src=fs.readFileSync(KIT,'utf8');assert.doesNotMatch(src,/^\s*import\s|\bimport\(|\brequire\(/m);assert.doesNotMatch(src,/conjurados|dead-air|caser[oó]n|toledo|girart/i);});
test('box: UV en metros con tesela configurable; caja degenerada null',()=>{const kit=createKit(T,{palette:P}),g=new T.Group(),m=kit.box(g,'c',[1,-3],[0,2],[0,1],'stone');assert.equal(g.children[0],m);assert.equal(m.name,'c');assert.deepEqual(m.position.toArray(),[-1,1,0.5]);assert.ok(m.castShadow&&m.receiveShadow);
 const uv=m.geometry.attributes.uv,maxOf=f=>[Math.max(...[0,1,2,3].map(k=>uv.getX(f*4+k))),Math.max(...[0,1,2,3].map(k=>uv.getY(f*4+k)))];
 assert.deepEqual([0,1,2,3,4,5].map(maxOf),[[0.5,1],[0.5,1],[2,0.5],[2,0.5],[2,1],[2,1]]);
 const k3=createKit(T,{palette:P}).configure({tile:3}),m3=k3.box(new T.Group(),'',[0,4],[0,2],[0,1],'stone');close(uvOf(m3),uvOf(m).map(v=>v*2/3),'tesela 3');
 assert.equal(kit.box(g,'nada',[0,1],[0,0],[0,1],'stone'),null);assert.equal(g.children.length,1);
 const mm=new T.MeshBasicMaterial();assert.equal(kit.box(g,'',[0,1],[0,1],[0,1],mm).material,mm);assert.equal(kit.box(g,'',[0,1],[0,1],[0,1],'stone').name,'');});
test('mat: caché por clave y extra, paleta y sin texturas en Node',()=>{const kit=createKit(T,{textures:true}).configure({palette:{stone:'#112233'}});const a=kit.mat('stone');assert.equal(kit.mat('stone'),a);assert.notEqual(kit.mat('stone',{transparent:true}),a);assert.equal(a.name,'stone');assert.equal(a.color.getHexString(),'112233');assert.equal(a.roughness,0.9);assert.equal(a.metalness,0);assert.equal(a.map,null);
 assert.equal(kit.mat('#abcdef').color.getHexString(),'abcdef');assert.equal(kit.mat('stone',{noTex:true,visible:false}).visible,false);assert.equal(kit.materials().length,4);assert.equal(createKit(T,{palette:P}).materials().length,0);assert.notEqual(createKit(T,{palette:P}).mat('stone'),a);});
test('wall: huecos desordenados y en ambos ejes',()=>{const kit=createKit(T,{palette:P}),g=new T.Group();const w=kit.wall(g,'muro','x',[0,10],[0,0.5],[0,3],[{a:[6,7],y:[1,2]},{a:[2,3],y:[0,2]}],'stone');assert.equal(w.parent,g);assert.equal(w.name,'muro');
 assert.deepEqual(w.children.map(m=>[m.position.x,m.position.y,m.geometry.parameters.width,m.geometry.parameters.height]),[[1,1.5,2,3],[2.5,2.5,1,1],[4.5,1.5,3,3],[6.5,0.5,1,1],[6.5,2.5,1,1],[8.5,1.5,3,3]]);
 const z=kit.wall(g,'z','z',[0,4],[1,1.2],[0,3],null,'stone');assert.equal(z.children.length,1);assert.deepEqual(z.children[0].position.toArray(),[1.1,1.5,2]);assert.equal(kit.group('suelto').parent,null);});
test('helpers de polígono sobre un cuadrado y un cóncavo',()=>{const sq=[[0,0],[4,0],[4,4],[0,4]],L=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]];
 assert.ok(polyContains(sq,2,2));assert.ok(!polyContains(sq,5,2));assert.ok(polyContains(L,0.5,3));assert.ok(!polyContains(L,3,3));
 assert.equal(polyDist(sq,2,2),0);assert.equal(polyDist(sq,6,2),2);assert.equal(polyDist(L,3,3),2);assert.equal(segDist(0,3,[0,0],[4,0]),3);
 assert.deepEqual(centroid(sq),[2,2]);assert.deepEqual(insetPolygon(sq,1),[[1,1],[3,1],[3,3],[1,3]]);assert.equal(xAtZ([0,0],[4,4],2),2);assert.equal(zAtX([0,0],[4,2],2),1);
 assert.deepEqual(rectMinus([0,3],[0,3],[[[1,2],[1,2]]]).length,8);assert.deepEqual(rectMinus([0,1],[0,1],[]),[[[0,1],[0,1]]]);const r=mulberry32(1),r2=mulberry32(1);assert.equal(r(),r2());
 const kit=createKit(T,{palette:P});for(const k of ['polyContains','polyDist','centroid','insetPolygon','xAtZ','zAtX','rectMinus','segDist','mulberry32'])assert.equal(typeof kit[k],'function',k);});
test('sin document: proceduralTextures vacío y applyImageTextures no pide URLs',async()=>{let calls=0;const kit=createKit(T,{textures:true,textureUrl:()=>{calls++;return 'x.png';}});assert.deepEqual(kit.proceduralTextures(),{});await kit.applyImageTextures({stone:{file:'s.png',tile:2}});await createKit(T,{palette:P}).applyImageTextures({stone:{file:'s.png',tile:2}});assert.equal(calls,0);});
test('compatible con el objeto de opciones',()=>{const state={pendon:'x'},url=f=>'/a/'+f,sky=()=>{},kit=createKit(T,{state,textures:true,textureUrl:url,onSky:sky});assert.equal(kit.isKit,true);assert.equal(kit.state,state);assert.equal(kit.textures,true);assert.equal(kit.textureUrl,url);assert.equal(kit.onSky,sky);assert.equal(kit.tile,2);
 const d=createKit(T,{palette:P});assert.deepEqual(d.state,{});assert.equal(d.textures,false);assert.equal(d.textureUrl,null);assert.equal(d.onSky,null);});

// ── Equivalencia con el constructor antiguo del caserón: se buscan en proyectos/ los constructores con el bloque de herramientas propio.
const legacy=[];
for(const id of fs.existsSync(path.join(ROOT,'proyectos'))?fs.readdirSync(path.join(ROOT,'proyectos')):[]){const pj=path.join(ROOT,'proyectos',id,'proyecto.json');if(!fs.existsSync(pj))continue;let p;try{p=JSON.parse(fs.readFileSync(pj,'utf8'));}catch{continue;}
 for(const e of p.environments||[]){if(!e.builder||!e.data)continue;const f=path.join(ROOT,'proyectos',id,e.builder);if(!fs.existsSync(f))continue;const src=fs.readFileSync(f,'utf8');if(src.includes('const mats = {};')&&src.includes('const marker =')&&/function textures\(T\)/.test(src))legacy.push({src,file:f,data:JSON.parse(fs.readFileSync(path.join(ROOT,'proyectos',id,e.data),'utf8'))});}}
const old=legacy[0];
const oldModule=async()=>import('data:text/javascript,'+encodeURIComponent(old.src+'\nexport {COLORS, textures, scaleUV, polyContains, polyDist, centroid, insetPolygon, xAtZ, zAtX, rectMinus, segDist, mulberry32};'));
const oldTools=(COLORS,tex={})=>{const a=old.src.indexOf('const mats = {};'),b=old.src.indexOf('const marker =');return new Function('T','COLORS','tex','root',old.src.slice(a,b)+'\nreturn {mat, group, box, wall, gableRoof, cyl};')(T,COLORS,tex,new T.Group());};
const skip=!old&&'sin constructor antiguo';

test('kit ≡ caserón: box, wall, gableRoof, cyl y mat',{skip},async()=>{const M=await oldModule(),o=oldTools(M.COLORS),kit=createKit(T).configure({palette:M.COLORS});
 const cases=[['box','caja',[1,-3],[0,2],[0.5,1.7],'stone'],['box','',[0,4],[0,1],[0,1],'oakDark'],['box','m',[0,1],[0,2],[0,3],new T.MeshBasicMaterial({color:'#123456'})],
  ['wall','mx','x',[0,10],[0,0.5],[0,3],[{a:[6,7],y:[1,2]},{a:[2,3],y:[0,2]},{a:[8,9],y:[0,3]}],'stone'],['wall','mz','z',[-5,4],[1,1.3],[0.2,2.9],[{a:[1,2],y:[0.2,2.9]},{a:[-4,-3],y:[1,2]}],'plaster'],['wall','sin','x',[0,3],[0,1],[0,2],[],'stoneInner'],
  ['gableRoof','t1',[-3,5],[-2,4],3,2],['gableRoof','t2',[0,6],[0,5],4,1.5,0.6,'oak','stoneDark'],['cyl','c',0.3,2,[1,0,2],'oak'],['cyl','',0.1,1,[0,1,0],'iron',6]];
 for(const [fn,...args] of cases){const ga=new T.Group(),gb=new T.Group();const ra=o[fn](ga,...args),rb=kit[fn](gb,...args);assert.equal(ra===null,rb===null,fn);same(describe(ga),describe(gb),`${fn} ${args[0]}`);}
 assert.equal(o.box(new T.Group(),'x',[0,1],[0,1e-4],[0,1],'stone'),null);assert.equal(kit.box(new T.Group(),'x',[0,1],[0,1e-4],[0,1],'stone'),null);
 for(const [k,e] of [['stone',{}],['shieldImg',{noTex:true,visible:false}],['#ff0000',{}],['cloth',{side:T.DoubleSide,transparent:true,opacity:0.8}]])assert.deepEqual(noUuid(kit.mat(k,e).toJSON()),noUuid(o.mat(k,e).toJSON()),k);
 const ea=new T.ExtrudeGeometry(new T.Shape([new T.Vector2(0,0),new T.Vector2(3,0),new T.Vector2(0,5)]),{depth:1}),eb=ea.clone();M.scaleUV(ea);kit.scaleUV(eb);close(Array.from(ea.attributes.uv.array),Array.from(eb.attributes.uv.array),'scaleUV');});

test('kit ≡ caserón: texturas procedurales con un canvas falso',{skip},async()=>{const M=await oldModule();
 const fake=log=>({createElement:tag=>{const c={tag,width:0,height:0,getContext:()=>new Proxy({},{set:(t,k,v)=>{log.push(['=',k,v]);return true;},get:(t,k)=>(...a)=>log.push([k,...a])})};return c;}});
 const dump=tx=>Object.fromEntries(Object.entries(tx).map(([k,t])=>[k,{repeat:t.repeat.toArray(),wrap:[t.wrapS,t.wrapT],cs:t.colorSpace,size:[t.image.width,t.image.height]}]));
 try{const la=[],lb=[];globalThis.document=fake(la);const a=M.textures(T);globalThis.document=fake(lb);const kit=createKit(T,{textures:true}),b=kit.proceduralTextures();
  assert.ok(la.length>1000);assert.deepEqual(lb,la);assert.deepEqual(dump(b),dump(a));assert.equal(kit.proceduralTextures(),b);assert.equal(lb.length,la.length);
  const lc=[];globalThis.document=fake(lc);const k2=createKit(T,{textures:true,palette:M.COLORS}),m=k2.mat('stone');assert.deepEqual(lc,la);assert.ok(m.map);assert.equal(m.color.getHexString(),'ffffff');assert.equal(k2.mat('stone',{noTex:true}).map,null);assert.equal(createKit(T,{palette:M.COLORS}).mat('stone').map,null);}
 finally{delete globalThis.document;}});

test('kit ≡ caserón: helpers de polígono sobre la planta',{skip},async()=>{const M=await oldModule(),d=old.data.dims,forms=d.planta.formas.map(f=>f.puntos),OUT=d.planta.formas.find(f=>f.id==='recinto')?.puntos||forms[0];
 assert.deepEqual(insetPolygon(OUT,d.enclosure.wall),M.insetPolygon(OUT,d.enclosure.wall));
 for(const P of forms){assert.deepEqual(centroid(P),M.centroid(P));assert.deepEqual(insetPolygon(P,0.4),M.insetPolygon(P,0.4));
  for(let x=-60;x<=60;x+=1.7)for(let z=-60;z<=60;z+=1.3){assert.equal(polyContains(P,x,z),M.polyContains(P,x,z));assert.equal(polyDist(P,x,z),M.polyDist(P,x,z));}
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],mz=(a[1]+b[1])/2,mx=(a[0]+b[0])/2;assert.deepEqual([xAtZ(a,b,mz),zAtX(a,b,mx)],[M.xAtZ(a,b,mz),M.zAtX(a,b,mx)]);assert.equal(segDist(mx+1,mz-2,a,b),M.segDist(mx+1,mz-2,a,b));}}
 const holes=[[[1,2],[1,3]],[[4,5.5],[0,2]]];assert.deepEqual(rectMinus([0,6],[0,4],holes),M.rectMinus([0,6],[0,4],holes));
 const a=mulberry32(20260925),b=M.mulberry32(20260925);for(let i=0;i<1000;i++)assert.equal(a(),b());});

test('kit.box reproduce cada caja del caserón construido',{skip},async()=>{const M=await oldModule(),{build}=await import('data:text/javascript,'+encodeURIComponent(old.src)),root=build(T,old.data,{textures:false}),kit=createKit(T).configure({palette:M.COLORS});
 let n=0;root.traverse(m=>{if(!m.isMesh||m.geometry.type!=='BoxGeometry'||m.rotation.x||m.rotation.y||m.rotation.z||m.scale.x!==1||m.scale.y!==1||m.scale.z!==1)return;
  const {width:w,height:h,depth:dd}=m.geometry.parameters,fresh=uvOf({geometry:new T.BoxGeometry(w,h,dd)}),uv=uvOf(m);if(uv.every((v,i)=>v===fresh[i]))return;
  const [x,y,z]=m.position.toArray(),b=kit.box(new T.Group(),m.name,[x-w/2,x+w/2],[y-h/2,y+h/2],[z-dd/2,z+dd/2],m.material.name);
  close(uvOf(b),uv,m.name+' uv');close(b.position.toArray(),[x,y,z],m.name+' pos',1e-9);assert.equal(b.name,m.name);assert.deepEqual(noUuid(b.material.toJSON()),noUuid(m.material.toJSON()),m.name+' material');n++;});
 assert.ok(n>100,`solo ${n} cajas comprobadas`);});

test('el caserón construye igual con un kit que con el objeto de opciones',{skip},async()=>{const {build}=await import('data:text/javascript,'+encodeURIComponent(old.src)),state={pendon:'bertran'};
 same(describe(build(T,old.data,createKit(T,{state}))),describe(build(T,old.data,{state,textures:false})));});
