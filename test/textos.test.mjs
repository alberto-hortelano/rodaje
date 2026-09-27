// Textos de prompt del proyecto (#42): sound, constraints y texts en registro.json y channels[].prompt en el catálogo; neutros sin textos.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import * as w from '../app/workflow.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const T42=JSON.parse(fs.readFileSync(path.join(ROOT,'test/fixtures/ep01-s01-b02/textos-42.json'),'utf8'));
const DEAD={stage:{...T42.catalog,channels:T42.catalog.channels.map(c=>({...c,prompt:T42.channelPrompts[c.id]}))}};
const DEAD_LIGHTING={red:'Headlamps.',yellow:'Tubes.',green:'Room light.'};

test('pickText: la clave, si no el respaldo, si no vacío; sin recortar',()=>{
 assert.equal(w.pickText({red:'R',default:'D'},'red'),'R');assert.equal(w.pickText({red:'R',default:'D'},'blue'),'D');assert.equal(w.pickText({red:' ',default:'D'},'red'),'D');
 assert.equal(w.pickText({red:'R'},'blue'),'');assert.equal(w.pickText(null,'red'),'');assert.equal(w.pickText({normal:'N'},undefined,'normal'),'N');assert.equal(w.pickText({a:3,default:'D'},'a'),'D');
 assert.equal(w.pickText({a:' x '},'a'),' x ');assert.equal(w.pickText({},'constructor'),'');});

test('promptZone: la variante de la secuencia, si no la variante por defecto, si no vacío',()=>{
 assert.equal(w.promptZone(DEAD,{variant:'red'}),'red');assert.equal(w.promptZone(DEAD,{variant:''}),'green');assert.equal(w.promptZone(null,{variant:''}),'');assert.equal(w.promptZone(null,{}),'');
 assert.equal(w.promptZone({stage:{...DEAD.stage,defaultVariant:'nope'}},{}),'');});

test('promptTexts funde campo a campo sobre los neutros y no los muta',()=>{const copy=structuredClone(w.NEUTRAL_TEXTS);
 assert.deepEqual(w.promptTexts(null),w.NEUTRAL_TEXTS);assert.deepEqual(w.promptTexts({texts:'x'}),w.NEUTRAL_TEXTS);
 const t=w.promptTexts({texts:{people:'the family',physics:{normal:'N',Half:'x',zero:''},swarm:{label:'Birds'},tasks:{idle:' ',fallback:'F'},quality:'x'}});
 assert.equal(t.people,'the family');assert.deepEqual(t.physics,{normal:'N'});assert.deepEqual(t.swarm,{label:'Birds',none:''});assert.deepEqual(t.tasks,{idle:'',fallback:'F'});assert.deepEqual(t.quality,w.NEUTRAL_TEXTS.quality);
 t.retention.character='x';assert.deepEqual(w.NEUTRAL_TEXTS,copy);
 assert.deepEqual(w.promptTexts({texts:T42.registry.texts}),{...T42.registry.texts});});

test('channelPrompt: el del canal; desconocido, el de direct; conocido sin prompt, vacío',()=>{const CH=w.projectChannels(DEAD);
 assert.deepEqual(w.channelPrompt(CH,'radio'),T42.channelPrompts.radio);assert.deepEqual(w.channelPrompt(CH,''),T42.channelPrompts.direct);assert.deepEqual(w.channelPrompt(CH,'intercom'),T42.channelPrompts.direct);
 const N=w.projectChannels(null);assert.deepEqual(w.channelPrompt(N,'pa'),{});assert.deepEqual(w.channelPrompt(N,'radio'),{});
 const part=w.projectChannels({stage:{channels:[{id:'tv',label:'TV',prompt:{voice:'tv voice'}}]}});assert.deepEqual(w.channelPrompt(part,'direct'),{});assert.deepEqual(w.channelPrompt(part,'tv'),{voice:'tv voice'});});

test('registryTextErrors: un caso por regla y los textos de dead-air sin errores',()=>{const e=r=>w.registryTextErrors(r);
 assert.deepEqual(e(null),[]);assert.deepEqual(e({summary:'x',lighting:{}}),[]);assert.deepEqual(e({lighting:DEAD_LIGHTING,...T42.registry}),[]);
 const has=(r,re)=>assert.ok(e(r).some(x=>re.test(x)),`${JSON.stringify(r)} → ${JSON.stringify(e(r))}`);
 has({sound:'x'},/^sound debe ser un objeto/);has({sound:{Red:'x'}},/sound: clave «Red» no válida/);has({sound:{red:''}},/sound\.red debe ser un texto no vacío/);has({constraints:{red:3}},/constraints\.red debe ser un texto/);has({constraints:[]},/constraints debe ser un objeto/);
 has({texts:'x'},/^texts debe ser un objeto/);has({texts:{crowd:'x'}},/texts: clave desconocida «crowd»/);has({texts:{people:' '}},/texts\.people debe ser un texto no vacío/);
 has({texts:{physics:'x'}},/texts\.physics debe ser un objeto/);has({texts:{physics:{Half:'x'}}},/texts\.physics: clave «Half» no válida/);has({texts:{physics:{half:''}}},/texts\.physics\.half debe ser/);
 has({texts:{swarm:[]}},/texts\.swarm debe ser un objeto/);has({texts:{swarm:{color:'x'}}},/texts\.swarm: clave desconocida «color»/);has({texts:{offscreen:{where:''}}},/texts\.offscreen\.where debe ser un texto no vacío/);
 assert.deepEqual(e({texts:{physics:{lunar:'Moon.'}}}),[]);});

