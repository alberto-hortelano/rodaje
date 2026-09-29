// Proyecto de prueba para #58 (índice de relaciones), válido para store.validate. Textos inventados.
// Acto e1: ficha f1 con dos storys (sb1 v1, sb2 v2 vigente), sus contenedores c1 (plano enlazado y huérfano) y c2 (visibleCast, shot.location,
// voz por el canal pa), y una prueba (reparto propio) que enlaza una viñeta de sb2. Acto e2: ficha f2 con planos propios (proxy y reparto colgante) y ficha f3
// vacía. plaza tiene entorno por environment (env-a) y nave por modelSpace (env-b); env-a declara f3 en sequences (dato informativo).
const cam=()=>({position:[4,2.5,7],target:[0,1,0],fov:45});
export const relShot=(id,extra={})=>({id,title:id,description:'',duration:5,camera:cam(),cameraEnd:cam(),lines:[],history:[],...extra});
const line=(id,character,extra={})=>({id,character,text:'Texto '+id,start:1,...extra});
export function relProject(){return {id:'rel',name:'Relaciones',type:'serie',language:'en',revision:7,ideas:[],issues:[],
 characters:[{id:'ana',name:'Ana Ruiz',kind:'person'},{id:'beto',name:'Beto',kind:'person'},{id:'pa',name:'Public Address',kind:'voice'},{id:'dani',name:'Dani',kind:'person'}],
 locations:[{id:'plaza',name:'Plaza',environment:'env-a'},{id:'nave',name:'Nave',modelSpace:{model:'m/b.json',room:'r'}},{id:'bosque',name:'Bosque'}],
 environments:[{id:'env-a',builder:'m/a.js',data:'m/a.json',sequences:['f3']},{id:'env-b',builder:'m/b.js',data:'m/b.json'}],
 storyboards:[
  {id:'sb1',title:'Uno',outlineSequence:'f1',version:1,sequences:[{id:'sc1',title:'Escena uno',location:'plaza',shots:[
   {id:'P1',code:'A1',title:'Llegada',duration:4,cast:['ana'],dialogue:[{who:'Ana',text:'Hola.'},{who:'BETO',text:'Aquí.'},{who:'Nadie',channel:'ext',text:'Eco.'},{who:'pa',channel:'pa',text:'Aviso.'}]},
   {id:'P2',code:'A2',title:'Sin planos',duration:3,cast:[],dialogue:[{who:'',text:'Suelta.'}]}]}]},
  {id:'sb2',title:'Uno (v2)',outlineSequence:'f1',version:2,sequences:[{id:'sc2',title:'Escena dos',location:'nave',shots:[
   {id:'P3',code:'B1',title:'Dentro',duration:5,cast:['ana','beto'],dialogue:[{character:'beto',who:'X',text:'Vamos.'}]}]}]}],
 episodes:[
  {id:'e1',title:'Acto I',sequences:[
   {id:'f1',title:'Ficha uno',silent:false,cast:[],shots:[],minutes:3,currentStoryboard:'sb2'},
   {id:'c1',title:'Planos v1',storyboard:'sb1',location:'plaza',silent:true,cast:[{character:'ana',x:0,z:0,yaw:0}],shots:[
    relShot('t1',{storyboardShot:'P1',lines:[line('l1','ana',{offscreen:false}),line('l2','beto',{offscreen:true})]}),relShot('t2')]},
   {id:'c2',title:'Planos v2',storyboard:'sb2',location:'nave',silent:true,cast:[{character:'ana',x:0,z:0,yaw:0},{character:'beto',x:1,z:0,yaw:0}],shots:[
    relShot('t3',{storyboardShot:'P3',visibleCast:['beto'],location:'bosque',lines:[line('l3','pa',{channel:'pa'})]})]},
   {id:'k1',title:'Prueba',test:true,location:'plaza',silent:true,cast:[],shots:[relShot('t4',{storyboardShot:'P3',cast:['beto']})]}]},
  {id:'e2',title:'Acto II',sequences:[
   {id:'f2',title:'Ficha dos',location:'bosque',silent:true,cast:[{character:'beto',x:0,z:0,yaw:0}],shots:[
    relShot('t5',{staging:{proxies:{dani:{x:1,z:2}}}}),relShot('t6',{cast:['ana','fantasma']})]},
   {id:'f3',title:'Ficha tres',silent:false,cast:[],shots:[]}]}]};}
