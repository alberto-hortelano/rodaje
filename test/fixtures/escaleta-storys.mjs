// Proyecto de prueba para #56 (escaleta → story → planos), sin migrar: dos versiones de un story con su secuencia de planos cada una
// (la primera con los campos de escaleta), un story sin planos con su ficha del mismo título, una secuencia suelta con planos y una prueba.
// La spec de migración las deja en una ficha nueva con v1 y v2 (v2 vigente), el story sin planos en su ficha y las dos sueltas como pruebas.
const cam=()=>({position:[4,2.5,7],target:[0,1,0],fov:45});
export const planShot=(id,storyboardShot,extra={})=>({id,title:id,description:'',duration:5,camera:cam(),cameraEnd:cam(),lines:[],history:[],...(storyboardShot?{storyboardShot}:{}),...extra});
const vin=(id,code,extra={})=>({id,code,title:'Viñeta '+code,duration:4,cast:['ana'],dialogue:[],...extra});
export function storysProject(){return {id:'escaleta',name:'Escaleta',type:'pelicula',language:'en',revision:3,ideas:[],issues:[],
 characters:[{id:'ana',name:'Ana'},{id:'bea',name:'Bea'}],locations:[{id:'loc',name:'Loc'},{id:'otro',name:'Otro'}],
 storyboards:[
  {id:'sb-v1',title:'Prólogo · El Colgado',sequences:[{id:'sb-v1-e1',title:'Cruce',location:'loc',shots:[vin('v1a','A01'),vin('v1b','A02')]}]},
  {id:'sb-carga',title:'Prólogo · La carga',sequences:[{id:'sb-carga-e1',title:'Carga',location:'otro',shots:[vin('ca','A01'),vin('cb','A02'),vin('cc','A03')]}]},
  {id:'sb-v2',title:'Prólogo · El Colgado (v2)',sequences:[{id:'sb-v2-e1',title:'Camino',location:'loc',shots:[vin('v2a','A01'),vin('v2b','A02'),vin('v2c','A03')]}]}],
 episodes:[
  {id:'e1',title:'Acto I',sequences:[
   {id:'x-v1',title:'Prólogo · El Colgado',storyboard:'sb-v1',location:'loc',silent:true,cast:[{character:'ana',x:0,z:0,yaw:0}],minutes:4,text:'Texto de la ficha.',coverPrompt:'Prompt de carátula.',shots:[planShot('p1','v1a'),planShot('p2','v1b')]},
   {id:'x-v2',title:'Prólogo · El Colgado (v2)',storyboard:'sb-v2',location:'loc',silent:true,cast:[],minutes:7,text:'Texto de la v2.',shots:[planShot('p3','v2a'),planShot('p4','v2b'),planShot('p5','v2c')]},
   {id:'x-prologo',title:'Prólogo · La carga',silent:false,cast:[],shots:[],minutes:3,text:'La carga.',cover:'assets/c.png',covers:[{file:'assets/c.png'}]},
   {id:'x-camino',title:'El camino',silent:false,cast:[],shots:[],minutes:2,text:'Camino.'},
   {id:'x-fuego',title:'El fuego',location:'loc',silent:true,cast:[],shots:[planShot('p6'),planShot('p7')],minutes:2},
   {id:'x-cruce',title:'Prueba 3D · El cruce',location:'loc',silent:true,cast:[],shots:[planShot('p8')],minutes:.5}]},
  {id:'e2',title:'Acto II',sequences:[{id:'y-uno',title:'Uno',silent:false,cast:[],shots:[],minutes:5}]}]};}
export const storysSpec=()=>({fichas:[{id:'x-colgado',from:'x-v1',title:'Prólogo · El Colgado'}],enlaces:{'sb-v1':'x-colgado','sb-v2':'x-colgado','sb-carga':'x-prologo'},vigentes:{'x-colgado':'sb-v2'},pruebas:['x-cruce','x-fuego']});
