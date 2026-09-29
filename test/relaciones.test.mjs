// #58: resolveSpeaker, líneas sin personaje, relationIndex y sus consultas, sequenceLocationPlan, characterDraft y sus scripts.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {speakerResolver,resolveSpeaker,unresolvedDialogue,storyboardDialogueWarnings,storyboardShotDraft,storyboardSequenceMerge,applyStoryPlans,relKey,shotAppearance,shotCast,
 relationIndex,relationIndexFor,trail,descendants,relatedTo,holders,linksTo,sequenceLocationPlan,characterDraft,appearanceTree,appearanceEnvironments,parseRoute,routeQuery} from '../app/workflow.mjs';
import {validate,digest} from '../app/store.mjs';
import {relProject,relShot} from './fixtures/relaciones.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const keys=m=>[...m.keys()];
const shotIds=p=>p.episodes.flatMap(e=>e.sequences.flatMap(s=>s.shots.map(t=>t.id)));

test('resolveSpeaker: character existente, luego who por id, nombre completo o primera palabra; vacío o desconocido, null',()=>{
 const p={characters:[{id:'ana',name:'Ana Ruiz'},{id:'ruiz',name:'Ruiz Bravo'},{id:'Mx',name:'Mr X'},{id:'sin'}]};
 const r=speakerResolver(p);
 assert.equal(r({character:'ruiz',who:'Ana'}),'ruiz');
 assert.equal(r({character:'nadie',who:'Ana'}),'ana');
 for(const [who,id] of [['ana','ana'],[' ANA ','ana'],['Ana Ruiz','ana'],['ruiz','ruiz'],['ruiz bravo','ruiz'],['mx','Mx'],['mr','Mx'],['MR X','Mx'],['sin','sin'],['bravo',null],['',null],['   ',null],[undefined,null]])
  assert.equal(r({who}),id,String(who));
 assert.equal(resolveSpeaker(p,{who:'Ruiz'}),'ruiz','el id de ruiz se registra antes que otra clave de otro personaje');
 assert.equal(resolveSpeaker({characters:[{id:'b',name:'Ana'},{id:'ana',name:'Otra'}]},{who:'ana'}),'b','gana el primer personaje que tenga la clave');
 assert.equal(resolveSpeaker(null,{who:'x'}),null);assert.equal(resolveSpeaker({characters:'x'},{who:'x'}),null);assert.equal(resolveSpeaker({characters:[]},null),null);});

// Resolutores anteriores (storyboardShotDraft y guardado de viñeta de app.source.js) copiados tal cual.
const oldDraft=(p,l)=>{if(l.character&&p.characters.some(c=>c.id===l.character))return l.character;const who=String(l.who||'').trim().toLowerCase();return p.characters.find(c=>c.id.toLowerCase()===who||c.name.toLowerCase().split(/\s+/)[0]===who||c.name.toLowerCase()===who)?.id;};
const oldApp=(p,who)=>{const w=who.toLowerCase();return p.characters.find(c=>c.id.toLowerCase()===w||c.name.toLowerCase()===w||c.name.toLowerCase().split(/\s+/)[0]===w)?.id;};
test('regresión: los resolutores anteriores coinciden con resolveSpeaker salvo who vacío con un nombre vacío',()=>{
 const casts=[[{id:'ana',name:'Ana Ruiz'},{id:'ruiz',name:'Ruiz Bravo'},{id:'X-1',name:'Mr X'}],[{id:'mr',name:'Ana'},{id:'ana',name:'Mr Ana'}],[{id:'voz',name:'Public Address'},{id:'eco',name:''}],[]];
 const whos=['ana','ANA',' Ana ','ana ruiz','Ruiz','ruiz bravo','mr','x-1','Mr X','public','address','voz','eco','','  ','zzz','Ana  Ruiz'];
 let n=0;for(const characters of casts){const p={characters};for(const who of whos)for(const character of [undefined,'ana','voz','nadie']){const l={who,character};n++;
  const expected=who.trim()===''&&characters.some(c=>c.name==='')&&!(character&&characters.some(c=>c.id===character))?null:oldDraft(p,l)??null;
  assert.equal(resolveSpeaker(p,l),expected,JSON.stringify([characters.map(c=>c.id),who,character]));
  const w=who.trim();assert.equal(resolveSpeaker(p,{who:w}),w===''&&characters.some(c=>c.name==='')?null:oldApp(p,w)??null,JSON.stringify([characters.map(c=>c.id),w]));}}
 assert.ok(n>200);
 assert.equal(oldDraft({characters:[{id:'eco',name:''}]},{who:''}),'eco');assert.equal(resolveSpeaker({characters:[{id:'eco',name:''}]},{who:''}),null);});

