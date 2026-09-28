// Animáticas del storyboard por paso (#46): foto 3D, fotograma, óptica, subtítulos, secuencia de capítulo enlazada, línea de tiempo,
// versiones, agrupación para la vista y argumentos de ffmpeg de cada segmento. Puro (sin ffmpeg ni disco).
import test from 'node:test';import assert from 'node:assert/strict';
import {SOURCE_3D,ANIMATIC_STEPS,shot3dPhoto,shotFrame,shotLens,captionText,captionRows,spreadDialogue,chapterSequenceFor,animaticTimeline,nextAnimaticVersion,animaticGroups,storyboardToEpisode,projectChannels} from '../app/workflow.mjs';
import {segmentArgs,drawtextEscape,ANIM_DIR} from '../lib/animaticas.mjs';

const R3=(file,extra={})=>({file,at:'2026-09-28T10:00:00.000Z',source:SOURCE_3D,...extra}),GPT=file=>({file,at:'2026-09-28T11:00:00.000Z',source:'ChatGPT'});
const v=(id,code,extra={})=>({id,code,title:'Título '+code,duration:6,camera:'',dialogue:[],...extra});
const P=()=>({id:'p',language:'en',locations:[],characters:[{id:'renaud',name:'Renaud'},{id:'aymer',name:'Aymer'},{id:'conde',name:'El conde'}],
 storyboards:[{id:'sb-a',sequences:[
  {id:'s1',title:'Camino',shots:[
   v('v1','A01',{duration:4,camera:'Fijo, 50 mm, a la altura de los ojos.',renders:[GPT('sb/render/A01-old.png'),R3('sb/3d/A01.png'),GPT('sb/render/A01.png')],render:'sb/render/A01.png',dialogue:[{who:'Renaud',character:'renaud',text:'He walks.'}]}),
   v('v2','A02',{duration:8,guide3d:{lens:85},renders:[R3('sb/3d/A02.png')],render:'sb/3d/A02.png',dialogue:[{who:'Renaud',character:'renaud',text:'He walks.'},{who:'Aymer',character:'aymer',text:"He's lame in the fore."}]})]},
  {id:'s 2',title:'Cruce',shots:[v('v3','B01',{duration:5,render:'sb/render/B01.png',dialogue:[{who:'Aymer',character:'aymer',text:'One.'},{who:'Aymer',character:'aymer',text:'Two.'}]})]}]}],
 episodes:[{id:'e1',sequences:[
  {id:'c-otra',shots:[{id:'x1',storyboardShot:'v1',duration:3,lines:[]}]},
  {id:'c-buena',storyboard:'sb-a',shots:[
   {id:'p1',storyboardShot:'v1',duration:5,lines:[{id:'l1',character:'renaud',text:'He walks.',start:0.5,audio:'a/l1.mp3',audioDuration:1.2}]},
   {id:'p1b',storyboardShot:'v1',duration:9,lines:[]},
   {id:'p2',storyboardShot:'v2',duration:7,lines:[
    {id:'l3',character:'aymer',text:"He's lame in the fore.",start:2.8,offscreen:true,audio:'a/l3.mp3',audioDuration:6},
    {id:'l2',character:'renaud',text:'He walks.',start:0.5,estimatedDuration:4},
    {id:'l4',character:'renaud',text:'He walks.',start:5.2}]}]}]}]});
const sbOf=p=>p.storyboards[0];

test('shot3dPhoto: la primera de renders con fuente «ensayo 3D» cuyo fichero existe; ignora ChatGPT; null sin renders',()=>{
 const t={renders:[GPT('g.png'),R3('a.png'),R3('b.png')]};
 assert.equal(shot3dPhoto(t),'a.png');assert.equal(shot3dPhoto(t,f=>f!=='a.png'),'b.png');assert.equal(shot3dPhoto({renders:[GPT('g.png')]}),null);
 assert.equal(shot3dPhoto({}),null);assert.equal(shot3dPhoto({guide3d:{lens:85}}),null);});

test('shotFrame: render válido; si apunta a la foto 3D o no existe, null',()=>{
 const t={render:'f.png',renders:[R3('a.png'),GPT('f.png')]};
 assert.equal(shotFrame(t),'f.png');assert.equal(shotFrame({...t,render:'a.png'}),null);assert.equal(shotFrame(t,()=>false),null);assert.equal(shotFrame({}),null);});

