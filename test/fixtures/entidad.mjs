// Registro de prueba para #60 (assets de personaje y ambiente). Textos inventados.
export const entityRegistry=()=>({version:1,summary:'x',assets:{
 ANA_ROJA:{kind:'character',character:'ana',variant:'roja',file:'personajes/ana/ref/roja.png',proxy:'Crema',voice:'ANA_VOICE',descriptor:'Mujer de rojo.',status:'approved',sha256:'abc',since:'2026-01-01'},
 ANA:{kind:'character',character:'ana',variant:'',file:'personajes/ana/ref/base.png',descriptor:'Mujer.',status:'draft',states:{herida:{drop:['x'],note:'y'},dormida:{note:'z'}}},
 ANA_VOICE:{kind:'voice',character:'ana',file:'',elevenlabs:'abcdefghij0123456789',descriptor:'Voz grave.',status:'approved'},
 BETO_VOICE:{kind:'voice',character:'beto',file:'',minimax:'ttv-1',descriptor:'Voz clara.',status:'draft',sha256:'def'},
 BETO:{kind:'character',character:'beto',variant:'',file:'b.png',descriptor:'Hombre.',status:'approved'},
 GRUPO:{kind:'group',variant:'roja',members:['ANA_ROJA','BETO'],file:'g.png',descriptor:'Los dos.',status:'approved',sha256:'ghi'},
 OTRO_GRUPO:{kind:'group',members:['BETO'],file:'h.png',descriptor:'Solo él.',status:'approved'},
 PLAZA:{kind:'location',location:'plaza',aliases:[],file:'ambientes/plaza/ref/a.png',descriptor:'Plaza.',status:'approved',sha256:'jkl',master:''},
 PLAZA_NOCHE:{kind:'location',location:'otra',aliases:['plaza','plaza-vieja'],file:'n.png',descriptor:'De noche.',status:'draft'},
 NAVE:{kind:'location',location:'nave',aliases:[],file:'v.png',descriptor:'',status:'draft'}}});
