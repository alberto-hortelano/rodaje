// Casos de referencia de blockPrompt para la #42: cada uno cambia una cosa del bloque b02 (variante, canales, gravedad, tareas…).
// casos(d) recibe base o conTextos de datos.mjs y devuelve [{name, args}] para blockPrompt(args).
const line=(id,character,channel,text,start,offscreen=false)=>({id,character,text,spokenText:text,channel,offscreen,start});
export function casos(d){
 const make=(name,fn=()=>{})=>{const args=structuredClone({project:d.project,sequence:d.sequence,shots:d.shots,block:d.block,registry:d.registry,map:d.map,scene:d.scene});fn(args);return {name,args};};
 const first=a=>a.shots[a.block.parts[0].shot],lines=a=>a.block.parts[0].lines;
 return [
  make('red'),
  make('yellow',a=>{a.sequence.variant='yellow';lines(a).push(line('y1','earl','muffled','Can you hear me?',8.2));}),
  make('green',a=>{a.sequence.variant='green';lines(a).push(line('g1','earl','direct','Door.',8.2),line('g2','nnamdi','','Seal.',9.1),line('g3','roz','external','Copy.',10));}),
  make('base',a=>{a.sequence.variant='';}),
  make('master',a=>{a.mode='master';}),
  make('swarm',a=>{first(a).staging={...first(a).staging,swarm:'cloud'};}),
  make('offscreen',a=>{lines(a).push(line('o1','pa','pa','Attention, crew.',0.1,true),line('o2','brady','ext','Hold eleven, report.',5),line('o3','brady','radio','Confirm the seal.',7,true),line('o4','jo','direct','Anyone there?',9,true),line('o5','earl','intercom','Coming through.',10));}),
  make('gravedad-half',a=>{first(a).gravity='half';}),
  make('gravedad-zero',a=>{first(a).gravity='zero';}),
  make('gravedad-lunar',a=>{first(a).gravity='lunar';}),
  make('tareas',a=>{const t=first(a);t.action='';t.staging={...t.staging,tasks:{roz:'idle',earl:'checking the latch'}};const s=a.shots[a.block.parts[1].shot];s.action='';delete s.staging.tasks;}),
  make('sin-escena',a=>{a.scene=undefined;a.map=undefined;}),
 ];}