test('líneas sin personaje: el plano no las lleva y la fusión, applyStoryPlans y storyboardDialogueWarnings las avisan',()=>{
 const p=relProject(),P1=p.storyboards[0].sequences[0].shots[0],n=()=>{let i=0;return ()=>'n'+(i++);};
 assert.deepEqual(unresolvedDialogue(p,P1),[{index:2,who:'Nadie',channel:'ext'}]);
 assert.deepEqual(unresolvedDialogue(p,p.storyboards[0].sequences[0].shots[1]),[{index:0,who:'',channel:''}]);
 assert.deepEqual(unresolvedDialogue(p,{}),[]);
 const d=storyboardShotDraft(p,P1,{newId:n(),castIds:['ana']});assert.deepEqual(d.lines.map(l=>[l.character,l.offscreen,l.channel??null]),[['ana',false,null],['beto',true,null],['pa',true,'pa']]);
 const texts=['Viñeta A1: la línea 3 («Nadie», canal ext) no tiene personaje; no pasa al plano. Crea el personaje o corrige el nombre.','Viñeta A2: la línea 1 («sin hablante») no tiene personaje; no pasa al plano. Crea el personaje o corrige el nombre.'];
 assert.deepEqual(storyboardDialogueWarnings(p,p.storyboards[0]),texts);assert.deepEqual(storyboardDialogueWarnings(p,p.storyboards[1]),[]);assert.deepEqual(storyboardDialogueWarnings(p,null),[]);
 const m=storyboardSequenceMerge(p,p.storyboards[0],p.episodes[0].sequences[1],n());for(const t of texts)assert.ok(m.warnings.includes(t),t);
 const a=applyStoryPlans(p,'sb1',{newId:n()});for(const t of texts)assert.ok(a.warnings.includes(t),t);});

test('relKey y shotAppearance (coincide con shotCast con cast o sin visibleCast)',()=>{
 assert.deepEqual([relKey('act','e'),relKey('sequence','s'),relKey('story','b'),relKey('scene','b','s'),relKey('panel','v'),relKey('shot','t'),relKey('character','c'),relKey('location','l'),relKey('environment','x')],
  ['act/e','seq/s','sb/b','scene/b/s','panel/v','shot/t','character/c','location/l','environment/x']);
 const seq={cast:[{character:'a'},{character:'b'}]};
 for(const t of [{},{cast:['c','c']},{cast:[]},{staging:{proxies:{p:{x:0,z:0},a:{x:1,z:1}}}}])assert.deepEqual(shotAppearance(t,seq).map(x=>x.character),shotCast(t,seq),JSON.stringify(t));
 assert.deepEqual(shotAppearance({visibleCast:['b'],staging:{proxies:{p:{}}}},seq),[{character:'b',via:'visibleCast'},{character:'p',via:'proxy'}]);
 assert.deepEqual(shotAppearance({cast:['c'],visibleCast:['b']},seq),[{character:'c',via:'shot.cast'}]);
 assert.deepEqual(shotAppearance(null,null),[]);});

test('relationIndex: nodos, padres, orden y trail con las claves de treeModel',()=>{
 const p=relProject();validate(p);const I=relationIndex(p);
 assert.equal(I.revision,7);
 const tree=[...I.nodes.values()].filter(n=>!['character','location','environment'].includes(n.kind)).sort((a,b)=>a.order-b.order).map(n=>`${n.key}<${n.parent}`);
 assert.deepEqual(tree,['act/e1<null','seq/f1<act/e1','sb/sb1<seq/f1','scene/sb1/sc1<sb/sb1','panel/P1<scene/sb1/sc1','shot/t1<panel/P1','panel/P2<scene/sb1/sc1','seq/c1<sb/sb1','shot/t2<seq/c1',
  'sb/sb2<seq/f1','scene/sb2/sc2<sb/sb2','panel/P3<scene/sb2/sc2','shot/t3<panel/P3','shot/t4<panel/P3','seq/c2<sb/sb2','seq/k1<act/e1',
  'act/e2<null','seq/f2<act/e2','shot/t5<seq/f2','shot/t6<seq/f2','seq/f3<act/e2']);
 assert.deepEqual(['f1','c1','k1'].map(id=>I.nodes.get('seq/'+id).role),['outline','container','test']);
 assert.deepEqual(['sb1','sb2'].map(id=>[I.nodes.get('sb/'+id).version,I.nodes.get('sb/'+id).current]),[[1,false],[2,true]]);
 assert.equal(I.nodes.get('shot/t4').episode,'e1');assert.equal(I.nodes.get('shot/t4').role,'test');assert.equal(I.nodes.get('scene/sb1/sc1').id,'sc1');
 assert.equal(I.nodes.get('panel/P1').data,p.storyboards[0].sequences[0].shots[0]);
 assert.deepEqual(trail(I,'shot/t3').map(n=>n.key),['act/e1','seq/f1','sb/sb2','scene/sb2/sc2','panel/P3','shot/t3']);assert.deepEqual(trail(I,'nada'),[]);
 assert.deepEqual([...I.panelShots],[['panel/P1',['shot/t1']],['panel/P3',['shot/t3','shot/t4']]]);
 assert.deepEqual([...I.shotPanel],[['shot/t1','panel/P1'],['shot/t3','panel/P3'],['shot/t4','panel/P3']]);
 assert.deepEqual([...I.sequenceShots],[['seq/c1',['shot/t1','shot/t2']],['seq/c2',['shot/t3']],['seq/k1',['shot/t4']],['seq/f2',['shot/t5','shot/t6']]]);
 assert.deepEqual(['t1','t2','t3','t4','t6'].map(id=>I.nodes.get('shot/'+id).sequence),['seq/c1','seq/c1','seq/c2','seq/k1','seq/f2']);
 assert.deepEqual([...I.locationEnvironments],[['location/plaza',['environment/env-a']],['location/nave',['environment/env-b']]]);
 assert.deepEqual([...I.environmentLocations],[['environment/env-a',['location/plaza']],['environment/env-b',['location/nave']]]);});

