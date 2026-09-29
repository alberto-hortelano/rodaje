// Voz del navegador compartida por el Ensayo y la Animación: preferencias por proyecto (rodaje-tts-<id>) y una utterance por línea.
export function loadVoicePrefs(projectId){try{const v=JSON.parse(localStorage.getItem('rodaje-tts-'+projectId)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
export function saveVoicePrefs(projectId,prefs){try{localStorage.setItem('rodaje-tts-'+projectId,JSON.stringify(prefs));}catch{}}
// params = ttsParams(...). Cancela lo que sonaba; una cancelación o interrupción termina como un final normal; otro error llega a onend(err).
export function speakLine(synth,params,voices,{onstart,onend}={}){synth.cancel();const u=new SpeechSynthesisUtterance(params.text);u.lang=params.lang;u.rate=params.rate;u.pitch=params.pitch;u.voice=(voices||[]).find(v=>v.voiceURI===params.voiceURI)||null;let done=false;const finish=err=>{if(done)return;done=true;onend?.(err);};
 u.onstart=()=>onstart?.();u.onend=()=>finish();u.onerror=e=>finish(['interrupted','canceled'].includes(e.error)?undefined:new Error('La voz no se ha podido reproducir: '+e.error));synth.speak(u);
 return {cancel(){if(done)return;done=true;synth.cancel();}};}