test('registryTextIssues: claves por zona fuera del catálogo y variantes sin sonido; dead-air sin avisos',()=>{
 assert.deepEqual(w.registryTextIssues({lighting:DEAD_LIGHTING,...T42.registry},DEAD),[]);assert.deepEqual(w.registryTextIssues({lighting:{default:'x'}},null),[]);
 const r=w.registryTextIssues({lighting:{blue:'x',default:'y'},sound:{red:'x'},constraints:{space:'x'}},DEAD);
 assert.deepEqual(r,['lighting: «blue» no es una variante del catálogo','constraints: «space» no es una variante del catálogo','variante «green» sin sound ni sound.default: saldrá [[SOUND]]','variante «yellow» sin sound ni sound.default: saldrá [[SOUND]]']);
 assert.deepEqual(w.registryTextIssues({sound:{red:'x',default:'d'}},DEAD),[]);assert.deepEqual(w.registryTextIssues({lighting:{red:'x'}},DEAD),[]);assert.deepEqual(w.registryTextIssues({sound:{red:'x'}},null),['sound: «red» no es una variante del catálogo']);});

test('mergeRegistryTexts: presente reemplaza, null borra, orden de claves, rechaza ajenas y sin cambios devuelve el mismo registro',()=>{
 const reg={version:1,summary:'s',assets:{},lighting:{default:'L'},texts:{people:'a'},extra:1},copy=structuredClone(reg);
 const r=w.mergeRegistryTexts(reg,{sound:{default:'S'},texts:{people:'b',tasks:{idle:'i'}}});assert.deepEqual(r.errors,[]);assert.deepEqual(r.changed,['sound','texts']);
 assert.deepEqual(Object.keys(r.registry),['version','summary','lighting','sound','texts','assets','extra']);assert.deepEqual(r.registry.texts,{people:'b',tasks:{idle:'i'}});assert.deepEqual(reg,copy);
 const del=w.mergeRegistryTexts(r.registry,{texts:null,constraints:null});assert.deepEqual(del.changed,['texts']);assert.equal(Object.hasOwn(del.registry,'texts'),false);
 const same=w.mergeRegistryTexts(reg,{texts:{people:'a'},constraints:null});assert.equal(same.registry,reg);assert.deepEqual(same.changed,[]);assert.deepEqual(same.errors,[]);
 const bad=w.mergeRegistryTexts(reg,{assets:{},lighting:{}});assert.equal(bad.registry,reg);assert.equal(bad.errors.length,2);assert.match(bad.errors[0],/clave «assets» no admitida/);
 const invalid=w.mergeRegistryTexts(reg,{sound:{red:''}});assert.equal(invalid.registry,reg);assert.match(invalid.errors[0],/sound\.red/);assert.deepEqual(invalid.changed,[]);
 assert.deepEqual(w.mergeRegistryTexts(reg,'x').errors,['el parche debe ser un objeto']);});