test('relationIndex: enlaces con via, canal, fuera de campo, herencia y entorno por las dos vías; sin hablante y colgantes',()=>{
 const I=relationIndex(relProject()),out=(k,rel)=>(I.from.get(k)||[]).filter(l=>l.rel===rel).map(({from,rel:_,...l})=>l);
 assert.deepEqual(out('panel/P1','appears'),[{to:'character/ana',via:'panel.cast'}]);
 assert.deepEqual(out('panel/P1','speaks'),[{to:'character/ana',via:'dialogue',channel:'direct',offscreen:false,line:0},{to:'character/beto',via:'dialogue',channel:'direct',offscreen:true,line:1},{to:'character/pa',via:'dialogue',channel:'pa',offscreen:true,line:3}]);
 assert.deepEqual(out('panel/P3','speaks'),[{to:'character/beto',via:'dialogue',channel:'direct',offscreen:false,line:0}]);
 assert.deepEqual(out('panel/P1','location'),[{to:'location/plaza',via:'scene.location',inherited:true}]);
 assert.deepEqual(out('scene/sb2/sc2','environment'),[{to:'environment/env-b',via:'scene.location',through:'location/nave',envVia:'modelSpace'}]);
 assert.deepEqual(out('panel/P1','environment'),[{to:'environment/env-a',via:'scene.location',through:'location/plaza',envVia:'environment',inherited:true}]);
 assert.deepEqual(out('shot/t1','appears'),[{to:'character/ana',via:'sequence.cast'}]);
 assert.deepEqual(out('shot/t1','speaks'),[{to:'character/ana',via:'lines',channel:'direct',offscreen:false,line:'l1'},{to:'character/beto',via:'lines',channel:'direct',offscreen:true,line:'l2'}]);
 assert.deepEqual(out('shot/t3','appears'),[{to:'character/beto',via:'visibleCast'}]);
 assert.deepEqual(out('shot/t3','speaks'),[{to:'character/pa',via:'lines',channel:'pa',offscreen:true,line:'l3'}]);
 assert.deepEqual(out('shot/t3','location'),[{to:'location/bosque',via:'shot.location'}]);assert.deepEqual(out('shot/t3','environment'),[]);
 assert.deepEqual(out('shot/t4','location'),[{to:'location/plaza',via:'sequence.location',inherited:true}]);
 assert.deepEqual(out('shot/t5','appears'),[{to:'character/beto',via:'sequence.cast'},{to:'character/dani',via:'proxy'}]);
 assert.deepEqual(out('shot/t6','appears'),[{to:'character/ana',via:'shot.cast'}]);
 assert.deepEqual(out('seq/c2','location'),[{to:'location/nave',via:'sequence.location'}]);assert.deepEqual(out('seq/f3','location'),[]);
 assert.deepEqual(I.unresolved,[{panel:'panel/P1',scene:'scene/sb1/sc1',story:'sb/sb1',index:2,who:'Nadie',channel:'ext',code:'A1'},{panel:'panel/P2',scene:'scene/sb1/sc1',story:'sb/sb1',index:0,who:'',channel:'',code:'A2'}]);
 assert.deepEqual(I.dangling,[{from:'shot/t6',to:'character/fantasma',via:'shot.cast'}]);
 assert.ok(!I.nodes.has('character/fantasma'));
 for(const l of I.links){assert.ok(I.from.get(l.from).includes(l));assert.ok(I.to.get(l.to).includes(l));}});