test('shotLens: guide3d.lens, si no el primer «NN mm» de la cámara; si no, null y rótulo sin óptica',()=>{
 assert.equal(shotLens({guide3d:{lens:85},camera:'Fijo, 50 mm'}),85);assert.equal(shotLens({camera:'Fijo, 50 mm, a la altura de los ojos.'}),50);
 assert.equal(shotLens({guide3d:{lens:'85'},camera:'Grúa 135mm'}),135);assert.equal(shotLens({camera:'Fijo'}),null);
 const p=P();sbOf(p).sequences[0].shots[0].camera='Fijo';const tl=animaticTimeline(p,sbOf(p),{step:'3d'});assert.equal(tl.sequences[0].shots[0].label,'A01 · Título A01');
 assert.equal(tl.sequences[0].shots[1].label,'A02 · Título A02 · 85 mm');});

test('captionText y captionRows: nombre en mayúsculas, (OFF) por la línea o por el canal; dos filas si pasa de 60',()=>{
 const p=P(),CH=projectChannels(p);
 assert.equal(captionText(p,{character:'renaud',text:'He walks.'},CH),'RENAUD: He walks.');
 assert.equal(captionText(p,{character:'aymer',text:"He's lame in the fore.",offscreen:true},CH),"AYMER (OFF): He's lame in the fore.");
 assert.equal(captionText(p,{character:'conde',text:'Hang him.',channel:'pa'},CH),'EL CONDE (OFF): Hang him.');
 assert.equal(captionText(p,{who:'Bertran',text:'Go.'},CH),'BERTRAN: Go.');
 assert.deepEqual(captionRows('RENAUD: He walks.'),['RENAUD: He walks.']);assert.deepEqual(captionRows(''),[]);
 const long='AYMER (OFF): He is lame in the fore and he will not reach the crossing before dark.';const rows=captionRows(long);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.length<=60));assert.equal(rows.join(' '),long);});

test('drawtextEscape escapa \\ \' : y % como el montaje',()=>{
 assert.equal(drawtextEscape("A\\B 'x': 50%"),'A\\\\B ’x’\\: 50\\%');});

test('spreadDialogue: la fórmula de storyboardToEpisode, que sigue dando los mismos inicios',()=>{
 assert.deepEqual(spreadDialogue(0,5),[]);assert.deepEqual(spreadDialogue(1,5),[0.5]);assert.deepEqual(spreadDialogue(3,8),[0.5,2.8,5.2]);assert.deepEqual(spreadDialogue(3,1),[0.5,0.5,0.5]);
 const p=P(),sb={id:'x',sequences:[{id:'q',shots:[v('w','Z1',{duration:8,dialogue:[1,2,3].map(i=>({character:'renaud',text:'t'+i}))}),v('w2','Z2',{duration:1,dialogue:[{character:'aymer',text:'a'},{character:'aymer',text:'b'}]})]}]};
 const old=(n,d)=>{const step=n?Math.max(0,(d-1))/n:0;return Array.from({length:n},(_,i)=>Math.min(d-.5,Math.round((.5+i*step)*10)/10));};for(const n of [0,1,2,3,5,7])for(const d of [1,2.5,4,5,8,12,15])assert.deepEqual(spreadDialogue(n,d),old(n,d));
 const e=storyboardToEpisode(p,sb,()=>'id');assert.deepEqual(e.sequences[0].shots.map(t=>t.lines.map(l=>l.start)),[[0.5,2.8,5.2],[0.5,0.5]]);});

test('chapterSequenceFor: storyboard propio, luego más audio, luego más planos, luego orden; override; sin candidatas null',()=>{
 const p=P(),sb=sbOf(p);let r=chapterSequenceFor(p,sb);assert.equal(r.sequence.id,'c-buena');assert.equal(r.episode.id,'e1');assert.equal(r.candidates,2);
 delete p.episodes[0].sequences[1].storyboard;p.episodes[0].sequences[0].storyboard='sb-a';assert.equal(chapterSequenceFor(p,sb).sequence.id,'c-otra');
 delete p.episodes[0].sequences[0].storyboard;assert.equal(chapterSequenceFor(p,sb).sequence.id,'c-buena','más audio');
 for(const t of p.episodes[0].sequences[1].shots)for(const l of t.lines)delete l.audio;assert.equal(chapterSequenceFor(p,sb).sequence.id,'c-buena','más planos');
 p.episodes[0].sequences[1].shots=[p.episodes[0].sequences[1].shots[0]];assert.equal(chapterSequenceFor(p,sb).sequence.id,'c-otra','empate: la primera');
 assert.equal(chapterSequenceFor(p,sb,{override:'c-buena'}).sequence.id,'c-buena');assert.throws(()=>chapterSequenceFor(p,sb,{override:'nada'}),/no encontrada/);
 assert.equal(chapterSequenceFor(p,{id:'sb-z',sequences:[{id:'q',shots:[{id:'zz'}]}]}),null);});

