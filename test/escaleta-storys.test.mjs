// Escaleta → story → planos (#56): papel de cada secuencia, árbol y filas de la escaleta, errores y avisos del modelo, destino de los planos
// de un story, aplicación sin mezclar versiones, etiqueta del botón, borrado de un story, plan de migración y los scripts sobre un proyecto temporal.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {sequenceRole,storyContainer,storyVersions,outlineTree,outline,storyModelIssues,storyPlansTarget,applyStoryPlans,storyPlansLabel,detachStory,storyMigrationPlan,OUTLINE_FIELDS} from '../app/workflow.mjs';
import {validate,digest} from '../app/store.mjs';
import {sceneNumber} from '../lib/lotes.mjs';
import {storysProject,storysSpec,planShot} from './fixtures/escaleta-storys.mjs';

const counter=(prefix,n=0)=>()=>prefix+(n++);
const migrated=()=>storyMigrationPlan(storysProject(),storysSpec()).next;
const seq=(p,id)=>p.episodes.flatMap(e=>e.sequences).find(s=>s.id===id);
const sb=(p,id)=>p.storyboards.find(b=>b.id===id);
const ids=list=>list.map(x=>x.sequence.id);
// Escaleta anterior a #56, para comparar.
const oldOutline=p=>{const rows=[];let n=0,start=0;for(const e of p.episodes||[])for(const s of e.sequences||[]){n++;const minutes=Number(s.minutes)||0;rows.push({episode:e,sequence:s,number:n,code:String(n).padStart(2,'0'),minutes,start});start+=minutes;}return rows;};
// Proyecto con secuencias de capítulo sin storys (como uno que solo usa capítulos): la escaleta no cambia.
const plainProject=()=>({id:'plano',name:'Plano',type:'serie',language:'en',ideas:[],issues:[],characters:[{id:'ana',name:'Ana'}],locations:[{id:'loc',name:'Loc'}],storyboards:[{id:'sb-x',title:'Suelto',sequences:[]}],
 episodes:[{id:'t',title:'Pruebas',sequences:[{id:'t1',title:'Prueba de tono',cast:[],shots:[planShot('q1')]}]},{id:'c1',title:'Capítulo 1',sequences:[{id:'s1',title:'1. INT.',cast:[],minutes:2,shots:[planShot('q2',null,{sourceScene:1})]},{id:'s2',title:'2. EXT.',cast:[],shots:[planShot('q3',null,{sourceScene:2})]}]}]});

test('sequenceRole: sin enlaces todo es ficha; contenedor solo con story enlazado existente; prueba con test:true',()=>{
 const p=storysProject();for(const s of p.episodes.flatMap(e=>e.sequences))assert.equal(sequenceRole(p,s),'outline',s.id);
 const m=migrated();assert.equal(sequenceRole(m,seq(m,'x-v1')),'container');assert.equal(sequenceRole(m,seq(m,'x-v2')),'container');assert.equal(sequenceRole(m,seq(m,'x-colgado')),'outline');
 assert.equal(sequenceRole(m,seq(m,'x-cruce')),'test');assert.equal(sequenceRole(m,seq(m,'x-prologo')),'outline');
 assert.equal(sequenceRole(m,{id:'z',storyboard:'no-existe'}),'outline');assert.equal(sequenceRole(m,{id:'z',storyboard:'sb-v1',test:true}),'test');
 assert.deepEqual(ids([storyContainer(m,'sb-v2')]),['x-v2']);assert.equal(storyContainer(m,'sb-carga'),null);});