test('consultas: descendants, relatedTo, holders y linksTo en los dos sentidos y con current',()=>{
 const I=relationIndex(relProject());
 assert.deepEqual(descendants(I,'seq/f1'),['seq/f1','sb/sb1','scene/sb1/sc1','panel/P1','shot/t1','panel/P2','seq/c1','shot/t2','sb/sb2','scene/sb2/sc2','panel/P3','shot/t3','shot/t4','seq/c2']);
 assert.deepEqual(descendants(I,'seq/f1',{current:true}),['seq/f1','sb/sb2','scene/sb2/sc2','panel/P3','shot/t3','shot/t4','seq/c2']);
 assert.deepEqual(descendants(I,'sb/sb1',{current:true}),['sb/sb1','scene/sb1/sc1','panel/P1','shot/t1','panel/P2','seq/c1','shot/t2'],'pedido el story no vigente, se recorre entero');assert.deepEqual(descendants(I,'nada'),[]);
 assert.deepEqual(keys(relatedTo(I,'act/e1',{rel:'speaks'})),['character/ana','character/beto','character/pa']);
 assert.deepEqual(keys(relatedTo(I,'act/e1',{rel:'speaks',current:true})),['character/beto','character/pa']);
 assert.deepEqual(keys(relatedTo(I,'seq/f1',{rel:['location','environment'],current:true})),['location/nave','environment/env-b','location/bosque','location/plaza','environment/env-a']);
 assert.deepEqual(keys(relatedTo(I,'panel/P1',{rel:'speaks',where:l=>!l.offscreen})),['character/ana']);
 assert.deepEqual(keys(relatedTo(I,'character/beto')),['panel/P1','panel/P3','shot/t1','shot/t3','shot/t4','shot/t5']);
 assert.deepEqual(keys(relatedTo(I,'character/beto',{current:true})),['panel/P3','shot/t3','shot/t4','shot/t5']);
 assert.deepEqual(keys(relatedTo(I,'environment/env-b')),['seq/c2','scene/sb2/sc2','panel/P3']);
 assert.deepEqual(holders(I,'character/ana','act'),['act/e1','act/e2']);
 assert.deepEqual(holders(I,'character/ana','sequence'),['seq/f1','seq/c1','seq/f2']);
 assert.deepEqual(holders(I,'character/ana','story'),['sb/sb1','sb/sb2']);
 assert.deepEqual(holders(I,'character/pa','sequence',{rel:'speaks'}),['seq/f1','seq/c2']);
 assert.deepEqual(holders(I,'character/beto','sequence',{rel:'speaks',current:true}),['seq/f1','seq/c1'],'el contenedor del story no vigente cuenta por pertenencia; la ficha, no');
 assert.deepEqual(holders(I,'character/ana','sequence',{rel:'speaks',current:true}),['seq/c1'],'solo habla en el story no vigente');
 assert.deepEqual(holders(I,'character/beto','sequence',{rel:'appears'}),['seq/f1','seq/c2','seq/k1','seq/f2']);
 assert.deepEqual(holders(I,'character/ana','act',{rel:'speaks',current:true}),[]);
 assert.deepEqual(holders(I,'character/ana','story',{rel:'speaks',current:true}),['sb/sb1'],'el story no vigente sí cuenta para sí mismo');
 assert.deepEqual(holders(I,'location/plaza','shot'),['shot/t1','shot/t2','shot/t4']);
 // Contenedor y prueba llegan a sus planos por pertenencia aunque en el árbol cuelguen de la viñeta.
 assert.deepEqual(descendants(I,'seq/c1'),['seq/c1','shot/t2','shot/t1']);assert.deepEqual(descendants(I,'seq/k1'),['seq/k1','shot/t4']);
 assert.deepEqual(keys(relatedTo(I,'seq/c1',{rel:'appears'})),['character/ana']);assert.deepEqual(keys(relatedTo(I,'seq/c1',{rel:'speaks'})),['character/ana','character/beto']);
 assert.deepEqual(keys(relatedTo(I,'seq/k1',{rel:'appears'})),['character/beto']);assert.deepEqual(keys(relatedTo(I,'seq/c2',{rel:['appears','speaks']})),['character/beto','character/pa']);
 assert.deepEqual(trail(I,'shot/t4').map(n=>n.key),['act/e1','seq/f1','sb/sb2','scene/sb2/sc2','panel/P3','shot/t4'],'el árbol no cambia');
 // Prueba con un plano enlazado a una viñeta del story no vigente: con current, el acto y el personaje coinciden en los dos sentidos; la prueba pedida sí lo cuenta.
 const z=relProject();z.characters.push({id:'zed',name:'Zed',kind:'person'});Object.assign(z.episodes[0].sequences[3].shots[0],{storyboardShot:'P1',cast:['zed']});const Z=relationIndex(z);
 assert.equal(relatedTo(Z,'act/e1',{rel:'appears',current:true}).has('character/zed'),false);assert.deepEqual(holders(Z,'character/zed','act',{current:true}),[]);
 assert.equal(relatedTo(Z,'act/e1',{rel:'appears'}).has('character/zed'),true);assert.deepEqual(holders(Z,'character/zed','act'),['act/e1']);
 assert.equal(relatedTo(Z,'seq/k1',{rel:'appears',current:true}).has('character/zed'),true);assert.deepEqual(holders(Z,'character/zed','sequence',{current:true}),['seq/k1']);
 assert.deepEqual(keys(relatedTo(Z,'character/zed',{current:true})),[]);assert.deepEqual(descendants(Z,'act/e1',{current:true}).includes('shot/t4'),false);
 for(const [k,kind] of [['act/e1','act'],['seq/f1','sequence'],['seq/k1','sequence'],['seq/c2','sequence']])for(const current of [false,true])for(const c of ['ana','beto','pa','zed'])
  assert.equal(relatedTo(Z,k,{current}).has('character/'+c),holders(Z,'character/'+c,kind,{current}).includes(k),`${k} ${c} ${current}`);
 assert.deepEqual(linksTo(I,'character/pa').map(l=>l.from),['panel/P1','shot/t3']);assert.deepEqual(linksTo(I,'character/pa',{current:true}).map(l=>l.from),['shot/t3']);
 assert.deepEqual(linksTo(I,'character/nadie'),[]);});