test('animaticTimeline 3d: fotos 3D, duraciones y texto del plano enlazado (el primero), at acumulado y falta foto-3d',()=>{
 const p=P(),sb=sbOf(p),source=chapterSequenceFor(p,sb),tl=animaticTimeline(p,sb,{step:'3d',source});
 assert.deepEqual(tl.source,{episode:'e1',sequence:'c-buena',candidates:2});assert.equal(tl.storyboard,'sb-a');
 const [s1,s2]=tl.sequences;assert.deepEqual([s1.at,s1.duration,s2.at,s2.duration,tl.duration],[0,12,12,5,17]);
 assert.deepEqual(s1.shots.map(t=>[t.code,t.at,t.duration,t.image]),[['A01',0,5,'sb/3d/A01.png'],['A02',5,7,'sb/3d/A02.png']]);
 assert.equal(s2.file,'sec-02');assert.equal(s1.file,'s1');assert.equal(s2.shots[0].slate,'SIN FOTO 3D');assert.equal(s2.shots[0].image,null);
 assert.deepEqual(tl.missing,[{shot:'v3',code:'B01',kind:'foto-3d'}]);assert.equal(tl.incomplete,true);
 assert.deepEqual(s1.shots[1].lines.map(l=>[l.caption,l.at,l.audio]),[['RENAUD: He walks.',0.5,null],["AYMER (OFF): He's lame in the fore.",2.8,null],['RENAUD: He walks.',5.2,null]]);
 assert.deepEqual(s2.shots[0].lines.map(l=>l.at),[0.5,2.5],'sin plano: diálogo repartido');});

test('animaticTimeline fotogramas: fotograma vigente; el que es la foto 3D falta (placa)',()=>{
 const p=P(),sb=sbOf(p),tl=animaticTimeline(p,sb,{step:'fotogramas',source:chapterSequenceFor(p,sb)});
 assert.deepEqual(tl.sequences.flatMap(s=>s.shots.map(t=>[t.image,t.slate])),[['sb/render/A01.png',null],[null,'SIN FOTOGRAMA'],['sb/render/B01.png',null]]);
 assert.deepEqual(tl.missing,[{shot:'v2',code:'A02',kind:'fotograma'}]);assert.equal(tl.incomplete,true);
 assert.deepEqual(animaticTimeline(p,sb,{step:'fotogramas',has:f=>f!=='sb/render/B01.png'}).missing.map(m=>m.code),['A02','B01']);});

test('animaticTimeline voces: audio en su start (también fuera de campo), faltas de audio y de plano, y audio que se sale',()=>{
 const p=P(),sb=sbOf(p),tl=animaticTimeline(p,sb,{step:'voces',source:chapterSequenceFor(p,sb),has:f=>f!=='sb/3d/A02.png'});
 const a2=tl.sequences[0].shots[1];assert.deepEqual(a2.lines.map(l=>[l.id,l.at,l.audio,l.offscreen]),[['l2',0.5,null,false],['l3',2.8,'a/l3.mp3',true],['l4',5.2,null,false]]);
 assert.deepEqual(tl.missing,[{shot:'v2',code:'A02',kind:'fotograma'},{shot:'v2',code:'A02',kind:'audio',line:'l2',text:'He walks.'},{shot:'v2',code:'A02',kind:'audio',line:'l4',text:'He walks.'},{shot:'v3',code:'B01',kind:'plano'}]);
 assert.equal(tl.sequences[0].missing.length,3);assert.equal(tl.sequences[1].missing.length,1);
 assert.equal(tl.warnings.length,1);assert.match(tl.warnings[0],/^A02: .*fuera del plano/);assert.deepEqual(tl.sequences[0].warnings,tl.warnings);
 const gone=animaticTimeline(p,sb,{step:'voces',source:chapterSequenceFor(p,sb),has:f=>f!=='a/l1.mp3'});assert.deepEqual(gone.missing.filter(m=>m.line==='l1').map(m=>m.kind),['audio']);
 for(const step of ['3d','fotogramas'])assert.ok(animaticTimeline(p,sb,{step,source:chapterSequenceFor(p,sb)}).sequences.every(s=>s.shots.every(t=>t.lines.every(l=>l.audio===null))));});