test('outlineTree antes y después de migrar: fichas numeradas, storys por versión con vigente y contenedor, pruebas y sin ficha',()=>{
 const t0=outlineTree(storysProject());assert.deepEqual(t0.acts.map(a=>ids(a.sequences)),[['x-v1','x-v2','x-prologo','x-camino','x-fuego','x-cruce'],['y-uno']]);
 assert.deepEqual(t0.tests,[]);assert.deepEqual(t0.unlinked.map(u=>[u.storyboard.id,u.container?.sequence.id??null]),[['sb-v1','x-v1'],['sb-carga',null],['sb-v2','x-v2']]);
 const m=migrated(),t=outlineTree(m);assert.deepEqual(t.acts.map(a=>ids(a.sequences)),[['x-colgado','x-prologo','x-camino'],['y-uno']]);
 const [colgado,prologo]=t.acts[0].sequences;
 assert.deepEqual(colgado.storys.map(s=>[s.storyboard.id,s.version,s.current,s.container.sequence.id]),[['sb-v1',1,false,'x-v1'],['sb-v2',2,true,'x-v2']]);
 assert.equal(colgado.current,'sb-v2');assert.equal(colgado.ownShots,0);assert.deepEqual([colgado.number,colgado.code,colgado.minutes,colgado.start],[1,'01',4,0]);
 assert.deepEqual(prologo.storys.map(s=>[s.storyboard.id,s.version,s.current,s.container]),[['sb-carga',1,true,null]]);assert.deepEqual([prologo.number,prologo.start],[2,4]);
 assert.deepEqual(ids(t.tests),['x-fuego','x-cruce']);assert.deepEqual(t.unlinked,[]);
 assert.deepEqual(t.acts[1].sequences.map(r=>[r.code,r.start]),[['04',9]]);});

test('outline: sin storys enlazados ni pruebas, igual que antes; con ellos, solo fichas con número, código e inicio recalculados',()=>{
 for(const p of [plainProject(),storysProject()])assert.deepEqual(outline(p),oldOutline(p));
 const m=migrated(),rows=outline(m);
 assert.deepEqual(rows.map(r=>[r.sequence.id,r.number,r.code,r.minutes,r.start,r.episode.id]),[['x-colgado',1,'01',4,0,'e1'],['x-prologo',2,'02',3,4,'e1'],['x-camino',3,'03',2,7,'e1'],['y-uno',4,'04',5,9,'e2']]);
 assert.deepEqual(Object.keys(rows[0]),['episode','sequence','number','code','minutes','start']);});

test('storyModelIssues: datos sin migrar y migrados, sin errores ni avisos',()=>{
 for(const p of [storysProject(),plainProject(),migrated()])assert.deepEqual(storyModelIssues(p),{errors:[],warnings:[]});
 assert.deepEqual(storyModelIssues({}),{errors:[],warnings:[]});assert.deepEqual(storyModelIssues({episodes:{},storyboards:'x'}),{errors:[],warnings:[]});});

test('storyModelIssues: cada error',()=>{
 const cases=[
  [m=>{sb(m,'sb-carga').outlineSequence='nada';},/sb-carga enlaza una secuencia inexistente: nada/],
  [m=>{sb(m,'sb-carga').outlineSequence=5;},/sb-carga: outlineSequence debe ser el id/],
  [m=>{sb(m,'sb-carga').outlineSequence='x-v1';},/sb-carga enlaza x-v1, que no es una ficha/],
  [m=>{sb(m,'sb-carga').outlineSequence='x-cruce';},/es una prueba/],
  [m=>{seq(m,'x-camino').currentStoryboard=3;},/x-camino: currentStoryboard debe ser el id/],
  [m=>{seq(m,'x-camino').currentStoryboard='sb-nada';},/x-camino marca vigente un story inexistente/],
  [m=>{seq(m,'x-prologo').currentStoryboard='sb-v2';},/x-prologo marca vigente sb-v2, que es de la secuencia x-colgado/],
  [m=>{seq(m,'y-uno').storyboard='sb-v1';},/sb-v1 tiene 2 secuencias de planos \(x-v1, y-uno\)/],
  [m=>{seq(m,'x-v2').shots[0].storyboardShot='v1a';},/El plano p3 de x-v2 enlaza la viñeta v1a del story sb-v1/],
  [m=>{sb(m,'sb-v2').version=1;},/Versión 1 repetida en la secuencia x-colgado: sb-v1 y sb-v2/],
  [m=>{sb(m,'sb-v2').version=0;},/sb-v2: version debe ser un entero mayor que 0/],
  [m=>{sb(m,'sb-v2').version=1.5;},/sb-v2: version debe ser un entero/],
  [m=>{seq(m,'x-camino').test=false;},/x-camino: test solo admite true/],
 ];
 for(const [f,re] of cases){const m=migrated();f(m);const r=storyModelIssues(m);assert.ok(r.errors.some(e=>re.test(e)),`${re}: ${JSON.stringify(r.errors)}`);assert.throws(()=>validate(m),re);}
 // Una viñeta que no es de ningún story no es mezcla.
 const m=migrated();seq(m,'x-v2').shots[0].storyboardShot='v-borrada';assert.deepEqual(storyModelIssues(m).errors,[]);});

