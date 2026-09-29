// Reparto del prompt por plano (#48): t.cast, staging.proxies, recuento de visibles y fondo por location.
import test from 'node:test';import assert from 'node:assert/strict';
import {moveStart,uniqueNames,shotCast,planBlockCast,blockCastFits,blockCastIds,firstFrameCast,visibleCountPhrase,outsideFrameSentence,locationBackground,shotCastIssues,stagingIssues,locationIssues,strayNegatives,firstFrameLine,rehearsalConfig} from '../app/workflow.mjs';
import {digest} from '../app/store.mjs';

// Cámara en el origen mirando a -z: x<0 a la izquierda, z más negativo más lejos; z>0 queda detrás (fuera de cuadro).
const cam={position:[0,1.6,0],target:[0,1.2,-5],fov:50};
const seq=()=>({id:'s1',location:'patio',cast:[{character:'ana',x:0,z:-3},{character:'bea',x:-1,z:-6},{character:'cai',x:1,z:-4}]});
const sh=(id,extra={})=>({id,title:id,duration:4,camera:cam,cameraEnd:cam,lines:[],...extra});

test('shotCast: el cast del plano; sin él, el de la secuencia y luego sus proxies, sin repetidos',()=>{const s=seq();
 assert.deepEqual(shotCast(sh('p',{cast:['cai','ana']}),s),['cai','ana']);assert.deepEqual(shotCast(sh('p'),s),['ana','bea','cai']);
 assert.deepEqual(shotCast(sh('p',{staging:{proxies:{dan:{x:0,z:-9},ana:{x:0,z:-1}}}}),s),['ana','bea','cai','dan']);assert.deepEqual(shotCast(null,s),['ana','bea','cai']);});
test('planBlockCast: null si ningún plano declara cast; si alguno, unión ordenada y el plano sin cast aporta el de la secuencia',()=>{const s=seq(),byId={p1:sh('p1'),p2:sh('p2',{cast:['cai']}),p3:sh('p3',{cast:['ana','cai']})};
 assert.equal(planBlockCast([{shot:'p1'}],byId,s),null);assert.deepEqual(planBlockCast([{shot:'p2'},{shot:'p3'}],byId,s),['cai','ana']);assert.deepEqual(planBlockCast([{shot:'p2'},{shot:'p1'}],byId,s),['cai','ana','bea']);});
test('blockCastFits: 7 personajes y la plate caben en 8 imágenes; 8 no',()=>{const ids=n=>Array.from({length:n},(_,i)=>'c'+i);assert.equal(blockCastFits(ids(7)),true);assert.equal(blockCastFits(ids(8)),false);assert.equal(blockCastFits(ids(8),{fixed:0}),true);});
test('blockCastIds: block.cast si existe; sin él ni proxies, el reparto de la secuencia',()=>{const s=seq(),shots={p1:sh('p1'),p2:sh('p2',{staging:{proxies:{dan:{x:0,z:-9}}}})};
 assert.deepEqual(blockCastIds({sequence:s,block:{parts:[{shot:'p1'}]},shots}),['ana','bea','cai']);assert.deepEqual(blockCastIds({sequence:s,block:{cast:['bea'],parts:[{shot:'p1'}]},shots}),['bea']);
 assert.deepEqual(blockCastIds({sequence:s,block:{parts:[{shot:'p1'},{shot:'p2'}]},shots}),['ana','bea','cai','dan']);});
test('firstFrameCast: colocación efectiva del primer plano, solo el reparto del bloque, proxies y fuera de cuadro; depthLabel solo entre visibles',()=>{const s=seq();
 const t=sh('p1',{staging:{placements:{ana:{z:4}},proxies:{dan:{x:2,z:-12}}}}),block={cast:['ana','bea','dan'],parts:[{shot:'p1'}]};
 const F=firstFrameCast({sequence:s,shot:t,block,shots:{p1:t}});assert.deepEqual(F.visible,['bea','dan']);assert.deepEqual(F.outside,['ana']);assert.deepEqual(F.unplaced,[]);
 const by=Object.fromEntries(F.people.map(p=>[p.character,p]));assert.equal(by.ana.z,4);assert.equal(by.ana.label,null);assert.equal(by.dan.proxy,true);assert.equal(by.bea.proxy,false);
 assert.equal(by.bea.label,'foreground');assert.equal(by.dan.label,'background');assert.equal(by.bea.side,'centre');assert.ok(!F.people.some(p=>p.character==='cai'),'cai no está en el bloque');
 const lost=firstFrameCast({sequence:s,shot:sh('p1',{cast:['ana','zoe']}),block:null});assert.deepEqual(lost.unplaced,['zoe']);assert.deepEqual(lost.visible,['ana']);
 const cov=firstFrameCast({sequence:s,shot:sh('p1',{coverage:[{start:0,camera:{...cam,target:[0,1.2,5]}}]})});assert.deepEqual(cov.visible,[],'la cámara de la cobertura inicial manda');});