// Proyecto sin catálogo ni textos: nada del mundo de dead-air llega al prompt.
const cam={position:[0,1.6,5],target:[0,1,0],fov:50};
const neutral={characters:[{id:'ana',name:'Ana'},{id:'bea',name:'Bea'},{id:'pa',name:'PA'},{id:'cal',name:'Cal'}],style:'Plain realism.'};
const nSeq={id:'s1',title:'Yard',location:'yard',variant:'',cast:[{character:'ana',x:0,z:0},{character:'bea',x:1,z:0}]};
const nShots={t1:{camera:cam,cameraEnd:cam,action:'',staging:{tasks:{ana:'idle',bea:'idle'},swarm:'none'}},t2:{camera:cam,cameraEnd:cam,action:'',staging:{swarm:'cloud'}}};
const nBlock={id:'b01',duration:12,parts:[{shot:'t1',at:0,from:0,to:6,lines:[{character:'pa',channel:'pa',text:'Attention.',start:0.5},{character:'cal',channel:'radio',offscreen:true,text:'Report.',start:2},{character:'ana',channel:'intercom',text:'Coming.',start:4}]},{shot:'t2',at:6,from:0,to:6,lines:[{character:'bea',channel:'radio',text:'Here.',start:1}]}]};
const nReg={summary:'Drama.',lighting:{default:'Soft daylight.'},assets:{ANA_BASE:{kind:'character',character:'ana',descriptor:'A tall woman.',status:'approved'},BEA_BASE:{kind:'character',character:'bea',descriptor:'A short woman.',status:'approved'},YARD_PLATE:{kind:'location',location:'yard',descriptor:'A yard.',status:'approved'},ANA_VOICE:{kind:'voice',character:'ana',descriptor:'Low.',status:'approved'},BEA_VOICE:{kind:'voice',character:'bea',descriptor:'High.',status:'approved'}}};
const WORLD=/helmet|visor|respirator|Seed potatoes|crew|strap|ship|amber|boot/i;
test('proyecto neutro: sonido [[SOUND]], sin zona, PHYSICS ni restricciones por zona, y sin textos de dead-air',()=>{
 for(const [mode,p] of [['block',neutral],['master',neutral],['block',w.stageFallback(neutral,neutral)]]){const {prompt}=w.blockPrompt({project:p,sequence:nSeq,shots:nShots,block:nBlock,registry:nReg,map:{prompt:'The yard.'},scene:{characters:{},local_constraints:['Keep it plain.']},mode});
  assert.match(prompt,/overall_soundscape:\n\[\[SOUND\]\]/);assert.doesNotMatch(prompt,/ zone|PHYSICS:|POSITIVE CONSTRAINTS: Visors/);assert.doesNotMatch(prompt,WORLD);assert.match(prompt,/LIGHTING: Soft daylight\./);
  assert.match(prompt,/fully preserve each person's identity, costume and props; each sheet/);assert.match(prompt,/chest markers are absent\. Audio references/);assert.match(prompt,/identities, costumes and set consistent across the whole take; textured materials at believable scale\.\n/);
  if(mode==='master')assert.match(prompt,/the cast hold the blocking/);
  else{assert.match(prompt,/ANA keeps working at the same spot; BEA keeps working at the same spot\./);assert.match(prompt,/\[6\.00s–12\.00s\] The take continues exactly as in Video 1\./);
   assert.match(prompt,/0\.50s: an offscreen voice from PA plays \(audio laid in post, not generated here\); the cast hear it/);assert.match(prompt,/2\.00s: an offscreen voice from CAL plays/);
   assert.match(prompt,/At approximately 4\.00s, ANA says exactly/);assert.match(prompt,/At approximately 7\.00s, BEA says exactly/);assert.match(prompt,/POSITIVE CONSTRAINTS: Listeners keep/);}}});

test('voiceDirection: neutro sin textos de canal; con el catálogo de dead-air, public-address, casco sellado y radio fuera de campo',()=>{
 const p={characters:[{id:'pa',name:'PA'},{id:'a',name:'Roz'}]},d={...p,...DEAD};
 assert.match(w.voiceDirection(p,{character:'pa',channel:'pa'}),/^PA speaks OFFSCREEN/);assert.equal(w.voiceDirection(p,{character:'a',channel:'radio'}),'Roz speaks with natural lip movement.');
 assert.equal(w.voiceDirection(d,{character:'pa',channel:'pa'}),'PA is an OFFSCREEN public-address recording, never a visible person; nobody mouths this line.');
 assert.equal(w.voiceDirection(d,{character:'a',channel:'radio'}),'Roz speaks by radio; helmet stays sealed, only their talk light activates, no visible lips.');
 assert.match(w.voiceDirection(d,{character:'a',channel:'radio',offscreen:true}),/^Roz speaks OFFSCREEN/);assert.equal(w.voiceDirection(d,{character:'a',channel:'direct'}),'Roz speaks with natural lip movement.');
 assert.equal(w.voiceDirection(d,{character:'x',channel:'muffled'}),'Speaker speaks with natural lip movement.');});

test('guardián: workflow.mjs no lleva textos de prompt de dead-air y blockPrompt no supone la zona green',()=>{const src=fs.readFileSync(path.join(ROOT,'app/workflow.mjs'),'utf8');
 for(const s of ['public-address recording','helmet stays sealed','restrained helmet radio voice','voice muffled through a respirator','ship PA','natural voice, lips visible','boots land','boot hook','straps and cables','helmet-radio','ship rumble','old ship interior','PA announcement','radio line','over the helmets','the crew','The same station continues','nearest strap or latch','suit and helmet state','amber talk light','Seed potatoes','all containers sealed','visors, straps','Visors stay closed','Respirators stay on'])assert.ok(!src.includes(s),s);
 const i=src.indexOf('export function blockPrompt('),body=src.slice(i,src.indexOf('export function',i+10));assert.ok(i>0);assert.doesNotMatch(body,/green/);});
