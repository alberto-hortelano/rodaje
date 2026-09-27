// Catálogo por proyecto (#41): variantes, zonas y canales en proyecto.stage, con neutros integrados.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import * as w from '../app/workflow.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
// Catálogo de dead-air y las listas fijas que había en workflow.mjs antes de #41.
const CATALOGO={variants:[{id:'green',label:'Verde · ropa normal'},{id:'yellow',label:'Amarilla · respirador'},{id:'red',label:'Roja · traje espacial'}],defaultVariant:'green',
 zones:[{id:'space',label:'Espacio',color:'#364973'},{id:'green',label:'Zona verde · caras',color:'#487432',variant:'green'},{id:'yellow',label:'Zona amarilla · respirador',color:'#887116',variant:'yellow'},{id:'red',label:'Zona roja · cascos',color:'#983b2a',variant:'red'},{id:'other',label:'Otro'}],
 channels:[{id:'direct',label:'Directo · caras'},{id:'radio',label:'RADIO · casco',speakLight:true,color:'#4b6a63'},{id:'muffled',label:'MUFFLED · respirador',color:'#a08a3a'},{id:'ext',label:'EXT · canal externo',offscreen:true,color:'#7a5a2c'},{id:'external',label:'EXTERNAL · canal externo en cuadro',color:'#7a5a2c'},{id:'pa',label:'PA · megafonía',color:'#8a4d7a'}]};
const OLD_VARIANTS=[['','Diseño base'],['green','Verde · ropa normal'],['yellow','Amarilla · respirador'],['red','Roja · traje espacial']];
const OLD_ZONES=[['space','Espacio'],['green','Zona verde · caras'],['yellow','Zona amarilla · respirador'],['red','Zona roja · cascos'],['other','Otro']];
const OLD_CHANNELS=[['','Directo · caras'],['radio','RADIO · casco'],['muffled','MUFFLED · respirador'],['ext','EXT · canal externo'],['pa','PA · megafonía']];
const dead={stage:CATALOGO},withStage=stage=>({stage});
const pairs=list=>list.map(e=>[e.id,e.label]);

test('projectVariants: neutro, dead-air como la lista antigua, mal formados fuera y "" renombra la base',()=>{
 assert.deepEqual(w.projectVariants(null),[{id:'',label:'Diseño base'}]);assert.deepEqual(w.projectVariants({stage:{variants:'x'}}),[{id:'',label:'Diseño base'}]);
 assert.deepEqual(pairs(w.projectVariants(dead)),OLD_VARIANTS);
 const r=w.projectVariants(withStage({variants:[{id:'Day',label:'Mayúscula'},{id:'1a',label:'Dígito'},{id:'ok'},{id:'ok',label:''},null,'x',{id:'ok',label:'Bien'},{id:'ok',label:'Repetida'},{id:'',label:'Base propia'},{id:'',label:'Otra base'},{id:'a-1',label:'Guion'}]}));
 assert.deepEqual(pairs(r),[['','Base propia'],['ok','Bien'],['a-1','Guion']]);});