test('visibleCountPhrase: none es el texto de siempre, people añade figuras de fondo y 0 es «Nobody is visible», sin negativos',()=>{
 assert.equal(visibleCountPhrase(3),'Exactly 3 people visible');assert.equal(visibleCountPhrase(1),'Exactly 1 person visible');assert.equal(visibleCountPhrase(0),'Nobody is visible');assert.equal(visibleCountPhrase(0,{background:'people'}),'Nobody is visible');
 assert.equal(visibleCountPhrase(2,{background:'people',people:'the villagers'}),'Exactly 2 named people visible, with small distant background figures of the villagers well behind them');
 assert.equal(visibleCountPhrase(1,{background:'people'}),'Exactly 1 named person visible, with small distant background figures of passers-by well behind them');
 for(const n of [0,1,2])for(const background of ['none','people'])assert.deepEqual(strayNegatives(visibleCountPhrase(n,{background})+'.'),[]);});
test('outsideFrameSentence: uno, dos, tres o nadie',()=>{assert.equal(outsideFrameSentence(['ROZ']),'ROZ is outside the frame at the start.');assert.equal(outsideFrameSentence(['ROZ','EARL']),'ROZ and EARL are outside the frame at the start.');
 assert.equal(outsideFrameSentence(['A','B','C']),'A, B and C are outside the frame at the start.');assert.equal(outsideFrameSentence([]),'');});
test('firstFrameLine sin bloque: fuera de cuadro aparte y sin contar; nadie visible usa la frase del set vacío',()=>{const s=seq(),project={characters:[]};
 const line=firstFrameLine({sequence:s,shot:sh('p',{staging:{placements:{bea:{z:2}}}}),project,map:null});assert.match(line,/contains ANA frame-centre, foreground; CAI frame-right, background, in the positions of Video 1 frame 0\. BEA is outside the frame at the start\. Exactly 2 people visible\. No empty establishing frame\.$/);
 const none=firstFrameLine({sequence:{...s,cast:[{character:'ana',x:0,z:3}]},shot:sh('p'),project,map:null});assert.match(none,/the set itself is the subject\. ANA is outside the frame at the start\. Nobody is visible\.$/);
 assert.equal(firstFrameLine({sequence:{...s,cast:[]},shot:sh('p'),project,map:null}),'The first visible frame already shows the empty set exactly as framed in Video 1 frame 0. No empty establishing frame is needed: the set itself is the subject.');
 assert.match(firstFrameLine({sequence:s,shot:sh('p'),project,map:null,registry:{texts:{people:'the monks'}},location:{background:'people'}}),/Exactly 3 named people visible, with small distant background figures of the monks well behind them\. No empty/);});
test('locationBackground y locationIssues: ausente es none; solo none o people',()=>{assert.equal(locationBackground(undefined),'none');assert.equal(locationBackground({}),'none');assert.equal(locationBackground({background:'people'}),'people');
 assert.deepEqual(locationIssues({locations:[{id:'a'},{id:'b',background:'none'},{id:'c',background:'people'}]}),[]);assert.deepEqual(locationIssues({locations:[{id:'d',background:'crowd'}]}),['ambiente d: background debe ser none o people']);});
test('shotCastIssues: lista de ids conocidos; sin colocación, aviso',()=>{const s=seq(),characters=['ana','bea','cai','dan','eva'];
 assert.deepEqual(shotCastIssues(sh('p'),s,{characters}),{errors:[],warnings:[]});assert.deepEqual(shotCastIssues(sh('p',{cast:['ana','dan'],staging:{proxies:{dan:{x:0,z:-9}}}}),s,{characters}),{errors:[],warnings:[]});
 assert.deepEqual(shotCastIssues(sh('p',{cast:'ana'}),s,{characters}).errors,['p: cast debe ser una lista de ids']);assert.deepEqual(shotCastIssues(sh('p',{cast:['ana',3]}),s,{characters}).errors,['p: cast debe ser una lista de ids']);
 const r=shotCastIssues(sh('p',{cast:['zoe','eva']}),s,{characters});assert.deepEqual(r.errors,['p: cast: «zoe» no es un personaje del proyecto']);assert.deepEqual(r.warnings,['p: cast: «eva» no está en el reparto de la secuencia ni en staging.proxies: sin colocación']);});
