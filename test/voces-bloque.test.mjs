import test from 'node:test';import assert from 'node:assert/strict';
const w=await import('../app/workflow.mjs');const {voiceTrackArgs,editFilterComplex}=await import('../lib/media.mjs');
const CH=w.projectChannels(null);
// Plano con audio en la instantánea y bloque del plan cuyas líneas no traen el audio.
const shots={s1:{id:'s1',title:'B05',lines:[
 {id:'a',character:'aymer',text:'Not before the bridge.',start:.5,audio:'assets/voces/q/a.wav',audioDuration:2.5},
 {id:'b',character:'ancel',text:'Then we ride.',start:4,audio:'assets/voces/q/b.wav',audioDuration:1.5},
 {id:'c',character:'warin',text:'Hold.',start:2,offscreen:true,audio:'assets/voces/q/c.wav',audioDuration:.8},
 {id:'d',character:'odila',text:'Look up.',start:6},
 {id:'e',character:'crier',text:'Hear ye.',start:1,channel:'pa'}]}};
const plan=(ids,at=0)=>({id:'b12',parts:[{shot:'s1',at,from:0,to:8,lines:ids.map(id=>{const {audio,audioDuration,...l}=shots.s1.lines.find(x=>x.id===id);return l;})}]});

test('blockVoices: dos personajes en cuadro, con el audio de la instantánea por id y ordenados por inicio',()=>{const v=w.blockVoices(plan(['b','a']),shots,CH);
 assert.deepEqual(v.lineAudios,[{file:'assets/voces/q/a.wav',start:.5,character:'aymer',lineId:'a',text:'Not before the bridge.',duration:2.5},{file:'assets/voces/q/b.wav',start:4,character:'ancel',lineId:'b',text:'Then we ride.',duration:1.5}]);
 assert.deepEqual(v.missing,[]);assert.deepEqual(v.offscreen,[]);});
test('blockVoices: el mismo personaje dos veces, en orden',()=>{const s={s1:{lines:[{id:'x2',character:'odila',text:'Two.',start:5.8,audio:'x2.wav'},{id:'x1',character:'odila',text:'One.',start:.5,audio:'x1.wav'}]}};
 const v=w.blockVoices({parts:[{shot:'s1',at:0,lines:[{id:'x2',character:'odila',text:'Two.',start:5.8},{id:'x1',character:'odila',text:'One.',start:.5}]}]},s,CH);
 assert.deepEqual(v.lineAudios.map(a=>[a.lineId,a.start]),[['x1',.5],['x2',5.8]]);});
test('blockVoices: fuera de campo (marcada o por canal pa) no entra en voz.wav; en cuadro sin audio → missing; part.at suma',()=>{const v=w.blockVoices(plan(['c','a','d','e'],1.25),shots,CH);
 assert.deepEqual(v.lineAudios.map(a=>[a.lineId,a.start]),[['a',1.75]]);
 assert.deepEqual(v.offscreen,[{file:null,start:2.25,character:'crier',lineId:'e',text:'Hear ye.',duration:null},{file:'assets/voces/q/c.wav',start:3.25,character:'warin',lineId:'c',text:'Hold.',duration:.8}]);
 assert.deepEqual(v.missing,[{start:7.25,character:'odila',lineId:'d',text:'Look up.'}]);});
test('blockVoices: sin instantánea, el audio de la línea del plan',()=>{const v=w.blockVoices({parts:[{shot:'zz',at:0,lines:[{id:'q',character:'ana',text:'Hi.',start:1,audio:'q.wav',audioDuration:1}]}]},{},CH);assert.equal(v.lineAudios[0].file,'q.wav');});