test('projectZones: neutro, dead-air como la lista antigua, other al final solo si falta, color y variant inválidos se ignoran',()=>{
 assert.deepEqual(w.projectZones(null),[{id:'other',label:'Sin zona'}]);
 assert.deepEqual(pairs(w.projectZones(dead)),OLD_ZONES);assert.equal(w.projectZones(dead).find(z=>z.id==='green').variant,'green');assert.equal(w.projectZones(dead).find(z=>z.id==='space').variant,undefined);
 const first=w.projectZones(withStage({zones:[{id:'other',label:'Primero',color:'#123456',variant:'x'},{id:'sea',label:'Mar'}]}));assert.deepEqual(first,[{id:'other',label:'Primero',color:'#123456'},{id:'sea',label:'Mar'}]);
 const bad=w.projectZones(withStage({variants:[{id:'day',label:'Día'}],zones:[{id:'a',label:'A',color:'red',variant:'night'},{id:'b',label:'B',color:'#12345',variant:''},{id:'c',label:'C',color:'#abcdef',variant:'day'}]}));
 assert.deepEqual(bad,[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C',color:'#abcdef',variant:'day'},{id:'other',label:'Sin zona'}]);});

test('projectChannels: neutro, dead-air en orden más external, integrados sin banderas nuevas, banderas no booleanas y ids raros fuera',()=>{
 assert.deepEqual(w.projectChannels(null),w.BASE_CHANNELS);assert.deepEqual(pairs(w.projectChannels(null)),[['direct','Directo'],['pa','Voz en off']]);
 const ch=w.projectChannels(dead);assert.deepEqual(ch.map(c=>c.id),['direct','radio','muffled','ext','external','pa']);
 assert.deepEqual(pairs(ch).filter(([id])=>id!=='external'),OLD_CHANNELS.map(([id,l])=>[id||'direct',l]));
 assert.deepEqual(ch.filter(c=>c.offscreen).map(c=>c.id),['ext','pa']);assert.deepEqual(ch.filter(c=>c.speakLight).map(c=>c.id),['radio']);
 const r=w.projectChannels(withStage({channels:[{id:'pa',label:'Mega',offscreen:false,color:'#010203'},{id:'direct',label:'Cara',offscreen:true,speakLight:true},{id:'tv',label:'TV',offscreen:'yes',speakLight:1},{id:'tv-2',label:'Guion'},{id:'tv2',label:'Dígito'},{id:'Tv',label:'Mayúscula'}]}));
 assert.deepEqual(r,[{id:'pa',label:'Mega',color:'#010203',offscreen:true,speakLight:false},{id:'direct',label:'Cara',offscreen:false,speakLight:false},{id:'tv',label:'TV',offscreen:false,speakLight:false}]);
 const onlyRadio=w.projectChannels(withStage({channels:[{id:'radio',label:'Radio'}]}));assert.deepEqual(onlyRadio.map(c=>c.id),['direct','radio','pa']);});

test('channelOf, zoneOf, lineOffscreen, projectDefaultVariant y zoneVariant',()=>{const CH=w.projectChannels(dead),N=w.projectChannels(null);
 for(const id of ['',null,undefined])assert.equal(w.channelOf(CH,id).id,'direct');assert.equal(w.channelOf(CH,'radio').speakLight,true);
 assert.deepEqual(w.channelOf(N,'radio'),{id:'radio',label:'radio',offscreen:false,speakLight:false,unknown:true});assert.equal(w.channelOf([],'').id,'direct');
 assert.equal(w.zoneOf(dead,'').id,'other');assert.equal(w.zoneOf(dead,undefined).label,'Otro');assert.equal(w.zoneOf(null,'').label,'Sin zona');assert.deepEqual(w.zoneOf(null,'space'),{id:'space',label:'space',unknown:true});
 assert.equal(w.lineOffscreen(N,{channel:'pa'}),true);assert.equal(w.lineOffscreen(N,{channel:'ext'}),false);assert.equal(w.lineOffscreen(CH,{channel:'ext'}),true);assert.equal(w.lineOffscreen(CH,{channel:'radio',offscreen:true}),true);assert.equal(w.lineOffscreen(CH,{}),false);
 assert.equal(w.projectDefaultVariant(dead),'green');assert.equal(w.projectDefaultVariant(null),'');assert.equal(w.projectDefaultVariant(withStage({defaultVariant:'green'})),'');
 assert.equal(w.zoneVariant(dead,'red'),'red');assert.equal(w.zoneVariant(dead,'space'),'');assert.equal(w.zoneVariant(dead,'nowhere'),'');assert.equal(w.zoneVariant(null,'red'),'');});

test('catalogOptions añade el valor actual si falta, con canal "" es direct, y no muta',()=>{const list=w.projectChannels(null),copy=structuredClone(list);
 assert.deepEqual(w.catalogOptions(list,'radio',{channel:true}),[['direct','Directo'],['pa','Voz en off'],['radio','radio']]);
 assert.deepEqual(w.catalogOptions(list,'',{channel:true}),[['direct','Directo'],['pa','Voz en off']]);assert.deepEqual(w.catalogOptions(list,undefined,{channel:true}),[['direct','Directo'],['pa','Voz en off']]);
 assert.deepEqual(w.catalogOptions(w.projectVariants(null),''),[['','Diseño base']]);assert.deepEqual(w.catalogOptions(w.projectZones(null),'space'),[['other','Sin zona'],['space','space']]);
 assert.deepEqual(list,copy);});

test('channelShort y catalogStyle: nombre corto y solo colores #rrggbb en el atributo style',()=>{
 assert.equal(w.channelShort({label:'RADIO · casco'}),'RADIO');assert.equal(w.channelShort({label:'Voz en off'}),'Voz en off');
 assert.equal(w.catalogStyle({color:'#4b6a63'},'ch'),'--ch:#4b6a63');assert.equal(w.catalogStyle({},'zone'),'');
 for(const color of ['#123456;background:red','url(x)','red','#12345g',' #123456'])assert.equal(w.catalogStyle({color},'zone'),'',color);});

test('stageCatalogErrors: un caso por regla y el catálogo de dead-air sin errores',()=>{const e=s=>w.stageCatalogErrors(s);
 assert.deepEqual(e(null),[]);assert.deepEqual(e(undefined),[]);assert.deepEqual(e(CATALOGO),[]);assert.deepEqual(e({rehearsal:{}}),[]);assert.deepEqual(e('x'),['stage debe ser un objeto']);
 const has=(s,re)=>assert.ok(e(s).some(x=>re.test(x)),`${JSON.stringify(s)} → ${JSON.stringify(e(s))}`);
 has({variants:{}},/^variants debe ser una lista/);has({variants:[1]},/variants\[0\] debe ser un objeto/);has({variants:[{id:'a',label:'A',color:'#123456'}]},/variants\[0\]: clave desconocida «color»/);
 has({variants:[{id:'A',label:'A'}]},/variants\[0\]\.id "A" no válido/);has({variants:[{id:'a',label:'A'},{id:'a',label:'B'}]},/variants\[1\]\.id «a» repetido/);has({variants:[{id:'a',label:' '}]},/variants\[0\]\.label/);
 has({zones:[{id:'z',label:'Z',color:'red'}]},/zones\[0\]\.color debe ser #rrggbb/);has({zones:[{id:'z',label:'Z',variant:'night'}]},/zones\[0\]\.variant "night" no es una variante/);has({zones:[{id:'z',label:'Z',variant:''}]},/zones\[0\]\.variant "" no es una variante/);
 has({zones:[{id:'other',label:'O',variant:'x'}]},/zona integrada «other»/);has({zones:[{id:'z',label:'Z',offscreen:true}]},/clave desconocida «offscreen»/);
 has({channels:[{id:'tv-2',label:'TV'}]},/channels\[0\]\.id "tv-2" no válido/);has({channels:[{id:'tv',label:'TV',offscreen:'sí'}]},/channels\[0\]\.offscreen debe ser true o false/);has({channels:[{id:'tv',label:'TV',speakLight:1}]},/speakLight debe ser true o false/);
 has({channels:[{id:'pa',label:'PA',offscreen:true}]},/canal integrado «pa» solo admite label y color/);has({channels:[{id:'direct',label:'D',speakLight:false}]},/canal integrado «direct»/);has({channels:[{id:'tv',label:'TV',variant:'x'}]},/clave desconocida «variant»/);
 has({defaultVariant:'night'},/defaultVariant "night"/);has({defaultVariant:3},/defaultVariant 3/);assert.deepEqual(e({defaultVariant:''}),[]);
 assert.deepEqual(e({variants:[{id:'',label:'Base'},{id:'day',label:'Día'}],zones:[{id:'z',label:'Z',variant:'day'}],defaultVariant:'day'}),[]);});

test('catalogIssues: avisa de cada tipo de dato fuera del catálogo y no de los que están dentro',()=>{
 const p={stage:{variants:[{id:'day',label:'Día'}],zones:[{id:'sea',label:'Mar'}],channels:[{id:'tv',label:'TV'}]},characters:[{id:'a',variants:{day:{},night:{}}}],
  episodes:[{sequences:[{variant:'night',shots:[{variant:'day',lines:[{channel:'tv'},{channel:'phone'},{channel:'phone'},{channel:''},{}]},{variant:'dusk',lines:[]}]},{variant:'',shots:[]}]}],
  storyboards:[{sequences:[{shots:[{zone:'sea',dialogue:[{channel:''},{channel:'ext'}]},{zone:'sky'},{zone:''}]}]}]};
 assert.deepEqual(w.catalogIssues(p).sort(),['canal de diálogo de storyboard «ext» fuera del catálogo (1)','canal de línea «phone» fuera del catálogo (2)','variante de personaje «night» fuera del catálogo (1)','variante de plano «dusk» fuera del catálogo (1)','variante de secuencia «night» fuera del catálogo (1)','zona de viñeta «sky» fuera del catálogo (1)']);
 const deadLike={stage:CATALOGO,characters:[{id:'r',variants:{green:{},yellow:{},red:{}}}],episodes:[{sequences:[{variant:'red',shots:[{variant:'yellow',lines:['radio','muffled','ext','external','pa','direct',''].map(channel=>({channel}))}]}]}],storyboards:[{sequences:[{shots:[{zone:'space',dialogue:[{channel:'ext'},{channel:'pa'},{channel:''}]},{zone:'green'},{zone:'red'}]}]}]};
 assert.deepEqual(w.catalogIssues(deadLike),[]);assert.ok(w.catalogIssues({...deadLike,stage:undefined}).length>0);});

test('stageFallback: sin stage toma el del vivo; con stage conserva el suyo y completa solo las claves del catálogo que falten',()=>{
 const live={stage:{rehearsal:{b:2},...CATALOGO}};
 const old={id:'x'};assert.deepEqual(w.stageFallback(old,live),{id:'x',stage:live.stage});assert.deepEqual(old,{id:'x'});
 const snap={id:'x',stage:{rehearsal:{a:1}}},r=w.stageFallback(snap,live);assert.deepEqual(r.stage.rehearsal,{a:1});for(const k of w.STAGE_CATALOG_KEYS)assert.deepEqual(r.stage[k],CATALOGO[k]);assert.deepEqual(snap,{id:'x',stage:{rehearsal:{a:1}}});
 const own={id:'x',stage:{rehearsal:{a:1},channels:[{id:'tv',label:'TV'}]}},r2=w.stageFallback(own,live);assert.deepEqual(r2.stage.channels,[{id:'tv',label:'TV'}]);assert.deepEqual(r2.stage.zones,CATALOGO.zones);
 assert.equal(w.stageFallback(snap,null),snap);assert.equal(w.stageFallback(snap,{stage:{rehearsal:{b:2}}}),snap);const full={id:'x',stage:{...CATALOGO}};assert.equal(w.stageFallback(full,live),full);});

test('canales en un proyecto sin catálogo: pa fuera de campo, ext y radio habladas; con el catálogo de dead-air ext pasa a fuera de campo',()=>{
 const block={parts:[{shot:'t',at:1,from:0,to:5,lines:[{character:'pa',channel:'pa',text:'Attention.',start:0},{character:'b',channel:'ext',text:'Copy that.',start:1},{character:'c',channel:'radio',text:'Go.',start:2}]}]},shots={t:{action:'They wait.'}};
 assert.deepEqual(w.spokenLines(block,shots).map(l=>l.character),['b','c']);assert.deepEqual(w.offscreenLines(block,shots).map(l=>[l.character,l.start]),[['pa',1]]);
 const CH=w.projectChannels(dead);assert.deepEqual(w.spokenLines(block,shots,CH).map(l=>l.character),['c']);assert.deepEqual(w.offscreenLines(block,shots,CH).map(l=>l.character),['pa','b']);
 const neutral=w.actionTiming({block,shots,project:{characters:[]}});assert.match(neutral[1],/^1\.00s: an offscreen PA announcement from PA/);assert.match(neutral[2],/^At approximately 2\.00s, B, [^<]*says exactly: <d>\[English\] Copy that\.<\/d>/);
 const withCat=w.actionTiming({block,shots,project:{characters:[],stage:CATALOGO}});assert.match(withCat[2],/^2\.00s: an offscreen radio line from B/);
 const ok={status:'approved'},registry={assets:{B_VOICE:ok,C_VOICE:ok,PA_VOICE:ok}},sequence={cast:[],location:'x'},blk={...block,cast:[]};
 assert.deepEqual(w.resolveRefs({sequence,block:blk,registry,shots}).audios.map(a=>a.tag),['B_VOICE','C_VOICE']);assert.deepEqual(w.resolveRefs({sequence,block:blk,registry,shots},{channels:CH}).audios.map(a=>a.tag),['C_VOICE']);});

test('alias de compatibilidad neutros y CACHES.shell nuevo',()=>{assert.deepEqual(w.variants,[['','Diseño base']]);assert.deepEqual(w.zones,[['other','Sin zona']]);assert.deepEqual(w.channels,[['direct','Directo'],['pa','Voz en off']]);assert.equal(w.CACHES.shell,'rodaje-shell-v2');});

test('guardián: la app y los scripts no fijan variantes, zonas ni canales de un proyecto',()=>{const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
 assert.doesNotMatch(src('app/app.source.js').match(/^import \{[^}]*\} from '\.\/workflow\.mjs';/m)[0],/\b(variants|zones|channels)\b/);
 for(const f of ['app/app.source.js','app/stage.js','app/store.mjs','scripts/bloques/planificar.mjs','scripts/bloques/montar.mjs'])assert.doesNotMatch(src(f),/'radio'|'ext'|'external'|'muffled'|'space'|\{green:/,f);
 assert.doesNotMatch(src('app/style.css'),/zone-green|li\.radio/);});