test('animaticTimeline sin secuencia de capítulo: duración de la viñeta, diálogo repartido, falta plano solo en voces',()=>{
 const p=P(),sb=sbOf(p),tl=animaticTimeline(p,sb,{step:'voces'});assert.equal(tl.source,null);
 assert.deepEqual(tl.sequences[0].shots.map(t=>t.duration),[4,8]);assert.deepEqual(tl.sequences[0].shots[1].lines.map(l=>l.at),[0.5,4]);
 assert.deepEqual(tl.missing.filter(m=>m.kind==='plano').map(m=>m.code),['A01','A02','B01']);
 assert.equal(animaticTimeline(p,sb,{step:'3d'}).missing.some(m=>m.kind==='plano'),false);
 sbOf(p).sequences[0].shots[0].duration=0;assert.equal(animaticTimeline(p,sb,{step:'3d'}).sequences[0].shots[0].duration,5,'último recurso 5 s');});

test('fin de cada línea: audioDuration > estimatedDuration > estimación, mínimo 1,5 s, recortado a la siguiente y al plano',()=>{
 const p=P(),sb=sbOf(p),tl=animaticTimeline(p,sb,{step:'3d',source:chapterSequenceFor(p,sb)});
 assert.deepEqual(tl.sequences[0].shots[0].lines.map(l=>[l.at,l.end]),[[0.5,2]],'audioDuration 1,2 → mínimo 1,5');
 assert.deepEqual(tl.sequences[0].shots[1].lines.map(l=>[l.at,l.end]),[[0.5,2.8],[2.8,5.2],[5.2,6.7]],'estimated 4 → recorte; audio 6 → recorte; estimación → 1,5');
 const p2=P();p2.episodes[0].sequences[1].shots[2].lines=[{id:'z',character:'renaud',text:'one two three four five six seven eight nine ten',start:4}];
 assert.deepEqual(animaticTimeline(p2,sbOf(p2),{step:'3d',source:chapterSequenceFor(p2,sbOf(p2))}).sequences[0].shots[1].lines.map(l=>l.end),[6.5],'estimación 2,5 s');
 p2.episodes[0].sequences[1].shots[2].lines[0].start=6;assert.deepEqual(animaticTimeline(p2,sbOf(p2),{step:'3d',source:chapterSequenceFor(p2,sbOf(p2))}).sequences[0].shots[1].lines.map(l=>l.end),[7],'final del plano');});

test('animaticTimeline con sequence: solo esa, con at 0; lanza si no existe; paso no válido lanza',()=>{
 const p=P(),sb=sbOf(p),tl=animaticTimeline(p,sb,{step:'3d',sequence:'s 2'});
 assert.deepEqual(tl.sequences.map(s=>[s.id,s.file,s.at]),[['s 2','sec-02',0]]);assert.equal(tl.duration,5);
 assert.throws(()=>animaticTimeline(p,sb,{step:'3d',sequence:'nada'}),/no encontrada/);assert.throws(()=>animaticTimeline(p,sb,{step:'video'}),/Paso no válido/);
 assert.deepEqual(ANIMATIC_STEPS,['3d','fotogramas','voces']);});

test('nextAnimaticVersion: mayor vNN del índice y de los ficheros del paso (entero o secuencia), compartida; nunca repite',()=>{
 assert.equal(nextAnimaticVersion([],[],'3d'),1);
 const entries=[{step:'3d',version:2},{step:'voces',version:7}];
 assert.equal(nextAnimaticVersion(entries,['3d-v01.mp4','fotogramas-v09.mp4'],'3d'),3);
 assert.equal(nextAnimaticVersion(entries,['3d.s1-v04.mp4','3d.sec-v2-v05.part.mp4'],'3d'),6);
 assert.equal(nextAnimaticVersion(entries,['3d-v01.mp4'],'fotogramas'),1);assert.equal(nextAnimaticVersion(entries,[],'voces'),8);
 assert.equal(nextAnimaticVersion([],['index.json','otro.mp4'],'3d'),1);});