test('voiceTrackWarnings: nombra la línea sin audio, el solape y la que se pasa de la duración; limpio sin avisos',()=>{
 const miss=w.voiceTrackWarnings({lineAudios:[],missing:[{lineId:'b',character:'ancel',start:4,text:'Not before the bridge falls.'}],duration:8,blockId:'b12'});
 assert.equal(miss.length,1);assert.match(miss[0],/^b12: ancel a 4\.00 s \(«Not before the bridge falls\.»\) está en cuadro y no tiene audio/);
 const lap=w.voiceTrackWarnings({lineAudios:[{character:'aymer',start:.5,duration:4,text:'A'},{character:'ancel',start:4,duration:1,text:'B'}],duration:8,blockId:'b12'});
 assert.equal(lap.length,1);assert.match(lap[0],/aymer a 0\.50 s .*se solapa con ancel a 4\.00 s/);
 const late=w.voiceTrackWarnings({lineAudios:[{character:'aymer',start:6,duration:3,text:'A'},{character:'ancel',start:9,duration:1,text:'B'}],duration:8});
 assert.equal(late.length,2);assert.match(late[0],/acaba a 9\.00 s.*se corta/);assert.match(late[1],/ancel a 9\.00 s.*no se oye/);
 assert.deepEqual(w.voiceTrackWarnings({lineAudios:[{character:'a',start:.5,duration:2},{character:'b',start:4,duration:1.5}],missing:[],duration:8,blockId:'b12'}),[]);
 assert.deepEqual(w.voiceTrackWarnings({lineAudios:[{file:'x.wav',start:.5,duration:null}],duration:6}),[]);});

test('voiceTrackArgs: una línea da el argv de siempre (golden enviar-b02)',()=>assert.deepEqual(voiceTrackArgs([{src:'/d/l01.wav',start:.5}],6,'/d/voz.wav'),['-i','/d/l01.wav','-af','adelay=500:all=1,apad,atrim=0:6','-ar','44100','-ac','1','/d/voz.wav']));
test('voiceTrackArgs: varias líneas con adelay por línea, amix sin normalizar y recorte a la duración pedida',()=>{const a=voiceTrackArgs([{src:'/a.wav',start:.5},{src:'/b.wav',start:4.0004}],8,'/voz.wav');
 assert.deepEqual(a.slice(0,4),['-i','/a.wav','-i','/b.wav']);const fc=a[a.indexOf('-filter_complex')+1];
 assert.equal(fc,'[0:a]adelay=500:all=1[v0];[1:a]adelay=4000:all=1[v1];[v0][v1]amix=inputs=2:normalize=0:duration=longest,apad,atrim=0:8[out]');
 assert.deepEqual(a.slice(-7),['-map','[out]','-ar','44100','-ac','1','/voz.wav']);assert.throws(()=>voiceTrackArgs([],8,'/v.wav'));});

test('editTime: tiempo de bloque a tiempo del edit con los tramos usados',()=>{assert.equal(w.editTime(2,[[1,5]]),1);assert.equal(w.editTime(.5,[[1,5]]),null);
 const s=[[0,2],[4,7]];assert.equal(w.editTime(5,s),3);assert.equal(w.editTime(3,s),null);assert.equal(w.editTime(1,s),1);assert.equal(w.editTime(7,s),null);});
test('offscreenMix: omite con aviso las que no tienen audio o caen en un hueco; avisa si se pasa del final',()=>{
 const off=[{file:null,start:1,character:'crier',lineId:'e',text:'Hear ye.',duration:null},{file:'c.wav',start:2.5,character:'warin',lineId:'c',text:'Hold.',duration:.8},{file:'f.wav',start:5,character:'aymer',lineId:'f',text:'Go.',duration:3}];
 const m=w.offscreenMix({offscreen:off,spans:[[0,2],[4,7]]});
 assert.deepEqual(m.items,[{file:'f.wav',at:3,lineId:'f',character:'aymer',duration:3}]);assert.equal(m.warnings.length,3);
 assert.match(m.warnings[0],/crier .*no tiene audio/);assert.match(m.warnings[1],/warin .*fuera del tramo usado/);assert.match(m.warnings[2],/aymer .*se corta/);
 assert.deepEqual(w.offscreenMix({offscreen:[off[1]],spans:[[0,6]]}),{items:[{file:'c.wav',at:2.5,lineId:'c',character:'warin',duration:.8}],warnings:[]});});

