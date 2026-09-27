// Voz y efectos de sonido. ElevenLabs SOLO a través de fal (derechos de uso comercial; la cuenta propia es no comercial):
// sin llamadas directas a su API. Los constructores de input conservan el orden de claves de los payloads.
import {uploadFile,subscribe,download} from './fal.mjs';
export const ELEVEN_V3='fal-ai/elevenlabs/tts/eleven-v3';
export const ELEVEN_SFX='fal-ai/elevenlabs/sound-effects/v2';
export const ELEVEN_VOICE_CHANGER='fal-ai/elevenlabs/voice-changer';
export const MINIMAX_SPEECH='fal-ai/minimax/speech-02-hd';
export const MINIMAX_VOICE_DESIGN='fal-ai/minimax/voice-design';
export const elevenV3Input=({text,voice,stability,language})=>({text,voice,stability,language_code:language});
export const soundEffectsInput=text=>({text,duration_seconds:22,loop:true,prompt_influence:.3,output_format:'mp3_44100_128'});
// MiniMax no admite etiquetas de interpretación: se quitan los [corchetes].
export const minimaxSpeechInput=({text,voice,speed})=>({text:text.replace(/\[[^\]]*\]\s*/g,''),voice_setting:{voice_id:voice,speed},language_boost:'English',output_format:'url'});
export const voiceChangerInput=({audioUrl,voice})=>({audio_url:audioUrl,voice,remove_background_noise:true});
export const voiceDesignInput=({prompt,previewText})=>({prompt,preview_text:previewText});
async function audioOf(client,endpoint,input,error){const r=await subscribe(client,endpoint,input);const url=r.data?.audio?.url;if(!url)throw Error(error);return download(url);}
// Una frase: model 'minimax' (speech-02-hd, voces de serie o diseñadas) o eleven-v3. Devuelve el mp3 como Buffer.
export function speak(client,{model,text,voice,stability,speed,language}){
 return model==='minimax'?audioOf(client,MINIMAX_SPEECH,minimaxSpeechInput({text,voice,speed:speed??1}),'MiniMax no devolvió audio')
  :audioOf(client,ELEVEN_V3,elevenV3Input({text,voice,stability:stability??.5,language}),'ElevenLabs no devolvió audio');}
// Una grabación por el cambiador de voz. Devuelve el mp3 como Buffer.
export async function changeVoice(client,{file,voice}){const audioUrl=await uploadFile(client,file);return audioOf(client,ELEVEN_VOICE_CHANGER,voiceChangerInput({audioUrl,voice}),'El cambiador de voz no devolvió audio');}
// Voz nueva de MiniMax: {id, url} (url de la muestra o null). No descarga.
export async function designVoice(client,{prompt,previewText}){const r=await subscribe(client,MINIMAX_VOICE_DESIGN,voiceDesignInput({prompt,previewText}));const id=r.data?.custom_voice_id;if(!id)throw Error('MiniMax no devolvió custom_voice_id');return {id,url:r.data?.audio?.url||null};}