test('relationIndex: robusto, puro, sin environments[].sequences y memorizado por revision',()=>{
 for(const p of [undefined,null,{},{episodes:'x',storyboards:{},characters:3},{episodes:[null,{id:'e',sequences:[null,{id:'s',shots:[null,{id:'t'}]}]}],storyboards:[null,{id:'b',sequences:[null,{id:'c',shots:[null,{id:'v',dialogue:[null,{who:'x'}]}]}]}]}]){
  const I=relationIndex(p);assert.ok(I.nodes instanceof Map);}
 const odd=relationIndex({episodes:[{id:'e',sequences:[{id:'s',shots:[{id:'t'}]}]}],storyboards:[{id:'b',sequences:[{id:'c',shots:[{id:'v',dialogue:[null,{who:'x'}]}]}]}]});
 assert.deepEqual(odd.unresolved.map(u=>u.index),[0,1]);assert.equal(odd.nodes.get('shot/t').parent,'seq/s');
 const p=relProject(),copy=structuredClone(p);relationIndex(p);assert.deepEqual(p,copy);
 const q=structuredClone(p);delete q.environments[0].sequences;q.environments[1].sequences=['f1','c1'];
 const a=relationIndex(p),b=relationIndex(q),strip=I=>I.links.map(l=>JSON.stringify(l));assert.deepEqual(strip(a),strip(b));assert.deepEqual(keys(a.nodes),keys(b.nodes));
 const i1=relationIndexFor(p);assert.equal(relationIndexFor(p),i1);p.revision++;const i2=relationIndexFor(p);assert.notEqual(i2,i1);assert.equal(i2.revision,8);
 assert.notEqual(relationIndexFor(structuredClone(p)),i2);});

test('sequenceLocationPlan: un candidato, varios, elección, planos, idempotente, distinta, inexistente, conflicto y digests',()=>{
 const p=relProject();let r=sequenceLocationPlan(p);
 assert.deepEqual(r.ops,[{sequence:'f3',location:'plaza',environment:'env-a'}]);assert.deepEqual([r.warnings,r.errors],[[],[]]);
 assert.equal(r.next.episodes[1].sequences[1].location,'plaza');assert.equal(p.episodes[1].sequences[1].location,undefined,'no muta');
 validate(r.next);for(const id of shotIds(p))assert.equal(digest(p,id),digest(r.next,id),id);
 assert.deepEqual(sequenceLocationPlan(r.next).ops,[]);assert.deepEqual(sequenceLocationPlan(r.next).warnings,[]);
 const two=structuredClone(p);two.locations.push({id:'plaza-b',name:'Plaza B',environment:'env-a'});
 r=sequenceLocationPlan(two);assert.deepEqual(r.ops,[]);assert.deepEqual(r.warnings,['f3: el entorno env-a es de varios ambientes (plaza, plaza-b); elige uno']);
 r=sequenceLocationPlan(two,{choose:{'env-a':'plaza-b'}});assert.deepEqual(r.ops,[{sequence:'f3',location:'plaza-b',environment:'env-a'}]);
 assert.deepEqual(sequenceLocationPlan(r.next),{ops:[],warnings:[],errors:[],next:r.next},'sin elegir, un ambiente que ya es candidato no avisa');
 r=sequenceLocationPlan(two,{choose:{'env-a':'bosque',nada:'plaza'}});assert.deepEqual(r.errors,['Entorno desconocido: nada','bosque no es un ambiente del entorno env-a (candidatos: plaza, plaza-b)']);assert.deepEqual(r.ops,[]);
 const q=structuredClone(p);q.environments[0].sequences=['f2','c1','zz','f3'];q.episodes[1].sequences[1].location='bosque';
 r=sequenceLocationPlan(q);assert.deepEqual(r.ops,[]);
 assert.deepEqual(r.warnings,['f2: tiene 2 planos y su ambiente (bosque) no es del entorno env-a (plaza); no se toca','zz: la secuencia no existe (entorno env-a)','f3: ya tiene el ambiente bosque, distinto de plaza (entorno env-a); no se toca']);
 const c=structuredClone(p);c.environments[1].sequences=['f3'];c.environments.push({id:'env-c',sequences:['f3']});
 r=sequenceLocationPlan(c);assert.deepEqual(r.ops,[]);assert.deepEqual(r.warnings,['f3: el entorno env-c no es de ningún ambiente','f3: la reclaman entornos con ambientes distintos (env-a → plaza, env-b → nave); no se toca']);
 const same=structuredClone(p);same.locations[1].environment='env-a';same.environments[1].sequences=['f3'];
 r=sequenceLocationPlan(same,{choose:{'env-a':'plaza'}});assert.deepEqual(r.warnings,['f3: la reclaman entornos con ambientes distintos (env-a → plaza, env-b → nave); no se toca']);
 assert.deepEqual(sequenceLocationPlan(null),{ops:[],warnings:[],errors:[],next:null});});