test('storyModelIssues: dos vigentes es imposible (un solo campo por ficha y el vigente debe ser de esa ficha)',()=>{
 const m=migrated();seq(m,'x-prologo').currentStoryboard='sb-v1';assert.match(storyModelIssues(m).errors.join('\n'),/x-prologo marca vigente sb-v1, que es de la secuencia x-colgado/);
 const m2=migrated();seq(m2,'x-colgado').currentStoryboard='sb-v1';assert.deepEqual(storyModelIssues(m2).errors,[]);
 assert.deepEqual(outlineTree(m2).acts[0].sequences[0].storys.filter(s=>s.current).map(s=>s.storyboard.id),['sb-v1']);});

test('storyModelIssues: cada aviso (solo check) y validate los admite',()=>{
 const cases=[
  [m=>{seq(m,'x-v1').storyboard='sb-nada';},/x-v1 apunta a un story inexistente: sb-nada/],
  [m=>{delete seq(m,'x-colgado').currentStoryboard;},/x-colgado tiene 2 storys y ninguno vigente/],
  [m=>{const s=seq(m,'x-v2');m.episodes[0].sequences=m.episodes[0].sequences.filter(x=>x!==s);m.episodes[1].sequences.push(s);},/Los planos del story sb-v2 \(x-v2\) están en otro acto que su ficha x-colgado/],
  [m=>{seq(m,'x-colgado').shots.push(planShot('p9'));},/La ficha x-colgado tiene storys enlazados y además 1 planos propios/],
 ];
 for(const [f,re] of cases){const m=migrated();f(m);const r=storyModelIssues(m);assert.deepEqual(r.errors,[],String(re));assert.ok(r.warnings.some(w=>re.test(w)),`${re}: ${JSON.stringify(r.warnings)}`);validate(m);}});

test('validate acepta los datos sin migrar, migrados y sin storys',()=>{for(const p of [storysProject(),migrated(),plainProject()])assert.equal(validate(p),p);});

test('storyPlansTarget: sin ficha y sin secuencia null; ficha → contenedor (nuevo al final del acto); nunca a los planos de otro story',()=>{
 const p=storysProject();assert.equal(storyPlansTarget(p,'sb-v1'),null);
 let t=storyPlansTarget(p,'sb-v1','x-camino');assert.deepEqual([t.sequence.id,t.index,t.created,t.errors,t.warnings],['x-camino',3,false,[],[]]);
 t=storyPlansTarget(p,'sb-v1','x-v2');assert.deepEqual([t.sequence.id,t.errors],['x-v2',[]]);assert.match(t.warnings[0],/deja de apuntar al story sb-v2/);
 assert.throws(()=>storyPlansTarget(p,'sb-nada'),/Storyboard no encontrado: sb-nada/);
 const m=migrated();
 for(const s of [undefined,'x-colgado','x-v2']){t=storyPlansTarget(m,'sb-v2',s);assert.deepEqual([t.episode.id,t.sequence.id,t.index,t.created,t.errors],['e1','x-v2',2,false,[]],String(s));}
 t=storyPlansTarget(m,'sb-carga','x-prologo',{newId:()=>'nuevo'});
 assert.deepEqual(t.sequence,{id:'nuevo',title:'Prólogo · La carga',storyboard:'sb-carga',silent:false,ambienceGain:.18,ambiencePrompt:'',cast:[],props:[],shots:[]});
 assert.deepEqual([t.episode.id,t.index,t.created,t.errors],['e1',m.episodes[0].sequences.length,true,[]]);assert.equal(storyPlansTarget(m,'sb-carga',undefined,{newId:()=>'n'}).created,true);
 assert.match(storyPlansTarget(m,'sb-v2','x-v1').errors[0],/x-v1 tiene los planos del story sb-v1: no se mezclan con los de sb-v2/);
 assert.match(storyPlansTarget(m,'sb-v2','x-camino').errors[0],/Los planos del story sb-v2 están en x-v2/);
 assert.match(storyPlansTarget(m,'sb-carga','x-camino').errors[0],/sb-carga es de la secuencia x-prologo/);
 t=storyPlansTarget(m,'sb-v2','x-cruce');assert.deepEqual([t.sequence.id,t.errors],['x-cruce',[]]);assert.match(t.warnings[0],/x-cruce es una prueba/);
 assert.match(storyPlansTarget(m,'sb-v2','nada').errors[0],/Secuencia no encontrada: nada/);
 m.storyboards.push({id:'sb-suelto',title:'Suelto',sequences:[]});assert.match(storyPlansTarget(m,'sb-suelto','x-colgado').errors[0],/x-colgado es la ficha de escaleta de sb-v1, sb-v2/);
 m.storyboards.at(-1).outlineSequence='nada';assert.match(storyPlansTarget(m,'sb-suelto').errors[0],/enlaza una secuencia inexistente/);});

