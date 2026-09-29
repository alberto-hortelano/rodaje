// Compatibilidad con app.js en caché; no usar: el catálogo de cada proyecto está en projectVariants, projectZones y projectChannels.
export const variants=[['','Diseño base']],zones=[['other','Sin zona']],channels=[['direct','Directo'],['pa','Voz en off']];
// Texto de aspecto para prompts de imagen/vídeo: el campo `look` si existe; si no, el párrafo "Current visual design" de la descripción; si no, la descripción sin cabeceras ni el bloque de voz (que no aporta nada visual).
export function visualBrief(character){if(character.look?.trim())return character.look.trim();const d=character.description||'';const m=/\*\*Current visual design:?\*\*:?\s*([\s\S]*?)(?:\n\s*\n|$)/.exec(d);if(m)return m[1].replace(/\s+/g,' ').trim();return d.replace(/^#+.*$/gm,'').replace(/\*\*(Voice|Acting|Voice prompt):\*\*[^\n]*/g,'').replace(/\*\*/g,'').replace(/\s+/g,' ').trim();}
export function appearance(character,sequence){const v=sequence.variant&&character.variants?.[sequence.variant];if(!sequence.variant)return {...character,look:visualBrief(character)};return {...character,image:v?.image||null,color:v?.color||character.color,description:character.description+'\n'+(v?.description||''),look:[v?.description?.trim(),visualBrief(character)].filter(Boolean).join(' '),variant:sequence.variant};}
export function validateEvents(events,shot){for(const e of events){if(!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.end<=e.start||e.start<0||e.end>shot.duration+.01)throw Error('Una intervención queda fuera del plano. Ajusta el inicio o alarga el plano.');}for(let i=0;i<events.length;i++)for(let k=i+1;k<events.length;k++){const a=events[i],b=events[k];if(a.start<b.end&&b.start<a.end){if(a.character===b.character)throw Error('Un personaje no puede hablar encima de sí mismo');if(!shot.allowOverlap)throw Error('Hay voces solapadas. Activa el solapamiento intencional o ajusta los inicios.');}}return events;}
export function voiceDirection(p,line){const c=p.characters.find(c=>c.id===line.character),CH=projectChannels(p),name=c?.name||'Speaker',ch=channelOf(CH,line.channel),dir=channelPrompt(CH,line.channel).direction;if(ch.offscreen&&dir)return `${name} ${dir}`;if(lineOffscreen(CH,line))return `${name} speaks OFFSCREEN; do not add a body or animate another person's lips.`;if(dir)return `${name} ${dir}`;return `${name} speaks with natural lip movement.`;}

// ---- Storyboards: viñetas con boceto, fotograma generado, referencias y prompt; se convierten en capítulos.
export function storyboardShot(p,id){for(const sb of p.storyboards||[])for(const s of sb.sequences||[]){const t=(s.shots||[]).find(t=>t.id===id);if(t)return {storyboard:sb,sequence:s,shot:t};}throw Error('Plano de storyboard no encontrado');}
// Prompt de imagen del plano: el explícito si existe; si no, se compone con boceto, estilo del proyecto, acción, cámara y reparto.
export function storyboardPrompt(p,sb,s,t){if(t.prompt?.trim())return t.prompt.trim();const parts=[];if(t.sketch)parts.push('Image 1 is a rough storyboard line sketch of this exact shot. Follow its framing, subject placement, relative scale and any arrow direction precisely; ignore its line style, paper texture and every annotation or label drawn on it, none of which may appear in the output.');parts.push(p.style||'');if(sb.style?.trim())parts.push(sb.style.trim());parts.push([t.action,t.camera?`Lens and camera: ${t.camera}.`:''].filter(Boolean).join(' '));const cast=(t.cast||[]).map(id=>p.characters.find(c=>c.id===id)).filter(Boolean);if(cast.length)parts.push(`Cast in this frame: ${cast.map(c=>`${c.name}: ${visualBrief(c).slice(0,500)}`).join('; ')}. Every person must match the supplied character reference sheets exactly; do not add people who are not listed.`);else parts.push('No people in this frame unless the shot description names them.');parts.push('Output one single photographic 16:9 frame: no split panels, no borders, no captions, no watermark.'+(t.avoid?` Avoid: ${t.avoid}.`:''));return parts.filter(Boolean).join('\n\n');}
// Inicios del diálogo de una viñeta sin plano: n líneas repartidas desde 0,5 s en la duración menos 1 s, a décimas, sin pasar de duración−0,5.
export function spreadDialogue(n,duration){const step=n?Math.max(0,duration-1)/n:0;return Array.from({length:n},(_,i)=>Math.min(duration-.5,Math.round((.5+i*step)*10)/10));}
// Convierte un storyboard en un capítulo editable: cada viñeta es un plano; el diálogo se reparte en el tiempo del plano; todas las voces quedan fuera de campo hasta colocar el reparto 3D.
export function storyboardToEpisode(p,sb,newId=()=>crypto.randomUUID()){
return {id:newId(),title:sb.title||'Capítulo desde storyboard',synopsis:sb.description||'',storyboard:sb.id,sequences:(sb.sequences||[]).map(s=>{const shots=(s.shots||[]);return {id:newId(),title:s.title||'Secuencia',location:p.locations.some(l=>l.id===s.location)?s.location:(p.locations[0]?.id||''),variant:zoneVariant(p,shots[0]?.zone),ambiencePrompt:shots.map(t=>t.sound).filter(Boolean)[0]||'',ambienceGain:.18,silent:false,cast:[],props:[],storyboardSequence:s.id,shots:shots.map(t=>{const {cast,staging,...rest}=storyboardShotDraft(p,t,{newId});return rest;})};})};}
// Plano nuevo de una viñeta (#51): duración 1–15, hablante con resolveSpeaker (las líneas sin personaje no pasan), diálogo repartido; cada línea va fuera de campo si su personaje no está en castIds.
// cast: los personajes físicos de la viñeta; staging vacío.
export function storyboardShotDraft(p,t,{newId=()=>crypto.randomUUID(),castIds=[]}={}){const speaker=speakerResolver(p);const cam=()=>({position:[4,2.5,7],target:[0,1,0],fov:45});
 const duration=Math.max(1,Math.min(15,Number(t.duration)||5));const lines=(t.dialogue||[]).map(l=>({...l,character:speaker(l)})).filter(l=>l.character);const starts=spreadDialogue(lines.length,duration);
 return {id:newId(),title:[t.code,t.title].filter(Boolean).join(' · ')||'Plano',description:[t.action,t.camera?`Cámara: ${t.camera}`:''].filter(Boolean).join('\n'),duration,camera:cam(),cameraEnd:cam(),lines:lines.map((l,i)=>({id:newId(),character:l.character,text:String(l.text||''),start:starts[i],offscreen:!castIds.includes(l.character),...(l.channel?{channel:l.channel}:{})})),history:[],storyboardShot:t.id,...(t.render?{storyboardRender:t.render}:{}),cast:uniq((t.cast||[]).filter(id=>p.characters.some(c=>c.id===id&&c.kind!=='voice'))),staging:{}};}
// Diálogo al reaplicar una viñeta: cada línea nueva se empareja con la primera anterior sin usar del mismo personaje y texto, que se conserva entera
// (id, audio, start, offscreen); las demás entran nuevas con el inicio dentro del plano y las anteriores sin pareja se descartan.
export function mergeStoryboardLines(prev,next,duration=Infinity){const used=new Set();return (next||[]).map(n=>{const i=(prev||[]).findIndex((l,k)=>!used.has(k)&&l?.character===n.character&&l?.text===n.text);if(i>=0){used.add(i);return structuredClone(prev[i]);}return {...n,start:Math.max(0,Math.min(n.start,duration-.5))};});}
// Fusión de un plano con su viñeta (storyboard-3d y storyboard-a-secuencia). Sin prev, el borrador (con cámara fija y preset si llegan).
// Con prev, la viñeta manda en título, descripción, duración, enlace, fotograma y texto del diálogo; lo demás se conserva. La cámara solo entra si
// el plano no tiene cameraRig, o con force; el preset, si falta o con force. changed: claves de primer nivel que cambian.
export function mergeStoryboardShot(prev,draft,{camera=null,preset=null,force=false}={}){
 const setCamera=t=>{t.camera=camCopy(camera);t.cameraEnd=camCopy(camera);t.cameraRig={type:'fixed',start:camCopy(camera)};},setPreset=t=>{const st=isObj(t.staging)?t.staging:{},env=isObj(st.environment)?st.environment:{};if(force||env.preset===undefined)t.staging={...st,environment:{...env,preset}};};
 if(!prev){const shot=structuredClone(draft);if(camera)setCamera(shot);if(preset)setPreset(shot);return {shot,changed:Object.keys(shot)};}
 const shot={...structuredClone(prev),title:draft.title,description:draft.description,duration:draft.duration,storyboardShot:draft.storyboardShot,lines:mergeStoryboardLines(prev.lines,draft.lines,draft.duration)};
 if(draft.storyboardRender)shot.storyboardRender=draft.storyboardRender;else delete shot.storyboardRender;
 if(!Array.isArray(prev.cast)&&Array.isArray(draft.cast))shot.cast=[...draft.cast];
 if(camera&&(force||!isObj(prev.cameraRig)))setCamera(shot);if(preset)setPreset(shot);
 return {shot,changed:uniq([...Object.keys(prev),...Object.keys(shot)]).filter(k=>JSON.stringify(prev[k])!==JSON.stringify(shot[k]))};}
// Reparto de la secuencia: conserva las colocaciones que ya hay y coloca en semicírculo (radio 3 × 2 m) los ids que faltan.
export function castPlacements(existing,ids){const out=(existing||[]).map(a=>({...a})),have=new Set(out.map(a=>a.character));ids.forEach((character,i)=>{if(have.has(character))return;const a=Math.PI*(i+.5)/ids.length;out.push({character,x:Math.round(Math.cos(a)*300)/100,z:Math.round(-Math.sin(a)*200)/100,yaw:0});});return out;}
// Rellena (o vuelve a aplicar) una secuencia con todas las viñetas de un storyboard, en orden: un plano por viñeta con mergeStoryboardShot.
// Los planos sin viñeta, de viñetas que ya no están o repetidos se conservan detrás del plano que tenían delante, con un aviso. Las líneas de diálogo sin personaje, también con aviso (#58).
export function storyboardSequenceMerge(p,sb,seq,newId=()=>crypto.randomUUID()){const physical=id=>p.characters.some(c=>c.id===id&&c.kind!=='voice');const shots=(sb.sequences||[]).flatMap(s=>s.shots||[]);const ids=[...new Set(shots.flatMap(t=>t.cast||[]))].filter(physical);
 const location=storyLocation(p,sb),old=seq.shots||[],used=new Set(),warnings=[],sbIds=new Set(shots.map(t=>t.id));
 const out=shots.map(v=>{const k=old.findIndex((t,i)=>!used.has(i)&&t.storyboardShot===v.id);if(k>=0)used.add(k);return {k:k>=0?k:null,shot:mergeStoryboardShot(k>=0?old[k]:null,storyboardShotDraft(p,v,{newId,castIds:ids})).shot};});
 old.forEach((t,k)=>{if(used.has(k))return;const name=`«${t.title||t.id}» (${t.id})`;warnings.push(!t.storyboardShot?`${name} no viene del storyboard: se conserva en su sitio`:sbIds.has(t.storyboardShot)?`${name} repite la viñeta ${t.storyboardShot}: se conserva aparte`:`${name}: su viñeta ${t.storyboardShot} ya no está en el storyboard; se conserva en su sitio`);
  let at=0,best=-1;out.forEach((x,i)=>{if(x.k!==null&&x.k<k&&x.k>best){best=x.k;at=i+1;}});out.splice(at,0,{k,shot:structuredClone(t)});});
 warnings.push(...storyboardDialogueWarnings(p,sb));
 return {sequence:{...seq,location,cast:castPlacements(seq.cast,ids),storyboard:sb.id,shots:out.map(x=>x.shot)},warnings};}
// Compatible con la versión anterior: la secuencia de storyboardSequenceMerge, sin los avisos.
export function storyboardToSequence(p,sb,seq,newId=()=>crypto.randomUUID()){return storyboardSequenceMerge(p,sb,seq,newId).sequence;}
// Posición de un plano nuevo de la viñeta sbShotId: justo después del último plano cuya viñeta va antes en order (ids de viñeta); si no hay, 0.
export function storyboardInsertIndex(shots,order,sbShotId){const pos=order.indexOf(sbShotId);let at=0;(shots||[]).forEach((t,i)=>{const k=order.indexOf(t?.storyboardShot);if(k>=0&&k<pos)at=i+1;});return at;}
// Viñeta de un storyboard por id o por código; un código repetido es un error con los ids.
export function findStoryboardShot(sb,key){const all=(sb?.sequences||[]).flatMap(s=>(s.shots||[]).map(shot=>({sequence:s,shot})));const byId=all.find(x=>x.shot.id===key);if(byId)return byId;const byCode=all.filter(x=>x.shot.code===key);
 if(byCode.length>1)throw Error(`El código ${key} se repite en el storyboard (${byCode.map(x=>x.shot.id).join(', ')}): usa el id de la viñeta`);if(!byCode.length)throw Error('Viñeta no encontrada en el storyboard: '+key);return byCode[0];}
// Fichero de cámaras del story (docs/scripts.md): {version, storyboard, entorno?, planos:[{code, camera:{position, target, fov}, momento?}]}; ignora el resto de campos.
export function parseShotCameras(json){const errors=[],byCode=new Map();if(!isObj(json)||!Array.isArray(json.planos))return {entorno:null,storyboard:null,byCode,errors:['El fichero de cámaras necesita una lista «planos»']};
 json.planos.forEach((x,i)=>{const at=`planos[${i}]`;if(!isObj(x)||typeof x.code!=='string'||!x.code)return errors.push(at+': falta code');if(byCode.has(x.code))return errors.push(`${at}: code ${x.code} repetido`);const c=x.camera;let camera=null;
  if(c!==undefined){if(!isObj(c)||!vec3(c.position)||!vec3(c.target)||!(Number.isFinite(c.fov)&&c.fov>=CAMERA_FOV[0]&&c.fov<=CAMERA_FOV[1]))return errors.push(`${x.code}: camera necesita position y target de 3 números y fov entre ${CAMERA_FOV[0]} y ${CAMERA_FOV[1]}`);camera=camCopy(c);}
  if(x.momento!==undefined&&(typeof x.momento!=='string'||!x.momento))return errors.push(`${x.code}: momento debe ser el id de un preset`);byCode.set(x.code,{camera,momento:x.momento||null});});
 return {entorno:typeof json.entorno==='string'&&json.entorno?json.entorno:null,storyboard:typeof json.storyboard==='string'?json.storyboard:null,byCode,errors};}
// Avisos de aplicar una cámara del fichero: sus coordenadas son del modelo, así que solo cuadran sin spot ni rotation en el entorno efectivo del plano.
export function cameraFileWarnings({envCfg,environmentId,fileEnv,momento,presetIds}={}){const w=[];if(!environmentId)w.push('El ambiente del plano no tiene entorno 3D: la cámara del fichero no tiene decorado de referencia');
 if(fileEnv&&environmentId&&fileEnv!==environmentId)w.push(`El fichero es del entorno ${fileEnv} y el plano usa ${environmentId}`);
 if(isObj(envCfg)&&(envCfg.spot||Number(envCfg.rotation)))w.push(`El entorno del plano tiene ${[envCfg.spot?'spot '+envCfg.spot:'',Number(envCfg.rotation)?'rotation '+envCfg.rotation:''].filter(Boolean).join(' y ')}: las coordenadas del fichero (respecto al origen del modelo) no cuadran`);
 if(momento&&Array.isArray(presetIds)&&!presetIds.includes(momento))w.push(`El momento ${momento} no es un preset del entorno (${presetIds.join(', ')||'ninguno'})`);return w;}

// ---- Producción por bloques (docs/PROCESO.md). Funciones puras, sin dependencias de Node: también se cargan en el navegador.
// Escalera de óptica por FOV horizontal (grados) con su equivalente en mm de paso completo y una frase observable, no metadatos de lente.
export const FOV_LADDER=[
  {mm:70,h:28.8,text:'long lens: background compressed close behind the subject, shallow focus isolates the face, no perspective stretch'},
  {mm:50,h:39.6,text:'normal lens: natural proportions, background at its true distance, no distortion'},
  {mm:35,h:54.4,text:'moderate wide: straight verticals, whole bodies and the near set readable, faces undistorted at arm\'s length'},
  {mm:28,h:65.5,text:'wide: the near foreground reads slightly larger, the set stays visible to the frame edges, straight lines stay straight'},
  {mm:24,h:73.7,text:'wide: immediate foreground large and close, deep focus, the set spreads to every edge, verticals stay rectilinear'},
  {mm:18,h:90,text:'very wide rectilinear: extreme depth, foreground exaggerated, straight lines stay straight out to the edges'}];
// Three.js guarda el FOV vertical; el modelo entiende mejor el horizontal.
export function horizontalFov(vertical,aspect=16/9){const v=vertical*Math.PI/180;return 2*Math.atan(Math.tan(v/2)*aspect)*180/Math.PI;}
export function opticsAnchor(vertical,aspect=16/9){const h=horizontalFov(vertical,aspect);let best=FOV_LADDER[0];for(const a of FOV_LADDER)if(Math.abs(a.h-h)<Math.abs(best.h-h))best=a;return {...best,h:Math.round(h)};}
export function opticsLine(vertical,aspect=16/9){const a=opticsAnchor(vertical,aspect);return `${a.h}° horizontal field of view (about ${a.mm} mm full-frame equivalent), ${a.text}. One lens for the whole take; no zoom or focal drift.`;}
// Reloj real del modelo: ~4 palabras por segundo, más los silencios escritos, más 1 s de cola limpia. Devuelve los segundos que necesita el diálogo del bloque.
export function dialogueBudget(lines,{rate=4,tail=1}={}){let end=0;for(const l of lines||[]){const words=String(l.spokenText||l.text||'').trim().split(/\s+/).filter(Boolean).length;end=Math.max(end,(Number(l.start)||0)+words/rate);}return lines?.length?end+tail:0;}
// Dónde cae un punto del set en el cuadro de una cámara: lado (left/centre/right), profundidad relativa y si entra en el campo horizontal.
export function framePosition(camera,point,aspect=16/9){const [cx,cy,cz]=camera.position,[tx,ty,tz]=camera.target;let fx=tx-cx,fz=tz-cz;const fl=Math.hypot(fx,fz)||1;fx/=fl;fz/=fl;const rx=-fz,rz=fx;const dx=point[0]-cx,dz=point[2]-cz;const depth=dx*fx+dz*fz,lateral=dx*rx+dz*rz;const angle=Math.atan2(lateral,Math.max(depth,1e-6))*180/Math.PI,half=horizontalFov(camera.fov,aspect)/2;const side=Math.abs(angle)<half/3?'centre':angle>0?'right':'left';return {side,depth:Math.hypot(dx,dz),angle,visible:depth>0&&Math.abs(angle)<half};}
function depthLabel(d,all){if(all.length<2)return 'midground';const sorted=[...all].sort((a,b)=>a-b);if(d<=sorted[0]+.01)return 'foreground';if(d>=sorted.at(-1)-.01)return 'background';return 'midground';}
// Nombre corto en mayúsculas para el prompt (primera palabra del nombre, como en los prompts aceptados).
export function shortName(project,id){const c=project?.characters?.find(c=>c.id===id);return String(c?.name||id).trim().split(/\s+/)[0].toUpperCase();}
// Nombres cortos únicos: shortName salvo que choque con el de otro personaje del proyecto o de ids; entonces characterName (prefijo del descriptor del registro) y, si aún choca dentro de ids, el nombre completo en mayúsculas.
export function uniqueNames(project,registry,ids){const list=[...new Set(ids)],pick=(fn,xs,among=xs)=>{const n=Object.fromEntries(among.map(id=>[id,fn(id)])),count={};for(const id of among)count[n[id]]=(count[n[id]]||0)+1;return {n,dup:xs.filter(id=>count[n[id]]>1)};};
 const {n,dup}=pick(id=>shortName(project,id),list,[...new Set([...list,...(project?.characters||[]).map(c=>c.id)])]);const names={...n};if(dup.length){const r=pick(id=>characterName(registry,project,id),dup);Object.assign(names,r.n);for(const id of r.dup)names[id]=String(project?.characters?.find(c=>c.id===id)?.name||id).trim().toUpperCase();}
 return id=>Object.hasOwn(names,id)?names[id]:shortName(project,id);}
// Nombre fijo del asset de personaje en el registro.
export function tagFor(id,variant){return `${String(id).toUpperCase()}_${String(variant||'base').toUpperCase()}`;}
export function findAsset(registry,pred){return Object.entries(registry?.assets||{}).find(([,a])=>pred(a));}
// Referencias del bloque, siempre por tag: imágenes de los personajes visibles, la foto de grupo si existe, la plate del ambiente y las voces de quien habla en cuadro.
export function resolveRefs({sequence,block,registry,shots},{maxImages=8,channels=projectChannels(null)}={}){const assets=registry?.assets||{},errors=[];const need=tag=>{const a=assets[tag];if(!a)errors.push(`Falta en el registro: ${tag}`);else if(a.status!=='approved')errors.push(`Asset sin aprobar: ${tag}`);return a;};const cast=blockCastIds({sequence,block,shots});const images=cast.map(id=>{const tag=tagFor(id,sequence.variant);const a=need(tag);return {tag,role:'character',character:id,file:a?.file,descriptor:a?.descriptor,proxy:a?.proxy};});const group=findAsset(registry,a=>a.kind==='group'&&a.status==='approved'&&a.variant===sequence.variant&&(a.members||[]).every(m=>images.some(i=>i.tag===m)));if(group)images.push({tag:group[0],role:'group',file:group[1].file,descriptor:group[1].descriptor});const plate=findAsset(registry,a=>a.kind==='location'&&(a.location===sequence.location||(a.aliases||[]).includes(sequence.location)));if(plate){if(plate[1].status!=='approved')errors.push(`Asset sin aprobar: ${plate[0]}`);images.push({tag:plate[0],role:'location',file:plate[1].file,descriptor:plate[1].descriptor});}else errors.push(`Falta la plate del ambiente ${sequence.location} en el registro`);for(const tag of block.extraRefs||[]){const a=need(tag);images.push({tag,role:a?.kind||'extra',file:a?.file,descriptor:a?.descriptor});}if(images.length>maxImages)errors.push(`Demasiadas imágenes de referencia: ${images.length} > ${maxImages}`);const speakers=[...new Set(spokenLines(block,shots,channels).map(l=>l.character))];const audios=speakers.map(id=>{const tag=`${String(id).toUpperCase()}_VOICE`;const a=need(tag);return {tag,character:id,file:a?.file,descriptor:a?.descriptor};});return {images,audios,video:'motion.mp4',errors};}
// Líneas que sí genera el modelo: en cuadro y con cuerpo. Las fuera de campo (marcadas o por un canal offscreen del catálogo) se producen aparte y se montan en post.
export function spokenLines(block,shots,channels=projectChannels(null)){return (block.parts||[]).flatMap(part=>(part.lines||[]).filter(l=>!lineOffscreen(channels,l)).map(l=>({...l,start:part.at+l.start})));}
export function offscreenLines(block,shots,channels=projectChannels(null)){return (block.parts||[]).flatMap(part=>(part.lines||[]).filter(l=>lineOffscreen(channels,l)).map(l=>({...l,start:part.at+l.start})));}
export const EMOTION_WORDS=['sad','sadly','sadness','angry','angrily','anger','afraid','scared','fear','fearful','happy','happily','nervous','nervously','excited','worried','terrified','furious'];
export function forbiddenEmotionWords(text){const found=new Set();for(const w of EMOTION_WORDS)if(new RegExp(`\\b${w}\\b`,'i').test(text))found.add(w);return [...found];}
// Solo se admiten tres negativos literales; todo lo demás se escribe como resultado (R21).
export const NEGATIVE_WHITELIST=['Do not add any other words','never duplicate those views as extra people','No empty establishing frame','no zoom or focal drift'];
export function strayNegatives(text){const out=[];text=String(text).replace(/<d>[\s\S]*?<\/d>/g,'');for(const m of text.matchAll(/\b(no|never|do not|don't)\b[^.;\n]*/gi)){const s=m[0].trim();if(!NEGATIVE_WHITELIST.some(w=>s.toLowerCase().startsWith(w.toLowerCase())))out.push(s);}return out;}
// Matices de un movimiento de cámara de a a b para el prompt: acercarse o alejarse del sujeto, subir o bajar.
export function moveParts(a,b){const d0=Math.hypot(a.target[0]-a.position[0],a.target[2]-a.position[2]),d1=Math.hypot(b.target[0]-b.position[0],b.target[2]-b.position[2]);const parts=[];if(Math.abs(d1-d0)>.3)parts.push(d1<d0?'ending closer to the subject':'ending farther from the subject');if(Math.abs(b.position[1]-a.position[1])>.2)parts.push(b.position[1]>a.position[1]?'rising':'lowering');return parts;}
const HANDHELD_TAIL=': operator on foot, small breathing sway, one unbroken take from first frame to last.';
const withParts=parts=>parts.length?', '+parts.join(' and '):'';
// CAMERA del prompt según t.cameraRig (#49); sin rig: estaciones de cobertura, cámara fija o movimiento en mano entre camera y cameraEnd.
export function cameraLine(shot,{nameOf=id=>id}={}){const rig=isObj(shot.cameraRig)?shot.cameraRig:null;if(rig)return rigCameraLine(rig,shot.duration,nameOf);const cov=(shot.coverage||[]).filter(c=>c.camera);if(cov.length>1)return `Video 1 cuts between ${cov.length} locked-off camera stations (cuts at ${cov.slice(1).map(c=>c.start.toFixed(1)+'s').join(', ')}); follow every cut and every station exactly. Every camera move stays one continuous move.`;const a=shot.camera,b=shot.cameraEnd||shot.camera;const same=['position','target'].every(k=>a[k].every((v,i)=>Math.abs(v-b[k][i])<.01));const height=a.position[1].toFixed(1);if(same)return `Locked-off camera at ${height} m above the floor, exactly as in Video 1; the operator does not move.`;return `One continuous handheld move exactly as in Video 1${withParts(moveParts(a,b))}${HANDHELD_TAIL}`;}
function rigCameraLine(rig,duration,nameOf){const a=rig.start,height=a.position[1].toFixed(1),name=nameOf(rig.follow?.character);
 if(rig.type==='move'){const [h0,h1]=Array.isArray(rig.hold)?rig.hold:[0,1],waits=[];if(h0>0&&Number.isFinite(duration))waits.push(`the camera waits still until ${(h0*duration).toFixed(1)}s`);if(h1<1&&Number.isFinite(duration))waits.push(`it settles at ${(h1*duration).toFixed(1)}s and holds to the end`);return `One smooth continuous dolly/track move exactly as in Video 1${withParts(moveParts(a,rig.end))}${waits.length?'; '+waits.join(' and '):''}: camera on a dolly, steady and level, one unbroken take from first frame to last.`;}
 if(rig.type==='handheld')return `One continuous handheld move exactly as in Video 1${withParts(isObj(rig.end)?moveParts(a,rig.end):[])}${HANDHELD_TAIL}`;
 if(rig.type==='follow'&&rig.follow?.mode==='track')return `The camera travels with ${name} exactly as in Video 1, keeping a constant distance and angle to ${name}, one smooth unbroken take from first frame to last.`;
 if(rig.type==='follow')return `Camera planted at ${height} m above the floor exactly as in Video 1; it only pans and tilts to keep ${name} in frame, one smooth unbroken take from first frame to last.`;
 if(rig.type==='track'){const k=(Array.isArray(rig.track)?rig.track:[]).filter(isObj);return `One continuous camera move along the recorded path of Video 1${k.length>1?withParts(moveParts(k[0],k.at(-1))):''}, following its every turn and change of speed exactly, one unbroken take from first frame to last.`;}
 return `Locked-off camera at ${height} m above the floor, exactly as in Video 1; the operator does not move.`;}
// ---- Reparto del prompt por plano (#48). Un plano puede declarar cast (ids) y staging.proxies {id:{x,z}} para figuras del entorno que no son actores del ensayo.
const uniq=a=>[...new Set(a)];
const proxiesOf=shot=>isObj(shot?.staging?.proxies)?shot.staging.proxies:{};
// Reparto de un plano: su cast si lo declara; si no, el de la secuencia más sus proxies.
export function shotCast(shot,sequence){if(Array.isArray(shot?.cast))return [...shot.cast];return uniq([...(sequence?.cast||[]).map(a=>a.character),...Object.keys(proxiesOf(shot))]);}
// block.cast de planificar: null si ningún plano lo declara; si alguno, la unión ordenada (un plano sin cast aporta el reparto de la secuencia).
export function planBlockCast(parts,shotsById,sequence){const ts=(parts||[]).map(p=>shotsById?.[p.shot]);if(!ts.some(t=>Array.isArray(t?.cast)))return null;return uniq(ts.flatMap(t=>shotCast(t,sequence)));}
// Las hojas del reparto más las imágenes fijas (la plate) caben en el máximo del modelo.
export function blockCastFits(ids,{maxImages=8,fixed=1}={}){return ids.length+fixed<=maxImages;}
// Reparto del bloque: block.cast si existe; si no, la unión de los repartos de sus planos (sin cast ni proxies, el de la secuencia).
export function blockCastIds({sequence,block,shots}){if(Array.isArray(block?.cast))return [...block.cast];const parts=block?.parts||[];return parts.length?uniq(parts.flatMap(p=>shotCast(shots?.[p.shot],sequence))):shotCast(null,sequence);}
// Posición en t=0 de un actor con staging.moves, como stage.js (position = at + delta·(f−1), glide-out = at + delta·f): glide-out empieza en su marca; walk, glide-in y el resto, en marca − delta.
export function moveStart(x,z,move){if(!isObj(move)||!Array.isArray(move.delta)||move.kind==='glide-out')return {x,z};const [dx=0,,dz=0]=move.delta;return {x:x-(Number(dx)||0),z:z-(Number(dz)||0)};}
// Quién está en el fotograma 0: colocación efectiva (#47) de los del reparto de la secuencia y {x,z} de los proxies; depthLabel solo entre visibles. Con cameraRig, la cámara es cameraAt en el inicio del bloque.
export function firstFrameCast({sequence,shot,block=null,shots=null,R=null}){const camera=isObj(shot.cameraRig)?cameraAt(shot.cameraRig,block?.parts?.[0]?.from??0,shot.duration,cameraContext({shot,sequence,R})):(shot.coverage||[]).find(c=>c.camera&&c.start<=0.01)?.camera||shot.camera;const ids=block?blockCastIds({sequence,block,shots}):shotCast(shot,sequence),proxies=proxiesOf(shot),people=[],unplaced=[];
 for(const id of ids){const c=(sequence?.cast||[]).find(a=>a.character===id);let x,z,proxy=false;if(c){const pl=effectivePlacement(c,shot.staging?.placements?.[id]);({x,z}=moveStart(pl.x,pl.z,shot.staging?.moves?.[id]));}else if(isObj(proxies[id])&&Number.isFinite(proxies[id].x)&&Number.isFinite(proxies[id].z)){({x,z}=proxies[id]);proxy=true;}else{unplaced.push(id);continue;}
  const p=framePosition(camera,[x,0,z]);people.push({character:id,x,z,proxy,visible:p.visible,side:p.side,depth:p.depth});}
 const depths=people.filter(p=>p.visible).map(p=>p.depth);for(const p of people)p.label=p.visible?depthLabel(p.depth,depths):null;
 return {camera,people,visible:people.filter(p=>p.visible).map(p=>p.character),outside:people.filter(p=>!p.visible).map(p=>p.character),unplaced};}
// Gente de fondo según el sitio: 'people' (pueblo, calle) o 'none' (por defecto: nadie más en todo el paisaje).
export function locationBackground(location){return location?.background==='people'?'people':'none';}
const backgroundFigures=people=>`small distant background figures of ${people||'passers-by'} well behind them`;
// Recuento de visibles; lo comparten FIRST FRAME y summary. Sin punto final.
export function visibleCountPhrase(n,{background='none',people=null}={}){if(n===0)return 'Nobody is visible';const who=n===1?'person':'people';return background==='people'?`Exactly ${n} named ${who} visible, with ${backgroundFigures(people)}`:`Exactly ${n} ${who} visible`;}
export function outsideFrameSentence(names){if(!names?.length)return '';return `${names.length>1?names.slice(0,-1).join(', ')+' and '+names.at(-1):names[0]} ${names.length>1?'are':'is'} outside the frame at the start.`;}
const EMPTY_FRAME='The first visible frame already shows the empty set exactly as framed in Video 1 frame 0. No empty establishing frame is needed: the set itself is the subject.';
const countOpts=(registry,location)=>({background:locationBackground(location),people:labelOk(registry?.texts?.people)?registry.texts.people:null});
function firstFrameText(F,{project,map,registry,location,nameOf=id=>shortName(project,id)}){const vis=F.people.filter(p=>p.visible),out=outsideFrameSentence(F.outside.map(nameOf)),count=visibleCountPhrase(vis.length,countOpts(registry,location));
 if(!vis.length)return F.outside.length?`${EMPTY_FRAME} ${out} ${count}.`:EMPTY_FRAME;
 const names=vis.map(p=>{const lm=nearestLandmark(map,[p.x,p.z]);return `${nameOf(p.character)} frame-${p.side}, ${p.label}${lm?`, ${lm}`:''}`;});
 return `The first visible frame already contains ${names.join('; ')}, in the positions of Video 1 frame 0.${out?' '+out:''} ${count}. No empty establishing frame.`;}
// Frase de primer fotograma: cada cuerpo visible con su lado de cuadro, su profundidad y el landmark más cercano del mapa; los de fuera de cuadro, aparte y sin contarlos.
export function firstFrameLine({sequence,shot,project,map,block=null,shots=null,registry=null,location=null}){const F=firstFrameCast({sequence,shot,block,shots,R:rehearsalConfig(project,shot)});return firstFrameText(F,{project,map,registry,location,nameOf:uniqueNames(project,registry,F.people.map(p=>p.character))});}
// Reparto de un plano frente al proyecto y la secuencia.
export function shotCastIssues(shot,sequence,{characters}={}){const errors=[],warnings=[];if(shot?.cast===undefined)return {errors,warnings};const at=shot.id+': ';
 if(!Array.isArray(shot.cast)||!shot.cast.every(x=>typeof x==='string')){errors.push(at+'cast debe ser una lista de ids');return {errors,warnings};}
 const seq=(sequence?.cast||[]).map(a=>a.character),proxies=proxiesOf(shot);
 for(const id of shot.cast){if(Array.isArray(characters)&&!characters.includes(id))errors.push(`${at}cast: «${id}» no es un personaje del proyecto`);else if(!seq.includes(id)&&!Object.hasOwn(proxies,id))warnings.push(`${at}cast: «${id}» no está en el reparto de la secuencia ni en staging.proxies: sin colocación`);}
 return {errors,warnings};}
export const LOCATION_BACKGROUNDS=['none','people'];
export function locationIssues(project){return (project?.locations||[]).filter(l=>l?.background!==undefined&&!LOCATION_BACKGROUNDS.includes(l.background)).map(l=>`ambiente ${l.id}: background debe ser ${LOCATION_BACKGROUNDS.join(' o ')}`);}
export function nearestLandmark(map,xz){const items=map?.landmarks||[];let best=null;for(const l of items)for(const p of l.positions||[]){const d=Math.hypot(p[0]-xz[0],p[1]-xz[1]);if(!best||d<best.d)best={d,label:l.label};}return best?best.d<3.5?`${best.label}`:null:null;}
// Texto de interpretación por personaje: la prosa de la escena si existe; si no, los campos estructurados.
export function actingText(scene,characterIds,project,nameOf=id=>shortName(project,id)){const out=[];for(const id of characterIds){const c=scene?.characters?.[id];if(!c)continue;const name=nameOf(id);if(c.paragraph)out.push(c.paragraph.trim());else{const bits=[];if(c.objective)bits.push(`${name} wants to ${c.objective}`);if(c.obstacle)bits.push(`the obstacle is ${c.obstacle}`);if(c.tactics?.length)bits.push(`tactics in order: ${c.tactics.join(', ')}`);if(c.business)bits.push(`hands busy with ${c.business}`);if(c.beats?.length)bits.push(`visible beats: ${c.beats.join('; ')}`);if(c.tic?.trigger)bits.push(`${c.tic.trigger}: ${c.tic.action}`);if(c.mask_crack)bits.push(c.mask_crack);out.push(bits.join('. ')+'.');}}return out.join('\n');}
// Parser mínimo de MAPA.md: el bloque ```prompt``` es el párrafo que se pega; el bloque ```json landmarks``` da posiciones locales por landmark.
export function parseMapa(md){const prompt=/```prompt\s*\n([\s\S]*?)```/.exec(md||'')?.[1]?.trim()||'';const lm=/```json landmarks\s*\n([\s\S]*?)```/.exec(md||'')?.[1];let landmarks=[];try{landmarks=lm?JSON.parse(lm):[];}catch{landmarks=[];}const axis=/^Eje de 180°:\s*(.+)$/m.exec(md||'')?.[1]?.trim()||'';const side=/^Lado de cámara:\s*(.+)$/m.exec(md||'')?.[1]?.trim()||'';return {prompt,landmarks,axis,side};}
export function actionTiming({block,shots,project,registry=null,nameOf=null}){const lines=[],CH=projectChannels(project),T=promptTexts(registry);const name=nameOf||(id=>shortName(project,id));for(const part of block.parts||[]){const t=shots[part.shot];if(!t)throw Error(`Plano desconocido en el plan: ${part.shot}`);const from=part.at,to=part.at+(part.to-part.from);const action=(t.action||'').trim()||describeTasks(t,project,T,name)||T.tasks.fallback;lines.push(`[${from.toFixed(2)}s–${to.toFixed(2)}s] ${action}`);for(const l of part.lines||[]){const at=(part.at+l.start).toFixed(2);const P=channelPrompt(CH,l.channel);if(lineOffscreen(CH,l))lines.push(`${at}s: an offscreen ${P.offscreen||OFFSCREEN_NOUN} from ${name(l.character)} plays${T.offscreen.where?' '+T.offscreen.where:''} (audio laid in post, not generated here); ${T.people} hear it and keep working, nobody mouths it.`);else lines.push(`At approximately ${at}s, ${name(l.character)}${P.voice?`, ${P.voice},`:''} says exactly: <d>[English] ${(l.spokenText||l.text).trim()}</d>`);}}return lines;}
function describeTasks(t,project,T=promptTexts(null),nameOf=id=>shortName(project,id)){const tasks=t.staging?.tasks||{};const bits=Object.entries(tasks).map(([id,task])=>{const n=nameOf(id);return task&&task!=='idle'?`${n} is already ${task}`:`${n} keeps working at the same spot${T.tasks.idle?', '+T.tasks.idle:''}`;});return bits.join('; ')+(bits.length?'.':'');}
// Genera el prompt del bloque en orden fijo. Devuelve el texto (con huecos [[ACTING]] y [[LOCAL]] si la escena no los aporta), las referencias resueltas y avisos.
export function blockPrompt({project,sequence,shots,block,registry,map,scene,mode='block'}){const CH=projectChannels(project);const refs=resolveRefs({sequence,block,registry,shots},{channels:CH});const warnings=[...refs.errors];const cast=blockCastIds({sequence,block,shots});const nameOf=uniqueNames(project,registry,[...cast,...(block.parts||[]).flatMap(p=>[...(p.lines||[]).map(l=>l.character),...Object.keys(shots[p.shot]?.staging?.tasks||{}),...Object.keys(proxiesOf(shots[p.shot]))])]);const duration=block.duration??Math.ceil(block.length||5);const requested=Math.max(5,Math.ceil(duration));const spoken=spokenLines(block,shots,CH);const budget=dialogueBudget(spoken);if(spoken.length&&budget>duration-1+.01)warnings.push(`Diálogo de ${budget.toFixed(1)} s no cabe en ${duration} s − 1 s de cola (R12)`);const first=shots[block.parts?.[0]?.shot];if(!first)throw Error('El bloque no tiene planos');const zone=promptZone(project,sequence),T=promptTexts(registry);const location=(project.locations||[]).find(l=>l.id===sequence.location),F=firstFrameCast({sequence,shot:first,block,shots,R:rehearsalConfig(project,first)});for(const id of uniq(spoken.map(l=>l.character)))if(!cast.includes(id))warnings.push(`${nameOf(id)} habla en cuadro y no está en el reparto del bloque`);if(F.unplaced.length)warnings.push(`Sin colocación en el primer plano (ni en el reparto de la secuencia ni en staging.proxies): ${F.unplaced.join(', ')}`);const subj=[];let n=0;for(const r of refs.images){n++;if(r.role==='character')subj.push(`<Subject ${n}> ${nameOf(r.character)} is Image ${n} (@${r.tag}): ${r.descriptor||'[[DESCRIPTOR]]'} ${r.proxy?r.proxy+' proxy':'Its proxy'} in Video 1.`.replace(/\s+/g,' ').trim());else if(r.role==='group')subj.push(`<Subject ${n}> Image ${n} (@${r.tag}) shows ${(r.descriptor||'the same people together in this set')}; it fixes how they read next to each other, never adds people.`);else if(r.role==='location')subj.push(`<Subject ${n}> Image ${n} (@${r.tag}): ${r.descriptor||'[[DESCRIPTOR]]'}`);else subj.push(`<Subject ${n}> Image ${n} (@${r.tag}): ${r.descriptor||'[[DESCRIPTOR]]'}`);}
subj.push('<Video 1> is the approved 3D guide for this exact segment: framing, camera path, actor positions, paths, prop contact, gravity state and speech timing. Each proxy becomes exactly one person from the first frame.');refs.audios.forEach((a,i)=>subj.push(`<Audio ${i+1}> is the voice identity reference for ${nameOf(a.character)} only; not a recording to paste.`));
const summary=`[reference generation${refs.audios.length?' + audio reference':''}] ${registry?.summary||'Photorealistic live-action drama.'} ${mode==='master'?`MASTER shot of ${sequence.title||sequence.location}: a one-second wide establishing frame, nobody speaks, blocking frozen as in Video 1.`:`Segment ${block.id} of scene ${first.sourceScene||sequence.title||''} (${sequence.location}${zone?`, ${zone} zone`:''}, gravity ${first.gravity||sequence.gravity||'normal'}).`} SINGLE CONTINUOUS TAKE matching Video 1. ${visibleCountPhrase(F.visible.length,countOpts(registry,location))}${offscreenLines(block,shots,CH).length?'; every offscreen voice stays offscreen':''}.`;
const retention=`Character images: fully preserve each person's identity, ${T.retention.character}; each sheet shows several views of ONE person, never duplicate those views as extra people. Location image: geometry, materials, light and atmosphere only, never a frozen camera angle. Video 1: preserve actor locations, paths, prop contact, gravity state and every camera move; replace mannequin geometry with real human anatomy from the first frame; the guide's labels, proxy mouths and chest markers are absent${T.retention.guide?', '+T.retention.guide:''}. Audio references: each one only for its assigned speaker's timbre. Generate dialogue and physical delivery together, tiny timing adjustments allowed for natural speech, without omissions.`;
const map_=map?.prompt?map.prompt:'[[LOCATION MAP]]';const axis=[map?.side?`Camera side: ${map.side}.`:'',map?.axis?`The 180° line is ${map.axis}; the camera stays on its side of that line for the whole take.`:''].filter(Boolean).join(' ');
const acting=mode==='master'?`Nobody speaks and nobody moves: ${T.people} hold the blocking of Video 1 frame 0 for the whole shot, breathing only, hands on their tasks.`:scene?actingText(scene,cast,project,nameOf):'';const local=mode==='master'?`The whole set is visible edge to edge as in Video 1; ${T.people} are small in frame.`:(scene?.local_constraints||[]).join(' ');
const light=pickText(registry?.lighting,zone)||'[[LIGHTING]]';const swarm=swarmState(first.staging);const sw=swarm&&T.swarm.label?(swarm==='none'?(T.swarm.none?`${T.swarm.label}: ${T.swarm.none}.`:''):`${T.swarm.label}: ${swarm}.`):'';const phys=[pickText(T.physics,first.gravity||sequence.gravity,'normal'),sw].filter(Boolean).join(' ');const pc=pickText(registry?.constraints,zone);
const detailed=[`LOCATION MAP: ${map_}${axis?' '+axis:''}`,`FIRST FRAME: ${firstFrameText(F,{project,map,registry,location,nameOf})}`,`OPTICS: ${isObj(first.cameraRig)?rigOpticsLine(first.cameraRig,first.duration,block.parts[0].from??0,block.parts[0].to??first.duration,F.camera.fov):opticsLine(first.camera.fov)}`,`CAMERA: ${cameraLine(first,{nameOf})}`,`ACTION TIMING:\n${actionTiming({block,shots,project,registry,nameOf}).join('\n')}${spoken.length?`\nFinish all words by ${(duration-1).toFixed(1)}s; the last second is clean tail. Do not add any other words.`:'\nNobody speaks in this segment.'}`,`CHARACTER ACTING: ${acting||'[[ACTING]]'}`,...(phys?[`PHYSICS: ${phys}`]:[]),`LIGHTING: ${light}`,`STYLE: ${project.style||''}`,`QUALITY: Photorealistic from frame zero; identities, ${T.quality.costume} and set consistent across the whole take; textured materials at believable scale${T.quality.details?`; clean rendering of ${T.quality.details}`:''}.`,`POSITIVE CONSTRAINTS: ${pc?pc+' ':''}Listeners keep their hands on their task. Eyes lead the head and settle on people, props or landmarks; nobody looks at the lens. Every person 100% matches their reference in every frame. ${local||'[[LOCAL]]'}`].join('\n');
const prompt=`subject_definitions:\n${subj.join('\n')}\nsummary:\n${summary}\nretention_analysis:\n${retention}\ndetailed_description:\n${detailed}\noverall_soundscape:\n${pickText(registry?.sound,zone)||'[[SOUND]]'}${refs.audios.map(a=>a.descriptor?` ${nameOf(a.character)}'s voice: ${a.descriptor}`:'').join('')}\nnon_diegetic_music:\nNone.`;
const emo=forbiddenEmotionWords(acting+' '+local);if(emo.length)warnings.push(`Palabras de emoción en la interpretación: ${emo.join(', ')} (skill interpretacion)`);const neg=strayNegatives(detailed.split('\n').filter(l=>!l.startsWith('STYLE:')).join('\n'));if(neg.length)warnings.push(`Negativos fuera de la lista blanca: ${neg.slice(0,3).join(' | ')}${neg.length>3?' …':''}`);
return {prompt,refs,warnings,duration,requested,budget};}

// Prompt de un bloque en modo «fotograma» (image-to-video): el fotograma del storyboard ES el primer fotograma; no hay vídeo guía ni hojas adjuntas, así que la identidad se sostiene con los descriptores del registro. Los huecos [[CAMERA]] y [[ACTION]] se rellenan con la skill director-h3 salvo que el plano traiga cameraEn/actionEn.
export function framePrompt({project,sequence,shots,block,registry,map,scene,cast=[]}){const warnings=[],CH=projectChannels(project);const part=block.parts?.[0];const t=shots[part?.shot];if(!t)throw Error('El bloque no tiene planos');if((block.parts||[]).length>1)warnings.push('Modo fotograma: el bloque tiene más de un plano; solo el primero tiene fotograma inicial');const image=t.storyboardRender||null;if(!image)warnings.push(`El plano ${t.title} no tiene fotograma de storyboard`);const duration=block.duration??Math.ceil(block.length||5);const requested=Math.max(5,Math.ceil(duration));const spoken=spokenLines(block,shots,CH);const budget=dialogueBudget(spoken);if(spoken.length&&budget>duration-1+.01)warnings.push(`Diálogo de ${budget.toFixed(1)} s no cabe en ${duration} s − 1 s de cola (R12)`);
const assets=Object.entries(registry?.assets||{});const person=id=>assets.find(([,a])=>a.kind==='character'&&a.character===id&&!a.variant)||assets.find(([,a])=>a.kind==='character'&&a.character===id);const voice=id=>assets.find(([,a])=>a.kind==='voice'&&a.character===id)?.[1];const nameOf=id=>characterName(registry,project,id);
const people=cast.map(id=>{const e=person(id);if(!e)warnings.push(`Sin entrada de registro para ${id}`);else if(e[1].status!=='approved')warnings.push(`Tag sin aprobar: ${e[0]}`);return e?e[1].descriptor||'[[DESCRIPTOR]]':`${nameOf(id)}: [[DESCRIPTOR]]`;});
const lines=[];for(const p of block.parts||[])for(const l of p.lines||[]){const at=(p.at+l.start).toFixed(2);if(lineOffscreen(CH,l))lines.push(`${at}s: ${nameOf(l.character)} is heard offscreen; nobody in frame mouths the words.`);else lines.push(`At approximately ${at}s, ${nameOf(l.character)} says exactly: <d>[English] ${(l.spokenText||l.text).trim()}</d>`);}
const axis=[map?.side?`Camera side: ${map.side.replace(/\.+$/,'')}.`:'',map?.axis?`The 180° line is ${map.axis.replace(/\.+$/,'')}; the camera stays on its side of that line.`:''].filter(Boolean).join(' ');const acting=scene?actingText(scene,cast,project):'';const local='';const zone=promptZone(project,sequence),F=promptTexts(registry).frame;const light=pickText(registry?.lighting,zone)||'[[LIGHTING]]';
const bg=countOpts(registry,(project?.locations||[]).find(l=>l.id===sequence.location));
const summary=`[image-to-video, first frame supplied${spoken.length?', dialogue':''}] ${registry?.summary||'Photorealistic live-action drama.'} Shot ${String(t.title).split(' · ')[0]}. The supplied image IS frame zero: the take starts exactly on it and moves on in one continuous take. Exactly ${cast.length} ${cast.length===1?'person':'people'} in the scene${cast.length?`: ${cast.map(nameOf).join(', ')}`:''}${bg.background==='people'?`, with ${backgroundFigures(bg.people)}`:''}.`;
const retention=`Keep every ${F.keep} exactly as in the first frame for the whole take. Nobody new appears unless the action says so; nobody is duplicated; nobody changes ${F.changes}. Keep the location, the light and the colour of the first frame.`;
const detailed=[`LOCATION MAP: ${map?.prompt||'[[LOCATION MAP]]'}${axis?' '+axis:''}`,'FIRST FRAME: the supplied image, unchanged.',`CAMERA: ${t.cameraEn||'[[CAMERA]]'}`,`ACTION TIMING:\n[0.00s–${duration.toFixed(2)}s] ${t.actionEn||'[[ACTION]]'}${lines.length?'\n'+lines.join('\n'):''}${spoken.length?`\nFinish all words by ${(duration-1).toFixed(1)}s; the last second is clean tail. Do not add any other words.`:'\nNobody speaks in this shot.'}`,`PEOPLE: ${people.join(' || ')||'No people in frame.'}`,`CHARACTER ACTING: ${acting||'[[ACTING]]'}`,...(F.physics?[`PHYSICS: ${F.physics}`]:[]),`LIGHTING: ${light}`,`STYLE: ${registry?.summary||''}`,`QUALITY: Photorealistic from frame zero; ${F.quality} consistent across the whole take; natural motion blur; no morphing.`,`POSITIVE CONSTRAINTS: Eyes lead the head and settle on people or landmarks; nobody looks at the lens. Only the ${F.present} of the first frame appear; nobody enters the frame unless the action says so. Every person 100% matches the first frame in every frame. [[LOCAL]]`].join('\n');
const sound=[sequence.ambiencePrompt||pickText(registry?.sound,zone)||'[[SOUND]]',...[...new Set(spoken.map(l=>l.character))].map(id=>voice(id)?.descriptor?`${nameOf(id)}'s voice: ${voice(id).descriptor}`:'')].filter(Boolean).join(' ');
const prompt=`summary:\n${summary}\nretention_analysis:\n${retention}\ndetailed_description:\n${detailed}\noverall_soundscape:\n${sound}\nnon_diegetic_music:\nNone.`;
const emo=forbiddenEmotionWords(acting+' '+local);if(emo.length)warnings.push(`Palabras de emoción en la interpretación: ${emo.join(', ')} (skill interpretacion)`);
return {prompt,image,warnings,duration,requested,budget,names:cast.map(nameOf)};}

// ---- Voces del bloque (modo fotograma y montaje): qué líneas van a voz.wav, cuáles faltan y cuáles se mezclan en post.
const clip=s=>{s=String(s||'').trim();return s.length>32?s.slice(0,30).trimEnd()+'…':s;};
const secs=n=>n.toFixed(2)+' s';
// Líneas del bloque en tiempo de bloque (part.at + l.start, a ms), ordenadas por inicio. El audio sale de shots[part.shot].lines por id (instantánea del lote); si no, de la línea del plan.
export function blockVoices(block,shots,channels=projectChannels(null)){const lineAudios=[],missing=[],offscreen=[];
 const all=(block?.parts||[]).flatMap(part=>(part.lines||[]).map(l=>{const src=(shots?.[part.shot]?.lines||[]).find(x=>x.id===l.id);const from=src?.audio?src:l;return {l,start:Math.round((part.at+l.start)*1000)/1000,file:from.audio||null,duration:Number.isFinite(from.audioDuration)?from.audioDuration:null};})).sort((a,b)=>a.start-b.start);
 for(const {l,start,file,duration} of all){const base={start,character:l.character,lineId:l.id,text:String(l.spokenText||l.text||'').trim()};
  if(lineOffscreen(channels,l))offscreen.push({file,...base,duration:file?duration:null});else if(file)lineAudios.push({file,...base,duration});else missing.push(base);}
 return {lineAudios,missing,offscreen};}
// Avisos de la pista de voz de un bloque: líneas en cuadro sin audio, solapes y audio que se corta o no se oye con la duración pedida.
export function voiceTrackWarnings({lineAudios,missing=[],duration,blockId}){const out=[],pre=blockId?blockId+': ':'',who=a=>`${a.character||'la línea'} a ${secs(a.start)}${a.text?` («${clip(a.text)}»)`:''}`;
 for(const m of missing)out.push(`${pre}${who(m)} está en cuadro y no tiene audio: genera las voces con voces.mjs y repite prompt.mjs, o el modelo inventará la voz`);
 const list=[...(lineAudios||[])].sort((a,b)=>a.start-b.start);
 for(let i=0;i<list.length;i++)for(let k=i+1;k<list.length;k++){const a=list[i],b=list[k];if(Number.isFinite(a.duration)&&a.start+a.duration>b.start+.001)out.push(`${pre}${who(a)} dura ${secs(a.duration)} y se solapa con ${who(b)}`);}
 if(Number.isFinite(duration))for(const a of list){if(a.start>=duration)out.push(`${pre}${who(a)} empieza después de la duración pedida (${secs(duration)}): no se oye`);else if(Number.isFinite(a.duration)&&a.start+a.duration>duration+.01)out.push(`${pre}${who(a)} acaba a ${secs(a.start+a.duration)}, después de la duración pedida (${secs(duration)}): se corta`);}
 return out;}
// Tiempo de bloque → tiempo en edit.mp4 (tramos usedRange concatenados). null si cae fuera de todos los tramos.
export function editTime(t,spans){let acc=0;for(const [s,e] of spans||[]){if(t>=s&&t<e)return Math.round((acc+t-s)*1000)/1000;acc+=e-s;}return null;}
// Voces fuera de campo que se mezclan sobre la toma en edit.mp4: su instante en el montaje y los avisos de las que se omiten o se cortan.
export function offscreenMix({offscreen,spans}){const items=[],warnings=[],total=(spans||[]).reduce((n,[s,e])=>n+e-s,0),who=o=>`${o.character} fuera de campo a ${secs(o.start)} («${clip(o.text)}»)`;
 for(const o of offscreen||[]){if(!o.file){warnings.push(`${who(o)} no tiene audio: no se mezcla (genera con voces.mjs y repite planificar --force)`);continue;}
  const at=editTime(o.start,spans);if(at===null){warnings.push(`${who(o)} empieza fuera del tramo usado: no se mezcla`);continue;}
  if(Number.isFinite(o.duration)&&at+o.duration>total+.01)warnings.push(`${who(o)} acaba después del final del bloque en el montaje: se corta`);
  items.push({file:o.file,at,lineId:o.lineId,character:o.character,duration:o.duration??null});}
 return {items,warnings};}
// Líneas de una secuencia que voces.mjs genera: sin audio (o todas con force), una sola con linea; por defecto también las fuera de campo, que el montaje mezcla.
export function pendingVoiceLines(shots,channels,{linea=null,force=false,soloEnCuadro=false}={}){return (shots||[]).flatMap(t=>(t.lines||[]).map(l=>({t,l,offscreen:lineOffscreen(channels,l)}))).filter(({l,offscreen})=>(!linea||l.id===linea)&&(force||!l.audio)&&!(soloEnCuadro&&offscreen));}

// Preview 3D estándar: un plano con render propio (customRenderer) no pasa por stage; se reproduce la preview guardada.
export function previewIssues(shot){return shot?.customRenderer?['Plano con render propio: reproduce la preview guardada']:[];}
// ---- Escaleta: secuencias en orden con número, minutos y una carátula (imagen) por secuencia (outline y outlineTree, más abajo: #56).
export function outlineSequence(p,id){for(const e of p.episodes||[])for(const s of e.sequences||[])if(s.id===id)return {episode:e,sequence:s};throw Error('Secuencia no encontrada');}
// Prompt de la carátula: el explícito de la secuencia tal cual; si no, estilo del proyecto, título y texto de escaleta, y un solo fotograma 16:9 sin texto.
export const COVER_TAIL='One single cinematic 16:9 film still. No text, no captions, no borders, no watermark.';
export function coverPrompt(p,e,s){if(s.coverPrompt?.trim())return s.coverPrompt.trim();return [p.style||'',`Key image for the sequence "${s.title}"${e?.title?` (${e.title})`:''}${s.text?': '+s.text:'.'}`,COVER_TAIL].filter(Boolean).join('\n\n');}


// ---- Copia para el móvil (PWA de solo lectura). El service worker (sw.js) y la página movil.html usan estas reglas; aquí viven para poder probarlas.
export const CACHES={shell:'rodaje-shell-v2',data:'rodaje-datos-v1'};
const FILE_RE=/^(?!\/)(?!.*(^|\/)\.\.(\/|$))[\w][\w ./()+-]*\.(png|jpe?g|webp|gif|mp4|webm|wav|mp3|ogg|glb|gltf|fbx|json|md|srt)$/i;
// Ficheros relativos que referencia un proyecto (cualquier cadena con extensión de imagen, audio, vídeo, 3D o datos). Se ignoran rutas absolutas, URLs y escapes con «..».
export function projectFiles(p){const out=new Set();(function walk(o){if(typeof o==='string'){if(FILE_RE.test(o))out.add(o);}else if(o&&typeof o==='object')Object.values(o).forEach(walk);})(p);return [...out].sort();}
// Especificadores de los imports estáticos de un módulo ES (import … from 'x', import 'x', export … from 'x'); no incluye import() dinámicos.
export function moduleImports(source){const out=[],re=/\b(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?['"]([^'"]+)['"]/g;let m;while((m=re.exec(source)))if(!out.includes(m[1]))out.push(m[1]);return out;}
// Resuelve un especificador a la ruta que pedirá el navegador: primero el import map (clave exacta o prefijo acabado en «/»), luego rutas relativas o absolutas; un nombre suelto desconocido devuelve null.
export function resolveModule(spec,from,imports={}){if(imports[spec])return imports[spec];for(const [k,v] of Object.entries(imports))if(k.endsWith('/')&&spec.startsWith(k))return v+spec.slice(k.length);if(/^(\.{1,2})?\//.test(spec))return new URL(spec,'http://x'+from).pathname;return null;}
// Estrategia por petición: escrituras siempre a red; librerías inmutables (three, y_bot) primero de caché; el resto primero de red y, sin servidor, de la copia guardada.
export function offlineRoute(pathname,method='GET'){if(method!=='GET'&&method!=='HEAD')return 'network';if(pathname.startsWith('/three/')||pathname.startsWith('/assets/'))return 'cache-first';return 'network-first';}
export function cacheName(pathname){return pathname.startsWith('/api/')?CACHES.data:CACHES.shell;}
// Clave de caché: la página principal se guarda una sola vez sin importar la ruta abierta (?project=…&view=…); el resto conserva la query (proyecto y fichero).
export function cacheKey(url){const u=typeof url==='string'?new URL(url,'http://x'):url;if(u.pathname==='/'||u.pathname==='/index.html')return '/';return u.pathname+u.search;}
export function assetUrl(project,file){return '/api/asset?project='+project+'&file='+encodeURIComponent(file);}
// Peticiones GET que la app hace al recorrer un proyecto: sus datos, el estado de cada plano (vista de estudio) y todos sus ficheros.
export function projectRequests(id,p){const shots=(p.episodes||[]).flatMap(e=>e.sequences||[]).flatMap(s=>s.shots||[]);return ['/api/state','/api/project?id='+id,...shots.map(t=>'/api/shot-state?project='+id+'&shot='+t.id),...projectFiles(p).map(f=>assetUrl(id,f))];}

// ---------- Pendientes (tablero kanban) ----------
// Un pendiente es un fallo de guion, una decisión abierta o una tarea. Vive en p.issues; el orden del array es el orden dentro de cada columna.
export const ISSUE_STATES=[['abierto','Pendiente'],['en-curso','En curso'],['cerrado','Cerrado']];
export const ISSUE_SEVERITIES=[['grave','Grave'],['medio','Medio'],['ritmo','Ritmo'],['nota','Nota']];
export function issueBoard(p){const by=Object.fromEntries(ISSUE_STATES.map(([k])=>[k,[]]));for(const i of p.issues||[])(by[i.status]||by.abierto).push(i);return ISSUE_STATES.map(([key,label])=>({key,label,items:by[key]}));}
// Mueve un pendiente a una columna; con beforeId lo deja delante de ese otro, si no al final de la columna. Marca la fecha de cierre al entrar en «cerrado».
export function moveIssue(p,id,status,beforeId,now=()=>new Date().toISOString()){const list=p.issues||(p.issues=[]);if(!ISSUE_STATES.some(([k])=>k===status))throw Error('Estado no válido');const i=list.findIndex(x=>x.id===id);if(i<0)throw Error('Pendiente no encontrado');if(beforeId===id)return false;const [item]=list.splice(i,1);const was=item.status;item.status=status;if(status==='cerrado'){if(was!=='cerrado')item.closed=now();}else delete item.closed;let at=beforeId?list.findIndex(x=>x.id===beforeId):-1;if(at<0){at=list.length;for(let k=list.length-1;k>=0;k--)if(list[k].status===status){at=k+1;break;}}list.splice(at,0,item);return true;}
// Lee un análisis crítico en Markdown: «**A2. Título.** texto» bajo «### Graves/Medios/Ritmo» son pendientes abiertos; «- **C14. Título.** texto» bajo «## Cerrado» son cerrados.
export function parseIssues(md){const out=[];let closed=false,severity='medio';for(const raw of String(md||'').split('\n')){const line=raw.trimEnd();if(/^## /.test(line)){closed=/cerrad/i.test(line);continue;}if(/^### /.test(line)){severity=/grave/i.test(line)?'grave':/ritmo/i.test(line)?'ritmo':/medio/i.test(line)?'medio':'nota';continue;}const m=/^(?:- )?\*\*([A-Z]\d+)\. (.+?)\.?\*\*\s*(.*)$/.exec(line);if(m){out.push({code:m[1],title:m[2].trim(),text:m[3].trim(),status:closed?'cerrado':'abierto',severity:closed?'nota':severity});continue;}if(out.length&&line&&!/^#/.test(line)&&!/^---$/.test(line)){const last=out[out.length-1];if(!/^(?:- )?\*\*/.test(line))last.text+=(last.text?'\n':'')+line;}}return out;}
// Vuelca pendientes con código en el proyecto: los nuevos se añaden; los existentes actualizan título, texto y gravedad. El estado del documento solo manda cuando dice «cerrado».
export function upsertIssues(p,items,{newId=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){const list=p.issues||(p.issues=[]);let added=0,updated=0;for(const it of items){const found=it.code&&list.find(x=>x.code===it.code);if(found){Object.assign(found,{title:it.title,text:it.text,severity:it.severity});if(it.status==='cerrado'&&found.status!=='cerrado'){found.status='cerrado';found.closed=now();}found.updated=now();updated++;}else{list.push({id:newId(),code:it.code,title:it.title,text:it.text,status:it.status||'abierto',severity:it.severity||'medio',created:now(),...(it.status==='cerrado'?{closed:now()}:{})});added++;}}return {added,updated};}
// Entornos 3D de un proyecto: los de p.environments (shipModel ya no es un entorno: la nave es uno más desde #14).
// Visor de un entorno: constructor y datos → visor genérico /viewer/mount.mjs (con viewer.plugins si los hay); solo GLB → /viewer/glb.mjs.
// viewer como ruta ya no se admite: no se abre nada, la vista muestra el mensaje (y proyecto-check lo marca como R-manifest).
export function environmentViewer(e){if(typeof e?.viewer==='string'&&e.viewer)return {kind:'invalido',message:`El entorno declara viewer como ruta (${e.viewer}), que ya no se admite. Pásalo a builder + data con viewer.plugins (docs/visor-3d.md) o sube un GLB.`};if(e?.builder&&e?.data)return {kind:'mount'};if(e?.glb)return {kind:'glb',url:e.glb};return {kind:'none'};}
// Editor de plantas (viewer/planta.html): para entornos con constructor y datos; la planta vive en data → dims.planta.
export const hasPlantaEditor=e=>!!(e?.builder&&e?.data);
export const plantaEditorUrl=(projectId,envId)=>'/viewer/planta.html?project='+encodeURIComponent(projectId)+'&env='+encodeURIComponent(envId);
const VIEWER_KINDS={invalido:'no válido',mount:'constructor',glb:'glb',none:'vacío'};
export function environmentList(p){return (p?.environments||[]).map(e=>{const v=environmentViewer(e);return {id:e.id,name:e.name||e.id,description:e.description||'',image:e.image||'',glb:e.glb||'',kind:VIEWER_KINDS[v.kind],invalid:v.message||'',action:'env-open:'+e.id};});}
// Entorno con constructor cuyos datos son los de un location.modelSpace (modelSpace.model === environment.data), o null.
export function modelSpaceEnvironment(p,modelSpace){const m=modelSpace?.model;return m?(p?.environments||[]).find(e=>e.builder&&e.data&&e.data===m)||null:null;}
// Rutas de la app (#57): ?project=…&view=…&<parámetros de la vista>. Los alias (outline, episodes, ship) llevan a la vista que los sustituye;
// con proyecto, una vista desconocida, library o ninguna llevan al árbol. scene y sequence de shots enfocan y no cuentan para el scroll; node es la página de la Escaleta.
export const VIEWS=['tree','overview','ideas','characters','locations','environments','environment','character','location','storyboards','storyboard','shots','shot','rehearsal','anim','montaje','issues','jobs'];
export const VIEW_ALIASES={outline:'tree',episodes:'shots',ship:'environments'};
export const ROUTE_PARAMS={shot:['episode','sequence','shot'],anim:['episode','sequence','shot'],rehearsal:['episode'],storyboard:['storyboard','scene'],environment:['environment'],character:['character'],location:['location'],tree:['node'],shots:['sequence','q','f'],storyboards:['q','f']};
export const FOCUS_PARAMS={storyboard:['scene'],shots:['sequence']};
export const ROUTE_KEYS=['episode','sequence','shot','storyboard','environment','character','location','scene','node','q','f'];
// Buscador y facetas (#59): q y f no cuentan para el scroll; en la URL, f conserva ':' y ',' legibles (f=act:e1,cast:ana).
export const FILTER_PARAMS=['q','f'];
const routeValue=(k,v)=>FILTER_PARAMS.includes(k)?encodeURIComponent(v).replace(/%3A/g,':').replace(/%2C/g,','):encodeURIComponent(v);
export const routeView=v=>typeof v==='string'&&Object.hasOwn(VIEW_ALIASES,v)?VIEW_ALIASES[v]:v;
export function parseRoute(search){const q=search instanceof URLSearchParams?search:new URLSearchParams(search||''),project=q.get('project')||null,v=routeView(q.get('view'));
 const view=project?(VIEWS.includes(v)?v:'tree'):(v==='jobs'?'jobs':'library'),own=ROUTE_PARAMS[view]||[];
 return {project,view,...Object.fromEntries(ROUTE_KEYS.map(k=>[k,own.includes(k)?q.get(k)||null:null]))};}
export function routeQuery(r){const parts=[];if(r?.project)parts.push(['project',r.project]);parts.push(['view',r?.view||'library']);
 for(const k of ROUTE_PARAMS[r?.view]||[])if(r[k]!==null&&r[k]!==undefined&&r[k]!=='')parts.push([k,r[k]]);
 return '?'+parts.map(([k,v])=>k+'='+routeValue(k,v)).join('&');}
export function routeKey(r){const focus=[...FOCUS_PARAMS[r?.view]||[],...FILTER_PARAMS];return JSON.stringify([r?.project||'',r?.view,...(ROUTE_PARAMS[r?.view]||[]).filter(k=>!focus.includes(k)).map(k=>r[k])].map(x=>x??''));}
// Historial (#66): push si cambia la ruta sin q ni f; replace en lo demás. history.state = {key: routeKey, scroll: [x, y]}.
const ROUTE_NAMES=['project','view',...ROUTE_KEYS],validScroll=xy=>Array.isArray(xy)&&xy.length===2&&xy.every(Number.isFinite);
// Búsqueda con la ruta y, detrás, los parámetros ajenos de la URL anterior (persist=0…) en su orden.
export function routeHref(prevSearch,route){const keep=[...new URLSearchParams(prevSearch||'')].filter(([k])=>!ROUTE_NAMES.includes(k));return routeQuery(route)+(keep.length?'&'+new URLSearchParams(keep):'');}
// Misma entrada: igual routeQuery sin q ni f, con la anterior normalizada por parseRoute (alias incluidos); ignora los parámetros ajenos.
export function sameEntry(prevSearch,route){const bare=r=>routeQuery({...r,q:null,f:null});return bare(parseRoute(prevSearch))===bare(route);}
export function historyStep(prevSearch,route,{replace=false}={}){return {method:replace||sameEntry(prevSearch,route)?'replace':'push',search:routeHref(prevSearch,route)};}
export function historyState(route,scroll=null){return validScroll(scroll)?{key:routeKey(route),scroll:[scroll[0],scroll[1]]}:{key:routeKey(route)};}
// Scroll guardado en la entrada, solo si su clave es la de la ruta; si no, null.
export function entryScroll(state,route){return state&&state.key===routeKey(route)&&validScroll(state.scroll)?[state.scroll[0],state.scroll[1]]:null;}
// Botón del menú que se marca en cada vista.
export function navActive(view){return view==='environment'?'environments':view==='character'?'characters':view==='location'?'locations':view==='storyboard'?'storyboards':['shot','anim','rehearsal'].includes(view)?'shots':view;}
// Entorno 3D enlazado a un ambiente (location.environment), o null.
export function locationEnvironment(p,locationId){const l=(p?.locations||[]).find(l=>l.id===locationId);return l?.environment?(p.environments||[]).find(e=>e.id===l.environment)||null:null;}
// Elección de entorno de una secuencia a partir del formulario: lugar, estado por secuencia y giro en grados. Vacío → sin elección.
export function environmentChoice(f){const spot=String(f.envSpot||'').trim(),preset=String(f.envPreset||'').trim(),rotation=Number(f.envRotation)||0;return spot||preset||rotation?{...(spot?{spot}:{}),...(preset?{preset}:{}),...(rotation?{rotation:((rotation%360)+360)%360}:{})}:undefined;}
// Montaje de un lote (vista Montaje y scripts/bloques/montar.mjs).
// Toma que usa el montaje en un bloque: la aceptada (acceptedAttempt); si no hay, la última descargada sin rechazar, pendiente de revisión.
export const isDownloaded=a=>a?.status==='done'&&!!a.video;
// Una sola aceptada por bloque (#24); si un attempts.json antiguo tiene varias, manda la última (informe.mjs lo marca).
export function acceptedAttempt(list,has=()=>true){return [...list].reverse().find(a=>a.verdict==='accepted'&&isDownloaded(a)&&has(a))||null;}
export function chosenAttempt(list,has=()=>true){const accepted=acceptedAttempt(list,has);if(accepted)return {attempt:accepted,pending:false};const last=[...list].reverse().find(a=>isDownloaded(a)&&has(a)&&a.verdict!=='rejected');return last?{attempt:last,pending:true}:{attempt:null,pending:false};}
// Tramo de cada bloque en el vídeo montado: `at`/`length` del cut.json o, en cortes antiguos, la suma de usedRange (o la duración del plan).
export function cutTimeline(cut,plan=[]){let at=0;return (cut?.blocks||[]).map(b=>{const length=b.length??(b.usedRange?.length?b.usedRange.reduce((n,[s,e])=>n+e-s,0):plan.find(x=>x.id===b.block)?.length||0);const start=b.at??at;at=start+length;return {...b,start,end:at};});}
export const blockAt=(timeline,t)=>timeline.find(b=>t>=b.start&&t<b.end)||(t>=(timeline.at(-1)?.end??0)?timeline.at(-1):timeline[0])||null;
// Storyboard ↔ lotes (#45). Viñeta de cada bloque: la de la primera parte cuyo plano tenga storyboardShot, en la instantánea del lote
// o, si allí no lo tiene, en el plano vivo del mismo id. Mapas id→plano; los bloques sin enlace no aparecen.
export function blockStoryboardLinks(plan,snapshotShots,liveShots={}){const out={};for(const b of plan||[])for(const p of b.parts||[]){const sb=snapshotShots?.[p.shot]?.storyboardShot||liveShots?.[p.shot]?.storyboardShot;if(sb){out[b.id]=sb;break;}}return out;}
const sbPlace=(storyboards,shotId)=>{for(const b of storyboards||[])for(const s of b.sequences||[])if((s.shots||[]).some(t=>t.id===shotId))return {storyboard:b,sequence:s};return null;};
const r3=n=>Math.round(n*1000)/1000;
// Montaje por secuencia del storyboard dentro de un corte (montar.mjs): bloques del corte agrupados por (storyboard, secuencia) en el
// orden del plan, sin los que faltan (missing) ni los sin enlace. at de la sección: inicio en el corte; at de cada bloque: inicio en el
// mp4 de la sección. Fichero <corte>.<secuencia>.mp4 (sec-NN si el id no vale como nombre; -2, -3… si se repite). duration: suma de length.
export function storyboardSections({plan,links,storyboards,blocks,name}){const groups=new Map();
 for(const b of plan||[]){const sb=links?.[b.id],e=(blocks||[]).find(x=>x.block===b.id);if(!sb||!e||e.source==='missing')continue;const where=sbPlace(storyboards,sb);if(!where)continue;
  const key=where.storyboard.id+'\u0000'+where.sequence.id;if(!groups.has(key))groups.set(key,{where,list:[]});groups.get(key).list.push(e);}
 const used=new Set();return [...groups.values()].map(({where:{storyboard,sequence},list},i)=>{const id=/^[\w-][\w.-]*$/.test(sequence.id)?sequence.id:'sec-'+String(i+1).padStart(2,'0');
  let file=`${name}.${id}.mp4`;for(let k=2;used.has(file);k++)file=`${name}.${id}-${k}.mp4`;used.add(file);let at=0;
  const out=list.map(e=>{const x={block:e.block,at:r3(at),length:e.length||0};at+=x.length;return x;});
  return {storyboard:storyboard.id,sequence:sequence.id,title:sequence.title||'',file,at:list[0].at??0,duration:r3(at),blocks:out};});}
// Vídeo de un storyboard en la vista Storyboards, derivado de los lotes (orden de listLotes: del más reciente al más antiguo).
// lotes: [{id, created, links, attempts:{bloque:[]}, cuts:[{name,file,at,duration,sequences?}]}]; has(lote,bloque,intento): el vídeo existe.
// Toma vigente de una viñeta: la elegida (chosenAttempt) del lote más reciente que tenga una; las demás, agrupadas por lote y bloque.
// Corte vigente: el último del lote más reciente con cortes; parcial si su lote no cubre todas las viñetas del storyboard.
export function storyboardMedia(storyboard,lotes,has=()=>true){const ids=new Set((storyboard?.sequences||[]).flatMap(s=>(s.shots||[]).map(t=>t.id))),total=ids.size;
 const rel=(lotes||[]).map(l=>({l,links:Object.entries(l.links||{}).filter(([,sb])=>ids.has(sb))})).filter(x=>x.links.length);
 const info=rel.map(({l,links})=>{const covered=new Set(links.map(([,sb])=>sb)).size;return {id:l.id,created:l.created,covered,total,partial:covered<total};});
 const shots={};for(const sb of ids){let current=null,pending=false;const groups=[];
  for(const {l,links} of rel)for(const [block,x] of links){if(x!==sb)continue;const list=l.attempts?.[block]||[],ok=a=>has(l.id,block,a);
   const takes=list.filter(a=>isDownloaded(a)&&ok(a)).sort((a,b)=>a.n-b.n).map(a=>({lote:l.id,block,n:a.n,at:a.at,video:`assets/${l.id}/${block}/${a.video}`,verdict:a.verdict??null,rules:a.failedRules||[],notes:a.notes||'',endpoint:a.endpoint,current:false}));
   if(!takes.length)continue;if(!current){const c=chosenAttempt(list,ok);if(c.attempt){current=takes.find(t=>t.n===c.attempt.n);current.current=true;pending=c.pending;}}groups.push({lote:l.id,block,takes});}
  if(groups.length)shots[sb]={current,pending,groups};}
 const byLote=Object.fromEntries(info.map(x=>[x.id,x])),withCuts=rel.filter(({l})=>(l.cuts||[]).length);
 const list=withCuts.flatMap(({l})=>l.cuts.map(c=>({lote:l.id,name:c.name,file:c.file,at:c.at,duration:c.duration,partial:byLote[l.id].partial,covered:byLote[l.id].covered,total})));
 const cuts={current:withCuts.length?list.filter(c=>c.lote===withCuts[0].l.id).at(-1):null,list};
 const sequences={};for(const s of storyboard?.sequences||[]){const found=withCuts.flatMap(({l})=>l.cuts.flatMap(c=>(c.sequences||[]).filter(x=>x.storyboard===storyboard.id&&x.sequence===s.id).map(x=>({lote:l.id,cut:c.name,file:x.file,at:x.at,duration:x.duration,blocks:x.blocks||[]}))));
  if(found.length)sequences[s.id]={current:found.filter(x=>x.lote===found[0].lote).at(-1),list:found};}
 return {storyboard:storyboard?.id,lotes:info,shots,sequences,cuts};}
// Reproductor único de la vista Storyboard (#55): anim = {paso:{current,list}} de las animáticas; cut = {current,list} de los montajes (paso «montaje»).
// Pasos en orden fijo, solo los que tienen vigente; list vacía o ausente → [current]. Inicial: montaje si lo hay, si no el último. No muta.
export const STORYBOARD_PLAYER_STEPS=[['3d','Ensayo 3D'],['fotogramas','Fotogramas'],['voces','Con voces'],['montaje','Montaje']];
export function storyboardPlayer(anim,cut){const steps=STORYBOARD_PLAYER_STEPS.flatMap(([key,label])=>{const g=key==='montaje'?cut:anim?.[key];if(!g?.current)return [];return [{key,label,current:g.current,list:g.list?.length?g.list:[g.current]}];});
 return {steps,initial:steps.some(s=>s.key==='montaje')?'montaje':steps.at(-1)?.key??null};}
// Cabecera de una escena del storyboard: «Escena · N viñetas · duración» y nota · ubicación (nombre o id), sin separadores sueltos.
export function storyboardSequenceHeader(seq,locations=[],fmt=String){const shots=seq?.shots||[],total=shots.reduce((n,t)=>n+(Number(t?.duration)||0),0),loc=seq?.location?(locations||[]).find(l=>l.id===seq.location)?.name||seq.location:'';
 return {eyebrow:`Escena · ${shots.length===1?'1 viñeta':shots.length+' viñetas'}${total?' · '+fmt(total):''}`,meta:[seq?.note,loc].filter(Boolean).join(' · ')};}
// ---- Animáticas del storyboard (#46): por paso (3d, fotogramas, voces), por secuencia del storyboard y entera. Las codifica lib/animaticas.mjs;
// el paso «Vídeo» son los montajes de storyboardMedia. Tiempos y audio de la secuencia de capítulo enlazada (chapterSequenceFor).
export const SOURCE_3D='ensayo 3D',ANIMATIC_STEPS=['3d','fotogramas','voces'];
// Foto del ensayo 3D de una viñeta: la primera de renders con source SOURCE_3D cuyo fichero exista (guide3d solo da la óptica).
export function shot3dPhoto(t,has=()=>true){return (t?.renders||[]).find(r=>r?.source===SOURCE_3D&&r.file&&has(r.file))?.file||null;}
// Fotograma vigente: render, si existe y no es una foto del ensayo 3D.
export function shotFrame(t,has=()=>true){const f=t?.render;if(!f||!has(f)||f===shot3dPhoto(t,has)||(t.renders||[]).some(r=>r?.source===SOURCE_3D&&r.file===f))return null;return f;}
// Óptica en mm: guide3d.lens o el primer «NN mm» del texto de cámara; null si no hay.
export function shotLens(t){const l=t?.guide3d?.lens;if(typeof l==='number'&&Number.isFinite(l))return l;const m=/(\d{2,3})\s*mm/i.exec(String(t?.camera||''));return m?Number(m[1]):null;}
// Subtítulo de una línea: «NOMBRE (OFF): texto», en el idioma del proyecto (el texto que dicen las voces).
export function captionText(project,line,channels=projectChannels(project)){const c=(project?.characters||[]).find(c=>c.id===line?.character),name=String(c?.name||line?.who||line?.character||'').trim().toUpperCase(),text=String(line?.text||'').trim();return name?`${name}${lineOffscreen(channels,line)?' (OFF)':''}: ${text}`:text;}
// Una fila si cabe en max caracteres; si no, dos filas cortadas por la palabra que más las iguala.
export function captionRows(text,max=60){const s=String(text||'').replace(/\s+/g,' ').trim();if(s.length<=max)return s?[s]:[];const w=s.split(' ');let best=null;for(let i=1;i<w.length;i++){const a=w.slice(0,i).join(' '),b=w.slice(i).join(' '),m=Math.max(a.length,b.length);if(!best||m<best.m)best={m,rows:[a,b]};}return best?best.rows:[s];}
// Secuencia de capítulo que da tiempos y audio a las animáticas: entre las que tienen algún plano enlazado a una viñeta del storyboard y no son
// contenedor de otro story (#56), 1) la que declara storyboard===sb.id y no es prueba, 2) la que no es prueba, 3) más líneas con audio,
// 4) más planos enlazados, 5) la primera del proyecto. override la fuerza.
export function chapterSequenceFor(project,storyboard,{override}={}){const ids=new Set((storyboard?.sequences||[]).flatMap(s=>(s.shots||[]).map(t=>t.id)));const all=(project?.episodes||[]).flatMap(e=>(e.sequences||[]).map(s=>({episode:e,sequence:s})));
 const found=all.map((x,i)=>{const linked=(x.sequence.shots||[]).filter(t=>ids.has(t.storyboardShot));return {...x,i,own:x.sequence.storyboard===storyboard?.id&&x.sequence.test!==true?1:0,real:x.sequence.test===true?0:1,linked:linked.length,audio:linked.flatMap(t=>t.lines||[]).filter(l=>l.audio).length};}).filter(x=>x.linked&&!(sequenceRole(project,x.sequence)==='container'&&x.sequence.storyboard!==storyboard?.id));
 if(override){const f=all.find(x=>x.sequence.id===override);if(!f)throw Error('Secuencia de capítulo no encontrada: '+override);return {episode:f.episode,sequence:f.sequence,candidates:found.length};}
 if(!found.length)return null;found.sort((a,b)=>b.own-a.own||b.real-a.real||b.audio-a.audio||b.linked-a.linked||a.i-b.i);return {episode:found[0].episode,sequence:found[0].sequence,candidates:found.length};}
const ANIM_SLATE={'3d':'SIN FOTO 3D',fotogramas:'SIN FOTOGRAMA',voces:'SIN FOTOGRAMA'},posNum=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:null;};
// Línea de tiempo de la animática de un paso. source: la de chapterSequenceFor (o null: duración de la viñeta y diálogo repartido).
// Duración de cada viñeta: la de su plano enlazado (el primero), la suya o 5 s. Cada línea empieza en su start y acaba en audioDuration,
// estimatedDuration o la estimación por palabras (mínimo 1,5 s), recortada al inicio de la siguiente y al final del plano.
// at de la viñeta: desde el inicio de su secuencia; at de la secuencia: desde el inicio de la animática. missing: lo que falta por viñeta.
export function animaticTimeline(project,storyboard,{step,source=null,sequence=null,has=()=>true}={}){
 if(!ANIMATIC_STEPS.includes(step))throw Error('Paso no válido: '+step+' (3d, fotogramas o voces)');
 const CH=projectChannels(project),all=storyboard?.sequences||[],chosen=sequence?all.filter(s=>s.id===sequence):all;if(sequence&&!chosen.length)throw Error('Secuencia del storyboard no encontrada: '+sequence);
 const plans=new Map();for(const t of source?.sequence?.shots||[])if(t.storyboardShot&&!plans.has(t.storyboardShot))plans.set(t.storyboardShot,t);
 const missing=[],warnings=[];let clock=0;
 const sequences=chosen.map(s=>{const file=/^[\w-][\w.-]*$/.test(s.id)?s.id:'sec-'+String(all.indexOf(s)+1).padStart(2,'0'),sMissing=[],sWarnings=[];let at=0;
  const shots=(s.shots||[]).map(t=>{const plan=plans.get(t.id)||null,code=t.code||'',duration=posNum(plan?.duration)??posNum(t.duration)??5,miss=(kind,x={})=>sMissing.push({shot:t.id,code,kind,...x});
   const image=step==='3d'?shot3dPhoto(t,has):shotFrame(t,has);if(!image)miss(step==='3d'?'foto-3d':'fotograma');
   let raw;if(plan)raw=(plan.lines||[]).map(l=>({l,start:Number(l.start)||0}));else{const d=t.dialogue||[],starts=spreadDialogue(d.length,duration);raw=d.map((l,i)=>({l,start:starts[i]}));}
   raw.sort((a,b)=>a.start-b.start);if(step==='voces'&&!plan&&raw.length)miss('plano');
   const lines=raw.map(({l,start},i)=>{const len=Math.max(1.5,posNum(l.audioDuration)??posNum(l.estimatedDuration)??dialogueBudget([{...l,start:0}],{tail:0})),next=raw.slice(i+1).find(x=>x.start>start)?.start??Infinity,caption=captionText(project,l,CH);let audio=null;
    if(step==='voces'&&plan){if(l.audio&&has(l.audio))audio=l.audio;else miss('audio',{line:l.id||null,text:String(l.text||'')});
     if(audio&&posNum(l.audioDuration)&&start+l.audioDuration>duration+.01)sWarnings.push(`${code||t.id}: el audio de «${clip(l.text)}» termina a ${secs(start+l.audioDuration)}, fuera del plano (${secs(duration)}); se recorta`);}
    return {id:l.id||null,caption,rows:captionRows(caption),at:r3(start),end:r3(Math.max(start,Math.min(start+len,next,duration))),offscreen:lineOffscreen(CH,l),audio};});
   const lens=shotLens(t),x={shot:t.id,code,title:t.title||'',lens,label:[code,t.title,lens?lens+' mm':''].filter(Boolean).join(' · '),at:r3(at),duration:r3(duration),image,slate:image?null:ANIM_SLATE[step],lines};at+=duration;return x;});
  missing.push(...sMissing);warnings.push(...sWarnings);const out={id:s.id,file,title:s.title||'',at:r3(clock),duration:r3(at),shots,missing:sMissing,warnings:sWarnings};clock+=at;return out;});
 return {step,storyboard:storyboard?.id,source:source?{episode:source.episode?.id??null,sequence:source.sequence?.id??null,candidates:source.candidates??null}:null,duration:r3(clock),incomplete:missing.length>0,missing,warnings,sequences};}
// Siguiente versión de un paso: la mayor vNN del índice y de los ficheros <paso>[.<secuencia>]-vNN[.part].mp4 de la carpeta, +1.
// Compartida por la animática entera y las de cada secuencia: nunca repite un nombre.
export function nextAnimaticVersion(entries,files,step){let v=0;for(const e of entries||[])if(e?.step===step&&Number.isInteger(e.version))v=Math.max(v,e.version);const re=new RegExp('^'+String(step).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\.[^/]+)?-v(\\d+)(?:\\.part)?\\.mp4$');for(const f of files||[]){const m=re.exec(f);if(m)v=Math.max(v,Number(m[1]));}return v+1;}
// Animáticas del índice agrupadas para la vista: {storyboard:{paso:{current,list}}, sequences:{secuencia:{paso:{current,list}}}}.
// list de mayor a menor versión y current la mayor; se ocultan los ficheros ausentes y las secuencias que ya no existen.
export function animaticGroups(index,storyboard,has=()=>true){const out={storyboard:{},sequences:{}},ids=new Set((storyboard?.sequences||[]).map(s=>s.id)),add=(o,e)=>(o[e.step]??={current:null,list:[]}).list.push(e);
 for(const e of index?.entries||[]){if(!e?.file||!ANIMATIC_STEPS.includes(e.step)||!has(e.file))continue;if(e.sequence==null)add(out.storyboard,e);else if(ids.has(e.sequence))add(out.sequences[e.sequence]??={},e);}
 const sort=o=>{for(const g of Object.values(o)){g.list.sort((a,b)=>(b.version||0)-(a.version||0)||String(b.at||'').localeCompare(String(a.at||'')));g.current=g.list[0];}};sort(out.storyboard);Object.values(out.sequences).forEach(sort);return out;}
// Reglas de REGLAS.md: «### R04 · Nadie mira a cámara».
export function parseRules(md){return [...String(md||'').matchAll(/^###\s+([A-Z]\d+)\s*·\s*(.+)$/gm)].map(m=>({id:m[1],title:m[2].trim()}));}
// Veredicto de un intento: estado.mjs --verdict y la vista Montaje, ambos vía reviewBlock (lib/lotes.mjs). No muta la lista.
// Solo intentos descargados. Una sola aceptada por bloque: aceptar quita el veredicto a las demás aceptadas (replacedBy: n) y la
// aceptada pierde su replacedBy; al aceptar failedRules queda [] (las reglas citadas se validan igual). Un rechazo cita al menos
// una regla conocida. Rango: tramos [inicio, fin] en segundos del vídeo generado; sin rango se conserva usedRange o, al aceptar,
// el bloque entero. null quita la revisión del intento sin tocar las demás.
export function reviewAttempt(list,{attempt,verdict,rules=[],notes='',range,length,known=[]},now=new Date().toISOString()){
 const out=structuredClone(list),a=out.find(x=>x.n===Number(attempt));if(!a)throw Error(`No existe el intento ${attempt}`);if(!isDownloaded(a))throw Error(`El intento ${a.n} no está descargado (estado ${a.status??'—'})`);
 if(![null,'accepted','rejected'].includes(verdict))throw Error('Veredicto: accepted, rejected o null');rules=rules.map(r=>String(r).trim()).filter(Boolean);
 if(verdict==='rejected'&&!rules.length)throw Error('Un rechazo cita al menos una regla de REGLAS.md');for(const r of rules)if(!known.includes(r))throw Error(`Regla desconocida ${r}: añádela al REGLAS.md del proyecto antes de citarla`);
 const max=a.durationReturned||a.durationRequested||Infinity;
 if(range){if(!Array.isArray(range)||!range.length||range.some(x=>!Array.isArray(x)||x.length!==2||!x.every(Number.isFinite)||x[0]<0||x[1]<=x[0]||x[1]>max+.05))throw Error('Rango no válido: tramos [inicio, fin] dentro del vídeo');}
 if(verdict===null){for(const k of ['verdict','failedRules','notes','reviewedAt','usedRange'])delete a[k];a.verdict=null;return out;}
 if(verdict==='accepted'){for(const x of out)if(x!==a&&x.verdict==='accepted'){x.verdict=null;x.replacedBy=a.n;}delete a.replacedBy;}
 Object.assign(a,{verdict,failedRules:verdict==='rejected'?rules:[],notes,reviewedAt:now});
 if(range)a.usedRange=range.map(([s,e])=>[Math.round(s*100)/100,Math.round(e*100)/100]);else if(verdict==='accepted'&&!a.usedRange)a.usedRange=[[0,Math.min(max,length||max)]];
 return out;}
// --range de la línea de órdenes: «0-9.6,11-14» → [[0,9.6],[11,14]]. No valida contra la duración (eso lo hace reviewAttempt).
export function parseRange(text){const bad=()=>Error(`Rango no válido: ${text} (usa inicio-fin, p. ej. 0-9.6,11-14)`);const s=String(text??'').trim();if(!s)throw bad();
 return s.split(',').map(p=>{const m=p.trim().match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);if(!m)throw bad();return [Number(m[1]),Number(m[2])];});}
// --verdict: accepted|rejected tal cual; none → null (quita la revisión).
export function parseVerdict(v){if(v==='accepted'||v==='rejected')return v;if(v==='none')return null;throw Error('--verdict accepted|rejected|none');}
// Copia con las claves de los objetos ordenadas en todos los niveles; los arrays conservan su orden.
export const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v;

// ---- Ensayo 3D: configuración por proyecto en stage.rehearsal ({animations:{library,clips}, exteriors, voicePitch, gear, cameraIgnores, propKinds, lookTargets}); formato en docs/ensayo-3d.md.
// Estados del enjambre (staging.swarm), tipos de s.props que el motor sabe animar, equipo por variante, gestos de mirada y atrezo del director que se puede colocar por plano.
export const SWARM_STATES=['none','single','settled','leak','stream','cloud'];
export const PROP_KINDS=['swarm'];
export const GEAR_KINDS=['helmet','mask'];
export const LOOK_GESTURES={ceiling:{tilt:.24,ramp:false},down:{tilt:.15,ramp:true}};
export const DIRECTOR_MOVABLE=['cargo','dog'];
const REHEARSAL_ROLES=['idle','talk','walk'];
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const vec3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
// Idioma del proyecto → base para filtrar voces del navegador y locale del SpeechSynthesisUtterance.
export function speechLocale(language){const l=String(language||'').trim().replace('_','-');if(!l)return {base:'en',locale:'en-US'};const base=l.split('-')[0].toLowerCase();return {base,locale:l.includes('-')?l:({en:'en-US',es:'es-ES'}[base]||base+'-'+base.toUpperCase())};}
// Lo que el ensayo necesita del proyecto para un plano (o para el capítulo, sin plano). Nunca lanza: una configuración mal formada se trata como ausente.
export function rehearsalConfig(project,shot=null){const c=isObj(project?.stage?.rehearsal)?project.stage.rehearsal:{};const lib=c.animations?.library,clips=c.animations?.clips;
 const animations=typeof lib==='string'&&isObj(clips)&&REHEARSAL_ROLES.every(r=>typeof clips[r]==='string')&&(!shot||shot.rehearsal)?{files:Object.fromEntries(REHEARSAL_ROLES.map(r=>[r,lib+'/'+clips[r]+'.fbx']))}:null;
 const key=shot?.rehearsal&&typeof shot.staging?.exterior==='string'?shot.staging.exterior:null;const ext=key&&isObj(c.exteriors)&&Object.hasOwn(c.exteriors,key)&&isObj(c.exteriors[key])&&Array.isArray(c.exteriors[key].parts)?c.exteriors[key]:null;
 const ids=v=>Array.isArray(v)&&v.every(x=>typeof x==='string');
 const gear=isObj(c.gear)?Object.fromEntries(Object.entries(c.gear).filter(([,g])=>isObj(g)&&GEAR_KINDS.includes(g.kind)&&(g.except===undefined||ids(g.except))).map(([k,g])=>[k,{kind:g.kind,except:[...(g.except||[])]}])):{};
 const propKinds=isObj(c.propKinds)?Object.fromEntries(Object.entries(c.propKinds).filter(([,k])=>PROP_KINDS.includes(k))):{};
 const lookTargets=isObj(c.lookTargets)?Object.fromEntries(Object.entries(c.lookTargets).filter(([,v])=>vec3(v)).map(([k,v])=>[k,[...v]])):{};
 const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 const mounts=isObj(c.mounts)?Object.fromEntries(Object.entries(c.mounts).filter(([,m])=>isObj(m)&&(m.kind===undefined||MOUNT_KINDS.includes(m.kind))&&(m.color===undefined||hex(m.color))).map(([k,m])=>[k,{kind:m.kind||'horse',color:m.color||NEUTRAL_MOUNT_COLOR}])):{};
 return {animations,exterior:ext?{background:ext.background,parts:ext.parts}:null,exteriorKey:ext?key:null,voicePitch:isObj(c.voicePitch)?{...c.voicePitch}:{},speech:speechLocale(project?.language),gear,cameraIgnores:Array.isArray(c.cameraIgnores)?c.cameraIgnores.filter(x=>typeof x==='string'):[],propKinds,lookTargets,mounts};}
export function rehearsalStageErrors(cfg,{characters}={}){const errors=[];if(cfg===undefined||cfg===null)return errors;if(!isObj(cfg))return ['stage.rehearsal debe ser un objeto'];
 const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 if(cfg.animations!==undefined){const a=cfg.animations;if(!isObj(a))errors.push('animations debe ser un objeto');else{if(typeof a.library!=='string'||!a.library)errors.push('animations.library debe ser una ruta');for(const r of REHEARSAL_ROLES)if(typeof a.clips?.[r]!=='string'||!a.clips[r])errors.push(`animations.clips.${r} debe ser un nombre de clip`);}}
 if(cfg.exteriors!==undefined){if(!isObj(cfg.exteriors))errors.push('exteriors debe ser un objeto');else for(const [k,e] of Object.entries(cfg.exteriors)){const at=`exteriors.${k}`;if(!isObj(e)){errors.push(at+' debe ser un objeto');continue;}if(!color(e.background))errors.push(at+'.background debe ser #rrggbb');if(!Array.isArray(e.parts)){errors.push(at+'.parts debe ser una lista');continue;}
  e.parts.forEach((p,i)=>{const w=`${at}.parts[${i}]`;if(!isObj(p))return errors.push(w+' debe ser un objeto');if(!['box','cylinder','sphere'].includes(p.shape))errors.push(w+'.shape debe ser box, cylinder o sphere');if(!color(p.color))errors.push(w+'.color debe ser #rrggbb');if(!vec3(p.position))errors.push(w+'.position debe tener 3 números');for(const f of ['rotation','drift','spin'])if(p[f]!==undefined&&!vec3(p[f]))errors.push(`${w}.${f} debe tener 3 números`);
   if(p.shape==='box'&&!vec3(p.size))errors.push(w+'.size debe tener 3 números');if((p.shape==='cylinder'||p.shape==='sphere')&&!(Number.isFinite(p.radius)&&p.radius>0))errors.push(w+'.radius debe ser mayor que 0');if(p.shape==='cylinder'&&!(Number.isFinite(p.height)&&p.height>0))errors.push(w+'.height debe ser mayor que 0');});}}
 if(cfg.voicePitch!==undefined){if(!isObj(cfg.voicePitch))errors.push('voicePitch debe ser un objeto');else for(const [k,v] of Object.entries(cfg.voicePitch))if(!(Number.isFinite(v)&&v>=0&&v<=2))errors.push(`voicePitch.${k} debe ser un número entre 0 y 2`);}
 const ids=v=>Array.isArray(v)&&v.every(x=>typeof x==='string'),known=(at,list)=>{if(Array.isArray(characters))for(const id of list)if(!characters.includes(id))errors.push(`${at}: «${id}» no es un personaje del proyecto`);};
 if(cfg.gear!==undefined){if(!isObj(cfg.gear))errors.push('gear debe ser un objeto');else for(const [k,g] of Object.entries(cfg.gear)){const at=`gear.${k}`;if(!isObj(g)){errors.push(at+' debe ser un objeto');continue;}if(!GEAR_KINDS.includes(g.kind))errors.push(`${at}.kind debe ser ${GEAR_KINDS.join(' o ')}`);if(g.except!==undefined){if(!ids(g.except))errors.push(at+'.except debe ser una lista de ids');else known(at+'.except',g.except);}}}
 if(cfg.cameraIgnores!==undefined){if(!ids(cfg.cameraIgnores))errors.push('cameraIgnores debe ser una lista de ids');else known('cameraIgnores',cfg.cameraIgnores);}
 if(cfg.propKinds!==undefined){if(!isObj(cfg.propKinds))errors.push('propKinds debe ser un objeto');else for(const [k,v] of Object.entries(cfg.propKinds))if(!PROP_KINDS.includes(v))errors.push(`propKinds.${k} debe ser ${PROP_KINDS.join(' o ')}`);}
 if(cfg.lookTargets!==undefined){if(!isObj(cfg.lookTargets))errors.push('lookTargets debe ser un objeto');else for(const [k,v] of Object.entries(cfg.lookTargets)){if(!vec3(v))errors.push(`lookTargets.${k} debe tener 3 números`);if(Object.hasOwn(LOOK_GESTURES,k))errors.push(`lookTargets.${k} choca con el gesto «${k}»`);}}
 if(cfg.mounts!==undefined){if(!isObj(cfg.mounts))errors.push('mounts debe ser un objeto');else{for(const [k,m] of Object.entries(cfg.mounts)){const at=`mounts.${k}`;if(!isObj(m)){errors.push(at+' debe ser un objeto');continue;}if(m.kind!==undefined&&!MOUNT_KINDS.includes(m.kind))errors.push(`${at}.kind debe ser ${MOUNT_KINDS.join(' o ')}`);if(m.color!==undefined&&!color(m.color))errors.push(at+'.color debe ser #rrggbb');}known('mounts',Object.keys(cfg.mounts));}}
 return errors;}
// Posición y giro de una pieza de exterior tras `elapsed` segundos de secuencia: position + drift·t; rotation + spin·t solo si gira.
export function exteriorPartAt(part,elapsed){return {position:part.position.map((v,i)=>v+(part.drift?.[i]??0)*elapsed),rotation:part.spin?part.spin.map((v,i)=>(part.rotation?.[i]??0)+v*elapsed):null};}
// Equipo que lleva un personaje en una variante (gear[variant], salvo los de except): 'helmet', 'mask' o null.
export function gearFor(R,variant,characterId){const g=isObj(R?.gear)&&typeof variant==='string'&&Object.hasOwn(R.gear,variant)?R.gear[variant]:null;return g&&GEAR_KINDS.includes(g.kind)&&!(g.except||[]).includes(characterId)?g.kind:null;}
// La cámara del ensayo sigue a quien habla salvo a los de cameraIgnores.
export function cameraFollows(R,characterId){return !(Array.isArray(R?.cameraIgnores)&&R.cameraIgnores.includes(characterId));}
// Tipo de motor de un prop de secuencia: alias propio de propKinds o el tipo tal cual.
export function propKind(R,type){return isObj(R?.propKinds)&&typeof type==='string'&&Object.hasOwn(R.propKinds,type)?R.propKinds[type]:type;}
// Estado del enjambre del plano; acepta la clave heredada potatoes.
export function swarmState(staging){const v=staging?.swarm??staging?.potatoes;return typeof v==='string'?v:null;}
// Posición de un atrezo del director en la fracción f del plano: at; 'in' llega a at al final (at+delta·(f−1)); 'out' sale de at (at+delta·f).
export function propPosition(move,f,fallback=[0,0,0]){if(!isObj(move)||!vec3(move.at))return [...fallback];const d=vec3(move.delta)?move.delta:null;
 if(d&&move.kind==='in')return move.at.map((v,i)=>v+d[i]*(f-1));if(d&&move.kind==='out')return move.at.map((v,i)=>v+d[i]*f);return [...move.at];}
// Quién empuja el carro: staging.carrier si está en el plano; si no, el primer actor.
export function cartCarrier(staging,actorIds){const c=staging?.carrier;return typeof c==='string'&&actorIds.includes(c)?c:(actorIds[0]??null);}
// Hacia dónde mira el reparto: gesto (inclinación de cabeza), actor presente o punto con nombre del proyecto; null si no resuelve.
export function lookAt(look,actorIds,R){if(typeof look!=='string'||!look)return null;if(Object.hasOwn(LOOK_GESTURES,look))return {...LOOK_GESTURES[look]};if(actorIds.includes(look))return {actor:look};
 if(isObj(R?.lookTargets)&&Object.hasOwn(R.lookTargets,look)&&vec3(R.lookTargets[look]))return {point:[...R.lookTargets[look]]};return null;}
// staging con la clave heredada potatoes renombrada a swarm en la misma posición; si ya hay swarm no se toca.
export function upgradeStaging(staging){if(!isObj(staging)||!Object.hasOwn(staging,'potatoes')||Object.hasOwn(staging,'swarm'))return staging;return Object.fromEntries(Object.entries(staging).map(([k,v])=>[k==='potatoes'?'swarm':k,v]));}
// Mezcla superficial de un parche sobre staging; null borra la clave.
export function applyStagingPatch(staging,patch){const r={...staging};for(const [k,v] of Object.entries(patch||{})){if(v===null)delete r[k];else r[k]=structuredClone(v);}return r;}
// Copia del proyecto con upgradeStaging en todos los planos con staging y el parche de cada id aplicado; unknown = ids sin plano con staging.
export function patchProjectStaging(project,patches){const p=structuredClone(project),changed=[],seen=new Set();
 for(const e of p.episodes||[])for(const s of e.sequences||[])for(const t of s.shots||[]){if(!isObj(t.staging))continue;const before=JSON.stringify(t.staging);t.staging=upgradeStaging(t.staging);if(isObj(patches)&&Object.hasOwn(patches,t.id)){seen.add(t.id);t.staging=applyStagingPatch(t.staging,patches[t.id]);}if(JSON.stringify(t.staging)!==before)changed.push(t.id);}
 return {project:p,changed,unknown:Object.keys(isObj(patches)?patches:{}).filter(id=>!seen.has(id))};}
// Copia del proyecto con t[field] de cada plano de map (cualquier plano, tenga o no staging); null borra. unknown = ids sin plano.
export function patchShotField(project,field,map){const p=structuredClone(project),changed=[],seen=new Set(),m=isObj(map)?map:{};
 for(const e of p.episodes||[])for(const s of e.sequences||[])for(const t of s.shots||[]){if(!Object.hasOwn(m,t.id))continue;seen.add(t.id);const before=JSON.stringify(t[field]);if(m[t.id]===null)delete t[field];else t[field]=structuredClone(m[t.id]);if(JSON.stringify(t[field])!==before)changed.push(t.id);}
 return {project:p,changed,unknown:Object.keys(m).filter(id=>!seen.has(id))};}
// ---- Cámara del plano (t.cameraRig, #49; docs/ensayo-3d.md). Todo es función del tiempo, nunca del fotograma anterior: la vista en vivo y el render headless coinciden.
// fov vertical admitido en grados (cámaras del plano y del rig): de teleobjetivos largos (≈1°) a gran angular (100°).
export const CAMERA_FOV=[1,100];
export const CAMERA_RIG_TYPES=['fixed','move','follow','track','handheld'],CAMERA_EASINGS=['linear','smooth','ease-in','ease-out'];
const CAMERA_RIG_KEYS=['type','start','end','easing','hold','follow','track','trackSmoothing','shake','seed'];
const clamp01=v=>Math.min(1,Math.max(0,v));
const EASE={linear:f=>f,smooth:f=>f*f*(3-2*f),'ease-in':f=>f*f,'ease-out':f=>1-(1-f)*(1-f)};
const lerp=(a,b,f)=>a+(b-a)*f;
const camCopy=c=>({position:[...c.position],target:[...c.target],fov:c.fov});
const camLerp=(a,b,f)=>({position:a.position.map((v,i)=>lerp(v,b.position[i],f)),target:a.target.map((v,i)=>lerp(v,b.target[i],f)),fov:lerp(a.fov,b.fov??a.fov,f)});
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
// Semilla estable de un texto (FNV-1a de 32 bits).
export function seedOf(text){const s=String(text);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;}
function mulberry32(a){return ()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
// Posición y giro de un actor en el instante time con staging.moves, como stage.js: glide-out sale de su marca (at + delta·f); walk, glide-in y el resto llegan a ella (at + delta·(f−1)).
// Altura base: placement.y si es un número; si no, ground(x, z, 0) en la x, z del instante (suelo del entorno, #53); si no, 0. delta[1] se suma encima.
export function actorPositionAt(placement,move,time,duration,ground=null){const position=[placement.x,0,placement.z];let yaw=placement.yaw;
 if(isObj(move)&&Array.isArray(move.delta)){const f=clamp01(time/duration),d=[0,1,2].map(i=>move.delta[i]??0),k=move.kind==='glide-out'?f:f-1;for(let i=0;i<3;i++)position[i]+=d[i]*k;if(move.kind==='walk'||String(move.kind).startsWith('glide'))yaw=Math.atan2(d[0],d[2]);}
 position[1]+=Number.isFinite(placement.y)?placement.y:(ground?.(position[0],position[2],0)??0);return {position,yaw};}
// Contexto de cameraAt para un plano: semilla del temblor y dónde está cada actor (y su altura de foco) en cada instante; proxies a 1,45 m sobre el suelo; null si no está colocado.
export function cameraContext({shot,sequence,R=null,ground=null}){const proxies=proxiesOf(shot);return {seed:seedOf(shot?.id??''),at(id,time){const c=(sequence?.cast||[]).find(a=>a.character===id);
 if(c){const pl=effectivePlacement(c,shot?.staging?.placements?.[id]);return {position:actorPositionAt(pl,shot?.staging?.moves?.[id],time,shot?.duration,ground).position,focus:poseProfile(pl.pose,mountFor(R,id)).focus};}
 const v=proxies[id];return isObj(v)&&Number.isFinite(v.x)&&Number.isFinite(v.z)?{position:[v.x,ground?.(v.x,v.z,0)??0,v.z],focus:1.45}:null;}};}
// Suelo muestreado en una rejilla de cell metros con interpolación bilineal; probe(x, z, yRef) → altura o null (viewer/walk.mjs floorProbe).
// Cada esquina se pregunta una vez por yRef (redondeado a 10 cm); las esquinas sin suelo se ignoran y sin ninguna da null. fn.probes cuenta las llamadas a probe.
export function groundGrid(probe,{cell=.2}={}){const memo=new Map();const corner=(i,k,yRef)=>{const y=yRef.toFixed(1),key=`${i},${k},${y}`;if(!memo.has(key)){fn.probes++;const h=probe(i*cell,k*cell,+y);memo.set(key,Number.isFinite(h)?h:null);}return memo.get(key);};
 function fn(x,z,yRef=0){const gx=x/cell,gz=z/cell,i=Math.floor(gx),k=Math.floor(gz),u=gx-i,v=gz-k;let sum=0,wt=0;
  for(const [di,dk,w] of [[0,0,(1-u)*(1-v)],[1,0,u*(1-v)],[0,1,(1-u)*v],[1,1,u*v]]){const h=corner(i+di,k+dk,yRef);if(h===null)continue;sum+=h*w;wt+=w;}
  if(wt>0)return sum/wt;for(const [di,dk] of [[0,0],[1,0],[0,1],[1,1]]){const h=corner(i+di,k+dk,yRef);if(h!==null)return h;}return null;}
 fn.probes=0;return fn;}
// Calienta el suelo de un plano: cada colocación (con su staging.moves) en los instantes i/24 del plano y los staging.proxies; sin ground no hace nada.
export function warmGround(ground,{shot,placements=[]}={}){if(!ground)return;const d=shot?.duration||0;for(const pl of placements)for(let i=0;i<=Math.ceil(d*24);i++)actorPositionAt(pl,shot?.staging?.moves?.[pl.character],Math.min(d,i/24),d,ground);for(const v of Object.values(proxiesOf(shot)))if(isObj(v)&&Number.isFinite(v.x)&&Number.isFinite(v.z))ground(v.x,v.z,0);}
// Punto de mira del seguimiento: el actor a la altura de su foco; media con rampa lineal (más peso al presente) de 16 muestras en [t − w, t].
function followPoint(ctx,id,time,w){const p=at=>{const a=ctx.at(id,Math.max(0,at));return a?[a.position[0],a.position[1]+a.focus,a.position[2]]:null;};if(!(w>0))return p(time);
 const acc=[0,0,0];let total=0;for(let k=0;k<16;k++){const q=p(time-w+w*k/15);if(!q)return null;const wt=k+1;for(let i=0;i<3;i++)acc[i]+=q[i]*wt;total+=wt;}return acc.map(v=>v/total);}
function trackAt(rig,time){const k=(Array.isArray(rig.track)?rig.track:[]).filter(isObj);if(!k.length)return camCopy(rig.start);const fovs=[];let last=rig.start.fov;for(const s of k){last=s.fov??last;fovs.push(last);}
 const at=i=>({position:k[i].position,target:k[i].target,fov:fovs[i]});if(time<=k[0].t||k.length===1)return camCopy(at(0));if(time>=k.at(-1).t)return camCopy(at(k.length-1));
 const i=k.findIndex(s=>s.t>time)-1;return camLerp(at(i),at(i+1),(time-k[i].t)/(k[i+1].t-k[i].t));}
// Cámara del plano en el instante time: {position, target, fov} con arrays nuevos. ctx = cameraContext (actores y semilla).
export function cameraAt(rig,time,duration,ctx={}){const u=clamp01(duration>0?time/duration:0),start=rig.start,t=u*(duration>0?duration:0);
 const moved=()=>{if(!isObj(rig.end))return camCopy(start);const [h0,h1]=Array.isArray(rig.hold)?rig.hold:[0,1],f=h1>h0?clamp01((u-h0)/(h1-h0)):(u>=h1?1:0);return camLerp(start,rig.end,(EASE[rig.easing]||EASE.smooth)(f));};
 if(rig.type==='move')return moved();
 if(rig.type==='follow'){const id=rig.follow?.character,w=(rig.follow?.smoothing??.5)*1.5;if(typeof ctx.at!=='function')return camCopy(start);const P=followPoint(ctx,id,t,w),p0=followPoint(ctx,id,0,0);if(!P||!p0)return camCopy(start);const d=sub(P,p0);
  if(rig.follow.mode==='track')return vec3(rig.follow.offset)?{position:add(P,rig.follow.offset),target:[...P],fov:start.fov}:{position:add(start.position,d),target:add(start.target,d),fov:start.fov};return {position:[...start.position],target:add(start.target,d),fov:start.fov};}
 if(rig.type==='track'){const w=(rig.trackSmoothing??0)*1;if(!(w>0))return trackAt(rig,t);const a=Math.max(0,t-w/2),b=Math.min(duration,t+w/2),n=17,acc={position:[0,0,0],target:[0,0,0],fov:0};
  for(let i=0;i<n;i++){const c=trackAt(rig,lerp(a,b,i/(n-1)));for(let j=0;j<3;j++){acc.position[j]+=c.position[j]/n;acc.target[j]+=c.target[j]/n;}acc.fov+=c.fov/n;}return acc;}
 if(rig.type==='handheld'){const base=moved(),shake=rig.shake??.03;if(!(shake>0))return base;const rnd=mulberry32(rig.seed??ctx.seed??0),phase=Array.from({length:6},()=>rnd()*2*Math.PI);
  const noise=ph=>shake*(.6*Math.sin(2*Math.PI*.37*t+ph)+.3*Math.sin(2*Math.PI*.83*t+ph)+.1*Math.sin(2*Math.PI*1.71*t+ph));return {position:base.position.map((v,i)=>v+noise(phase[i])),target:base.target.map((v,i)=>v+noise(phase[3+i])),fov:base.fov};}
 return camCopy(start);}
// Variación de fov de un rig en [from, to] (por defecto el plano entero): fov inicial y final, extremos y zoom si varía más de 0,5°. Muestrea cameraAt y los instantes de la pista.
export function rigFovSpan(rig,duration,from=0,to=duration){const ts=[...Array.from({length:33},(_,i)=>lerp(from,to,i/32)),...(Array.isArray(rig?.track)?rig.track.filter(k=>isObj(k)&&k.t>=from&&k.t<=to).map(k=>k.t):[])],fovs=ts.map(t=>cameraAt(rig,t,duration).fov);
 const min=Math.min(...fovs),max=Math.max(...fovs);return {start:fovs[0],end:fovs[32],min,max,zoom:max-min>.5};}
// OPTICS con rig: la línea de siempre si la fov no varía en el tramo; si varía, un zum lento y continuo de la fov inicial a la final.
export function rigOpticsLine(rig,duration,from=0,to=duration,fov=cameraAt(rig,from,duration).fov,aspect=16/9){const z=rigFovSpan(rig,duration,from,to);if(!z.zoom)return opticsLine(fov,aspect);const a=opticsAnchor(z.start,aspect),b=opticsAnchor(z.end,aspect);
 return `${a.h}° to ${b.h}° horizontal field of view (about ${a.mm} mm to ${b.mm} mm full-frame equivalent): one slow continuous zoom ${z.end<z.start?'in':'out'} from the first frame to the last, exactly as in Video 1; perspective and depth of field change smoothly with it.`;}
// Errores y avisos de un cameraRig, en español y sin prefijo. duration, cast (reparto del plano) y positioned (ids con colocación) solo se comprueban si llegan.
export function cameraRigIssues(rig,{duration,cast,positioned}={}){const errors=[],warnings=[];if(!isObj(rig))return {errors:['debe ser un objeto'],warnings};
 const cam=(c,at)=>{if(!isObj(c))return errors.push(at+' debe ser una cámara {position, target, fov}');for(const k of ['position','target'])if(!vec3(c[k]))errors.push(`${at}.${k} debe tener 3 números`);if(!(Number.isFinite(c.fov)&&c.fov>=CAMERA_FOV[0]&&c.fov<=CAMERA_FOV[1]))errors.push(`${at}.fov debe estar entre ${CAMERA_FOV[0]} y ${CAMERA_FOV[1]}`);};
 const range=(k,max)=>{if(rig[k]!==undefined&&!(Number.isFinite(rig[k])&&rig[k]>=0&&rig[k]<=max))errors.push(`${k} debe estar entre 0 y ${String(max).replace('.',',')}`);};
 if(!CAMERA_RIG_TYPES.includes(rig.type))errors.push(`type debe ser ${CAMERA_RIG_TYPES.join(', ')}`);
 if(rig.start===undefined)errors.push('falta start');else cam(rig.start,'start');if(rig.end!==undefined)cam(rig.end,'end');else if(rig.type==='move')errors.push('move necesita end');
 if(rig.easing!==undefined&&!CAMERA_EASINGS.includes(rig.easing))errors.push(`easing debe ser ${CAMERA_EASINGS.join(', ')}`);
 if(rig.hold!==undefined&&!(Array.isArray(rig.hold)&&rig.hold.length===2&&rig.hold.every(Number.isFinite)&&rig.hold[0]>=0&&rig.hold[0]<rig.hold[1]&&rig.hold[1]<=1))errors.push('hold debe ser [inicio, fin] con 0 ≤ inicio < fin ≤ 1');
 if(rig.follow===undefined){if(rig.type==='follow')errors.push('follow necesita follow {character, mode}');}else if(!isObj(rig.follow))errors.push('follow debe ser un objeto');else{const f=rig.follow;
  if(typeof f.character!=='string'||!f.character)errors.push('follow.character debe ser el id de un personaje');else{if(Array.isArray(cast)&&!cast.includes(f.character))errors.push(`follow.character «${f.character}» no está en el reparto del plano`);if(Array.isArray(positioned)&&!positioned.includes(f.character))errors.push(`follow.character «${f.character}» no tiene colocación (reparto de la secuencia o staging.proxies)`);}
  if(f.mode!==undefined&&!['look','track'].includes(f.mode))errors.push('follow.mode debe ser look o track');if(f.offset!==undefined&&!vec3(f.offset))errors.push('follow.offset debe tener 3 números');if(f.smoothing!==undefined&&!(Number.isFinite(f.smoothing)&&f.smoothing>=0&&f.smoothing<=1))errors.push('follow.smoothing debe estar entre 0 y 1');
  for(const k of Object.keys(f))if(!['character','mode','offset','smoothing'].includes(k))warnings.push(`follow.${k}: clave desconocida`);}
 if(rig.track===undefined){if(rig.type==='track')errors.push('track necesita al menos una muestra');}else if(!Array.isArray(rig.track)||!rig.track.length)errors.push('track debe ser una lista con al menos una muestra');else{let prev=-Infinity;rig.track.forEach((s,i)=>{const at=`track[${i}]`;if(!isObj(s))return errors.push(at+' debe ser un objeto');
  if(!(Number.isFinite(s.t)&&s.t>=0))errors.push(at+'.t debe ser un número ≥ 0');else{if(s.t<=prev)errors.push(at+'.t debe ser mayor que el de la muestra anterior');if(Number.isFinite(duration)&&s.t>duration+1e-6)errors.push(`${at}.t pasa de la duración del plano (${duration} s)`);prev=s.t;}
  for(const k of ['position','target'])if(!vec3(s[k]))errors.push(`${at}.${k} debe tener 3 números`);if(s.fov!==undefined&&!(Number.isFinite(s.fov)&&s.fov>=CAMERA_FOV[0]&&s.fov<=CAMERA_FOV[1]))errors.push(`${at}.fov debe estar entre ${CAMERA_FOV[0]} y ${CAMERA_FOV[1]}`);});}
 range('trackSmoothing',1);range('shake',.5);if(rig.seed!==undefined&&!(Number.isInteger(rig.seed)&&rig.seed>=0))errors.push('seed debe ser un entero ≥ 0');
 for(const k of Object.keys(rig))if(!CAMERA_RIG_KEYS.includes(k))warnings.push(`${k}: clave desconocida`);
 return {errors,warnings};}
// Tipos de grabación: rigs de partida construidos desde la cámara actual; characters, ids o {id, name}.
export function cameraPresets(camera,{characters=[]}={}){const c=camCopy(camera),fx=c.target[0]-c.position[0],fz=c.target[2]-c.position[2],len=Math.hypot(fx,fz),right=len>1e-9?[-fz/len,0,fx/len]:[1,0,0],fwd=sub(c.target,c.position);
 const shift=(v,k)=>({position:c.position.map((x,i)=>x+v[i]*k),target:c.target.map((x,i)=>x+v[i]*k),fov:c.fov}),move=end=>({type:'move',start:camCopy(c),end,easing:'smooth'});
 const out=[{id:'fixed',label:'Plano fijo',rig:{type:'fixed',start:camCopy(c)}},{id:'truck-right',label:'Travelling lateral a la derecha',rig:move(shift(right,1.5))},{id:'truck-left',label:'Travelling lateral a la izquierda',rig:move(shift(right,-1.5))},
  {id:'dolly-in',label:'Acercamiento',rig:move({position:c.position.map((x,i)=>x+fwd[i]*.35),target:[...c.target],fov:c.fov})},{id:'dolly-out',label:'Alejamiento',rig:move({position:c.position.map((x,i)=>x-fwd[i]*.5),target:[...c.target],fov:c.fov})}];
 for(const ch of characters){const id=typeof ch==='string'?ch:ch?.id;if(typeof id!=='string')continue;const name=(typeof ch==='object'&&ch?.name)||id;
  out.push({id:'pan-follow:'+id,label:`Panorámica siguiendo a ${name}`,rig:{type:'follow',start:camCopy(c),follow:{character:id,mode:'look',smoothing:.5}}},{id:'follow:'+id,label:`Acompañar a ${name}`,rig:{type:'follow',start:camCopy(c),follow:{character:id,mode:'track',smoothing:.5}}});}
 out.push({id:'handheld',label:'Cámara en mano',rig:{type:'handheld',start:camCopy(c),shake:.03}},{id:'free',label:'Grabación libre',rig:{type:'track',start:camCopy(c),track:[{t:0,...camCopy(c)}],trackSmoothing:.5}});
 return out;}
// ---- Vista Animación (#50; docs/ensayo-3d.md): voz del navegador por personaje, reloj y líneas, grabación y recorte de la pista, edición del rig.
// Hablantes del capítulo sin repetir, por orden de primera aparición.
export function episodeSpeakers(episode){return uniq((episode?.sequences||[]).flatMap(s=>(s.shots||[]).flatMap(t=>(t.lines||[]).map(l=>l.character))));}
// Voz por defecto del navegador: las del idioma base (lang ^base, sin mayúsculas) repartidas por orden de hablante; '' si no hay.
export function ttsDefaultVoiceURI(voices,speakerIds,id,base){const re=new RegExp('^'+base+'\\b','i'),own=(voices||[]).filter(v=>re.test(v.lang||'')),i=Math.max(0,(speakerIds||[]).indexOf(id));return own[i%Math.max(1,own.length)]?.voiceURI||'';}
// Voz elegida (localStorage) o la de por defecto; una elección vacía vuelve a la de por defecto.
export function ttsVoiceURI({voices,speakerIds,id,saved,base}){return saved?.[id]||ttsDefaultVoiceURI(voices,speakerIds,id,base);}
// Parámetros de la utterance de una línea: texto hablado, idioma del proyecto y tono del personaje.
export function ttsParams(line,{speech,voicePitch,voiceURI,rate=1}){return {text:line.spokenText||line.text,lang:speech.locale,pitch:voicePitch?.[line.character]??1,rate,voiceURI};}
export const TIMELINE_FPS=24,TRACK_SMOOTHING_DEFAULT=.5;
const r3c=n=>Math.round(n*1000)/1000;
// Instante del scrub: múltiplo de 1/fps dentro de [0, duración], con 3 decimales.
export function snapTime(time,duration,fps=TIMELINE_FPS){const t=Math.round((Number(time)||0)*fps)/fps;return r3c(Math.min(Math.max(0,duration),Math.max(0,t)));}
// Avance del reloj: con bucle, al llegar al final vuelve a 0 (wrapped); sin bucle se queda en la duración (ended).
export function clockTick({time,duration,loop},dt){const next=time+Math.max(0,dt);if(next<duration)return {time:next,ended:false,wrapped:false};return loop?{time:0,ended:false,wrapped:true}:{time:duration,ended:true,wrapped:false};}
// Líneas del plano en el reloj, por inicio; fin acotado a la duración (estimatedDuration o 3 s).
export function lineSchedule(lines,duration,channels=projectChannels(null)){return (lines||[]).filter(l=>Number.isFinite(l?.start)).map(l=>({id:l.id,character:l.character,start:l.start,end:Math.min(duration,l.start+(l.estimatedDuration||3)),text:l.spokenText||l.text||'',offscreen:lineOffscreen(channels,l)})).sort((a,b)=>a.start-b.start);}
// Línea que hay que lanzar al pasar el reloj de prev a now: la última con prev < start ≤ now (con un salto grande, solo la última).
export function lineToLaunch(schedule,prev,now){return (schedule||[]).filter(l=>l.start>prev&&l.start<=now).at(-1)||null;}
// Línea en pantalla (subtítulo) en el instante time: la de mayor inicio con start ≤ time < end.
export function activeLineAt(schedule,time){return (schedule||[]).filter(l=>l.start<=time&&time<l.end).at(-1)||null;}
// Marcas de la línea de tiempo en % de la duración.
export function timelineMarks(schedule,duration){return (schedule||[]).map(l=>({id:l.id,at:l.start,pct:duration>0?r3c(Math.min(100,Math.max(0,l.start/duration*100))):0,label:l.text}));}
export function roundCamera(c,dp=3){const k=10**dp,r=v=>Math.round(v*k)/k;return {position:c.position.map(r),target:c.target.map(r),fov:r(c.fov)};}
// Grabación: una muestra por cada fotograma k/fps ya transcurrido y aún sin muestra (si el navegador va lento, repite la cámara actual). Nunca pasa de la duración.
export function recordSamples(track,time,camera,{duration,fps=TIMELINE_FPS}){const out=[...(track||[])],last=Math.floor(Math.min(time,duration)*fps+1e-9);for(let k=out.length;k<=last;k++)out.push({t:Math.min(r3c(k/fps),duration),...roundCamera(camera)});return out;}
// Recorte de una pista a [from, to]: extremos interpolados y las muestras interiores, sin desplazar tiempos.
export function trimTrack(track,from,to,{duration}){if(!(from<to))throw Error('El recorte necesita un inicio anterior al final');const rig={type:'track',start:track[0],track},at=x=>({t:r3c(x),...roundCamera(cameraAt(rig,x,duration))});
 const out=[];for(const s of [at(from),...track.filter(s=>s.t>from&&s.t<to).map(s=>at(s.t)),at(to)])if(!out.length||s.t>out.at(-1).t)out.push(s);return out;}
// Rig de una grabación: track con la primera muestra como start y el suavizado por defecto.
export function recordedRig(track,{smoothing}={}){const k=track[0];return {type:'track',start:{position:[...k.position],target:[...k.target],fov:k.fov},track:structuredClone(track),trackSmoothing:smoothing??TRACK_SMOOTHING_DEFAULT};}
// Borrador del editor: el rig del plano o uno fijo con su cámara; nunca comparte objetos con el proyecto.
export function rigFromShot(shot){return isObj(shot?.cameraRig)?structuredClone(shot.cameraRig):{type:'fixed',start:camCopy(shot.camera)};}
// Fijar inicio o fin con la cámara actual. Fin en un fijo lo convierte en movimiento; follow y track no tienen fin; track tampoco admite fijar el inicio.
export function rigWithCamera(rig,which,camera){const r=structuredClone(rig),c=camCopy(camera);
 if(which==='start'){if(r.type==='track')return {error:'La pista grabada fija su propio inicio: regraba o recórtala'};r.start=c;return {rig:r};}
 if(which!=='end')return {error:'Cámara desconocida: '+which};
 if(r.type==='fixed')return {rig:{...r,type:'move',end:c,easing:'smooth'}};if(r.type==='move'||r.type==='handheld'){r.end=c;return {rig:r};}
 return {error:r.type==='follow'?'El seguimiento no tiene cámara final: sigue al personaje hasta el último fotograma':'La pista grabada no tiene cámara final: regraba o recórtala'};}
// Cambio de tipo conservando start; quita las claves que el nuevo tipo no usa.
export function rigWithType(rig,type,{positioned=[]}={}){if(!CAMERA_RIG_TYPES.includes(type))return {error:'Tipo de cámara desconocido: '+type};if(rig.type===type)return {rig:structuredClone(rig)};const start=camCopy(rig.start),moving={...(isObj(rig.end)?{end:camCopy(rig.end)}:{}),...(rig.easing?{easing:rig.easing}:{}),...(Array.isArray(rig.hold)?{hold:[...rig.hold]}:{})};
 if(type==='fixed')return {rig:{type,start}};
 if(type==='move')return {rig:{type,start,end:camCopy(rig.end||start),...(rig.easing?{easing:rig.easing}:{}),...(Array.isArray(rig.hold)?{hold:[...rig.hold]}:{})}};
 if(type==='follow'){if(!positioned.length)return {error:'No hay nadie colocado a quien seguir'};return {rig:{type,start,follow:{character:positioned[0],mode:'look',smoothing:.5}}};}
 if(type==='track')return {rig:{type,start,track:[{t:0,...camCopy(start)}],trackSmoothing:TRACK_SMOOTHING_DEFAULT}};
 return {rig:{type,start,...moving,shake:rig.shake??.03,...(Number.isInteger(rig.seed)?{seed:rig.seed}:{})}};}
// Controles del editor que tienen sentido para cada tipo.
export function rigControls(type){const moving=type==='move'||type==='handheld';return {end:moving,easing:moving,hold:moving,follow:type==='follow',trackSmoothing:type==='track',trim:type==='track',shake:type==='handheld'};}
// Vuelo de la vista Animación (#52): cámara libre con teclado y ratón, sin alabeo. Estado {position,yaw,pitch,distance,velocity}; yaw 0 mira a -Z (como viewer/walk.mjs).
export const FLY_KEYS=['w','a','s','d','q','e','shift','arrowup','arrowdown','arrowleft','arrowright'],FLY_PITCH=1.45,FLY_SPEED={min:.25,max:20,default:2},FLY_FAST=3,FLY_TAU=.12,FLY_MAX_DT=.1,FLY_LOOK=.0025;
export function flyKey(key){const k=typeof key==='string'?key.toLowerCase():'';return FLY_KEYS.includes(k)?k:null;}
const flyDir=(yaw,pitch)=>[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
export function flyFromCamera({position,target}){const d=[0,1,2].map(i=>target[i]-position[i]);return {position:[...position],yaw:Math.atan2(-d[0],-d[2]),pitch:Math.atan2(d[1],Math.hypot(d[0],d[2])),distance:Math.max(1,Math.hypot(...d)),velocity:[0,0,0]};}
// Un paso: la mirada gira (el cabeceo no pasa de ±FLY_PITCH, o no empeora si ya estaba fuera) y la velocidad tiende a la deseada con constante FLY_TAU, integrada de forma exacta: el resultado no depende de cómo se reparta dt.
export function flyStep(state,{keys=[],look=[0,0],speed=FLY_SPEED.default,fast=false}={},dt=0){const h=Math.min(FLY_MAX_DT,Math.max(0,Number(dt)||0)),k=new Set([...keys].map(flyKey).filter(Boolean)),[lx,ly]=(look||[]).map(v=>Number(v)||0);
 const yaw=state.yaw-(lx||0)*FLY_LOOK,p0=state.pitch,pitch=Math.min(Math.max(FLY_PITCH,p0),Math.max(Math.min(-FLY_PITCH,p0),p0-(ly||0)*FLY_LOOK));
 const on=(...a)=>a.some(x=>k.has(x))?1:0,along=on('w','arrowup')-on('s','arrowdown'),side=on('d','arrowright')-on('a','arrowleft'),up=on('e')-on('q');
 const f=flyDir(yaw,pitch),r=[Math.cos(yaw),0,-Math.sin(yaw)],m=[0,1,2].map(i=>f[i]*along+r[i]*side+(i===1?up:0)),n=Math.hypot(...m),v=flySpeedStep(speed,0)*(fast||k.has('shift')?FLY_FAST:1);
 const vd=m.map(x=>n?x/n*v:0),v0=state.velocity||[0,0,0],e=Math.exp(-h/FLY_TAU);
 return {...state,yaw,pitch,velocity:vd.map((x,i)=>x+(v0[i]-x)*e),position:state.position.map((p,i)=>p+vd[i]*h+(v0[i]-vd[i])*FLY_TAU*(1-e))};}
export function flyCamera(state,fov){const d=flyDir(state.yaw,state.pitch);return {position:[...state.position],target:state.position.map((p,i)=>p+d[i]*state.distance),fov};}
// Preferencias del navegador (localStorage 'rodaje-anim-camera'): modo de Libre y velocidad de vuelo, acotadas.
export function flyPrefs(raw){return {mode:raw?.mode==='fly'?'fly':'orbit',speed:flySpeedStep(raw?.speed,0)};}
export function flySpeedStep(speed,deltaY){const s=Number(speed),b=typeof speed==='number'&&Number.isFinite(s)?s:FLY_SPEED.default,d=Number(deltaY)||0,x=d<0?b*1.15:d>0?b/1.15:b;return Math.min(FLY_SPEED.max,Math.max(FLY_SPEED.min,x));}
// «Inicio/Final de cámara» de la vista del plano: sin rig, camera/cameraEnd como siempre; con rig, además start/end del rig. anim: el cambio solo se hace en la vista Animación.
export function applyShotCamera(shot,which,camera){const t=structuredClone(shot),key=which==='start'?'camera':'cameraEnd';if(!isObj(t.cameraRig)){t[key]=camCopy(camera);return {shot:t};}
 const r=rigWithCamera(t.cameraRig,which,camera);if(r.error)return {error:r.error,anim:true};t.cameraRig=r.rig;t[key]=camCopy(camera);return {shot:t};}
// Planos de capítulo enlazados a una viñeta del storyboard (t.storyboardShot).
export function storyboardAnimTargets(project,storyboardShotId){const out=[];for(const e of project?.episodes||[])for(const s of e.sequences||[])for(const t of s.shots||[])if(t.storyboardShot===storyboardShotId)out.push({episode:e.id,sequence:s.id,shot:t.id});return out;}
// ---- Animación 3D de una viñeta (#51): el trabajo anim3d renderiza el plano enlazado a storyboards/<sb>/animacion-3d/<nombre>-vNN.mp4 (lib/animacion3d.mjs).
// Secuencia que ve el ensayo de un plano: su location, si la trae, manda sobre la de la secuencia (render-data y vista Animación).
export function stageSequence(s,t){return t?.location?{...s,location:t.location}:s;}
// Errores y avisos de la cámara del plano (su cameraRig o la fija de camera) con el reparto y las colocaciones de la vista Animación.
export function shotRigIssues(s,t){return cameraRigIssues(rigFromShot(t),{duration:t.duration,cast:shotCast(t,s),positioned:uniq([...(s?.cast||[]).map(a=>a.character),...Object.keys(proxiesOf(t))])});}
// ¿Se puede renderizar el plano? Errores: no existe, sin viñeta enlazada o inexistente, duración no positiva o cámara con errores.
export function anim3dReady(p,shotId){const out={errors:[],warnings:[],storyboard:null,storyboardShot:null,episode:null,sequence:null,shot:null};
 for(const e of p?.episodes||[])for(const s of e.sequences||[]){const t=(s.shots||[]).find(t=>t.id===shotId);if(t&&!out.shot)Object.assign(out,{episode:e,sequence:s,shot:t});}
 const t=out.shot;if(!t){out.errors.push('Plano no encontrado');return out;}
 if(!t.storyboardShot)out.errors.push('El plano no está enlazado a una viñeta del storyboard');
 else{for(const sb of p.storyboards||[]){const v=(sb.sequences||[]).flatMap(s=>s.shots||[]).find(v=>v.id===t.storyboardShot);if(v){out.storyboard=sb;out.storyboardShot=v;break;}}if(!out.storyboard)out.errors.push(`La viñeta ${t.storyboardShot} no está en ningún storyboard`);}
 if(!(Number.isFinite(t.duration)&&t.duration>0))out.errors.push('La duración del plano debe ser positiva');
 else{const r=shotRigIssues(out.sequence,t);out.errors.push(...r.errors.map(x=>'Cámara: '+x));out.warnings.push(...r.warnings.map(x=>'Cámara: '+x));}
 return out;}
// Nombre de los ficheros de una viñeta: su código si es único en el storyboard; si no, su id. Solo [A-Za-z0-9_-].
export function anim3dName(sb,v){const clean=x=>String(x).replace(/[^A-Za-z0-9_-]/g,'_'),n=(sb?.sequences||[]).flatMap(s=>s.shots||[]).filter(t=>t.code===v?.code).length;return v?.code&&n===1?clean(v.code):clean(v?.id);}
// Siguiente versión de un nombre: la mayor vNN del índice (de ese nombre) y de los ficheros <nombre>-vNN[.part].mp4, +1.
export function nextAnim3dVersion(entries,files,name){return nextAnimaticVersion((entries||[]).filter(e=>e?.name===name).map(e=>({step:name,version:e.version})),files,name);}
// Eventos de voz del plano para el ensayo y la mezcla: con audio (audioSeconds[id] = duración), fin recortado al plano y su clip; sin audio o si
// falta el fichero, fin por estimatedDuration o 3 s y silencio. Avisa de lo que recorta o falta; nunca lanza.
export function anim3dEvents(lines,duration,audioSeconds={},channels=projectChannels(null)){const events=[],clips=[],warnings=[],D=Number(duration)||0;
 for(const l of lines||[]){if(!isObj(l)||!Number.isFinite(l.start))continue;const start=Math.max(0,l.start),name=`«${clip(l.text)}»`;let end=null;
  if(l.audio){const s=audioSeconds?.[l.id];if(Number.isFinite(s)&&s>0){end=Math.min(D,start+s);if(start+s>D+.01)warnings.push(`El audio de ${name} termina a ${secs(start+s)}, fuera del plano (${secs(D)}): se recorta`);if(start<D)clips.push({audio:l.audio,start});}else warnings.push(`Falta el audio de ${name} (${l.audio}): ese tramo queda en silencio`);}
  if(end===null)end=Math.min(D,start+(l.estimatedDuration||3));if(end>start)events.push({...l,start,end,offscreen:lineOffscreen(channels,l)});}
 events.sort((a,b)=>a.start-b.start);return {events,clips,warnings};}
// Vídeos 3D del índice por viñeta para la tarjeta: {storyboard, shots:{viñeta:{current,list}}}; list de mayor a menor versión, sin ficheros ausentes.
export function anim3dGroups(index,sb,has=()=>true){const ids=new Set((sb?.sequences||[]).flatMap(s=>(s.shots||[]).map(t=>t.id))),shots={};
 for(const e of index?.entries||[]){if(!e?.file||!ids.has(e.storyboardShot)||!has(e.file))continue;(shots[e.storyboardShot]??={current:null,list:[]}).list.push(e);}
 for(const g of Object.values(shots)){g.list.sort((a,b)=>(b.version||0)-(a.version||0)||String(b.at||'').localeCompare(String(a.at||'')));g.current=g.list[0];}return {storyboard:sb?.id??null,shots};}
// Botón «Renderizar vídeo» de la vista Animación: con un trabajo en cola o en marcha, su progreso; desactivado con errores o trabajo activo.
export function anim3dButton(job,errors=[]){const busy=['queued','running'].includes(job?.status);return {label:busy?`Renderizando… ${Number.isFinite(job.progress)?job.progress:0} %`:'Renderizar vídeo',disabled:busy||(errors||[]).length>0};}
// Errores y avisos del staging y de la cámara (cameraRig) de un plano frente al reparto de su secuencia y la configuración del ensayo.
export function stagingIssues(shot,sequence,R,{characters}={}){const errors=[],warnings=[],st=shot?.staging;
 if(shot?.cameraRig!==undefined){const w=shot.id+': cameraRig: ',r=cameraRigIssues(shot.cameraRig,{duration:shot.duration,cast:shotCast(shot,sequence),positioned:uniq([...(sequence?.cast||[]).map(a=>a.character),...Object.keys(proxiesOf(shot))])});errors.push(...r.errors.map(e=>w+e));warnings.push(...r.warnings.map(e=>w+e));if(!r.errors.length){const z=rigFovSpan(shot.cameraRig,shot.duration);if(z.zoom)warnings.push(`${w}la cámara hace zum (fov vertical de ${z.start.toFixed(1)}° a ${z.end.toFixed(1)}°): OPTICS lo describe como un zum continuo`);}
  const ignored=[...(Array.isArray(shot.coverage)&&shot.coverage.length?['coverage']:[]),...(shot.cameraMotion!==undefined?['cameraMotion']:[])];if(ignored.length)warnings.push(`${shot.id}: cameraRig manda: se ignoran ${ignored.join(' y ')}`);}
 if(!isObj(st))return {errors,warnings};const at=shot.id+': ',cast=(sequence?.cast||[]).map(a=>a.character);
 if(st.swarm!==undefined&&!SWARM_STATES.includes(st.swarm))errors.push(`${at}swarm debe ser ${SWARM_STATES.join(', ')}`);
 if(Object.hasOwn(st,'potatoes'))warnings.push(at+'clave heredada potatoes: usa swarm');
 if(st.propMoves!==undefined){if(!isObj(st.propMoves))errors.push(at+'propMoves debe ser un objeto');else for(const [k,m] of Object.entries(st.propMoves)){const w=`${at}propMoves.${k}`;if(!DIRECTOR_MOVABLE.includes(k))warnings.push(`${w}: el director solo mueve ${DIRECTOR_MOVABLE.join(', ')}`);if(!isObj(m)){errors.push(w+' debe ser un objeto');continue;}
  if(!vec3(m.at))errors.push(w+'.at debe tener 3 números');if(m.delta!==undefined&&!vec3(m.delta))errors.push(w+'.delta debe tener 3 números');if(m.kind!==undefined&&m.kind!=='in'&&m.kind!=='out')errors.push(w+'.kind debe ser in u out');else if(m.kind!==undefined&&m.delta===undefined)errors.push(w+'.kind necesita delta');if(m.gait!==undefined&&typeof m.gait!=='boolean')errors.push(w+'.gait debe ser true o false');}}
 if(st.carrier!==undefined&&!cast.includes(st.carrier))errors.push(`${at}carrier «${st.carrier}» no está en el reparto de la secuencia`);
 if(typeof st.look==='string'&&st.look&&!lookAt(st.look,cast,R))warnings.push(`${at}look «${st.look}» no es un gesto, un actor del plano ni un punto de lookTargets`);
 if(Array.isArray(st.props)&&st.props.includes('dog')&&!isObj(st.propMoves?.dog))warnings.push(at+'dog en props sin propMoves.dog: queda en el origen');
 if(st.placements!==undefined){if(!isObj(st.placements))errors.push(at+'placements debe ser un objeto');else for(const [id,pl] of Object.entries(st.placements)){const w=`${at}placements.${id}`;if(!cast.includes(id))errors.push(`${w}: «${id}» no está en el reparto de la secuencia`);if(!isObj(pl)){errors.push(w+' debe ser un objeto');continue;}
  if(pl.pose!==undefined&&!POSES.includes(pl.pose))errors.push(`${w}.pose debe ser ${POSES.join(', ')}`);if(pl.mount!==undefined&&!LED_MOUNTS.includes(pl.mount))errors.push(`${w}.mount debe ser ${LED_MOUNTS.join(' o ')}`);for(const f of ['x','y','z','yaw'])if(pl[f]!==undefined&&!Number.isFinite(pl[f]))errors.push(`${w}.${f} debe ser un número`);
  if((pl.pose==='mounted'||pl.mount==='led')&&!mountFor(R,id).configured)warnings.push(`${w}: montura sin configurar en stage.rehearsal.mounts: caballo neutro`);}}
 if(st.environment!==undefined){const e=st.environment,w=at+'environment';if(!isObj(e))errors.push(w+' debe ser un objeto');else{for(const f of ['preset','spot'])if(e[f]!==undefined&&typeof e[f]!=='string')errors.push(`${w}.${f} debe ser texto`);if(e.state!==undefined&&!isObj(e.state))errors.push(w+'.state debe ser un objeto');if(e.rotation!==undefined&&!Number.isFinite(e.rotation))errors.push(w+'.rotation debe ser un número');for(const k of Object.keys(e))if(!['preset','state','spot','rotation'].includes(k))warnings.push(`${w}.${k}: el entorno solo lee preset, state, spot y rotation`);}}
 if(st.proxies!==undefined){if(!isObj(st.proxies))errors.push(at+'proxies debe ser un objeto');else for(const [id,v] of Object.entries(st.proxies)){const w=`${at}proxies.${id}`;if(Array.isArray(characters)&&!characters.includes(id))errors.push(`${w}: «${id}» no es un personaje del proyecto`);if(cast.includes(id))errors.push(`${w}: «${id}» ya está en el reparto de la secuencia: usa placements`);if(!isObj(v)){errors.push(w+' debe ser un objeto');continue;}
  for(const f of ['x','z'])if(!Number.isFinite(v[f]))errors.push(`${w}.${f} debe ser un número`);for(const k of Object.keys(v))if(k!=='x'&&k!=='z')warnings.push(`${w}.${k}: proxies solo lee x y z`);if(Array.isArray(shot.cast)&&!shot.cast.includes(id))warnings.push(`${w}: el plano declara cast sin «${id}»: no entra en el prompt`);}}
 return {errors,warnings};}
// Clave para reutilizar un stage con updateShot: secuencia, ambiente, variante, detalle y exterior del ensayo (las piezas del exterior solo se construyen en createStage); más poses y monturas del plano y su entorno, solo si los trae.
export function stageReuseKey(project,sequence,shot){const key=[sequence?.id,shot?.location||sequence?.location,shot?.variant||sequence?.variant,!!shot?.detail,rehearsalConfig(project,shot).exteriorKey];const poses=stagePoseKey(sequence,shot),environment=shot?.staging?.environment!==undefined?effectiveEnvironment(sequence?.environment,shot.staging.environment):undefined;return JSON.stringify(poses!==null||environment!==undefined?[...key,{poses,environment}]:key);}
// Poses y monturas del ensayo (#47). Sin pose o con una desconocida, el perfil «legado» de siempre: cuerpo sentado en caja con las alturas de pie.
export const POSES=['standing','seated','mounted'],MOUNT_KINDS=['horse','mule'],LED_MOUNTS=['led','none'],NEUTRAL_MOUNT_COLOR='#7d6b58',LED_OFFSET=[-.85,0,-.35];
// Proporciones de la montura en metros, con la silla en el origen: saddleY altura de la cadera del jinete; legLen, pivote de las patas; stride, metros por ciclo de paso.
const HORSE={saddleY:1.35,body:[.6,.55,1.6],bodyY:.885,neck:{len:.8,angle:.75},head:[.22,.28,.55],legLen:.85,legX:.2,legZ:[.62,-.62],tail:.6,stride:1.6};
export function mountRig(kind){if(kind!=='mule')return structuredClone(HORSE);const k=1.15/1.35,m=v=>Math.round(v*k*1000)/1000;return {saddleY:1.15,body:[m(.56),m(.55),m(1.5)],bodyY:m(.885),neck:{len:m(.72),angle:.8},head:[m(.22),m(.3),m(.58)],legLen:m(.85),legX:m(.2),legZ:[m(.58),m(-.58)],tail:m(.55),stride:m(1.5)};}
export function mountFor(R,characterId){const m=isObj(R?.mounts)&&Object.hasOwn(R.mounts,characterId)?R.mounts[characterId]:null;return m?{kind:m.kind,color:m.color,configured:true}:{kind:'horse',color:NEUTRAL_MOUNT_COLOR,configured:false};}
// Cuerpo, alturas (etiqueta, pecho, foco de cámara) y reglas de animación de una pose; mount es {kind} o el tipo.
export function poseProfile(pose,mount){if(pose==='standing')return {body:'standing',upperOnly:false,footLock:true,hipY:1,label:2.05,chest:1.38,focus:1.45};if(pose==='seated')return {body:'seated',upperOnly:true,footLock:false,hipY:.6,label:1.65,chest:1.02,focus:1.2};
 if(pose==='mounted'){const y=mountRig(typeof mount==='string'?mount:mount?.kind).saddleY;return {body:'mounted',upperOnly:true,footLock:false,hipY:y,label:Math.round((y+1.05)*100)/100,chest:Math.round((y+.42)*100)/100,focus:Math.round((y+.6)*100)/100};}
 return {body:'legacy',upperOnly:false,footLock:false,hipY:.6,label:2.05,chest:1.38,focus:1.45};}
// Patas [lf,rf,lh,rh], cuello y cabeza (rad) y respiración de la montura. Al paso: cuatro tiempos (LH, LF, RH, RF) con fase distance/stride·2π; quieta, respira y cabecea.
export function mountPose({time=0,distance=0,moving=false,seed=0,stride=HORSE.stride}={}){if(moving){const f=distance/stride*2*Math.PI,leg=o=>.35*Math.sin(f-o*2*Math.PI);return {legs:[leg(.25),leg(.75),leg(0),leg(.5)],neck:.06*Math.sin(2*f),head:.04*Math.sin(2*f+1),breathe:1};}
 return {legs:[0,0,0,0],neck:.05*Math.sin(time*.7+seed),head:.08*Math.sin(time*.7+seed+1.3),breathe:1+.01*Math.sin(time*1.4+seed)};}
// El clip solo mueve el tren superior: siempre talk; idle y walk en poses sentadas o montadas.
export function upperBodyClip(role,pose){return role==='talk'||poseProfile(pose).upperOnly;}
// Pesos [idle, talk, walk]. El jinete no anda: la montura da el paso.
export function actorWeights({pose,walking,talking}){if(pose==='mounted')return [1,talking?.28:0,0];return [walking?0:1,!walking&&talking?.28:0,walking?1:0];}
// Colocación de un personaje en el plano: la de la secuencia pisada por staging.placements[id]; sin montura si nadie la pide.
export function effectivePlacement(castPlacement,override){const a={...castPlacement,...(isObj(override)?override:{})};a.mount??='none';return a;}
// Entorno del plano: el de la secuencia con staging.environment encima (state clave a clave; null en state borra la clave).
export function effectiveEnvironment(seqEnv,shotEnv){if(!isObj(shotEnv))return seqEnv;const r={...seqEnv,...shotEnv};if(seqEnv?.state!==undefined||shotEnv.state!==undefined){const state={...(isObj(seqEnv?.state)?seqEnv.state:{}),...(isObj(shotEnv.state)?shotEnv.state:{})};for(const k of Object.keys(state))if(state[k]===null)delete state[k];r.state=state;}return r;}
// {id:{pose,mount}} de los personajes a los que el plano cambia la pose o la montura; null si no cambia ninguna.
export function stagePoseKey(sequence,shot){const out={},over=shot?.staging?.placements;if(!isObj(over))return null;for(const c of sequence?.cast||[]){if(!Object.hasOwn(over,c.character))continue;const a=effectivePlacement(c,over[c.character]),b=effectivePlacement(c);if(a.pose!==b.pose||a.mount!==b.mount)out[c.character]={pose:a.pose??null,mount:a.mount};}return Object.keys(out).length?out:null;}
// Poses del reparto de una secuencia: pose desconocida, error; a caballo o con montura llevada sin montura configurada, aviso.
export function castIssues(sequence,R){const errors=[],warnings=[],at=(sequence?.id||'secuencia')+': ';for(const c of sequence?.cast||[]){if(c.pose!==undefined&&!POSES.includes(c.pose))errors.push(`${at}pose «${c.pose}» de «${c.character}» debe ser ${POSES.join(', ')}`);if(c.mount!==undefined&&!LED_MOUNTS.includes(c.mount))errors.push(`${at}mount «${c.mount}» de «${c.character}» debe ser ${LED_MOUNTS.join(' o ')}`);if((c.pose==='mounted'||c.mount==='led')&&!mountFor(R,c.character).configured)warnings.push(`${at}«${c.character}» lleva montura sin configurar en stage.rehearsal.mounts: caballo neutro`);}return {errors,warnings};}
// Instantánea de un lote o trabajo: sin stage toma el del proyecto vivo; con stage conserva el suyo (rehearsal incluido) y completa del vivo las claves del catálogo que no traiga.
// Después completa, canal a canal por id, el prompt de los canales de la instantánea que no lo traigan (#42); no añade canales.
export function stageFallback(snapshot,live){if(!snapshot?.stage)return {...snapshot,stage:live?.stage};const add=isObj(live?.stage)?STAGE_CATALOG_KEYS.filter(k=>!Object.hasOwn(snapshot.stage,k)&&Object.hasOwn(live.stage,k)):[];let out=add.length?{...snapshot,stage:{...snapshot.stage,...Object.fromEntries(add.map(k=>[k,live.stage[k]]))}}:snapshot;
 const own=out.stage.channels,lc=isObj(live?.stage)?live.stage.channels:null;if(Array.isArray(own)&&Array.isArray(lc)){let changed=false;const channels=own.map(c=>{if(!isObj(c)||Object.hasOwn(c,'prompt'))return c;const l=lc.find(x=>isObj(x)&&x.id===c.id&&Object.hasOwn(x,'prompt'));if(!l)return c;changed=true;return {...c,prompt:l.prompt};});if(changed)out={...out,stage:{...out.stage,channels}};}
 return out;}

// ---- Catálogo del proyecto en proyecto.stage (variants, zones, channels, defaultVariant); formato en docs/ensayo-3d.md.
// Integrados: variante '' (diseño base), zona other y canales direct y pa (fuera de campo). El catálogo cambia su etiqueta, su color y su prompt, no su comportamiento.
// offscreen: voz sin cuerpo (no se genera en el bloque, no mueve la boca en el ensayo, exime del reparto). speakLight: enciende la luz de habla en el ensayo.
export const BASE_VARIANT={id:'',label:'Diseño base'};
export const BASE_ZONE={id:'other',label:'Sin zona'};
export const BASE_CHANNELS=[{id:'direct',label:'Directo',offscreen:false,speakLight:false},{id:'pa',label:'Voz en off',color:'#8a4d7a',offscreen:true,speakLight:false}];
export const STAGE_CATALOG_KEYS=['variants','zones','channels','defaultVariant'];
const HEX=/^#[0-9a-f]{6}$/i,VARIANT_ID=/^[a-z][a-z0-9-]*$/,CHANNEL_ID=/^[a-z]+$/;
const CATALOG_FIELDS={variants:['id','label'],zones:['id','label','color','variant'],channels:['id','label','color','offscreen','speakLight','prompt']};
const CHANNEL_PROMPT_KEYS=['voice','offscreen','direction'];
// prompt de un canal del catálogo: solo voice, offscreen y direction con texto; sin ninguno, sin clave.
const promptOf=c=>{const p=isObj(c.prompt)?Object.fromEntries(CHANNEL_PROMPT_KEYS.filter(k=>labelOk(c.prompt[k])).map(k=>[k,c.prompt[k]])):{};return Object.keys(p).length?{prompt:p}:{};};
const catalogList=(project,k)=>Array.isArray(project?.stage?.[k])?project.stage[k]:[];
const labelOk=v=>typeof v==='string'&&!!v.trim();
const colorOf=v=>HEX.test(v?.color||'')?{color:v.color}:{};
export function projectVariants(project){const out=[{...BASE_VARIANT}];let base=false;
 for(const v of catalogList(project,'variants')){if(!isObj(v)||typeof v.id!=='string'||!(v.id===''||VARIANT_ID.test(v.id))||!labelOk(v.label))continue;if(v.id===''){if(!base)out[0]={id:'',label:v.label};base=true;continue;}if(!out.some(x=>x.id===v.id))out.push({id:v.id,label:v.label});}
 return out;}
export function projectZones(project){const variants=projectVariants(project).map(v=>v.id).filter(Boolean),out=[];
 for(const z of catalogList(project,'zones')){if(!isObj(z)||typeof z.id!=='string'||!VARIANT_ID.test(z.id)||!labelOk(z.label)||out.some(x=>x.id===z.id))continue;
  out.push(z.id===BASE_ZONE.id?{...BASE_ZONE,label:z.label,...colorOf(z)}:{id:z.id,label:z.label,...colorOf(z),...(variants.includes(z.variant)?{variant:z.variant}:{})});}
 if(!out.some(z=>z.id===BASE_ZONE.id))out.push({...BASE_ZONE});return out;}
export function projectChannels(project){const out=[];
 for(const c of catalogList(project,'channels')){if(!isObj(c)||typeof c.id!=='string'||!CHANNEL_ID.test(c.id)||!labelOk(c.label)||out.some(x=>x.id===c.id))continue;const base=BASE_CHANNELS.find(b=>b.id===c.id);
  out.push(base?{...base,label:c.label,...colorOf(c),...promptOf(c)}:{id:c.id,label:c.label,...colorOf(c),offscreen:c.offscreen===true,speakLight:c.speakLight===true,...promptOf(c)});}
 const [direct,pa]=BASE_CHANNELS;if(!out.some(c=>c.id===direct.id))out.unshift({...direct});if(!out.some(c=>c.id===pa.id))out.push({...pa});return out;}
export function projectDefaultVariant(project){const v=project?.stage?.defaultVariant;return typeof v==='string'&&projectVariants(project).some(x=>x.id===v)?v:'';}
// Canal de una línea: ''/null → direct; desconocido → entrada sin comportamiento marcada unknown (se muestra y se conserva).
export function channelOf(channels,id){if(id===undefined||id===null||id==='')id='direct';return (channels||[]).find(c=>c.id===id)||(id==='direct'?{...BASE_CHANNELS[0]}:{id,label:String(id),offscreen:false,speakLight:false,unknown:true});}
export function zoneOf(project,id){const zones=projectZones(project);if(id===undefined||id===null||id==='')id=BASE_ZONE.id;return zones.find(z=>z.id===id)||{id,label:String(id),unknown:true};}
export function lineOffscreen(channels,line){return !!line?.offscreen||!!channelOf(channels,line?.channel).offscreen;}
export function zoneVariant(project,zoneId){return zoneOf(project,zoneId).variant||'';}
// Opciones de un selector: [id, etiqueta] del catálogo y, si el valor actual no está, él mismo (no se pierde al guardar). En canales '' es direct.
export function catalogOptions(list,current,{channel=false}={}){const opts=(list||[]).map(e=>[e.id,e.label]);const cur=channel&&(current===undefined||current===null||current==='')?'direct':current;if(cur!==undefined&&cur!==null&&cur!==''&&!opts.some(([id])=>id===cur))opts.push([cur,String(cur)]);return opts;}
export function channelShort(entry){return String(entry?.label??'').split(' ·')[0];}
// Color del catálogo como variable CSS para style="…"; solo #rrggbb, nada más llega al atributo.
export function catalogStyle(entry,name){return HEX.test(entry?.color||'')?`--${name}:${entry.color}`:'';}
export function stageCatalogErrors(stage){if(stage===undefined||stage===null)return [];if(!isObj(stage))return ['stage debe ser un objeto'];const errors=[];
 const variantIds=[''];
 for(const k of ['variants','zones','channels']){const list=stage[k];if(list===undefined)continue;if(!Array.isArray(list)){errors.push(`${k} debe ser una lista`);continue;}const seen=new Set();
  list.forEach((e,i)=>{const at=`${k}[${i}]`;if(!isObj(e))return errors.push(at+' debe ser un objeto');
   for(const f of Object.keys(e))if(!CATALOG_FIELDS[k].includes(f))errors.push(`${at}: clave desconocida «${f}»`);
   const re=k==='channels'?CHANNEL_ID:VARIANT_ID,idOk=typeof e.id==='string'&&(re.test(e.id)||(k==='variants'&&e.id===''));
   if(!idOk)errors.push(`${at}.id ${JSON.stringify(e.id)} no válido (${k==='channels'?'solo letras minúsculas':k==='variants'?'minúsculas, dígitos y guiones, empezando por letra, o "" para el diseño base':'minúsculas, dígitos y guiones, empezando por letra'})`);
   else if(seen.has(e.id))errors.push(`${at}.id «${e.id}» repetido`);else{seen.add(e.id);if(k==='variants')variantIds.push(e.id);}
   if(!labelOk(e.label))errors.push(at+'.label debe ser un texto no vacío');
   if(e.color!==undefined&&!HEX.test(typeof e.color==='string'?e.color:''))errors.push(at+'.color debe ser #rrggbb');
   if(k==='channels')for(const f of ['offscreen','speakLight'])if(e[f]!==undefined){if(typeof e[f]!=='boolean')errors.push(`${at}.${f} debe ser true o false`);else if(BASE_CHANNELS.some(b=>b.id===e.id))errors.push(`${at}.${f}: el canal integrado «${e.id}» solo admite label, color y prompt`);}
   if(k==='channels'&&e.prompt!==undefined){if(!isObj(e.prompt))errors.push(at+'.prompt debe ser un objeto');else for(const [f,v] of Object.entries(e.prompt)){if(!CHANNEL_PROMPT_KEYS.includes(f))errors.push(`${at}.prompt: clave desconocida «${f}» (solo ${CHANNEL_PROMPT_KEYS.join(', ')})`);else if(!labelOk(v))errors.push(`${at}.prompt.${f} debe ser un texto no vacío`);}}});}
 if(Array.isArray(stage.zones))stage.zones.forEach((z,i)=>{if(!isObj(z)||z.variant===undefined)return;const at=`zones[${i}].variant`;if(z.id===BASE_ZONE.id)errors.push(`${at}: la zona integrada «${BASE_ZONE.id}» solo admite label y color`);else if(typeof z.variant!=='string'||!z.variant||!variantIds.includes(z.variant))errors.push(`${at} ${JSON.stringify(z.variant)} no es una variante del catálogo`);});
 if(stage.defaultVariant!==undefined&&!(typeof stage.defaultVariant==='string'&&variantIds.includes(stage.defaultVariant)))errors.push(`defaultVariant ${JSON.stringify(stage.defaultVariant)} no es una variante del catálogo`);
 return errors;}
// ---- Textos de prompt del proyecto (#42): registro.json guarda sound y constraints por zona ({<variante>|default}, como lighting) y texts
// (fragmentos que no dependen de la zona; texts.frame, los del modo fotograma, #43); el catálogo guarda el texto de cada canal en stage.channels[].prompt. Formato en docs/PROCESO.md.
// Sin textos: sonido [[SOUND]], sin restricciones por zona ni PHYSICS, y los neutros de NEUTRAL_TEXTS donde la frase necesita sujeto.
export const REGISTRY_TEXT_KEYS=['sound','constraints','texts'];
export const NEUTRAL_TEXTS={people:'the cast',physics:{},swarm:{label:'',none:''},retention:{character:'costume and props',guide:''},quality:{costume:'costumes',details:''},tasks:{idle:'',fallback:'The take continues exactly as in Video 1.'},offscreen:{where:''},frame:{keep:'face, hair, costume and prop',changes:'clothes',physics:'',quality:'identities and costumes',present:'people'}};
export const OFFSCREEN_NOUN='voice';
const TEXT_GROUPS={swarm:['label','none'],retention:['character','guide'],quality:['costume','details'],tasks:['idle','fallback'],offscreen:['where'],frame:['keep','changes','physics','quality','present']},PHYSICS_KEY=/^[a-z]+$/,ZONE_TEXT_KEY=/^(default|[a-z][a-z0-9-]*)$/;
// map[key] si es un texto; si no, map[fallback]; si no, ''.
export function pickText(map,key,fallback='default'){const m=isObj(map)?map:{};return labelOk(m[key])?m[key]:labelOk(m[fallback])?m[fallback]:'';}
// Zona del prompt: la variante de la secuencia o la variante por defecto del catálogo; '' sin ninguna.
export function promptZone(project,sequence){const v=sequence?.variant;return typeof v==='string'&&v?v:projectDefaultVariant(project);}
export function promptTexts(registry){const t=isObj(registry?.texts)?registry.texts:{},N=NEUTRAL_TEXTS;
 const group=g=>{const src=isObj(t[g])?t[g]:{};return Object.fromEntries(TEXT_GROUPS[g].map(k=>[k,labelOk(src[k])?src[k]:N[g][k]]));};
 return {people:labelOk(t.people)?t.people:N.people,physics:Object.fromEntries(Object.entries(isObj(t.physics)?t.physics:{}).filter(([k,v])=>PHYSICS_KEY.test(k)&&labelOk(v))),...Object.fromEntries(Object.keys(TEXT_GROUPS).map(g=>[g,group(g)]))};}
// Texto de prompt de un canal: canal desconocido → el de direct; conocido sin prompt → {}.
export function channelPrompt(channels,id){const ch=channelOf(channels,id),src=ch.unknown?channelOf(channels,'direct'):ch;return isObj(src.prompt)?{...src.prompt}:{};}
export function registryTextErrors(registry){if(!isObj(registry))return [];const errors=[];
 for(const k of ['sound','constraints']){const m=registry[k];if(m===undefined)continue;if(!isObj(m)){errors.push(k+' debe ser un objeto');continue;}for(const [z,v] of Object.entries(m)){if(!ZONE_TEXT_KEY.test(z))errors.push(`${k}: clave «${z}» no válida (id de variante o default)`);else if(!labelOk(v))errors.push(`${k}.${z} debe ser un texto no vacío`);}}
 const t=registry.texts;if(t===undefined)return errors;if(!isObj(t))return [...errors,'texts debe ser un objeto'];
 for(const [k,v] of Object.entries(t)){if(k==='people'){if(!labelOk(v))errors.push('texts.people debe ser un texto no vacío');}
  else if(k==='physics'){if(!isObj(v)){errors.push('texts.physics debe ser un objeto');continue;}for(const [g,x] of Object.entries(v)){if(!PHYSICS_KEY.test(g))errors.push(`texts.physics: clave «${g}» no válida (solo minúsculas)`);else if(!labelOk(x))errors.push(`texts.physics.${g} debe ser un texto no vacío`);}}
  else if(TEXT_GROUPS[k]){if(!isObj(v)){errors.push(`texts.${k} debe ser un objeto`);continue;}for(const [f,x] of Object.entries(v)){if(!TEXT_GROUPS[k].includes(f))errors.push(`texts.${k}: clave desconocida «${f}» (solo ${TEXT_GROUPS[k].join(', ')})`);else if(!labelOk(x))errors.push(`texts.${k}.${f} debe ser un texto no vacío`);}}
  else errors.push(`texts: clave desconocida «${k}» (solo people, physics, ${Object.keys(TEXT_GROUPS).join(', ')})`);}
 return errors;}
// Avisos: claves por zona que no son variantes del catálogo y, si el registro tiene sonido, variantes sin sonido ni default.
export function registryTextIssues(registry,project){if(!isObj(registry))return [];const variants=projectVariants(project).map(v=>v.id).filter(Boolean),out=[];
 for(const k of ['lighting','sound','constraints'])if(isObj(registry[k]))for(const z of Object.keys(registry[k]))if(z!=='default'&&!variants.includes(z))out.push(`${k}: «${z}» no es una variante del catálogo`);
 if(isObj(registry.sound)&&Object.keys(registry.sound).length)for(const v of variants)if(!labelOk(registry.sound[v])&&!labelOk(registry.sound.default))out.push(`variante «${v}» sin sound ni sound.default: saldrá [[SOUND]]`);
 return out;}
// Aplica un parche de textos: solo REGISTRY_TEXT_KEYS; presente reemplaza, null borra, ausente no toca. Sin cambios devuelve el mismo registro.
export function mergeRegistryTexts(registry,patch){if(!isObj(patch))return {registry,changed:[],errors:['el parche debe ser un objeto']};
 const bad=Object.keys(patch).filter(k=>!REGISTRY_TEXT_KEYS.includes(k));if(bad.length)return {registry,changed:[],errors:bad.map(k=>`clave «${k}» no admitida (solo ${REGISTRY_TEXT_KEYS.join(', ')})`)};
 const next={...registry},changed=[];for(const k of REGISTRY_TEXT_KEYS){if(!Object.hasOwn(patch,k))continue;const v=patch[k];
  if(v===null){if(Object.hasOwn(next,k)){delete next[k];changed.push(k);}}else if(JSON.stringify(next[k])!==JSON.stringify(v)){next[k]=structuredClone(v);changed.push(k);}}
 const errors=registryTextErrors(next);if(errors.length)return {registry,changed:[],errors};if(!changed.length)return {registry,changed,errors};
 const out={};for(const k of ['version','summary','lighting',...REGISTRY_TEXT_KEYS])if(Object.hasOwn(next,k))out[k]=next[k];for(const k of Object.keys(next))if(!Object.hasOwn(out,k))out[k]=next[k];
 return {registry:out,changed,errors:[]};}
// Avisos: valores de los datos que no están en el catálogo (se muestran y se conservan, pero sin etiqueta ni comportamiento).
export function catalogIssues(project){const variants=projectVariants(project).map(v=>v.id),zones=projectZones(project).map(z=>z.id),channels=projectChannels(project).map(c=>c.id),found=new Map();
 const note=(what,value,list)=>{if(value===undefined||value===null||value===''||list.includes(value))return;const k=what+'\u0000'+value;found.set(k,(found.get(k)||0)+1);};
 for(const e of project?.episodes||[])for(const s of e.sequences||[]){note('variante de secuencia',s.variant,variants);for(const t of s.shots||[]){note('variante de plano',t.variant,variants);for(const l of t.lines||[])note('canal de línea',l.channel,channels);}}
 for(const b of project?.storyboards||[])for(const s of b.sequences||[])for(const t of s.shots||[]){note('zona de viñeta',t.zone,zones);for(const l of t.dialogue||[])note('canal de diálogo de storyboard',l.channel,channels);}
 for(const c of project?.characters||[])for(const v of Object.keys(isObj(c.variants)?c.variants:{}))note('variante de personaje',v,variants);
 return [...found].map(([k,n])=>{const [what,value]=k.split('\u0000');return `${what} «${value}» fuera del catálogo (${n})`;});}

// ── Dirección por lote (assets/<lote>/direccion.json, modo fotograma) y estados de personaje del registro ──
// Nombre en mayúsculas del personaje: prefijo «NOMBRE:» de su descriptor (base antes que variante); si no, shortName.
const characterAsset=(registry,id)=>{const assets=Object.entries(registry?.assets||{});return assets.find(([,a])=>a.kind==='character'&&a.character===id&&!a.variant)||assets.find(([,a])=>a.kind==='character'&&a.character===id)||null;};
export function characterName(registry,project,id){return /^([A-Z][A-Z' -]+):/.exec(characterAsset(registry,id)?.[1]?.descriptor||'')?.[1]||shortName(project,id);}
const DIR_TEXT=['camera','action','acting','local','people'];
// Rellena los huecos del esqueleto de framePrompt con la entrada del bloque. [[LOCAL]] = frase de reparto + local + locks aplicables.
export function applyDireccion(prompt,d,{names=[],locks=[],image=null}={}){const warnings=[];let p=prompt;const who=d.people||names.join(', ');
 if(d.people)p=p.replace(/Exactly \d+ (people|person) in the scene[^.]*\./,()=>`People in the scene: ${d.people}.`);
 const L=(locks||[]).map(l=>typeof l==='string'?{text:l}:l).filter(l=>l.when!=='cast'||names.length).map(l=>l.text);
 const local=[who?`The people in the scene are only ${who}; nobody else enters the frame.`:'',d.local,...L].filter(Boolean).join(' ');
 for(const [k,h,v] of [['camera','[[CAMERA]]',d.camera],['action','[[ACTION]]',d.action],['local','[[LOCAL]]',local]]){if(!v)continue;if(p.includes(h))p=p.replace(h,()=>v);else if(d[k])warnings.push(`direccion.${k} no se aplica: el esqueleto ya trae ${k.toUpperCase()}`);}
 if(d.acting){const re=/^CHARACTER ACTING: [\s\S]*?(?=^(?:PHYSICS|LIGHTING): )/m;if(re.test(p))p=p.replace(re,()=>`CHARACTER ACTING: ${d.acting}\n`);else warnings.push('direccion.acting no se aplica: falta CHARACTER ACTING antes de PHYSICS o LIGHTING');}
 if(d.fin&&!image)warnings.push('direccion.fin sin fotograma: no hay endImage');
 const emo=forbiddenEmotionWords((d.acting||'')+' '+(d.local||''));if(emo.length)warnings.push(`Palabras de emoción en la dirección: ${emo.join(', ')} (skill interpretacion)`);
 return {prompt:p,refsPatch:d.fin?{endImage:image}:{},warnings};}
export function direccionErrors(d){if(!isObj(d))return ['debe ser un objeto'];const errors=[];
 if(d.blocks===undefined&&Object.keys(d).some(k=>/^b\d+$/.test(k)))return ['formato antiguo: mueve los bloques a "blocks" y las coletillas a "locks"'];
 if(d.blocks!==undefined&&!isObj(d.blocks))errors.push('blocks debe ser un objeto {bNN: {...}}');
 for(const [id,b] of Object.entries(isObj(d.blocks)?d.blocks:{})){if(!isObj(b)){errors.push(`blocks.${id} debe ser un objeto`);continue;}for(const k of DIR_TEXT)if(b[k]!==undefined&&typeof b[k]!=='string')errors.push(`blocks.${id}.${k} debe ser texto`);if(b.fin!==undefined&&typeof b.fin!=='boolean')errors.push(`blocks.${id}.fin debe ser true o false`);}
 if(d.locks!==undefined){if(!Array.isArray(d.locks))errors.push('locks debe ser una lista');else d.locks.forEach((l,i)=>{if(typeof l==='string')return;if(!isObj(l)||typeof l.text!=='string'||(l.when!==undefined&&!['cast','always'].includes(l.when)))errors.push(`locks[${i}] debe ser texto o {text, when: "cast"|"always"}`);});}
 return errors;}
// Entrada de un bloque; lee también el formato antiguo (bNN en la raíz) para la vista Montaje.
export function direccionBlock(d,blockId){return d?.blocks?.[blockId]??(d?.blocks?null:d?.[blockId])??null;}
// Dónde escribe prompt.mjs: con direccion.json, un bloque sin entrada y con prompt.txt no se toca salvo que se nombre.
export function promptTargets({exists,force,hasDireccion,directed,named}){if(hasDireccion&&!directed&&exists&&!named)return {skip:true,promptFile:null,writeRefs:false};return {skip:false,promptFile:exists&&!force?'prompt.generated.txt':'prompt.txt',writeRefs:true};}
// refs.json nuevo: con dirección manda fin; sin dirección se conserva el endImage anterior. endImage siempre al final.
export function mergeRefs(fresh,old,{directed=false,patch={}}={}){const {endImage:_,...out}=fresh||{};const end=directed?patch.endImage:old?.endImage;return end?{...out,endImage:end}:out;}
export function parseCastRef(ref){const s=String(ref||''),i=s.indexOf('@');return i<0?{id:s,state:null}:{id:s.slice(0,i),state:s.slice(i+1)};}
// Estados en el asset del personaje: "states": {"a-pie": {"drop": [", on horseback"], "note": "on foot, …"}}. Sin herencia.
function applyState(descriptor,st){let d=descriptor;const missing=[];for(const x of st.drop||[]){if(d.includes(x))d=d.replace(x,'');else missing.push(x);}if(st.note)d=d.replace(/\.\s*$/,'')+'; '+st.note;return {descriptor:d,missing};}
export function resolveDescriptor(registry,ref){const {id,state}=parseCastRef(ref);const e=characterAsset(registry,id);const out={id,state,tag:e?.[0]||null,name:characterName(registry,null,id),descriptor:e?.[1]?.descriptor||'',errors:[]};
 if(!e){out.errors.push(`Sin entrada de registro para ${id}`);return out;}if(!state)return out;
 const st=e[1].states?.[state];if(!isObj(st)){out.errors.push(`${e[0]}: estado desconocido «${state}»${Object.keys(e[1].states||{}).length?` (hay ${Object.keys(e[1].states).join(', ')})`:''}`);return out;}
 const r=applyState(out.descriptor,st);for(const x of r.missing)out.errors.push(`${e[0]}@${state}: no se encuentra «${x}» en el descriptor`);out.descriptor=r.descriptor;return out;}
export function stateErrors(tag,asset){const errors=[];if(asset?.states===undefined)return errors;if(!isObj(asset.states))return [`${tag}: states debe ser un objeto`];
 for(const [s,st] of Object.entries(asset.states)){if(!isObj(st)){errors.push(`${tag}@${s}: debe ser un objeto {drop, note}`);continue;}if(st.drop!==undefined&&(!Array.isArray(st.drop)||st.drop.some(x=>typeof x!=='string'||!x)))errors.push(`${tag}@${s}: drop debe ser una lista de textos`);if(st.note!==undefined&&typeof st.note!=='string')errors.push(`${tag}@${s}: note debe ser texto`);if(!st.drop?.length&&!st.note)errors.push(`${tag}@${s}: sin drop ni note`);
  if(Array.isArray(st.drop))for(const x of applyState(asset.descriptor||'',{drop:st.drop.filter(x=>typeof x==='string'&&x)}).missing)errors.push(`${tag}@${s}: no se encuentra «${x}» en el descriptor`);}
 return errors;}

// ---- Escaleta y storys (#56). Una sola lista episodes[].sequences[] con tres papeles deducidos: ficha de escaleta (carátula, texto, minutos),
// contenedor de los planos de un story (sequence.storyboard de un story enlazado) y prueba (test:true, fuera de la escaleta). El story apunta a su
// ficha (storyboards[].outlineSequence) y la ficha marca el vigente (currentStoryboard). Sin enlaces todo es ficha, como antes. Puras: no mutan.
export const OUTLINE_FIELDS=['minutes','text','coverPrompt','cover','covers'];
const seqList=p=>(Array.isArray(p?.episodes)?p.episodes:[]).flatMap(e=>(Array.isArray(e?.sequences)?e.sequences:[]).map((s,i)=>({episode:e,sequence:s||{},i})));
const storyList=p=>Array.isArray(p?.storyboards)?p.storyboards.filter(isObj):[];
const storyOf=(p,id)=>storyList(p).find(b=>b.id===id)||null;
const storyShotIds=b=>(Array.isArray(b?.sequences)?b.sequences:[]).flatMap(s=>(Array.isArray(s?.shots)?s.shots:[]).map(t=>t?.id));
const linkOf=b=>typeof b?.outlineSequence==='string'&&b.outlineSequence?b.outlineSequence:null;
const posInt=v=>Number.isInteger(v)&&v>0;
export function sequenceRole(p,seq){if(seq?.test===true)return 'test';return seq?.storyboard&&linkOf(storyOf(p,seq.storyboard))?'container':'outline';}
// Contenedor de los planos de un story: la primera secuencia que no es prueba con storyboard igual a su id.
export function storyContainer(p,sbId){const x=seqList(p).find(x=>x.sequence.storyboard===sbId&&x.sequence.test!==true);return x?{episode:x.episode,sequence:x.sequence}:null;}
// Versión de cada story de una ficha: la suya si es entera > 0; si no, el primer número libre en el orden de p.storyboards.
export function storyVersions(p,fichaId){const list=storyList(p).filter(b=>linkOf(b)===fichaId),used=new Set(list.map(b=>b.version).filter(posInt)),out=new Map();let n=1;
 for(const b of list){if(posInt(b.version))out.set(b.id,b.version);else{while(used.has(n))n++;used.add(n);out.set(b.id,n);}}return out;}
// Árbol de la escaleta: actos con sus fichas numeradas (sus storys por versión, el vigente y su contenedor), pruebas aparte y storys sin ficha.
export function outlineTree(p){let n=0,start=0;const fichas=new Set();
 const acts=(Array.isArray(p?.episodes)?p.episodes:[]).map(e=>({episode:e,sequences:(Array.isArray(e?.sequences)?e.sequences:[]).filter(s=>sequenceRole(p,s)==='outline').map(s=>{fichas.add(s.id);n++;const minutes=Number(s.minutes)||0,current=typeof s.currentStoryboard==='string'?s.currentStoryboard:null;
  const storys=[...storyVersions(p,s.id)].map(([id,version])=>({storyboard:storyOf(p,id),version,current:id===current,container:storyContainer(p,id)})).sort((a,b)=>a.version-b.version);
  const row={sequence:s,number:n,code:String(n).padStart(2,'0'),minutes,start,current,storys,ownShots:(s.shots||[]).length};start+=minutes;return row;})}));
 return {acts,tests:seqList(p).filter(x=>x.sequence.test===true).map(({episode,sequence})=>({episode,sequence})),unlinked:storyList(p).filter(b=>!fichas.has(linkOf(b))).map(b=>({storyboard:b,container:storyContainer(p,b.id)}))};}
// Filas de la escaleta (vista Escaleta y carátulas): solo fichas, numeradas en orden.
export function outline(p){return outlineTree(p).acts.flatMap(a=>a.sequences.map(r=>({episode:a.episode,sequence:r.sequence,number:r.number,code:r.code,minutes:r.minutes,start:r.start})));}
// Errores (store.validate y check:proyectos) y avisos (solo check) del modelo escaleta → story → planos.
export function storyModelIssues(p){const errors=[],warnings=[],sbs=storyList(p),all=seqList(p),seqOf=id=>all.find(x=>x.sequence.id===id);
 const owner=new Map(sbs.flatMap(b=>storyShotIds(b).filter(Boolean).map(id=>[id,b.id])));
 for(const b of sbs){const o=b.outlineSequence;
  if(b.version!==undefined&&!posInt(b.version))errors.push(`El story ${b.id}: version debe ser un entero mayor que 0`);
  if(o===undefined)continue;
  if(!linkOf(b)){errors.push(`El story ${b.id}: outlineSequence debe ser el id de una secuencia`);continue;}
  const f=seqOf(o);if(!f){errors.push(`El story ${b.id} enlaza una secuencia inexistente: ${o}`);continue;}
  if(f.sequence.storyboard||f.sequence.test===true)errors.push(`El story ${b.id} enlaza ${o}, que no es una ficha de escaleta (${f.sequence.test===true?'es una prueba':'tiene los planos del story '+f.sequence.storyboard}): enlázalo a su ficha`);
  const cs=all.filter(x=>x.sequence.storyboard===b.id&&x.sequence.test!==true);
  if(cs.length>1)errors.push(`El story ${b.id} tiene ${cs.length} secuencias de planos (${cs.map(x=>x.sequence.id).join(', ')}): deja una o marca las demás como prueba`);
  for(const c of cs)for(const t of c.sequence.shots||[]){const other=owner.get(t?.storyboardShot);if(other&&other!==b.id)errors.push(`El plano ${t.id} de ${c.sequence.id} enlaza la viñeta ${t.storyboardShot} del story ${other}, no de ${b.id}: no se mezclan planos de dos storys`);}
  if(cs.length&&cs[0].episode!==f.episode)warnings.push(`Los planos del story ${b.id} (${cs[0].sequence.id}) están en otro acto que su ficha ${o}`);}
 for(const o of new Set(sbs.map(linkOf).filter(Boolean))){const seen=new Map();for(const b of sbs.filter(b=>linkOf(b)===o&&posInt(b.version))){if(seen.has(b.version))errors.push(`Versión ${b.version} repetida en la secuencia ${o}: ${seen.get(b.version)} y ${b.id}`);else seen.set(b.version,b.id);}}
 for(const {sequence:s} of all){
  if(s.test!==undefined&&s.test!==true)errors.push(`La secuencia ${s.id}: test solo admite true`);
  if(s.currentStoryboard!==undefined){const c=s.currentStoryboard,b=typeof c==='string'&&c?storyOf(p,c):null;
   if(typeof c!=='string'||!c)errors.push(`La secuencia ${s.id}: currentStoryboard debe ser el id de un story`);
   else if(!b)errors.push(`La secuencia ${s.id} marca vigente un story inexistente: ${c}`);
   else if(linkOf(b)!==s.id)errors.push(`La secuencia ${s.id} marca vigente ${c}, que es de ${linkOf(b)?'la secuencia '+linkOf(b):'ninguna secuencia'}`);}
  if(s.storyboard&&!storyOf(p,s.storyboard))warnings.push(`La secuencia ${s.id} apunta a un story inexistente: ${s.storyboard}`);
  const linked=sbs.filter(b=>linkOf(b)===s.id);
  if(linked.length&&!s.storyboard&&s.test!==true){if(!s.currentStoryboard)warnings.push(`La secuencia ${s.id} tiene ${linked.length} ${linked.length>1?'storys':'story'} y ninguno vigente`);
   if((s.shots||[]).length)warnings.push(`La ficha ${s.id} tiene storys enlazados y además ${s.shots.length} planos propios`);}}
 return {errors,warnings};}
// Localización de los planos de un story: la de su primera escena que tenga una conocida; si no, la primera del proyecto.
export function storyLocation(p,sb){const loc=(sb?.sequences||[]).find(s=>s.location)?.location;return p.locations.some(l=>l.id===loc)?loc:(p.locations[0]?.id||'');}
// Dónde van los planos de un story (storyboard-a-secuencia, storyboard-3d y «Crear/actualizar planos del story»). null: story sin ficha y sin seqId
// (comportamiento anterior). Pedir su ficha lleva a su contenedor, que se crea al final del acto si no existe; nunca se mezclan planos de dos storys.
export function storyPlansTarget(p,sbId,seqId,{newId=()=>crypto.randomUUID()}={}){const sb=storyOf(p,sbId);if(!sb)throw Error('Storyboard no encontrado: '+sbId);
 const errors=[],warnings=[],all=seqList(p),out=(x,created=false)=>({episode:x?.episode||null,index:x?x.i:-1,sequence:x?.sequence||null,created,errors,warnings});
 const fichaId=linkOf(sb),ficha=fichaId?all.find(x=>x.sequence.id===fichaId):null;
 if(fichaId&&!ficha){errors.push(`El story ${sb.id} enlaza una secuencia inexistente: ${fichaId}`);return out(null);}
 const own=()=>{const c=all.find(x=>x.sequence.storyboard===sb.id&&x.sequence.test!==true);if(c)return out(c);const e=ficha.episode;
  return out({episode:e,i:e.sequences.length,sequence:{id:newId(),title:sb.title,storyboard:sb.id,silent:false,ambienceGain:.18,ambiencePrompt:'',cast:[],props:[],shots:[]}},true);};
 if(!seqId)return ficha?own():null;
 const x=all.find(x=>x.sequence.id===seqId);if(!x){errors.push('Secuencia no encontrada: '+seqId);return out(null);}
 const s=x.sequence;if(ficha&&s.id===fichaId)return own();
 if(sequenceRole(p,s)==='container'&&s.storyboard!==sb.id){errors.push(`La secuencia ${s.id} tiene los planos del story ${s.storyboard}: no se mezclan con los de ${sb.id}`);return out(x);}
 if(s.test===true){warnings.push(`La secuencia ${s.id} es una prueba: sus planos no cuentan como los del story`+(s.storyboard&&s.storyboard!==sb.id?` (deja de apuntar a ${s.storyboard})`:''));return out(x);}
 if(s.storyboard===sb.id)return out(x);
 if(ficha){const c=storyContainer(p,sb.id);errors.push(c?`Los planos del story ${sb.id} están en ${c.sequence.id}: pide esa secuencia o su ficha ${fichaId}`:`El story ${sb.id} es de la secuencia ${fichaId}: pide esa secuencia (se crea su contenedor) o una prueba`);return out(x);}
 const linked=storyList(p).filter(b=>linkOf(b)===s.id);if(linked.length){errors.push(`La secuencia ${s.id} es la ficha de escaleta de ${linked.map(b=>b.id).join(', ')}: enlaza el story (outlineSequence) o elige otra secuencia`);return out(x);}
 if(s.storyboard)warnings.push(`La secuencia ${s.id} deja de apuntar al story ${s.storyboard}`);
 return out(x);}
// Aplica storyPlansTarget y storyboardSequenceMerge sobre una copia; lanza con el primer error. warnings: los de los dos.
export function applyStoryPlans(p,sbId,{sequence:seqId,newId=()=>crypto.randomUUID()}={}){const q=structuredClone(p),t=storyPlansTarget(q,sbId,seqId,{newId});
 if(!t)throw Error(`El story ${sbId} no tiene secuencia de escaleta (outlineSequence): indica la secuencia`);if(t.errors.length)throw Error(t.errors[0]);
 const {sequence,warnings}=storyboardSequenceMerge(q,storyOf(q,sbId),t.sequence,newId);t.episode.sequences.splice(t.index,t.created?0:1,sequence);
 return {project:q,episodeId:t.episode.id,sequence,created:t.created,warnings:[...t.warnings,...warnings]};}
export function storyPlansLabel(p,sb){return linkOf(sb)?'Crear/actualizar planos del story':'Crear capítulo';}
// Antes de borrar un story: ninguna ficha lo deja como vigente.
export function detachStory(p,sbId){const q=structuredClone(p);for(const {sequence:s} of seqList(q))if(s.currentStoryboard===sbId)delete s.currentStoryboard;return q;}
// Spec sugerida para storyMigrationPlan: storys agrupados por título sin «(vN)»; la ficha es la secuencia sin storyboard del mismo título o,
// si no la hay, una nueva desde el contenedor del primero; el vigente, el último; pruebas, las secuencias con planos cuyo título dice prueba o test.
function suggestStorySpec(p){const base=t=>String(t||'').replace(/\s*\(v\d+\)\s*$/i,'').trim().toLowerCase(),all=seqList(p),fichas=[],enlaces={},vigentes={},groups=new Map();
 for(const b of storyList(p)){if(linkOf(b))continue;const k=base(b.title);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b);}
 for(const [k,list] of groups){const same=all.find(x=>!x.sequence.storyboard&&x.sequence.test!==true&&base(x.sequence.title)===k);let fid=same?.sequence.id;
  if(!fid){const c=list.map(b=>storyContainer(p,b.id)).find(Boolean);if(!c)continue;fid=c.sequence.id+'-escaleta';for(let n=2;all.some(x=>x.sequence.id===fid)||fichas.some(f=>f.id===fid);n++)fid=`${c.sequence.id}-escaleta-${n}`;fichas.push({id:fid,from:c.sequence.id,title:list[0].title});}
  for(const b of list)enlaces[b.id]=fid;if(list.length>1)vigentes[fid]=list.at(-1).id;}
 return {fichas,enlaces,vigentes,pruebas:all.filter(x=>x.sequence.test!==true&&!x.sequence.storyboard&&(x.sequence.shots||[]).length&&/\b(prueba|test)\b/i.test(x.sequence.title||'')).map(x=>x.sequence.id)};}
// Plan de migración al modelo de #56 (scripts/migrar-storys.mjs). spec: {fichas:[{id,from,title}], enlaces:{story:ficha}, vigentes:{ficha:story}, pruebas:[id]}.
// Orden: 1) sceneNumber fijo en las secuencias con planos que la ficha nueva desplaza; 2) ficha en la posición de from con sus campos de escaleta;
// 3) fuera los campos de escaleta de los contenedores; 4) outlineSequence y version; 5) currentStoryboard; 6) test:true. ops vacío: nada que hacer.
export function storyMigrationPlan(p,spec){const q=structuredClone(p),ops=[],errors=[],warnings=[],op=(kind,text)=>ops.push({kind,text}),find=id=>seqList(q).find(x=>x.sequence.id===id),suggested=suggestStorySpec(p);
 if(!spec)return {ops,next:q,errors,warnings,suggested};
 if(!isObj(spec))return {ops,next:q,errors:['La spec debe ser un objeto {fichas, enlaces, vigentes, pruebas}'],warnings,suggested};
 const fichas=Array.isArray(spec.fichas)?spec.fichas:[],enlaces=isObj(spec.enlaces)?spec.enlaces:{},vigentes=isObj(spec.vigentes)?spec.vigentes:{},pruebas=Array.isArray(spec.pruebas)?spec.pruebas:[];
 for(const [k,v] of [['fichas',Array.isArray],['enlaces',isObj],['vigentes',isObj],['pruebas',Array.isArray]])if(spec[k]!==undefined&&!v(spec[k]))errors.push(`spec.${k} no tiene el formato esperado`);
 const nuevas=[],fichaIds=new Set(),notFicha=s=>!!s.storyboard||s.test===true||pruebas.includes(s.id);
 for(const f of fichas){if(!isObj(f)||typeof f.id!=='string'||!f.id){errors.push('Cada ficha necesita un id');continue;}fichaIds.add(f.id);const x=find(f.id);
  if(x){if(notFicha(x.sequence))errors.push(`El id de ficha ${f.id} ya es de una secuencia que no es ficha (${x.sequence.storyboard?'tiene los planos de '+x.sequence.storyboard:'prueba'})`);else if(f.title&&x.sequence.title!==f.title)warnings.push(`La ficha ${f.id} ya existe con otro título («${x.sequence.title}»): se deja como está`);continue;}
  if(typeof f.from!=='string'||!find(f.from)){errors.push(`La ficha ${f.id}: from inexistente (${f.from})`);continue;}
  if(typeof f.title!=='string'||!f.title.trim()){errors.push(`La ficha ${f.id} necesita title`);continue;}
  nuevas.push(f);}
 for(const [sbId,fid] of Object.entries(enlaces)){if(!storyOf(q,sbId))errors.push(`Story desconocido en enlaces: ${sbId}`);const x=typeof fid==='string'?find(fid):null;
  if(!fichaIds.has(fid)&&!x)errors.push(`El story ${sbId} enlaza una secuencia inexistente: ${fid}`);else if(x&&notFicha(x.sequence))errors.push(`El story ${sbId} enlaza ${fid}, que no es una ficha de escaleta`);}
 const target=sbId=>Object.hasOwn(enlaces,sbId)?enlaces[sbId]:linkOf(storyOf(q,sbId));
 for(const [fid,sbId] of Object.entries(vigentes)){if(!storyOf(q,sbId))errors.push(`Story desconocido en vigentes: ${sbId}`);else if(target(sbId)!==fid)errors.push(`El vigente ${sbId} de ${fid} no está enlazado a ${fid}`);}
 for(const id of pruebas)if(!find(id))errors.push(`Prueba inexistente: ${id}`);
 if(errors.length)return {ops:[],next:structuredClone(p),errors,warnings,suggested};
 const val=v=>JSON.stringify(v);
 for(const f of nuevas){const x=find(f.from),E=x.episode,seqs=E.sequences;
  for(let j=x.i;j<seqs.length;j++){const s=seqs[j];if((s.shots||[]).length&&!s.shots.some(t=>t.sourceScene)&&!posInt(s.sceneNumber)){s.sceneNumber=j+1;op('sceneNumber',`${s.id}: sceneNumber ${j+1} (conserva su escena al insertar ${f.id})`);}}
  const moved=OUTLINE_FIELDS.filter(k=>Object.hasOwn(x.sequence,k));
  seqs.splice(x.i,0,{id:f.id,title:f.title,silent:false,cast:[],props:[],shots:[],...Object.fromEntries(moved.map(k=>[k,structuredClone(x.sequence[k])]))});
  op('ficha',`${f.id}: ficha nueva «${f.title}» en ${E.title||E.id}, posición ${x.i+1}${moved.length?`, con ${moved.join(', ')} de ${f.from}`:''}`);}
 const containers=new Set();for(const b of storyList(q)){if(!target(b.id))continue;const c=seqList(q).find(x=>x.sequence.storyboard===b.id&&x.sequence.test!==true&&!pruebas.includes(x.sequence.id));if(c)containers.add(c.sequence);}
 for(const s of containers){const gone=OUTLINE_FIELDS.filter(k=>Object.hasOwn(s,k));if(!gone.length)continue;op('campos',`${s.id}: quita ${gone.map(k=>`${k}=${val(s[k])}`).join(' · ')}`);for(const k of gone)delete s[k];}
 for(const [sbId,fid] of Object.entries(enlaces)){const b=storyOf(q,sbId);if(b.outlineSequence!==fid){b.outlineSequence=fid;op('enlace',`${sbId} → ${fid}`);}}
 for(const fid of new Set(storyList(q).map(linkOf).filter(Boolean)))for(const [sbId,v] of storyVersions(q,fid)){const b=storyOf(q,sbId);if(b.version!==v){b.version=v;op('version',`${sbId}: version ${v}`);}}
 for(const [fid,sbId] of Object.entries(vigentes)){const s=find(fid).sequence;if(s.currentStoryboard!==sbId){s.currentStoryboard=sbId;op('vigente',`${fid}: vigente ${sbId}`);}}
 for(const {sequence:s} of seqList(q)){if(s.currentStoryboard!==undefined||notFicha(s))continue;const list=storyList(q).filter(b=>linkOf(b)===s.id);if(list.length===1){s.currentStoryboard=list[0].id;op('vigente',`${s.id}: vigente ${list[0].id} (su único story)`);}}
 for(const id of pruebas){const s=find(id).sequence;if(s.test!==true){s.test=true;op('prueba',`${id}: prueba, fuera de la escaleta`);}}
 const r=storyModelIssues(q);return {ops,next:q,errors:r.errors,warnings:[...warnings,...r.warnings],suggested};}
// ---- Árbol de la escaleta (#57): outlineTree bajado hasta escenas, viñetas y planos (por storyboardShot). Estado de la interfaz (versión
// mostrada, scroll) fuera de proyecto.json. Puras: no mutan; los nodos llevan los objetos del proyecto (episode, sequence, storyboard, shot).
const ROLE_ORDER={container:0,test:1,outline:2};
// Etiquetas (#61). Plano: «Pnn · título», sin repetir el prefijo si el título ya lo trae (conserva su número aunque no coincida).
export function shotLabel(number,title){const code='P'+String(number).padStart(2,'0');if(typeof title!=='string'||!title.trim())return {code,title:'',label:code};
 const m=/^P\d{1,3}\s*·\s*/.exec(title);return m?{code,title:title.slice(m[0].length),label:title}:{code,title,label:code+' · '+title};}
// voiceStatus legible; un valor desconocido sale tal cual.
export const VOICE_STATUS={'id-assigned-samples-pending':'Voz asignada · faltan muestras','id-assigned':'Voz asignada','samples-pending':'Faltan muestras','pending':'Pendiente','approved':'Aprobada'};
export function voiceStatusLabel(status){return typeof status==='string'&&status?(Object.hasOwn(VOICE_STATUS,status)?VOICE_STATUS[status]:status):'';}
const shotLeaves=(p,e,s)=>(Array.isArray(s?.shots)?s.shots:[]).map((t,i)=>({episode:e,sequence:s,shot:t,number:i+1,role:sequenceRole(p,s)}));
export function treeModel(p){const index=new Map(),add=(node,parent)=>{index.set(node.key,{node,parent});return node;};
 const bySb=new Map();for(const {episode,sequence} of seqList(p))for(const l of shotLeaves(p,episode,sequence)){const k=l.shot?.storyboardShot;if(!k)continue;if(!bySb.has(k))bySb.set(k,[]);bySb.get(k).push(l);}
 for(const list of bySb.values())list.sort((a,b)=>ROLE_ORDER[a.role]-ROLE_ORDER[b.role]);
 const storyNode=({storyboard:b,version=null,current=false,container=null},parent)=>{const key='sb/'+b.id,scenes=Array.isArray(b.sequences)?b.sequences.filter(isObj):[],panelIds=new Set(storyShotIds(b));
  const node=add({key,kind:'story',storyboard:b,version,current,container,counts:{scenes:scenes.length,panels:panelIds.size,shots:(container?.sequence?.shots||[]).length},children:[]},parent);
  for(const s of scenes)node.children.push(add({key:`scene/${b.id}/${s.id}`,kind:'scene',storyboard:b,scene:s,panels:(Array.isArray(s.shots)?s.shots:[]).filter(isObj).map(t=>({panel:t,thumb:t.render||t.sketch||null,shots:bySb.get(t.id)||[]}))},key));
  const orphans=container?shotLeaves(p,container.episode,container.sequence).filter(l=>!panelIds.has(l.shot?.storyboardShot)):[];
  if(orphans.length)node.children.push(add({key:'orphans/'+b.id,kind:'orphans',shots:orphans},key));
  return node;};
 const t=outlineTree(p);
 const acts=t.acts.map(a=>{const key='act/'+a.episode.id,act=add({key,kind:'act',episode:a.episode,minutes:a.sequences.reduce((n,r)=>n+r.minutes,0),children:[]},null);
  act.children=a.sequences.map(r=>{const k='seq/'+r.sequence.id,f=add({key:k,kind:'ficha',episode:a.episode,sequence:r.sequence,number:r.number,code:r.code,minutes:r.minutes,current:r.current,cover:r.sequence.cover||null,children:[],shots:shotLeaves(p,a.episode,r.sequence)},key);
   f.children=r.storys.filter(x=>x.storyboard).map(x=>storyNode(x,k));return f;});return act;});
 const groups=[];
 if(t.tests.length){const g=add({key:'tests',kind:'tests',children:[]},null);g.children=t.tests.map(({episode,sequence})=>add({key:'seq/'+sequence.id,kind:'test',episode,sequence,shots:shotLeaves(p,episode,sequence)},'tests'));groups.push(g);}
 if(t.unlinked.length){const g=add({key:'unlinked',kind:'unlinked',children:[]},null);g.children=t.unlinked.map(({storyboard,container})=>storyNode({storyboard,container},'unlinked'));groups.push(g);}
 return {acts,groups,index};}
// Claves desde la raíz hasta key (incluida); [] si no existe.
export function treePath(model,key){const out=[];let k=key;while(k!==null&&k!==undefined&&model?.index?.has(k)){out.unshift(k);k=model.index.get(k).parent;}return out;}
// ---- Escaleta por niveles (#67): cada nodo de treeModel es una página (acto, ficha, prueba y grupos) o redirige a su vista (story, escena,
// planos sin viñeta). LEVELS da la etiqueta y la ruta de cada tipo; #68 añade panel (y shot); #69 usa el prefijo de entidad.
const LEVELS={
 act:{label:n=>n.episode.title||n.episode.id,route:n=>({view:'tree',node:n.key})},
 ficha:{label:n=>n.code+' · '+(n.sequence.title||n.sequence.id),route:n=>({view:'tree',node:n.key})},
 test:{label:n=>n.sequence.title||n.sequence.id,route:n=>({view:'tree',node:n.key})},
 tests:{label:()=>'Pruebas',route:n=>({view:'tree',node:n.key})},
 unlinked:{label:()=>'Sin secuencia',route:n=>({view:'tree',node:n.key})},
 story:{label:n=>n.version?'Story v'+n.version:(n.storyboard.title||n.storyboard.id),route:n=>({view:'storyboard',storyboard:n.storyboard.id})},
 scene:{label:n=>n.scene.title||n.scene.id,route:n=>({view:'storyboard',storyboard:n.storyboard.id,scene:n.scene.id})},
 orphans:{label:()=>'Planos sin viñeta',route:n=>({view:'shots',sequence:n.shots[0].sequence.id})}};
export const LEVEL_ROOT={key:null,kind:'root',label:'Escaleta',route:{view:'tree'}};
const levelNode=(model,key)=>(typeof key==='string'||typeof key==='number')&&model?.index instanceof Map?model.index.get(key)?.node||null:null;
// Ruta canónica de la página de un nodo; null si la clave no existe.
export function levelRoute(model,key){const n=levelNode(model,key);return n&&LEVELS[n.kind]?LEVELS[n.kind].route(n):null;}
// Página que corresponde a node: la raíz sin clave; la del nodo si existe (story, escena y huérfanos llevan a otra vista); si no, el nivel
// existente más cercano (el story de una escena o de sus huérfanos, o la raíz) con missing.
export function levelResolve(model,key){if(key===null||key===undefined||key==='')return {key:null,route:{view:'tree'},missing:false};
 const route=levelRoute(model,key);if(route)return {key,route,missing:false};
 const m=typeof key==='string'&&/^(?:scene\/([^/]+)\/.*|orphans\/(.+))$/.exec(key),sb=m&&'sb/'+(m[1]??m[2]);
 if(sb&&levelRoute(model,sb))return {key:sb,route:levelRoute(model,sb),missing:true};
 return {key:null,route:{view:'tree'},missing:true};}
// Nodo del árbol que representa una ruta: tree → node; storyboard → su escena o el story; resto → null.
export function levelKey(p,route,model){const has=k=>!!levelNode(model,k);
 if(route?.view==='tree')return has(route.node)?route.node:null;
 if(route?.view==='storyboard'){const sc=`scene/${route.storyboard}/${route.scene}`,sb='sb/'+route.storyboard;return route.scene&&has(sc)?sc:has(sb)?sb:null;}
 return null;}
// Migas de una página: Escaleta › camino de treePath (la última sin ruta); personaje y ambiente, su lista › nombre. [] si no hay migas.
export function levelCrumbs(p,route,model){const v=route?.view;
 if(v==='character'||v==='location'){const list=v==='character'?p?.characters:p?.locations,x=Array.isArray(list)?list.find(e=>e?.id===route[v]):null;if(!x)return [];
  const key=v+'/'+x.id;return [{key,kind:'list',label:v==='character'?'Personajes y voces':'Ambientes',route:{view:v+'s'}},{key,kind:v,label:x.name||x.id,route:null}];}
 if(v!=='tree'&&v!=='storyboard')return [];
 model??=treeModel(p);const key=levelKey(p,route,model);
 if(!key)return v==='tree'?[{...LEVEL_ROOT,route:null}]:[];
 const out=[{...LEVEL_ROOT},...treePath(model,key).map(k=>{const n=model.index.get(k).node;return {key:k,kind:n.kind,label:LEVELS[n.kind].label(n),route:levelRoute(model,k)};})];
 out[out.length-1]={...out.at(-1),route:null};return out;}
// Selector de versión del story: las de su ficha por número; [] sin ficha.
export function storyVersionOptions(p,sbId){const b=storyOf(p,sbId),fid=linkOf(b);if(!fid)return [];const f=seqList(p).find(x=>x.sequence.id===fid)?.sequence,cur=f?.currentStoryboard;
 return [...storyVersions(p,fid)].sort((a,b)=>a[1]-b[1]).map(([id,version])=>({id,version,label:'v'+version+(id===cur?' · vigente':''),current:id===cur,selected:id===sbId}));}
// Marca un story como el vigente de su ficha (copia).
export function setCurrentStory(p,sbId){const q=structuredClone(p),fid=linkOf(storyOf(q,sbId)),f=fid&&seqList(q).find(x=>x.sequence.id===fid);if(!f)throw Error('El story no tiene secuencia');f.sequence.currentStoryboard=sbId;return q;}
// Vista Planos: por acto, las secuencias con planos agrupadas por papel (storys, propios, pruebas) y las fichas sin planos aparte.
export function shotGroups(p){return (Array.isArray(p?.episodes)?p.episodes:[]).map(e=>{const by={container:[],outline:[],test:[]},empty=[];
 for(const s of Array.isArray(e?.sequences)?e.sequences:[]){const role=sequenceRole(p,s);if(role==='outline'&&!(s.shots||[]).length){empty.push(s);continue;}
  if(role!=='container'){by[role].push({sequence:s});continue;}const b=storyOf(p,s.storyboard),fid=linkOf(b);
  by.container.push({sequence:s,storyboard:b,version:storyVersions(p,fid).get(b.id),ficha:seqList(p).find(x=>x.sequence.id===fid)?.sequence||null});}
 return {episode:e,groups:['container','outline','test'].filter(r=>by[r].length).map(role=>({role,sequences:by[role]})),empty};});}
// Cifras de la vista Proyecto. shots: planos fuera de las pruebas; tests: secuencias de prueba.
export function projectStats(p){const rows=outline(p),all=seqList(p),len=k=>Array.isArray(p?.[k])?p[k].length:0;
 return {acts:len('episodes'),sequences:rows.length,minutes:rows.reduce((n,r)=>n+r.minutes,0),storys:storyList(p).length,shots:all.filter(x=>x.sequence.test!==true).reduce((n,x)=>n+(x.sequence.shots||[]).length,0),tests:all.filter(x=>x.sequence.test===true).length,characters:len('characters'),locations:len('locations'),environments:len('environments')};}
// ---- Relaciones (#58): hablante de las líneas e índice de relaciones del proyecto (docs/ARQUITECTURA.md). Puras: no mutan ni escriben.
// Hablante de una línea ({character?, who?}): character si es el id de un personaje; si no, who (sin espacios alrededor, sin mayúsculas) contra
// id, nombre completo o primera palabra del nombre; gana el primer personaje del proyecto que lo tenga. who vacío o sin personaje: null.
export function speakerResolver(p){const map=new Map(),ids=new Set();
 for(const c of Array.isArray(p?.characters)?p.characters:[]){if(!isObj(c)||typeof c.id!=='string')continue;ids.add(c.id);const name=String(c.name??'').toLowerCase();
  for(const k of [c.id.toLowerCase(),name,name.split(/\s+/)[0]])if(!map.has(k))map.set(k,c.id);}
 return e=>{if(typeof e?.character==='string'&&ids.has(e.character))return e.character;const who=String(e?.who??'').trim().toLowerCase();return who?map.get(who)??null:null;};}
export function resolveSpeaker(p,entry){return speakerResolver(p)(entry);}
const unresolvedWith=(sp,panel)=>(Array.isArray(panel?.dialogue)?panel.dialogue:[]).flatMap((l,index)=>sp(l)?[]:[{index,who:l?.who,channel:l?.channel||''}]);
// Líneas del diálogo de una viñeta que no llegan a un plano porque no tienen personaje.
export function unresolvedDialogue(p,panel){return unresolvedWith(speakerResolver(p),panel);}
export function dialogueLineWarning(panel,{index,who,channel}){return `Viñeta ${panel?.code||panel?.id}: la línea ${index+1} («${who||'sin hablante'}»${channel?', canal '+channel:''}) no tiene personaje; no pasa al plano. Crea el personaje o corrige el nombre.`;}
export function storyboardDialogueWarnings(p,sb){const sp=speakerResolver(p);return (Array.isArray(sb?.sequences)?sb.sequences:[]).flatMap(s=>Array.isArray(s?.shots)?s.shots:[]).flatMap(t=>unresolvedWith(sp,t).map(u=>dialogueLineWarning(t,u)));}
const REL_PREFIX={act:'act',sequence:'seq',seq:'seq',story:'sb',sb:'sb',scene:'scene',panel:'panel',shot:'shot',character:'character',location:'location',environment:'environment'};
// Claves del índice; act, seq, sb y scene son las de treeModel.
export function relKey(kind,...ids){return [REL_PREFIX[kind]||kind,...ids].join('/');}
// Quién aparece en un plano y de dónde sale: su cast; si no, visibleCast o el reparto de la secuencia, más los proxies (como shotCast).
export function shotAppearance(shot,sequence){if(Array.isArray(shot?.cast))return shot.cast.map(character=>({character,via:'shot.cast'}));
 const base=Array.isArray(shot?.visibleCast)?shot.visibleCast.map(character=>({character,via:'visibleCast'})):(Array.isArray(sequence?.cast)?sequence.cast:[]).filter(isObj).map(a=>({character:a.character,via:'sequence.cast'}));
 const seen=new Set();return [...base,...Object.keys(proxiesOf(shot)).map(character=>({character,via:'proxy'}))].filter(x=>!seen.has(x.character)&&seen.add(x.character));}
// Entornos 3D de un ambiente: el de location.environment y el del modelSpace, sin repetir.
function locationEnvs(p,l){const out=[],add=(e,envVia)=>{if(e&&typeof e.id==='string'&&!out.some(x=>x.id===e.id))out.push({id:e.id,envVia});};
 add(isObj(l)&&l.environment?(Array.isArray(p?.environments)?p.environments:[]).find(e=>isObj(e)&&e.id===l.environment):null,'environment');add(isObj(l)?modelSpaceEnvironment(p,l.modelSpace):null,'modelSpace');return out;}
// Índice de relaciones: nodos del árbol de treeModel (acto → ficha → story → escena → viñeta → plano; contenedor bajo su story; plano sin viñeta
// bajo su secuencia) más personajes, ambientes y entornos, y enlaces appears, speaks, location y environment en los dos sentidos.
export function relationIndex(p){const nodes=new Map(),links=[],from=new Map(),to=new Map(),panelShots=new Map(),shotPanel=new Map(),sequenceShots=new Map(),unresolved=[],dangling=[];
 const locationEnvironments=new Map(),environmentLocations=new Map(),envVia=new Map();
 const node=(kind,id,data,parent,extra={})=>{const key=relKey(kind,...[].concat(id));if(nodes.has(key))return null;const n={key,kind,id:[].concat(id).at(-1),order:0,parent,children:[],data,...extra};nodes.set(key,n);return n;};
 const chars=new Map((Array.isArray(p?.characters)?p.characters:[]).filter(c=>isObj(c)&&typeof c.id==='string').map(c=>[c.id,c]));
 const locs=(Array.isArray(p?.locations)?p.locations:[]).filter(l=>isObj(l)&&typeof l.id==='string'),envs=(Array.isArray(p?.environments)?p.environments:[]).filter(e=>isObj(e)&&typeof e.id==='string');
 for(const c of chars.values())node('character',c.id,c,null);for(const l of locs)node('location',l.id,l,null);for(const e of envs)node('environment',e.id,e,null);
 for(const l of locs){const lk=relKey('location',l.id);for(const x of locationEnvs(p,l)){const ek=relKey('environment',x.id);if(!nodes.has(ek))continue;pushTo(locationEnvironments,lk,ek);pushTo(environmentLocations,ek,lk);envVia.set(lk+'\0'+ek,x.envVia);}}
 const link=l=>{links.push(l);pushTo(from,l.from,l);pushTo(to,l.to,l);};
 const target=(kind,id,src,via)=>{const k=relKey(kind,id);if(typeof id==='string'&&nodes.has(k)&&nodes.get(k).kind===kind)return k;dangling.push({from:src,to:k,via});return null;};
 const place=(src,loc,via,inherited)=>{if(typeof loc!=='string'||!loc)return;const k=inherited?(nodes.has(relKey('location',loc))?relKey('location',loc):null):target('location',loc,src,via);if(!k)return;
  link({from:src,to:k,rel:'location',via,...(inherited?{inherited:true}:{})});
  for(const ek of locationEnvironments.get(k)||[])link({from:src,to:ek,rel:'environment',via,through:k,envVia:envVia.get(k+'\0'+ek),...(inherited?{inherited:true}:{})});};
 const CH=projectChannels(p),sp=speakerResolver(p);
 // Árbol: actos, secuencias, storys, escenas, viñetas y planos.
 for(const e of Array.isArray(p?.episodes)?p.episodes:[])if(isObj(e)&&typeof e.id==='string')node('act',e.id,e,null);
 const seqs=seqList(p).filter(x=>isObj(x.episode)&&typeof x.sequence.id==='string'&&nodes.has(relKey('act',x.episode.id)));
 for(const {episode,sequence:s} of seqs)node('sequence',s.id,s,null,{episode:episode.id,role:sequenceRole(p,s)});
 for(const b of storyList(p)){if(typeof b.id!=='string')continue;const f=linkOf(b)?nodes.get(relKey('sequence',linkOf(b))):null,ficha=f?.kind==='sequence'&&f.role==='outline'?f:null;
  const n=node('story',b.id,b,ficha?.key??null,ficha?{version:storyVersions(p,ficha.id).get(b.id),current:ficha.data.currentStoryboard===b.id}:{});if(!n)continue;
  for(const sc of Array.isArray(b.sequences)?b.sequences:[]){if(!isObj(sc)||typeof sc.id!=='string')continue;const scn=node('scene',[b.id,sc.id],sc,n.key);if(!scn)continue;
   for(const t of Array.isArray(sc.shots)?sc.shots:[])if(isObj(t)&&typeof t.id==='string')node('panel',t.id,t,scn.key);}}
 for(const {episode,sequence:s} of seqs){const sk=relKey('sequence',s.id),n=nodes.get(sk);if(n.data!==s)continue;
  n.parent=n.role==='container'?relKey('story',s.storyboard):relKey('act',episode.id);
  for(const t of Array.isArray(s.shots)?s.shots:[]){if(!isObj(t)||typeof t.id!=='string')continue;const pk=typeof t.storyboardShot==='string'&&nodes.get(relKey('panel',t.storyboardShot))?.kind==='panel'?relKey('panel',t.storyboardShot):null;
   const tn=node('shot',t.id,t,pk||sk,{episode:episode.id,role:n.role,sequence:sk});if(!tn)continue;pushTo(sequenceShots,sk,tn.key);if(pk){pushTo(panelShots,pk,tn.key);shotPanel.set(tn.key,pk);}}}
 for(const n of nodes.values())if(n.parent!==null&&!nodes.has(n.parent))n.parent=null;
 for(const n of nodes.values())if(n.parent!==null)nodes.get(n.parent).children.push(n.key);
 for(const list of panelShots.values())list.sort((a,b)=>ROLE_ORDER[nodes.get(a).role]-ROLE_ORDER[nodes.get(b).role]);
 // Hijos: los storys de una ficha por versión y antes que sus planos propios; en un story, las escenas y luego su contenedor; en una viñeta, panelShots.
 const rank=n=>n.kind==='story'?n.version??0:n.kind==='scene'?0:n.kind==='shot'&&nodes.get(n.parent)?.kind==='sequence'?1e9:1;
 for(const n of nodes.values()){if(n.kind==='panel')n.children=[...(panelShots.get(n.key)||[])];else if(n.kind==='sequence'||n.kind==='story')n.children.sort((a,b)=>rank(nodes.get(a))-rank(nodes.get(b)));}
 // Orden del proyecto: recorrido en profundidad desde los actos, los storys sin ficha y las fichas de personajes, ambientes y entornos.
 let order=0;const visit=k=>{const n=nodes.get(k);n.order=order++;for(const c of n.children)visit(c);};
 for(const kind of ['act','story','character','location','environment'])for(const n of [...nodes.values()])if(n.kind===kind&&n.parent===null)visit(n.key);
 // Enlaces.
 for(const n of nodes.values()){
  if(n.kind==='scene')place(n.key,n.data.location,'scene.location',false);
  else if(n.kind==='panel'){const t=n.data,scene=nodes.get(n.parent),story=nodes.get(scene.parent),cast=Array.isArray(t.cast)?t.cast:[];
   for(const c of cast){const k=target('character',c,n.key,'panel.cast');if(k)link({from:n.key,to:k,rel:'appears',via:'panel.cast'});}
   (Array.isArray(t.dialogue)?t.dialogue:[]).forEach((l,index)=>{const id=sp(l);if(!id){unresolved.push({panel:n.key,scene:scene.key,story:story.key,index,who:l?.who,channel:l?.channel||'',code:t.code||''});return;}
    link({from:n.key,to:relKey('character',id),rel:'speaks',via:'dialogue',channel:l.channel||'direct',offscreen:!!channelOf(CH,l.channel).offscreen||!cast.includes(id)||chars.get(id).kind==='voice',line:index});});
   place(n.key,scene.data.location,'scene.location',true);}
  else if(n.kind==='sequence')place(n.key,n.data.location,'sequence.location',false);
  else if(n.kind==='shot'){const t=n.data,s=nodes.get(n.sequence).data;
   for(const a of shotAppearance(t,s)){const k=target('character',a.character,n.key,a.via);if(k)link({from:n.key,to:k,rel:'appears',via:a.via});}
   for(const l of Array.isArray(t.lines)?t.lines:[]){if(!isObj(l))continue;const k=target('character',l.character,n.key,'lines');if(k)link({from:n.key,to:k,rel:'speaks',via:'lines',channel:l.channel||'direct',offscreen:lineOffscreen(CH,l),line:l.id});}
   if(t.location)place(n.key,t.location,'shot.location',false);else place(n.key,s.location,'sequence.location',true);}}
 return {revision:p?.revision??null,nodes,links,from,to,panelShots,shotPanel,sequenceShots,locationEnvironments,environmentLocations,unresolved,dangling};}
const relCache=new WeakMap();
// relationIndex memorizado por objeto y revision.
export function relationIndexFor(p){if(!isObj(p))return relationIndex(p);const c=relCache.get(p);if(c&&c.revision===(p.revision??null))return c.index;const index=relationIndex(p);relCache.set(p,{revision:index.revision,index});return index;}
const ENTITY_KINDS=new Set(['character','location','environment']);
// Story no vigente de una ficha que tiene vigente: con current, su rama no cuenta por encima de él.
const offCurrent=(index,n)=>n.kind==='story'&&!n.current&&!!n.parent&&(index.nodes.get(n.parent)?.children||[]).some(k=>index.nodes.get(k)?.current===true);
const relMatch=(q={})=>{const rels=q.rel===undefined?null:[].concat(q.rel);return l=>(!rels||rels.includes(l.rel))&&(!q.where||q.where(l));};
// Nodos desde la raíz hasta key (incluido); [] si no existe.
export function trail(index,key){const out=[];let n=index?.nodes?.get(key);while(n){out.unshift(n);n=n.parent===null?null:index.nodes.get(n.parent);}return out;}
// key y todo lo que cuelga de ella, en orden, más los planos de cada secuencia por pertenencia (sequenceShots: los de un contenedor o una prueba
// cuelgan de su viñeta); con current, bajo una ficha con vigente se saltan los demás storys (y sus planos), también los planos que una secuencia
// alcanzada por debajo de key tiene enlazados a viñetas de esos storys; los de la propia key cuentan siempre.
export function descendants(index,key,{current=false}={}){const seen=new Set(),walk=k=>{const n=index?.nodes?.get(k);if(!n||seen.has(k))return;if(current&&k!==key&&offCurrent(index,n))return;seen.add(k);n.children.forEach(walk);if(n.kind==='sequence')for(const t of index.sequenceShots?.get(k)||[])if(!current||k===key||!trail(index,t).some(x=>offCurrent(index,x)))walk(t);};walk(key);return [...seen];}
// Enlaces que llegan a targetKey (con current, sin los que salen de la rama de un story no vigente).
export function linksTo(index,targetKey,q={}){const ok=relMatch(q);return (index?.to?.get(targetKey)||[]).filter(l=>ok(l)&&(!q.current||!trail(index,l.from).some(n=>offCurrent(index,n))));}
// Relacionados con key: para un nodo del árbol, los destinos de los enlaces de su subárbol; para un personaje, ambiente o entorno, los nodos que
// lo enlazan. Map clave → enlaces, en orden de aparición.
// Diagnóstico (#61): llamadas a relatedTo; el árbol plegado no debe hacer ninguna.
export const relationCounters={relatedTo:0};
export function relatedTo(index,key,q={}){relationCounters.relatedTo++;const out=new Map(),n=index?.nodes?.get(key);if(!n)return out;const add=(k,l)=>{if(!out.has(k))out.set(k,[]);out.get(k).push(l);};
 if(ENTITY_KINDS.has(n.kind)){for(const l of linksTo(index,key,q))add(l.from,l);return out;}
 const ok=relMatch(q);for(const k of descendants(index,key,q))for(const l of index.from.get(k)||[])if(ok(l))add(l.to,l);return out;}
// Nodos de tipo kind cuyo subárbol enlaza targetKey, en orden del proyecto; para kind 'sequence', también la secuencia a la que pertenece el plano
// (contenedor o prueba). Con current, la rama de un story no vigente no cuenta para su ficha ni su acto.
export function holders(index,targetKey,kind,q={}){const out=new Set(),ok=relMatch(q);
 for(const l of index?.to?.get(targetKey)||[]){if(!ok(l))continue;let blocked=false;for(const n of trail(index,l.from).reverse()){if(n.kind===kind&&!blocked)out.add(n.key);if(kind==='sequence'&&n.sequence)out.add(n.sequence);if(q.current&&offCurrent(index,n))blocked=true;}}
 return [...out].sort((a,b)=>index.nodes.get(a).order-index.nodes.get(b).order);}
// Apariciones (#60) de un personaje, ambiente o entorno: los nodos que lo enlazan (linksTo) colgados de su trail y fusionados por clave.
// Marcas en el nodo que enlaza; los intermedios van sin marcas. counts: viñetas y planos con marca en el subárbol. Con current, sin los storys no vigentes.
const AP_RELS={character:['appears','speaks'],location:['location'],environment:['environment']};
const apSceneRoute=(index,sceneKey)=>{const sc=index.nodes.get(sceneKey);return {view:'storyboard',storyboard:index.nodes.get(sc.parent).id,scene:sc.id};};
function apNode(index,n){const d=n.data||{},title=d.title||n.id;let label=title,route;
 if(n.kind==='act')route={view:'tree',node:n.key};
 else if(n.kind==='sequence')route=n.role==='container'?{view:'shots',sequence:n.id}:{view:'tree',node:n.key};
 else if(n.kind==='story'){label=n.version?'v'+n.version+' · '+title:title;route={view:'storyboard',storyboard:n.id};}
 else if(n.kind==='scene')route=apSceneRoute(index,n.key);
 else if(n.kind==='panel'){label=d.code?d.code+' · '+(d.title||''):title;route=apSceneRoute(index,n.parent);}
 else if(n.kind==='shot'){const seq=index.nodes.get(n.sequence),pos=(index.sequenceShots.get(n.sequence)||[]).indexOf(n.key)+1;label=shotLabel(pos,d.title).label;route={view:'shot',episode:n.episode,sequence:seq?.id??null,shot:n.id};}
 return {key:n.key,kind:n.kind,id:n.id,label,order:n.order,route,...(n.role?{role:n.role}:{}),...(n.version!==undefined?{version:n.version}:{}),...(n.current!==undefined?{current:n.current}:{}),...(offCurrent(index,n)?{stale:true}:{}),marks:[],counts:{panels:0,shots:0},children:[]};}
function apMark(index,l){const d=index.nodes.get(l.from)?.data||{},m={rel:l.rel,via:l.via};if(l.inherited)m.inherited=true;
 if(l.rel==='speaks'){Object.assign(m,{channel:l.channel,offscreen:l.offscreen,line:l.line});const text=l.via==='dialogue'?d.dialogue?.[l.line]?.text:(Array.isArray(d.lines)?d.lines:[]).find(x=>x?.id===l.line)?.text;if(typeof text==='string')m.text=text;}
 return m;}
export function appearanceTree(index,key,{current=true,rel,inherited=true}={}){const kind=String(key).split('/')[0],rels=rel===undefined?AP_RELS[kind]||[]:rel;
 const byKey=new Map(),roots=[],total={acts:0,sequences:0,storys:0,scenes:0,panels:0,shots:0,lines:0};
 for(const l of linksTo(index,key,{rel:rels,current,...(inherited?{}:{where:x=>!x.inherited})})){let parent=null;
  for(const n of trail(index,l.from)){let a=byKey.get(n.key);if(!a){a=apNode(index,n);byKey.set(n.key,a);(parent?parent.children:roots).push(a);}parent=a;}
  parent.marks.push(apMark(index,l));if(l.rel==='speaks')total.lines++;}
 const sort=list=>{list.sort((a,b)=>a.order-b.order);for(const a of list){sort(a.children);if(a.marks.length&&(a.kind==='panel'||a.kind==='shot'))a.counts[a.kind+'s']++;for(const c of a.children){a.counts.panels+=c.counts.panels;a.counts.shots+=c.counts.shots;}}};sort(roots);
 const KT={act:'acts',sequence:'sequences',story:'storys',scene:'scenes'};for(const a of byKey.values())if(KT[a.kind])total[KT[a.kind]]++;
 for(const a of roots){total.panels+=a.counts.panels;total.shots+=a.counts.shots;}
 return {target:key,total,roots};}
// Entornos 3D donde aparece un personaje (los enlaces environment, heredados incluidos, de los nodos donde aparece o habla) o los de un ambiente.
// nodes: nodos distintos que llegan a cada entorno; en orden del proyecto.
export function appearanceEnvironments(index,key,{current=true}={}){const n=index?.nodes?.get(key);if(!n)return [];const out=new Map();
 const add=(ek,via,from)=>{const e=index.nodes.get(ek);if(!e)return;if(!out.has(ek))out.set(ek,{key:ek,id:e.id,name:e.data?.name||e.id,via:[],from:new Set(),route:{view:'environment',environment:e.id}});const x=out.get(ek);if(via&&!x.via.includes(via))x.via.push(via);if(from)x.from.add(from);};
 if(n.kind==='character'){for(const from of new Set(linksTo(index,key,{rel:['appears','speaks'],current}).map(l=>l.from)))for(const l of index.from.get(from)||[])if(l.rel==='environment')add(l.to,l.envVia,from);}
 else if(n.kind==='location')for(const ek of index.locationEnvironments.get(key)||[]){add(ek,n.data?.environment===index.nodes.get(ek).id?'environment':'modelSpace');for(const l of linksTo(index,ek,{current,where:l=>l.through===key}))add(ek,null,l.from);}
 return [...out.values()].sort((a,b)=>index.nodes.get(a.key).order-index.nodes.get(b.key).order).map(({from,...x})=>({...x,nodes:from.size}));}
// Enlaces (#61) de un nodo del árbol: personajes, ambientes y entornos. Acto, secuencia, story y escena agregan su subárbol (relatedTo, con
// current como appearanceTree); viñeta y plano, solo sus enlaces propios (index.from). Entradas en orden de primera aparición; inherited solo si
// todos sus enlaces lo son; sources, nodos origen distintos. missing (sin agregar): ids que no existen. Clave desconocida → todo vacío.
const REL_DEEP=new Set(['act','sequence','story','scene']);
export function relationLinks(index,key,{current=true,deep}={}){const n=index?.nodes?.get(key),L={key,deep:false,appears:[],speaks:[],location:[],environment:[],missing:[]};if(!n)return L;
 L.deep=deep??REL_DEEP.has(n.kind);const groups=L.deep?[...relatedTo(index,key,{current}).entries()]:[];
 if(!L.deep){const m=new Map();for(const l of index.from?.get(key)||[])pushTo(m,l.to,l);groups.push(...m.entries());}
 for(const [to,ls] of groups){const t=index.nodes.get(to);if(!t||!ENTITY_KINDS.has(t.kind))continue;
  for(const rel of ['appears','speaks','location','environment']){const xs=ls.filter(l=>l.rel===rel);if(!xs.length)continue;
   const e={key:to,kind:t.kind,id:t.id,label:t.data?.name||t.id,route:{view:t.kind,[t.kind]:t.id},via:[...new Set(xs.map(l=>l.via))],inherited:xs.every(l=>l.inherited),sources:new Set(xs.map(l=>l.from)).size};
   if(rel==='speaks'){const off=xs.filter(l=>l.offscreen);Object.assign(e,{lines:xs.length,offscreenLines:off.length,offscreen:off.length===xs.length,channels:[...new Set(off.map(l=>l.channel).filter(c=>c&&c!=='direct'))]});}
   L[rel].push(e);}}
 if(!L.deep){const seen=new Set();for(const d of index.dangling||[])if(d.from===key&&!seen.has(d.to)){seen.add(d.to);const i=d.to.indexOf('/');L.missing.push({kind:d.to.slice(0,i),id:d.to.slice(i+1),via:d.via});}}
 return L;}
// Línea compacta de relationLinks: Personajes (los que aparecen y luego los que solo hablan), Ambiente(s), 3D y No existen; max por grupo, el resto en more.
export function relationLine(L,{max=6}={}){const groups=[],group=(rel,label,items)=>{if(items.length)groups.push({rel,label:typeof label==='function'?label(items.length):label,items:items.slice(0,max),more:items.slice(max).map(x=>x.label)});};
 const item=(e,notes=[],tone)=>({key:e.key,label:e.label,route:e.route,notes,...(tone?{tone}:{})}),inh=e=>e.inherited?item(e,['heredado'],'inherited'):item(e);
 const speaks=new Map((L?.speaks||[]).map(e=>[e.key,e])),appears=L?.appears||[],shown=new Set(appears.map(e=>e.key));
 const who=(e,s,app)=>s?.offscreenLines?item(e,['fuera de campo'+(s.channels.length?' · '+s.channels.join(', '):'')],'off'):!app&&s?item(e,['habla']):item(e);
 group('character','Personajes',[...appears.map(e=>who(e,speaks.get(e.key),true)),...(L?.speaks||[]).filter(e=>!shown.has(e.key)).map(e=>who(e,e,false))]);
 group('location',k=>k===1?'Ambiente':'Ambientes',(L?.location||[]).map(inh));group('environment','3D',(L?.environment||[]).map(inh));
 group('missing','No existen',(L?.missing||[]).map(m=>({key:m.kind+'/'+m.id,label:m.id,route:null,notes:[]})));
 return {groups};}
// Plegado de Apariciones (#61): secuencias y storys se pliegan con más de node viñetas+planos o si la página entera pasa de page.
export const APPEARANCE_FOLD={node:30,page:40};
export function appearanceOpen(a,total,{node=APPEARANCE_FOLD.node,page=APPEARANCE_FOLD.page}={}){if(a?.kind!=='sequence'&&a?.kind!=='story')return true;
 const n=(a.counts?.panels||0)+(a.counts?.shots||0),t=(total?.panels||0)+(total?.shots||0);return !(n>node||t>page);}
// ---- Buscador y facetas (#59): lógica de la barra de búsqueda de las vistas transversales (docs/ARQUITECTURA.md). Puras; el estado va en la URL
// (q, f) y en localStorage, nunca en proyecto.json. Ítem {key, kind, id, text, facets:{faceta:[valores]}, group, subs?, ref}; sub {key, kind, scene,
// label, text, facets}. Definición de faceta {id, label, sub?, values:[{value, label}]}; sub: también se exige a las subs para marcar coincidencias.
export function searchText(s){return String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();}
export function queryTerms(q){return searchText(q).split(' ').filter(Boolean);}
const activeFilters=filters=>Object.entries(isObj(filters)?filters:{}).filter(([,v])=>Array.isArray(v)&&v.length);
const facetOk=(facets,active)=>active.every(([id,vals])=>(Array.isArray(facets?.[id])?facets[id]:[]).some(v=>vals.includes(v)));
const hasAll=(text,terms)=>{const t=searchText(text);return terms.every(x=>t.includes(x));};
const restTerms=(item,terms)=>{const t=searchText(item?.text);return terms.filter(x=>!t.includes(x));};
// Todo término en el texto del ítem o, los que falten, todos juntos en una misma sub; cada faceta activa, algún valor (OR dentro, AND entre facetas).
export function filterItems(items,query,filters){const terms=queryTerms(query),active=activeFilters(filters);
 return (Array.isArray(items)?items:[]).filter(item=>{if(!facetOk(item.facets,active))return false;const rest=restTerms(item,terms);return !rest.length||(item.subs||[]).some(s=>hasAll(s.text,rest));});}
// Subs que explican la coincidencia: las que tienen los términos que faltan en el ítem y cumplen las facetas activas marcadas sub.
export function itemHits(item,query,filters,defs){const rest=restTerms(item,queryTerms(query)),subIds=new Set((defs||[]).filter(d=>d.sub).map(d=>d.id)),active=activeFilters(filters).filter(([id])=>subIds.has(id));
 if(!rest.length&&!active.length)return [];return (item?.subs||[]).filter(s=>hasAll(s.text,rest)&&facetOk(s.facets,active));}
// Facetas con recuento: cada una sobre los ítems que pasan los demás filtros. Se ocultan las de un solo valor en todo el conjunto (salvo activas)
// y los valores sin ítems (salvo activos); orden de la definición y después los desconocidos, con su valor por etiqueta.
export function facets(items,query,filters,defs){const list=Array.isArray(items)?items:[],f=isObj(filters)?filters:{};
 return (defs||[]).flatMap(d=>{const active=Array.isArray(f[d.id])?f[d.id]:[],all=new Set(list.flatMap(i=>i.facets?.[d.id]||[]));if(all.size<=1&&!active.length)return [];
  const count=new Map();for(const i of filterItems(list,query,{...f,[d.id]:[]}))for(const v of new Set(i.facets?.[d.id]||[]))count.set(v,(count.get(v)||0)+1);
  const known=(d.values||[]).map(x=>x.value),vals=[...(d.values||[]).filter(x=>all.has(x.value)||active.includes(x.value)),...[...new Set([...all,...active])].filter(v=>!known.includes(v)).map(v=>({value:v,label:String(v)}))];
  const values=vals.map(x=>({value:x.value,label:x.label,count:count.get(x.value)||0,active:active.includes(x.value)})).filter(x=>x.count||x.active);
  return values.length?[{id:d.id,label:d.label,active:active.length>0,values}]:[];});}
// Modelo de la barra: filtros sin facetas desconocidas, facetas, cifras y resultados con sus coincidencias.
export function filterView(items,defs,query,filters){const ids=new Set((defs||[]).map(d=>d.id)),clean=Object.fromEntries(activeFilters(filters).filter(([id])=>ids.has(id)));
 const results=filterItems(items,query,clean).map(item=>({item,hits:itemHits(item,query,clean,defs)}));
 return {total:(Array.isArray(items)?items:[]).length,shown:results.length,active:activeCount(query,clean),filters:clean,facets:facets(items,query,clean,defs),results};}
// f de la URL: «faceta:valor,…» con cada parte codificada; se ignoran los trozos mal formados y los repetidos.
export function parseFilters(s){const out={};for(const piece of String(s??'').split(',')){const i=piece.indexOf(':');if(i<1||i===piece.length-1)continue;let k,v;try{k=decodeURIComponent(piece.slice(0,i));v=decodeURIComponent(piece.slice(i+1));}catch{continue;}
 if(!k||!v||k==='__proto__')continue;if(!Object.hasOwn(out,k))out[k]=[];if(!out[k].includes(v))out[k].push(v);}return out;}
export function filtersParam(filters){return activeFilters(filters).flatMap(([k,vs])=>vs.map(v=>encodeURIComponent(k)+':'+encodeURIComponent(v))).join(',');}
export function toggleFilter(filters,id,value){const out={...(isObj(filters)?filters:{})},cur=Array.isArray(out[id])?out[id]:[],next=cur.includes(value)?cur.filter(v=>v!==value):[...cur,value];if(next.length)out[id]=next;else delete out[id];return out;}
export function activeCount(query,filters){return (String(query??'').trim()?1:0)+activeFilters(filters).reduce((n,[,v])=>n+v.length,0);}
export function hasFilters(view){return !!ROUTE_PARAMS[view]?.includes('q');}
const relIds=(index,key,rels)=>[...new Set((index.from.get(key)||[]).filter(l=>rels.includes(l.rel)).map(l=>l.to.split('/').slice(1).join('/')))];
const actLabel=p=>p?.type==='serie'?'Capítulo':'Acto';
const entityValues=list=>(Array.isArray(list)?list:[]).filter(x=>isObj(x)&&typeof x.id==='string').map(x=>({value:x.id,label:x.name||x.id}));
const episodeValues=p=>(Array.isArray(p?.episodes)?p.episodes:[]).filter(isObj).map(e=>({value:e.id,label:e.title||e.id}));
// Storyboards: un ítem por story en el orden del árbol (actos › fichas › storys, pruebas, sin secuencia), con sus escenas y viñetas como subs,
// y uno por prueba (sin subs). En el story, cast, loc y zone son la unión de sus viñetas (loc también de sus escenas).
export function storyboardItems(p){const model=treeModel(p),idx=relationIndexFor(p),items=[],fichas=[];
 const story=(n,group,extra)=>{const b=n.storyboard,subs=[],cast=[],loc=[],zone=[];
  for(const sn of n.children.filter(c=>c.kind==='scene')){const s=sn.scene,sl=relIds(idx,relKey('scene',b.id,s.id),['location']);loc.push(...sl);
   subs.push({key:sn.key,kind:'scene',scene:s.id,label:s.title||s.id,text:searchText(s.title||s.id),facets:{loc:sl}});
   for(const {panel:t} of sn.panels){if(typeof t.id!=='string')continue;const k=relKey('panel',t.id),c=relIds(idx,k,['appears','speaks']),l=relIds(idx,k,['location']),z=[zoneOf(p,t.zone).id];cast.push(...c);loc.push(...l);zone.push(...z);
    subs.push({key:k,kind:'panel',scene:s.id,label:(s.title||s.id)+' · '+[t.code,t.title].filter(Boolean).join(' '),text:searchText([t.code,t.title].filter(Boolean).join(' ')),facets:{cast:c,loc:l,zone:z}});}}
  items.push({key:n.key,kind:'story',id:b.id,text:searchText([b.title,b.subtitle,...extra].filter(Boolean).join(' ')),facets:{...group.facets,cast:uniq(cast),loc:uniq(loc),zone:uniq(zone)},group:group.group,subs,ref:{storyboard:b,version:n.version,current:n.current}});};
 for(const a of model.acts){const e=a.episode;for(const f of a.children){const ficha={id:f.sequence.id,code:f.code,title:f.sequence.title||f.sequence.id};fichas.push(ficha);
  for(const n of f.children)story(n,{group:{section:'acts',episode:e,ficha},facets:{act:[e.id],sequence:[ficha.id],kind:[n.current?'current':'other'],...(n.version?{version:['v'+n.version]}:{})}},[e.title,f.code+' '+ficha.title]);}}
 for(const g of model.groups){if(g.kind==='tests')for(const n of g.children){const s=n.sequence,k=relKey('sequence',s.id),rel=r=>[...relatedTo(idx,k,{rel:r}).keys()].map(x=>x.split('/').slice(1).join('/'));
   items.push({key:n.key,kind:'test',id:s.id,text:searchText([s.title||s.id,n.episode.title].filter(Boolean).join(' ')),facets:{act:[n.episode.id],kind:['test'],cast:rel(['appears','speaks']),loc:rel(['location'])},group:{section:'tests',episode:n.episode,ficha:null},ref:{episode:n.episode,sequence:s,shots:n.shots.length}});}
  if(g.kind==='unlinked')for(const n of g.children)story(n,{group:{section:'unlinked',episode:null,ficha:null},facets:{kind:['unlinked']}},[]);}
 const versions=uniq(items.flatMap(i=>i.facets.version||[])).sort((a,b)=>Number(a.slice(1))-Number(b.slice(1)));
 const defs=[{id:'act',label:actLabel(p),values:episodeValues(p)},{id:'sequence',label:'Secuencia',values:fichas.map(f=>({value:f.id,label:f.code+' · '+f.title}))},
  {id:'kind',label:'Estado',values:[{value:'current',label:'Vigente'},{value:'other',label:'No vigente'},{value:'unlinked',label:'Sin secuencia'},{value:'test',label:'Prueba'}]},
  {id:'version',label:'Versión',values:versions.map(v=>({value:v,label:v}))},{id:'cast',label:'Personaje',sub:true,values:entityValues(p?.characters)},
  {id:'loc',label:'Ambiente',sub:true,values:entityValues(p?.locations)},{id:'zone',label:'Zona',sub:true,values:projectZones(p).map(z=>({value:z.id,label:z.label}))}];
 return {items,defs};}
// Resultados de Storyboards agrupados (storyboardSections es la de los montajes): actos › fichas (en orden de los ítems), pruebas y sin secuencia; sin grupos vacíos.
export function storyboardResultSections(results){const acts=new Map(),tests=[],unlinked=[];
 for(const r of results||[]){const g=r.item.group||{};if(g.section==='tests'){tests.push(r);continue;}if(g.section!=='acts'){unlinked.push(r);continue;}
  if(!acts.has(g.episode.id))acts.set(g.episode.id,{kind:'act',episode:g.episode,fichas:[]});const a=acts.get(g.episode.id);let f=a.fichas.find(x=>x.ficha.id===g.ficha.id);
  if(!f){f={ficha:g.ficha,code:g.ficha.code,results:[]};a.fichas.push(f);}f.results.push(r);}
 return [...acts.values(),...(tests.length?[{kind:'tests',results:tests}]:[]),...(unlinked.length?[{kind:'unlinked',results:unlinked}]:[])];}
// Planos: un ítem por plano (actos › secuencias › planos) con texto de título, descripción, líneas y secuencia; cast y loc del índice de relaciones.
export function shotItems(p){const idx=relationIndexFor(p),items=[],seqs=[];
 for(const {episode:e,sequence:s} of seqList(p)){if(!isObj(e))continue;const role=sequenceRole(p,s);seqs.push({value:s.id,label:s.title||s.id});
  (Array.isArray(s.shots)?s.shots:[]).forEach((t,index)=>{if(!isObj(t))return;const k=relKey('shot',t.id);
   items.push({key:k,kind:'shot',id:t.id,text:searchText([t.title,t.description,...(Array.isArray(t.lines)?t.lines:[]).map(l=>l?.text),s.title].filter(x=>typeof x==='string').join(' ')),
    facets:{act:[e.id],role:[role],sequence:[s.id],loc:relIds(idx,k,['location']),cast:relIds(idx,k,['appears','speaks']),panel:[idx.shotPanel.has(k)?'yes':'no']},group:{episode:e.id,sequence:s.id,role},ref:{episode:e,sequence:s,shot:t,index}});});}
 const defs=[{id:'act',label:actLabel(p),values:episodeValues(p)},{id:'role',label:'Tipo',values:[{value:'container',label:'De storys'},{value:'outline',label:'Propios'},{value:'test',label:'Pruebas'}]},
  {id:'sequence',label:'Secuencia',values:seqs},{id:'loc',label:'Ambiente',values:entityValues(p?.locations)},{id:'cast',label:'Personaje',values:entityValues(p?.characters)},
  {id:'panel',label:'Viñeta',values:[{value:'yes',label:'Con viñeta'},{value:'no',label:'Sin viñeta'}]}];
 return {items,defs};}
// shotGroups con los planos que quedan ({shot, index} con su posición original). keep null: todos; un Set de ids: sin secuencias, grupos ni actos vacíos.
export function filterShotGroups(groups,keep){return (groups||[]).map(({episode,groups:gs,empty})=>{
 const out=gs.map(g=>({role:g.role,sequences:g.sequences.map(x=>({...x,shots:(x.sequence.shots||[]).map((shot,index)=>({shot,index})).filter(y=>!keep||keep.has(y.shot?.id))})).filter(x=>!keep||x.shots.length)})).filter(g=>g.sequences.length);
 return {episode,groups:out,empty:keep?[]:empty};}).filter(x=>!keep||x.groups.length);}
// Ambiente de las secuencias sin planos a partir de environments[].sequences (scripts/ambientes-secuencias.mjs). choose: {entorno: ambiente} cuando el
// entorno es de varios ambientes. Solo propone location en secuencias sin planos (ningún digest cambia); lo demás, con aviso.
export function sequenceLocationPlan(p,{choose={}}={}){const warnings=[],errors=[],ops=[],envs=(Array.isArray(p?.environments)?p.environments:[]).filter(isObj),locs=(Array.isArray(p?.locations)?p.locations:[]).filter(isObj);
 const seqOf=id=>seqList(p).find(x=>x.sequence.id===id)?.sequence||null,proposals=new Map();
 for(const envId of Object.keys(isObj(choose)?choose:{}))if(!envs.some(e=>e.id===envId))errors.push(`Entorno desconocido: ${envId}`);
 for(const e of envs){if(!Array.isArray(e.sequences))continue;const cands=locs.filter(l=>locationEnvs(p,l).some(x=>x.id===e.id)).map(l=>l.id),list=cands.join(', ')||'ninguno';
  const chosen=isObj(choose)&&Object.hasOwn(choose,e.id)?choose[e.id]:undefined;
  if(chosen!==undefined&&!cands.includes(chosen)){errors.push(`${chosen} no es un ambiente del entorno ${e.id} (candidatos: ${list})`);continue;}
  const loc=chosen??(cands.length===1?cands[0]:null);
  for(const id of e.sequences){const s=seqOf(id);
   if(!s){warnings.push(`${id}: la secuencia no existe (entorno ${e.id})`);continue;}
   if((s.shots||[]).length){if(!cands.includes(s.location))warnings.push(`${id}: tiene ${s.shots.length} planos y su ambiente (${s.location||'ninguno'}) no es del entorno ${e.id} (${list}); no se toca`);continue;}
   if(!cands.length){warnings.push(`${id}: el entorno ${e.id} no es de ningún ambiente`);continue;}
   if(!loc&&cands.includes(s.location))continue;
   if(!loc){warnings.push(`${id}: el entorno ${e.id} es de varios ambientes (${list}); elige uno`);continue;}
   if(s.location===loc)continue;
   if(s.location){warnings.push(`${id}: ya tiene el ambiente ${s.location}, distinto de ${loc} (entorno ${e.id}); no se toca`);continue;}
   pushTo(proposals,id,{sequence:id,location:loc,environment:e.id});}}
 for(const [id,list] of proposals){if(new Set(list.map(x=>x.location)).size>1){warnings.push(`${id}: la reclaman entornos con ambientes distintos (${list.map(x=>x.environment+' → '+x.location).join(', ')}); no se toca`);continue;}ops.push(list[0]);}
 const next=structuredClone(p);for(const o of ops)seqList(next).find(x=>x.sequence.id===o.sequence).sequence.location=o.location;
 return {ops,warnings,errors,next};}
function pushTo(m,k,v){if(!m.has(k))m.set(k,[]);m.get(k).push(v);}
// Personaje nuevo (scripts/perfil.mjs add): id en minúsculas con guiones y libre entre los ids que comprueba store.validate; kind person o voice.
export function characterDraft(p,{id,name,kind='person',color}={}){const errors=[],all=[];const ls=x=>Array.isArray(x)?x.filter(isObj):[];
 const sbs=ls(p?.storyboards),eps=ls(p?.episodes);for(const x of [...ls(p?.characters),...ls(p?.locations),...eps,...ls(p?.issues),...eps.flatMap(e=>ls(e.sequences)),...eps.flatMap(e=>ls(e.sequences).flatMap(s=>ls(s.shots))),...sbs,...sbs.flatMap(b=>ls(b.sequences)),...sbs.flatMap(b=>ls(b.sequences).flatMap(s=>ls(s.shots)))])all.push(x.id);
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]*$/.test(id))errors.push('El id debe empezar por letra y llevar solo minúsculas, cifras y guiones');else if(all.includes(id))errors.push('El id ya existe en el proyecto: '+id);
 const n=String(name??'').trim();if(!n)errors.push('Falta el nombre');if(!['person','voice'].includes(kind))errors.push('kind debe ser person o voice');
 return {character:errors.length?null:{id,name:n,kind,color:color||'#8e9ca0',description:'',voice:''},errors};}