test('characterDraft: id libre y válido, nombre, kind y color por defecto',()=>{
 const p=relProject();
 assert.deepEqual(characterDraft(p,{id:'eco',name:' Eco Lejano ',kind:'voice'}),{character:{id:'eco',name:'Eco Lejano',kind:'voice',color:'#8e9ca0',description:'',voice:''},errors:[]});
 assert.equal(characterDraft(p,{id:'eco',name:'Eco',color:'#123456'}).character.color,'#123456');assert.equal(characterDraft(p,{id:'eco',name:'Eco'}).character.kind,'person');
 for(const id of ['ana','plaza','e1','f1','t1','sb1','sc1']){const r=characterDraft(p,{id,name:'X'});assert.equal(r.character,null);assert.deepEqual(r.errors,['El id ya existe en el proyecto: '+id]);}
 for(const id of ['P1','1a','a b','',undefined,'-a'])assert.match(characterDraft(p,{id,name:'X'}).errors[0],/El id debe/,String(id));
 assert.deepEqual(characterDraft(p,{id:'eco',name:'  ',kind:'robot'}).errors,['Falta el nombre','kind debe ser person o voice']);
 assert.deepEqual(characterDraft(null,{id:'eco',name:'Eco'}).errors,[]);});

const run=(script,args,data)=>{const env={...process.env,RODAJE_DATA:data};delete env.RODAJE_PROJECT;return spawnSync(process.execPath,[path.join(ROOT,'scripts',script),...args],{cwd:ROOT,encoding:'utf8',timeout:30000,env});};
const mkData=()=>{const data=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-rel-')),dir=path.join(data,'rel');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'proyecto.json'),JSON.stringify(relProject()));return {data,file:path.join(dir,'proyecto.json'),dir};};

test('ambientes-secuencias.mjs: --plan no escribe; sin --plan escribe y luego «Sin cambios»; --elegir inválido, 1; mal formado, 2',()=>{
 const {data,file}=mkData(),before=fs.readFileSync(file,'utf8');
 let r=run('ambientes-secuencias.mjs',['--project','rel','--plan'],data);
 assert.equal(r.status,0,r.stderr);assert.ok(r.stderr.split('\n').includes('Proyecto: rel (--project)'));assert.match(r.stdout,/^f3 → plaza \(entorno env-a\)$/m);assert.match(r.stdout,/Plan: 1 secuencias .* no se escribe/);
 assert.equal(fs.readFileSync(file,'utf8'),before);
 r=run('ambientes-secuencias.mjs',['--project','rel','--elegir','env-a=bosque'],data);assert.equal(r.status,1);assert.match(r.stderr,/Error: bosque no es un ambiente del entorno env-a/);assert.equal(fs.readFileSync(file,'utf8'),before);
 r=run('ambientes-secuencias.mjs',['--project','rel','--elegir','env-a'],data);assert.equal(r.status,2);assert.match(r.stderr,/Uso:/);
 r=run('ambientes-secuencias.mjs',['--project','rel'],data);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/Escrito: 1 secuencias · 0 avisos · rev 8/);
 const p=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(p.episodes[1].sequences[1].location,'plaza');assert.deepEqual(p.environments[0].sequences,['f3']);
 const after=fs.readFileSync(file,'utf8');r=run('ambientes-secuencias.mjs',['--project','rel'],data);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/^Sin cambios · 0 avisos$/m);assert.equal(fs.readFileSync(file,'utf8'),after);});