// Cadena literal de montar.mjs antes de la mezcla de voces fuera de campo: los edit.json existentes siguen valiendo.
const OLD=spans=>{const f=[],labels=[];spans.forEach(([s,e],i)=>{f.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`,`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);labels.push(`[v${i}][a${i}]`);});f.push(`${labels.join('')}concat=n=${spans.length}:v=1:a=1[cv][ca]`,'[cv]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24[v]','[ca]afade=t=in:d=0.015,aresample=48000[a]');return f.join(';');};
test('editFilterComplex: sin voces fuera de campo, la cadena de siempre (uno y dos tramos)',()=>{
 assert.equal(editFilterComplex([[0,6]]),'[0:v]trim=start=0:end=6,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=0:end=6,asetpts=PTS-STARTPTS[a0];[v0][a0]concat=n=1:v=1:a=1[cv][ca];[cv]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24[v];[ca]afade=t=in:d=0.015,aresample=48000[a]');
 assert.equal(editFilterComplex([[0,2.5],[4,7]]),OLD([[0,2.5],[4,7]]));});
test('editFilterComplex: con voces fuera de campo, entradas [1:a] y [2:a] en su instante y amix sin normalizar que dura lo que la toma',()=>{const f=editFilterComplex([[0,6]],[{at:1.25},{at:3}]);
 assert.ok(f.includes('[ca]afade=t=in:d=0.015,aresample=48000,aformat=channel_layouts=stereo[base]'));
 assert.ok(f.includes('[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=1250:all=1[o0]'));assert.ok(f.includes('[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay=3000:all=1[o1]'));
 assert.ok(f.endsWith('[base][o0][o1]amix=inputs=3:normalize=0:duration=first[a]'));assert.ok(!f.includes('aresample=48000[a]'));});

test('framePrompt: una línea por canal pa sin offscreen se oye fuera de campo, sin <d>',()=>{const project={characters:[{id:'crier',name:'Crier'}]};
 const s={s1:{id:'s1',title:'B01',duration:5,storyboardRender:'r.png',lines:[{id:'e',character:'crier',text:'Hear ye.',start:1,channel:'pa'}]}};
 const r=w.framePrompt({project,sequence:{title:'x'},shots:s,block:{id:'b01',length:5,parts:[{shot:'s1',at:0,from:0,to:5,lines:s.s1.lines}]},registry:{assets:{}},map:null,scene:null,cast:[]});
 assert.ok(!r.prompt.includes('<d>'));assert.match(r.prompt,/is heard offscreen/);});

test('pendingVoiceLines: por defecto incluye las fuera de campo; --solo-en-cuadro las excluye; respeta force y linea',()=>{const seq=[{title:'P1',lines:[{id:'a',character:'x',text:'A',offscreen:false},{id:'b',character:'y',text:'B',offscreen:true},{id:'c',character:'z',text:'C',channel:'pa'},{id:'d',character:'x',text:'D',audio:'d.wav'}]}];
 assert.deepEqual(w.pendingVoiceLines(seq,CH).map(x=>[x.l.id,x.offscreen]),[['a',false],['b',true],['c',true]]);
 assert.deepEqual(w.pendingVoiceLines(seq,CH,{soloEnCuadro:true}).map(x=>x.l.id),['a']);
 assert.deepEqual(w.pendingVoiceLines(seq,CH,{force:true}).map(x=>x.l.id),['a','b','c','d']);
 assert.deepEqual(w.pendingVoiceLines(seq,CH,{linea:'d'}).map(x=>x.l.id),[]);assert.deepEqual(w.pendingVoiceLines(seq,CH,{linea:'d',force:true}).map(x=>x.l.id),['d']);
 assert.equal(w.pendingVoiceLines(seq,CH,{linea:'a'})[0].t.title,'P1');});