test('animaticGroups: vigente la mayor, orden descendente, sin ficheros ausentes ni secuencias borradas; vacío',()=>{
 const sb=sbOf(P()),e=(step,version,sequence=null,file=`${step}${sequence?'.'+sequence:''}-v0${version}.mp4`)=>({file,step,version,sequence,at:'2026-09-2'+version+'T00:00:00Z'});
 const index={entries:[e('3d',1),e('3d',3),e('3d',2),e('voces',1,'s1'),e('voces',2,'s1'),e('voces',3,'borrada'),e('fotogramas',4)]};
 const g=animaticGroups(index,sb,f=>f!=='fotogramas-v04.mp4');
 assert.deepEqual(Object.keys(g.storyboard),['3d']);assert.deepEqual(g.storyboard['3d'].list.map(x=>x.version),[3,2,1]);assert.equal(g.storyboard['3d'].current.version,3);
 assert.deepEqual(Object.keys(g.sequences),['s1']);assert.equal(g.sequences.s1.voces.current.version,2);
 assert.deepEqual(animaticGroups({storyboard:'sb-a',entries:[]},sb),{storyboard:{},sequences:{}});assert.deepEqual(animaticGroups(null,sb),{storyboard:{},sequences:{}});});

test('segmentArgs: imagen en bucle o placa negra; voces con una entrada y adelay por audio; 3d solo silencio; misma salida',()=>{
 const p=P(),sb=sbOf(p),source=chapterSequenceFor(p,sb);
 const shot3=animaticTimeline(p,sb,{step:'3d',source}).sequences[0].shots[1],voces=animaticTimeline(p,sb,{step:'voces',source,has:f=>f!=='sb/render/A01.png'});
 const a=segmentArgs(shot3,{base:'/proj',step:'3d',out:'/t/a.mp4'});
 assert.deepEqual(a.slice(0,8),['-loop','1','-framerate','24','-t','7','-i','/proj/sb/3d/A02.png']);
 assert.deepEqual(a.slice(8,12),['-f','lavfi','-i','anullsrc=r=48000:cl=stereo:d=7']);assert.equal(a.filter(x=>x==='-i').length,2);
 const fc=a[a.indexOf('-filter_complex')+1];assert.match(fc,/drawtext=fontfile=[^:]+:text='A02 · Título A02 · 85 mm':[^,]*x=20:y=20/);
 assert.match(fc,/text='RENAUD\\: He walks\.'.*enable='between\(t,0\.5,2\.8\)'/);assert.match(fc,/\[1:a\]amix=inputs=1:normalize=0:duration=first,atrim=0:7\[a\]/);assert.doesNotMatch(fc,/adelay/);
 const b=segmentArgs(voces.sequences[0].shots[0],{base:'/proj',step:'voces',out:'/t/b.mp4'});
 assert.deepEqual(b.slice(0,4),['-f','lavfi','-i','color=black:s=1280x720:r=24:d=5']);assert.ok(b.includes('/proj/a/l1.mp3'));
 const fb=b[b.indexOf('-filter_complex')+1];assert.match(fb,/text='SIN FOTOGRAMA'/);assert.match(fb,/\[1:a\]aresample=48000,aformat=channel_layouts=stereo,adelay=500:all=1\[a0\]/);assert.match(fb,/\[2:a\]\[a0\]amix=inputs=2/);
 const c=segmentArgs(voces.sequences[0].shots[1],{base:'/proj',step:'voces',out:'/t/c.mp4'});assert.equal(c.filter(x=>x==='-i').length,3);assert.match(c[c.indexOf('-filter_complex')+1],/adelay=2800:all=1/);
 const tail=x=>x.slice(x.indexOf('-t',x.indexOf('-map'))+2,-1);assert.deepEqual(tail(a),tail(b));assert.deepEqual(tail(b),tail(c));
 assert.deepEqual(tail(a),['-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000','-ac','2']);
 assert.equal(a.at(-1),'/t/a.mp4');assert.equal(ANIM_DIR('sb-a'),'storyboards/sb-a/animaticas');});