test('perfil.mjs add: crea el personaje con su hoja; id repetido, 1',()=>{
 const {data,file,dir}=mkData();
 let r=run('perfil.mjs',['add','--project','rel','nadie','--name','Nadie','--kind','voice'],data);
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/Creado nadie \(voice, «Nadie»\)/);
 const p=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(p.characters.at(-1),{id:'nadie',name:'Nadie',kind:'voice',color:'#8e9ca0',description:'',voice:''});assert.equal(p.revision,8);
 assert.ok(fs.existsSync(path.join(dir,'personajes','nadie','hoja.md')));assert.ok(fs.existsSync(path.join(dir,'personajes','nadie','personaje.json')));
 assert.deepEqual(relationIndex(p).unresolved.map(u=>u.who),[''],'la línea de «Nadie» ya tiene personaje');
 const before=fs.readFileSync(file,'utf8');r=run('perfil.mjs',['add','--project','rel','ana','--name','Otra'],data);assert.equal(r.status,1);assert.match(r.stderr,/El id ya existe en el proyecto: ana/);assert.equal(fs.readFileSync(file,'utf8'),before);});

// Apariciones (#60): árbol de apariciones y entornos de un personaje o ambiente.
const flat=(roots,out=[])=>{for(const a of roots){out.push(a);flat(a.children,out);}return out;};
const shape=roots=>roots.map(a=>a.children.length?[a.key,shape(a.children)]:a.key);
test('appearanceTree: vigente por defecto, orden, contenedor sin viñeta bajo su secuencia y prueba bajo la viñeta',()=>{
 const p=relProject();p.episodes[0].sequences[2].shots.push(relShot('t7'));const I=relationIndex(p);
 assert.deepEqual(shape(appearanceTree(I,'character/ana').roots),[['act/e1',[['seq/f1',[['sb/sb2',[['scene/sb2/sc2',['panel/P3']],['seq/c2',['shot/t7']]]]]]]],['act/e2',[['seq/f2',['shot/t6']]]]]);
 const T=appearanceTree(I,'character/beto');const keys=flat(T.roots).map(a=>a.key);
 assert.ok(!keys.includes('sb/sb1')&&!keys.includes('panel/P1'),'sin el story no vigente');
 assert.deepEqual(shape(T.roots)[0],['act/e1',[['seq/f1',[['sb/sb2',[['scene/sb2/sc2',[['panel/P3',['shot/t3','shot/t4']]]],['seq/c2',['shot/t7']]]]]]]]);
 const P3=flat(T.roots).find(a=>a.key==='panel/P3');assert.deepEqual(P3.counts,{panels:1,shots:2});assert.deepEqual(P3.marks.map(m=>m.rel),['appears','speaks']);
 const t4=flat(T.roots).find(a=>a.key==='shot/t4');assert.equal(t4.role,'test');assert.deepEqual(t4.route,{view:'shot',episode:'e1',sequence:'k1',shot:'t4'});assert.equal(t4.label,'P01 · t4');
 assert.deepEqual(T.total,{acts:2,sequences:3,storys:1,scenes:1,panels:1,shots:4,lines:1});
 assert.deepEqual(flat(T.roots).find(a=>a.key==='act/e1').counts,{panels:1,shots:3});
 for(const a of flat(T.roots))assert.ok(a.children.every((c,i,l)=>!i||l[i-1].order<c.order),a.key);});

test('appearanceTree: todas las versiones marcan el story no vigente; marcas de voz, fuera de campo y texto',()=>{
 const I=relationIndex(relProject()),T=appearanceTree(I,'character/ana',{current:false}),by=k=>flat(T.roots).find(a=>a.key===k);
 assert.deepEqual([by('sb/sb1').stale,by('sb/sb2').stale,by('sb/sb1').label,by('sb/sb2').current],[true,undefined,'v1 · Uno',true]);
 assert.deepEqual(by('panel/P1').marks,[{rel:'appears',via:'panel.cast'},{rel:'speaks',via:'dialogue',channel:'direct',offscreen:false,line:0,text:'Hola.'}]);
 assert.ok(by('shot/t1'));assert.equal(by('shot/t1').label,'P01 · t1');assert.equal(by('panel/P1').label,'A1 · Llegada');
 const pa=appearanceTree(I,'character/pa',{current:false});
 assert.deepEqual(flat(pa.roots).flatMap(a=>a.marks),[{rel:'speaks',via:'dialogue',channel:'pa',offscreen:true,line:3,text:'Aviso.'},{rel:'speaks',via:'lines',channel:'pa',offscreen:true,line:'l3',text:'Texto l3'}]);
 assert.equal(pa.total.lines,2);assert.equal(appearanceTree(I,'character/pa').total.lines,1);
 const beto=flat(appearanceTree(I,'character/beto',{current:false}).roots).find(a=>a.key==='panel/P1');
 assert.deepEqual(beto.marks,[{rel:'speaks',via:'dialogue',channel:'direct',offscreen:true,line:1,text:'Aquí.'}],'fuera del reparto de la viñeta');});