test('applyStoryPlans: v1 y luego v2 de una ficha en contenedores separados, sin mezclar; repetir conserva ids; no muta',()=>{
 const p=storysProject();for(const id of ['sb-v1','sb-v2'])sb(p,id).outlineSequence='x-camino';
 p.episodes[0].sequences=p.episodes[0].sequences.filter(s=>!['x-v1','x-v2'].includes(s.id));const before=structuredClone(p);
 const r1=applyStoryPlans(p,'sb-v1',{sequence:'x-camino',newId:counter('a')});assert.deepEqual(p,before,'no muta');
 assert.equal(r1.created,true);assert.equal(r1.episodeId,'e1');const c1=r1.sequence;
 assert.deepEqual([c1.storyboard,c1.location,c1.shots.map(t=>t.storyboardShot)],['sb-v1','loc',['v1a','v1b']]);assert.equal(r1.project.episodes[0].sequences.at(-1),c1);
 const r2=applyStoryPlans(r1.project,'sb-v2',{newId:counter('b')});assert.equal(r2.created,true);
 const q=r2.project;assert.deepEqual(q.episodes[0].sequences.slice(-2).map(s=>[s.storyboard,s.shots.map(t=>t.storyboardShot)]),[['sb-v1',['v1a','v1b']],['sb-v2',['v2a','v2b','v2c']]]);
 assert.deepEqual(seq(q,c1.id),c1,'v1 intacta');assert.deepEqual(storyModelIssues(q).errors,[]);validate(q);
 const again=applyStoryPlans(q,'sb-v2',{sequence:'x-camino',newId:counter('c')});assert.equal(again.created,false);
 assert.deepEqual(again.sequence.shots.map(t=>t.id),r2.sequence.shots.map(t=>t.id));assert.deepEqual(again.project.episodes[0].sequences.length,q.episodes[0].sequences.length);
 assert.throws(()=>applyStoryPlans(storysProject(),'sb-v1'),/no tiene secuencia de escaleta/);
 assert.throws(()=>applyStoryPlans(migrated(),'sb-v2',{sequence:'x-v1'}),/no se mezclan/);});

test('storyPlansLabel y detachStory',()=>{
 const m=migrated();assert.equal(storyPlansLabel(m,sb(m,'sb-v2')),'Crear/actualizar planos del story');assert.equal(storyPlansLabel(storysProject(),sb(storysProject(),'sb-v2')),'Crear capítulo');
 const before=structuredClone(m),d=detachStory(m,'sb-v2');assert.deepEqual(m,before,'no muta');assert.equal(seq(d,'x-colgado').currentStoryboard,undefined);assert.equal(seq(d,'x-prologo').currentStoryboard,'sb-carga');
 d.storyboards=d.storyboards.filter(b=>b.id!=='sb-v2');assert.deepEqual(storyModelIssues(d).errors,[]);});