test('stagingIssues valida staging.proxies',()=>{const s=seq(),R=rehearsalConfig({}),characters=['ana','bea','cai','dan','eva'];
 assert.deepEqual(stagingIssues(sh('p',{staging:{proxies:{dan:{x:1,z:-9}}}}),s,R,{characters}),{errors:[],warnings:[]});
 assert.deepEqual(stagingIssues(sh('p',{staging:{proxies:[]}}),s,R,{characters}).errors,['p: proxies debe ser un objeto']);
 const r=stagingIssues(sh('p',{cast:['dan'],staging:{proxies:{zoe:{x:0,z:0},ana:{x:0,z:0},dan:3,eva:{x:'1',z:NaN,yaw:2}}}}),s,R,{characters});
 assert.deepEqual(r.errors,['p: proxies.zoe: «zoe» no es un personaje del proyecto','p: proxies.ana: «ana» ya está en el reparto de la secuencia: usa placements','p: proxies.dan debe ser un objeto','p: proxies.eva.x debe ser un número','p: proxies.eva.z debe ser un número']);
 assert.deepEqual(r.warnings,['p: proxies.zoe: el plano declara cast sin «zoe»: no entra en el prompt','p: proxies.ana: el plano declara cast sin «ana»: no entra en el prompt','p: proxies.eva.yaw: proxies solo lee x y z','p: proxies.eva: el plano declara cast sin «eva»: no entra en el prompt']);});
test('digest: t.cast, staging.proxies y location.background no cambian la huella del ensayo',()=>{const p={id:'demo-reparto',characters:[{id:'ana',name:'Ana'}],locations:[{id:'patio',name:'Patio'}],environments:[],episodes:[{id:'e1',sequences:[{...seq(),shots:[sh('p1',{staging:{scene:1}})]}]}]};
 const before=digest(p,'p1'),t=p.episodes[0].sequences[0].shots[0];t.cast=['ana'];t.staging.proxies={dan:{x:0,z:-9}};p.locations[0].background='people';assert.equal(digest(p,'p1'),before);});
test('moveStart: posición en t=0 como stage.js: walk, glide-in y glide empiezan en marca − delta; glide-out en la marca',()=>{
 assert.deepEqual(moveStart(1,-2,{kind:'walk',delta:[-.4,0,-2.8]}),{x:1.4,z:.7999999999999998});assert.deepEqual(moveStart(1,-2,{kind:'glide-in',delta:[1,0,1]}),{x:0,z:-3});assert.deepEqual(moveStart(1,-2,{kind:'glide',delta:[0,0,2]}),{x:1,z:-4});
 assert.deepEqual(moveStart(1,-2,{kind:'glide-out',delta:[5,0,5]}),{x:1,z:-2});assert.deepEqual(moveStart(1,-2,undefined),{x:1,z:-2});assert.deepEqual(moveStart(1,-2,{kind:'walk'}),{x:1,z:-2});});
test('firstFrameCast usa la posición de t=0 con staging.moves, sobre la colocación efectiva (#48)',()=>{const s=seq();
 // ana acaba detrás de la cámara (z=2) pero empieza delante (z=-3); cai acaba en cuadro pero empieza detrás; bea sale con glide-out desde su marca.
 const t=sh('p',{staging:{placements:{ana:{z:2}},moves:{ana:{kind:'walk',delta:[0,0,5]},cai:{kind:'glide-in',delta:[0,0,-8]},bea:{kind:'glide-out',delta:[0,0,10]}}}});
 const F=firstFrameCast({sequence:s,shot:t});assert.deepEqual(F.visible,['ana','bea']);assert.deepEqual(F.outside,['cai']);assert.equal(F.people.find(p=>p.character==='ana').z,-3);});
test('uniqueNames: shortName salvo choque en el proyecto o el bloque; entonces el nombre del registro y, si aún choca, el nombre completo (#48)',()=>{const project={characters:[{id:'a1',name:'El primero del árbol'},{id:'a2',name:'El segundo del árbol'},{id:'g',name:'Girart de Ruel'},{id:'b1',name:'La vieja'},{id:'b2',name:'La moza'}]};
 const registry={assets:{A1:{kind:'character',character:'a1',descriptor:'THE FIRST MAN OF THE TREE: a man.'},A2:{kind:'character',character:'a2',descriptor:'THE SECOND MAN OF THE TREE: a man.'}}};
 const n=uniqueNames(project,registry,['g','a1','a2','b1','b2']);assert.deepEqual(['g','a1','a2','b1','b2'].map(n),['GIRART','THE FIRST MAN OF THE TREE','THE SECOND MAN OF THE TREE','LA VIEJA','LA MOZA']);
 assert.equal(uniqueNames(project,registry,['g','a1'])('a1'),'THE FIRST MAN OF THE TREE','choca con otro personaje del proyecto aunque no esté en el bloque');assert.equal(uniqueNames({characters:project.characters.slice(0,1)},registry,['a1'])('a1'),'EL','sin choque, shortName');assert.equal(n('zzz'),'ZZZ');});