test('appearanceTree: ambientes sin heredados (secuencias, escenas y shot.location) y con heredados',()=>{
 const I=relationIndex(relProject());
 const own=appearanceTree(I,'location/plaza',{current:false,inherited:false}),marked=T=>flat(T.roots).filter(a=>a.marks.length).map(a=>a.key);
 assert.deepEqual(marked(own),['scene/sb1/sc1','seq/c1','seq/k1']);assert.ok(flat(own.roots).every(a=>a.marks.every(m=>!m.inherited)));
 assert.deepEqual(marked(appearanceTree(I,'location/plaza',{inherited:false})),['seq/k1']);
 const all=appearanceTree(I,'location/plaza',{current:false});assert.deepEqual(marked(all),['scene/sb1/sc1','panel/P1','shot/t1','panel/P2','seq/c1','shot/t2','shot/t4','seq/k1'],'t4 cuelga de P3, antes que la prueba en el orden');
 assert.ok(flat(all.roots).find(a=>a.key==='shot/t4').marks[0].inherited);
 assert.deepEqual(marked(appearanceTree(I,'location/bosque',{inherited:false})),['shot/t3','seq/f2']);
 assert.deepEqual(flat(appearanceTree(I,'location/bosque',{inherited:false}).roots).find(a=>a.key==='shot/t3').marks,[{rel:'location',via:'shot.location'}]);
 assert.deepEqual(marked(appearanceTree(I,'environment/env-b')),['scene/sb2/sc2','panel/P3','seq/c2']);});

test('appearanceTree: cada ruta es una ruta de la app hacia su vista',()=>{
 const I=relationIndex(relProject()),want={act:'tree',sequence:null,story:'storyboard',scene:'storyboard',panel:'storyboard',shot:'shot'};
 const nodes=['character/ana','character/beto','location/plaza'].flatMap(k=>flat(appearanceTree(I,k,{current:false}).roots));assert.ok(nodes.length>10);
 for(const a of nodes){const r=parseRoute(routeQuery({project:'rel',...a.route}));const {project,view,...rest}=r;
  assert.equal(view,want[a.kind]??(a.role==='container'?'shots':'tree'),a.key);
  for(const [k,v] of Object.entries(a.route))if(k!=='view')assert.equal(rest[k],v,a.key+' '+k);}
 assert.deepEqual(flat(appearanceTree(I,'character/ana',{current:false}).roots).find(a=>a.key==='seq/c1').route,{view:'shots',sequence:'c1'});
 assert.deepEqual(flat(appearanceTree(I,'location/plaza',{current:false}).roots).find(a=>a.key==='panel/P1').route,{view:'storyboard',storyboard:'sb1',scene:'sc1',panel:'P1'},'la viñeta abre su página (#68)');});

test('appearanceTree y appearanceEnvironments: vacío, entornos por las dos vías y sin mutar',()=>{
 const p=relProject();p.characters.push({id:'solo',name:'Solo',kind:'person'});const before=structuredClone(p),digests=shotIds(p).map(id=>digest(p,id)),I=relationIndex(p);
 assert.deepEqual(appearanceTree(I,'character/solo'),{target:'character/solo',total:{acts:0,sequences:0,storys:0,scenes:0,panels:0,shots:0,lines:0},roots:[]});
 assert.deepEqual(appearanceTree(I,'character/nadie').roots,[]);assert.deepEqual(appearanceEnvironments(I,'character/nadie'),[]);
 assert.deepEqual(appearanceEnvironments(I,'character/ana'),[{key:'environment/env-b',id:'env-b',name:'env-b',via:['modelSpace'],route:{view:'environment',environment:'env-b'},nodes:1}]);
 assert.deepEqual(appearanceEnvironments(I,'character/ana',{current:false}).map(e=>[e.id,e.via,e.nodes]),[['env-a',['environment'],3],['env-b',['modelSpace'],1]]);
 assert.deepEqual(appearanceEnvironments(I,'location/plaza').map(e=>[e.id,e.via,e.nodes]),[['env-a',['environment'],2]]);
 assert.deepEqual(appearanceEnvironments(I,'location/nave').map(e=>[e.id,e.via]),[['env-b',['modelSpace']]]);
 assert.deepEqual(appearanceEnvironments(I,'location/bosque'),[]);
 for(const k of ['character/ana','character/pa','location/plaza','environment/env-a'])for(const current of [true,false])appearanceTree(I,k,{current});
 assert.deepEqual(p,before);assert.deepEqual(shotIds(p).map(id=>digest(p,id)),digests);});