test('storyMigrationPlan: ficha en la posición de from, campos movidos, sceneNumber fijados, mismos digests e ids; la segunda vez sin ops',()=>{
 const p=storysProject(),before=structuredClone(p),r=storyMigrationPlan(p,storysSpec());assert.deepEqual(p,before,'no muta');
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.warnings,[]);const m=r.next;
 assert.deepEqual(r.ops.map(o=>o.kind),['sceneNumber','sceneNumber','sceneNumber','sceneNumber','ficha','campos','campos','enlace','enlace','enlace','version','version','version','vigente','vigente','prueba','prueba']);
 assert.deepEqual(m.episodes[0].sequences.map(s=>s.id),['x-colgado','x-v1','x-v2','x-prologo','x-camino','x-fuego','x-cruce']);
 assert.deepEqual(seq(m,'x-colgado'),{id:'x-colgado',title:'Prólogo · El Colgado',silent:false,cast:[],props:[],shots:[],minutes:4,text:'Texto de la ficha.',coverPrompt:'Prompt de carátula.',currentStoryboard:'sb-v2'});
 for(const id of ['x-v1','x-v2'])for(const k of OUTLINE_FIELDS)assert.equal(Object.hasOwn(seq(m,id),k),false,id+'.'+k);
 assert.match(r.ops.find(o=>o.kind==='campos'&&o.text.startsWith('x-v2:')).text,/quita minutes=7 · text="Texto de la v2."/);
 assert.deepEqual(seq(m,'x-prologo').cover,'assets/c.png','las fichas conservan sus campos');
 assert.deepEqual(['x-v1','x-v2','x-fuego','x-cruce'].map(id=>seq(m,id).sceneNumber),[1,2,5,6]);
 for(const e of p.episodes)for(const s of e.sequences)if(s.shots.length)assert.equal(sceneNumber(m.episodes.find(x=>x.id===e.id),seq(m,s.id)),sceneNumber(e,s),s.id);
 assert.deepEqual(['sb-v1','sb-v2','sb-carga'].map(id=>[sb(m,id).outlineSequence,sb(m,id).version]),[['x-colgado',1],['x-colgado',2],['x-prologo',1]]);
 assert.deepEqual([seq(m,'x-colgado').currentStoryboard,seq(m,'x-prologo').currentStoryboard,seq(m,'x-camino').currentStoryboard],['sb-v2','sb-carga',undefined]);
 assert.deepEqual([seq(m,'x-cruce').test,seq(m,'x-fuego').test],[true,true]);
 const shotIds=q=>q.episodes.flatMap(e=>e.sequences.flatMap(s=>s.shots.map(t=>t.id)));assert.deepEqual(shotIds(m),shotIds(p));
 for(const id of shotIds(p))assert.equal(digest(m,id),digest(p,id),id);
 for(const s of p.episodes.flatMap(e=>e.sequences))assert.ok(seq(m,s.id),'se conserva '+s.id);
 validate(m);const again=storyMigrationPlan(m,storysSpec());assert.deepEqual([again.ops,again.errors,again.warnings],[[],[],[]]);});

test('storyMigrationPlan: errores de la spec y spec sugerida',()=>{
 const p=storysProject(),run=spec=>storyMigrationPlan(p,spec).errors;
 assert.match(run({...storysSpec(),fichas:[{id:'x-v1',from:'x-v1',title:'T'}]}).join('\n'),/El id de ficha x-v1 ya es de una secuencia que no es ficha/);
 assert.match(run({...storysSpec(),enlaces:{'sb-nada':'x-prologo'}}).join('\n'),/Story desconocido en enlaces: sb-nada/);
 assert.match(run({...storysSpec(),vigentes:{'x-colgado':'sb-carga'}}).join('\n'),/El vigente sb-carga de x-colgado no está enlazado a x-colgado/);
 assert.match(run({...storysSpec(),fichas:[{id:'x-colgado',from:'x-nada',title:'T'}]}).join('\n'),/La ficha x-colgado: from inexistente \(x-nada\)/);
 assert.match(run({...storysSpec(),pruebas:['x-nada']}).join('\n'),/Prueba inexistente: x-nada/);
 assert.match(run({...storysSpec(),enlaces:{'sb-carga':'x-v1'}}).join('\n'),/sb-carga enlaza x-v1, que no es una ficha/);
 assert.match(run({...storysSpec(),enlaces:{'sb-carga':'x-cruce'}}).join('\n'),/sb-carga enlaza x-cruce, que no es una ficha/);
 assert.deepEqual(storyMigrationPlan(p,{...storysSpec(),pruebas:['x-nada']}).ops,[]);
 const s=storyMigrationPlan(p,null);assert.deepEqual(s.ops,[]);
 assert.deepEqual(s.suggested,{fichas:[{id:'x-v1-escaleta',from:'x-v1',title:'Prólogo · El Colgado'}],enlaces:{'sb-v1':'x-v1-escaleta','sb-carga':'x-prologo','sb-v2':'x-v1-escaleta'},vigentes:{'x-v1-escaleta':'sb-v2'},pruebas:['x-cruce']});
 assert.deepEqual(storyMigrationPlan(p,s.suggested).errors,[]);
 assert.deepEqual(storyVersions(migrated(),'x-colgado'),new Map([['sb-v1',1],['sb-v2',2]]));});

const ROOT=path.resolve(import.meta.dirname,'..');
const runScript=(data,script,args)=>spawnSync(process.execPath,[path.join(ROOT,'scripts',script),...args],{cwd:ROOT,encoding:'utf8',timeout:30000,env:{...process.env,RODAJE_DATA:data}});
const tempProject=p=>{const data=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-escaleta-'));fs.mkdirSync(path.join(data,p.id));fs.writeFileSync(path.join(data,p.id,'proyecto.json'),JSON.stringify(p));return {data,read:()=>JSON.parse(fs.readFileSync(path.join(data,p.id,'proyecto.json'),'utf8'))};};

test('scripts/storyboard-a-secuencia.mjs: la ficha lleva a su contenedor (nuevo la primera vez); nunca a los planos de otro story',()=>{
 const {data,read}=tempProject(migrated());
 let r=runScript(data,'storyboard-a-secuencia.mjs',['--project','escaleta','sb-carga','x-prologo']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/Prólogo · La carga \(secuencia nueva [\w-]+\): 3 planos/);
 let p=read();const c=p.episodes[0].sequences.at(-1);assert.deepEqual([c.storyboard,c.location,c.shots.map(t=>t.storyboardShot)],['sb-carga','otro',['ca','cb','cc']]);assert.deepEqual(seq(p,'x-prologo').shots,[]);
 r=runScript(data,'storyboard-a-secuencia.mjs',['--project','escaleta','sb-carga','x-prologo']);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stdout,/secuencia nueva/);
 p=read();assert.equal(p.episodes[0].sequences.length,8);assert.deepEqual(p.episodes[0].sequences.at(-1).shots.map(t=>t.id),c.shots.map(t=>t.id));
 const before=fs.readFileSync(path.join(data,'escaleta','proyecto.json'),'utf8');r=runScript(data,'storyboard-a-secuencia.mjs',['--project','escaleta','sb-v2','x-v1']);
 assert.notEqual(r.status,0);assert.match(r.stderr,/no se mezclan/);assert.equal(fs.readFileSync(path.join(data,'escaleta','proyecto.json'),'utf8'),before);});

test('scripts/storyboard-3d.mjs: --secuencia opcional con story enlazado (usa o crea su contenedor); sin enlace, uso',()=>{
 const {data,read}=tempProject(migrated());
 let r=runScript(data,'storyboard-3d.mjs',['sb-carga','A02','--project','escaleta']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/A02 · creado · plano [\w-]+ · posición 1\/1/);assert.match(r.stderr,/secuencia nueva/);
 let p=read();const c=p.episodes[0].sequences.at(-1);assert.deepEqual([c.storyboard,c.location,c.shots.map(t=>t.storyboardShot)],['sb-carga','otro',['cb']]);
 r=runScript(data,'storyboard-3d.mjs',['sb-carga','A01','--secuencia','x-prologo','--project','escaleta']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/A01 · creado · .* · posición 1\/2/);
 p=read();assert.equal(p.episodes[0].sequences.length,8);assert.deepEqual(p.episodes[0].sequences.at(-1).shots.map(t=>t.storyboardShot),['ca','cb']);
 r=runScript(data,'storyboard-3d.mjs',['sb-v2','A01','--project','escaleta','--plan']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/A01 · actualizado · plano p3/);
 r=runScript(data,'storyboard-3d.mjs',['sb-v2','A01','--secuencia','x-v1','--project','escaleta']);assert.equal(r.status,1);assert.match(r.stderr,/no se mezclan/);
 const plain=tempProject(storysProject());r=runScript(plain.data,'storyboard-3d.mjs',['sb-v1','A01','--project','escaleta']);assert.equal(r.status,2);assert.match(r.stderr,/Falta --secuencia <id>/);assert.match(r.stderr,/Uso:/);});
