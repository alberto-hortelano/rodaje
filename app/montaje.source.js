import {storyboardShot,chosenAttempt,blockAt} from './workflow.mjs';
// Vista Montaje: el corte de un lote con, en cada momento, su bloque, la toma, la viñeta del storyboard y la escena.
// Debajo, el editor del bloque: tomas generadas, tramo usado, veredicto y prompt. «Volver a montar» lanza montar.mjs.
export async function mountMontaje(root,{project:p,api,toast}){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const media=f=>'/api/asset?project='+p.id+'&file='+encodeURIComponent(f);const fmt=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`:'–';
 const store=(k,v)=>{try{if(v===undefined)return localStorage.getItem('rodaje-montaje-'+p.id+'-'+k);localStorage.setItem('rodaje-montaje-'+p.id+'-'+k,v);}catch{}};
 const lotes=await api('/api/lotes?project='+p.id);
 if(!lotes.length){root.innerHTML='<div class="empty"><h2>Aún no hay lotes</h2><p>Un lote aparece aquí cuando <code>scripts/bloques/planificar.mjs</code> crea su <code>plan.json</code>; el montaje, al pasar <code>montar.mjs</code>.</p></div>';return {dispose(){}};}
 let lote,cut,timeline=[],current=null,selected=null,take=null,poll=null,disposed=false,rangeDraft=null;
 const model=e=>/h3-max/.test(e||'')?'H3 Max':/minimax\/h3\//.test(e||'')?'H3':(e||'').split('/').slice(-2).join('/');
 const seqOf=()=>p.episodes.find(e=>e.id===lote.meta.episode)?.sequences.find(s=>s.id===lote.meta.sequence);
 const episodeOf=()=>p.episodes.find(e=>e.id===lote.meta.episode);
 const shotOf=b=>seqOf()?.shots.find(t=>t.id===b.shots[0]);
 const sbOf=b=>{const t=shotOf(b);if(!t?.storyboardShot)return null;try{return storyboardShot(p,t.storyboardShot).shot;}catch{return null;}};
 const frameOf=b=>b.refs?.image||shotOf(b)?.storyboardRender||sbOf(b)?.render;
 const blockById=id=>lote.blocks.find(b=>b.id===id);
 // Estado de un bloque según sus intentos de ahora (puede diferir del corte si se ha revisado después de montar).
 const stateOf=b=>{const {attempt,pending}=chosenAttempt(b.attempts);return attempt?(pending?'pending':'accepted'):'missing';};
 const stale=b=>{const c=cut?.blocks.find(x=>x.block===b.id),{attempt}=chosenAttempt(b.attempts);if(!c)return true;if(!attempt)return c.source==='generated';return c.attempt!==attempt.n||JSON.stringify(c.usedRange||null)!==JSON.stringify(attempt.usedRange||c.usedRange||null)||!!c.pending!==(attempt.verdict!=='accepted');};
 const label={accepted:'Aceptada',pending:'Sin revisar',missing:'Sin toma'};
 async function load(id){lote=await api(`/api/lote?project=${p.id}&lote=${encodeURIComponent(id)}`);store('lote',id);}
 function pickCut(name){cut=lote.cuts.find(c=>c.name===name)||lote.cuts.at(-1)||null;timeline=cut?.blocks||[];}
 root.innerHTML=`<div class="mt">
  <div class="mt-bar"><label>Lote<select data-mt="lote">${lotes.map(l=>`<option value="${esc(l.id)}">${esc(l.id)} · ${l.blocks} bloques</option>`).join('')}</select></label><label>Corte<select data-mt="cut"></select></label><div class="mt-bar-info"></div><button data-mt="montar" class="primary">Volver a montar</button></div>
  <div class="mt-main"><div class="mt-player"><video data-mt="video" controls preload="metadata"></video><div class="mt-timeline" data-mt="timeline"></div><div class="mt-legend"><span class="mt-dot accepted"></span>Aceptada <span class="mt-dot pending"></span>Sin revisar <span class="mt-dot missing"></span>Sin toma <span class="mt-dot stale"></span>Cambiada desde el montaje · <kbd>Espacio</kbd> reproducir · <kbd>←</kbd><kbd>→</kbd> plano anterior/siguiente · <kbd>E</kbd> editar el plano actual</div></div>
  <aside class="mt-side" data-mt="side"></aside></div>
  <section class="mt-editor panel" data-mt="editor"></section></div>`;
 const $=s=>root.querySelector(`[data-mt="${s}"]`),video=$('video');
 const lastLote=store('lote');$('lote').value=lotes.some(l=>l.id===lastLote)?lastLote:lotes[0].id;
 function renderBar(){$('cut').innerHTML=lote.cuts.length?lote.cuts.map(c=>`<option value="${esc(c.name)}" ${c===cut?'selected':''}>${esc(c.name)} · ${fmt(c.duration)}</option>`).join(''):'<option>Sin montar</option>';
  const changed=lote.blocks.filter(stale).length,counts=lote.blocks.reduce((n,b)=>(n[stateOf(b)]++,n),{accepted:0,pending:0,missing:0}),m=lote.montando;
  root.querySelector('.mt-bar-info').innerHTML=`<span class="pill ok">${counts.accepted} aceptados</span> <span class="pill warn">${counts.pending} sin revisar</span>${counts.missing?` <span class="pill">${counts.missing} sin toma</span>`:''}${changed?` <span class="pill mt-stale-pill">${changed} cambiados desde este corte</span>`:''}${m?.state==='running'?' <span class="pill">Montando…</span>':m?.state==='failed'?` <span class="pill warn" title="${esc(m.error)}">El montaje falló</span>`:''}`;
  $('montar').disabled=m?.state==='running';}
 function renderTimeline(){const total=cut?.duration||timeline.at(-1)?.end||1;$('timeline').innerHTML=timeline.map(c=>{const b=blockById(c.block),sb=b&&sbOf(b);return `<button class="mt-seg ${b?stateOf(b):'missing'} ${b&&stale(b)?'stale':''} ${selected===c.block?'selected':''}" style="width:${(c.end-c.start)/total*100}%" data-seg="${esc(c.block)}" title="${esc(c.block)}${sb?' · '+esc(sb.code+' '+sb.title):''} · ${fmt(c.start)}–${fmt(c.end)}"><span>${esc(sb?.code||c.block)}</span></button>`;}).join('')+'<i class="mt-head"></i>';
  root.querySelectorAll('[data-seg]').forEach(el=>el.onclick=e=>{const c=timeline.find(x=>x.block===el.dataset.seg),r=el.getBoundingClientRect();video.currentTime=c.start+(c.end-c.start)*Math.max(0,Math.min(.98,(e.clientX-r.left)/r.width));tick();select(c.block);});moveHead();}
 function moveHead(){const h=root.querySelector('.mt-head'),total=cut?.duration||timeline.at(-1)?.end||1;if(h)h.style.left=(video.currentTime/total*100)+'%';}
 function renderSide(){const el=$('side');if(!current){el.innerHTML='<p class="tiny">Sin corte montado. Pulsa «Volver a montar».</p>';return;}const b=blockById(current.block),t=b&&shotOf(b),sb=b&&sbOf(b),s=seqOf(),e=episodeOf(),a=b&&b.attempts.find(x=>x.n===current.attempt),f=b&&frameOf(b);
  el.innerHTML=`<div class="mt-now"><div class="row between"><h2>${esc(sb?.code||current.block)} · ${esc(sb?.title||t?.title||'')}</h2><span class="pill ${b?({accepted:'ok',pending:'warn'})[stateOf(b)]||'':''}">${b?label[stateOf(b)]:''}</span></div>
   <p class="tiny">Bloque ${esc(current.block)} · ${fmt(video.currentTime-current.start)} de ${fmt(current.end-current.start)} · montaje ${fmt(video.currentTime)}</p>
   ${f?`<figure class="mt-frame"><img src="${media(f)}" alt="Viñeta ${esc(sb?.code||'')}"><figcaption>Viñeta del storyboard · primer fotograma</figcaption></figure>`:''}
   <dl class="mt-facts">
    <dt>Toma</dt><dd>${current.source==='generated'?`v${current.attempt} · ${esc(model(a?.endpoint))}${current.usedRange?` · tramo ${current.usedRange.map(([x,y])=>`${x}–${y} s`).join(', ')}`:''}${current.pending?' · <b>sin revisar</b>':''}`:current.source==='guide'?'Guía 3D':'Sin toma'}${b&&stale(b)?'<br><span class="mt-stale-text">Ha cambiado desde este corte</span>':''}</dd>
    ${sb?.camera?`<dt>Cámara</dt><dd>${esc(sb.camera)}</dd>`:''}
    <dt>Acción</dt><dd>${esc(sb?.action||t?.description||'')}</dd>
    ${sb?.sound?`<dt>Sonido</dt><dd>${esc(sb.sound)}</dd>`:''}
    ${(sb?.dialogue||[]).length?`<dt>Diálogo</dt><dd>${sb.dialogue.map(d=>`<b>${esc(p.characters.find(c=>c.id===d.character)?.name||d.character||'')}</b> ${esc(d.text||d)}`).join('<br>')}</dd>`:''}
    <dt>Escena</dt><dd>${esc(e?.title||'')} / ${esc(s?.title||lote.meta.sequence)}</dd>
   </dl><button data-mt="edit-current">Editar este plano ↓</button></div>`;
  el.querySelector('[data-mt="edit-current"]').onclick=()=>{select(current.block);$('editor').scrollIntoView({behavior:'smooth'});};}
 function tick(){const c=blockAt(timeline,video.currentTime);moveHead();if(c!==current){current=c;renderSide();if(video.paused&&c)select(c.block,false);}else if(current)root.querySelector('.mt-now .tiny').textContent=`Bloque ${current.block} · ${fmt(video.currentTime-current.start)} de ${fmt(current.end-current.start)} · montaje ${fmt(video.currentTime)}`;}
 function select(id,force=true){if(!force&&selected===id)return;selected=id;const b=blockById(id);const {attempt}=chosenAttempt(b.attempts);take=(attempt||b.attempts.filter(a=>a.video).at(-1))?.n??null;rangeDraft=null;renderEditor();root.querySelectorAll('.mt-seg').forEach(el=>el.classList.toggle('selected',el.dataset.seg===id));}
 function renderEditor(){const el=$('editor'),b=selected&&blockById(selected);if(!b){el.innerHTML='<p class="tiny">Elige un plano en la línea de tiempo.</p>';return;}const sb=sbOf(b),a=b.attempts.find(x=>x.n===take),f=frameOf(b),dirOf=b.direccion;
  const range=rangeDraft||a?.usedRange||null,dur=a?.durationReturned||a?.durationRequested||b.length;
  el.innerHTML=`<div class="row between"><div><div class="eyebrow">Editar plano</div><h2>${esc(sb?.code||b.id)} · ${esc(sb?.title||'')} <span class="tiny">bloque ${esc(b.id)} · ${b.length} s en el plan</span></h2></div><div class="row"><button data-ed="prev">← Anterior</button><button data-ed="next">Siguiente →</button></div></div>
   <div class="mt-takes">${b.attempts.map(x=>`<button class="mt-take ${x.verdict||(x.video?'pending':'none')} ${x.n===take?'active':''}" data-take="${x.n}" ${x.video?'':'disabled'} title="${esc(x.changedLine||'Primer intento')}">v${x.n} · ${esc(model(x.endpoint))} ${x.verdict==='accepted'?'✓':x.verdict==='rejected'?'✕':x.video?'·':'(sin vídeo)'}</button>`).join('')||'<span class="tiny">Sin intentos enviados.</span>'}</div>
   ${a?`<div class="mt-compare"><div><video data-ed="take" controls preload="metadata" src="${media(`assets/${lote.id}/${b.id}/${a.video}`)}"></video><div class="mt-range" data-ed="range"></div>
    <div class="row mt-range-tools"><button data-ed="in">[ Entrada aquí</button><button data-ed="out">Salida aquí ]</button><button data-ed="full">Tramo del plan</button><span class="tiny">Tramo: <b data-ed="range-text">${range?range.map(([x,y])=>`${x.toFixed(2)}–${y.toFixed(2)} s`).join(', '):`0–${Math.min(dur,b.length)} s (por defecto)`}</b> · vídeo ${fmt(dur)}</span></div></div>
    <div>${f?`<figure class="mt-frame"><img src="${media(f)}" alt="Viñeta"><figcaption>Primer fotograma pedido</figcaption></figure>`:''}
     <dl class="mt-facts"><dt>Modelo</dt><dd>${esc(a.endpoint)}</dd><dt>Duración</dt><dd>pedida ${a.durationRequested} s · devuelta ${a.durationReturned?.toFixed?.(2)??'–'} s</dd><dt>Cambio</dt><dd>${esc(a.changedLine||'Primer intento')}</dd>${a.verdict?`<dt>Veredicto</dt><dd>${a.verdict==='accepted'?'Aceptada':'Rechazada'}${a.failedRules?.length?' · '+esc(a.failedRules.join(', ')):''}${a.notes?' · '+esc(a.notes):''}</dd>`:''}</dl></div></div>
   <div class="mt-review"><div class="mt-rules">${lote.rules.map(r=>`<label class="mt-rule" title="${esc(r.title)}"><input type="checkbox" value="${esc(r.id)}" ${a.failedRules?.includes(r.id)?'checked':''}>${esc(r.id)} ${esc(r.title)}</label>`).join('')}</div>
    <label>Notas<textarea data-ed="notes" rows="2">${esc(a.notes||'')}</textarea></label>
    <div class="row"><button class="primary" data-ed="accept">✓ Aceptar y usar esta toma</button><button data-ed="reject">✕ Rechazar (marca las reglas que falla)</button>${a.verdict?'<button data-ed="clear">Quitar veredicto</button>':''}</div></div>
    <details data-ed="prompt"><summary>Prompt enviado (${esc(a.prompt||'prompt.txt')})</summary><pre class="mt-pre">Cargando…</pre></details>`:''}
   ${dirOf?`<details><summary>Dirección del bloque</summary><dl class="mt-facts">${['camera','action','acting','local'].filter(k=>dirOf[k]).map(k=>`<dt>${({camera:'Cámara',action:'Acción',acting:'Actuación',local:'Restricciones'})[k]}</dt><dd>${esc(typeof dirOf[k]==='string'?dirOf[k]:JSON.stringify(dirOf[k],null,1))}</dd>`).join('')}</dl></details>`:''}`;
  const q=s=>el.querySelector(`[data-ed="${s}"]`);
  q('prev').onclick=()=>step(-1);q('next').onclick=()=>step(1);
  el.querySelectorAll('[data-take]').forEach(x=>x.onclick=()=>{take=Number(x.dataset.take);rangeDraft=null;renderEditor();});
  if(!a)return;const tv=q('take');
  const drawRange=()=>{const r=rangeDraft||a.usedRange||[[0,Math.min(dur,b.length)]];q('range').innerHTML=r.map(([x,y])=>`<i style="left:${x/dur*100}%;width:${(y-x)/dur*100}%"></i>`).join('')+`<b style="left:${tv.currentTime/dur*100}%"></b>`;};
  drawRange();tv.ontimeupdate=drawRange;q('range').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();tv.currentTime=(e.clientX-r.left)/r.width*dur;};
  const setRange=r=>{rangeDraft=r;q('range-text').textContent=r.map(([x,y])=>`${x.toFixed(2)}–${y.toFixed(2)} s`).join(', ')+' (sin guardar: acepta para usarlo)';drawRange();};
  const cur=()=>(rangeDraft||a.usedRange||[[0,Math.min(dur,b.length)]])[0];
  q('in').onclick=()=>{const [,y]=cur(),x=Math.round(tv.currentTime*100)/100;setRange([[x,y>x?y:Math.min(dur,x+b.length)]]);};
  q('out').onclick=()=>{const [x]=cur(),y=Math.round(tv.currentTime*100)/100;if(y<=x)return toast('La salida tiene que ir después de la entrada');setRange([[x,y]]);};
  q('full').onclick=()=>setRange([[0,Math.round(Math.min(dur,b.length)*100)/100]]);
  const send=async verdict=>{const rules=[...el.querySelectorAll('.mt-rule input:checked')].map(i=>i.value);try{b.attempts=await api('/api/lote-review',{project:p.id,lote:lote.id,block:b.id,attempt:a.n,verdict,rules:verdict==='rejected'?rules:[],notes:q('notes').value.trim(),range:verdict==='accepted'&&rangeDraft?rangeDraft:undefined});toast(verdict==='accepted'?`v${a.n} aceptada para ${sb?.code||b.id}`:verdict==='rejected'?`v${a.n} rechazada`:'Veredicto quitado');rangeDraft=null;renderBar();renderTimeline();renderSide();renderEditor();}catch(e){toast(e.message);}};
  q('accept').onclick=()=>send('accepted');q('reject').onclick=()=>send('rejected');if(q('clear'))q('clear').onclick=()=>send(null);
  q('prompt').ontoggle=async e=>{if(!e.target.open||e.target.dataset.loaded)return;e.target.dataset.loaded=1;const r=await fetch(media(`assets/${lote.id}/${b.id}/${a.prompt||'prompt.txt'}`));e.target.querySelector('pre').textContent=r.ok?await r.text():'No se encuentra el prompt.';};}
 function step(d){const i=lote.blocks.findIndex(b=>b.id===selected),n=lote.blocks[Math.max(0,Math.min(lote.blocks.length-1,i+d))];if(!n)return;const c=timeline.find(x=>x.block===n.id);if(c&&video.paused){video.currentTime=c.start+.01;tick();}select(n.id);}
 async function open(id,cutName){await load(id);pickCut(cutName);$('lote').value=id;renderBar();video.src=cut?media(cut.file):'';current=null;renderTimeline();video.currentTime=0;tick();if(!current)renderSide();select(selected&&blockById(selected)?selected:lote.blocks[0].id);watch();}
 function watch(){clearInterval(poll);if(lote.montando?.state!=='running')return;poll=setInterval(async()=>{if(disposed)return clearInterval(poll);const before=lote.cuts.length;const fresh=await api(`/api/lote?project=${p.id}&lote=${encodeURIComponent(lote.id)}`).catch(()=>null);if(!fresh||fresh.montando?.state==='running')return;clearInterval(poll);if(fresh.montando?.state==='failed'){lote=fresh;renderBar();return toast('El montaje falló: '+fresh.montando.error);}toast(fresh.montando?.output||'Montaje terminado');const keep=selected;await open(lote.id,fresh.cuts.at(-1)?.name);if(keep&&fresh.cuts.length>before)select(keep);},3000);}
 $('lote').onchange=e=>{selected=null;open(e.target.value).catch(err=>toast(err.message));};
 $('cut').onchange=e=>{pickCut(e.target.value);video.src=media(cut.file);current=null;renderBar();renderTimeline();tick();};
 $('montar').onclick=async()=>{try{lote.montando=await api('/api/montar',{project:p.id,lote:lote.id});renderBar();toast('Montando: se crea un corte nuevo; los planos sin cambios no se vuelven a codificar.');watch();}catch(e){toast(e.message);}};
 video.ontimeupdate=tick;video.onseeked=tick;video.onpause=()=>{if(current)select(current.block,false);};
 const keys=e=>{if(e.target.closest?.('input,textarea,select')||!root.isConnected)return;if(e.key===' '&&!e.target.closest?.('video,button')){e.preventDefault();video.paused?video.play():video.pause();}else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){if(e.target.closest?.('video'))return;e.preventDefault();const i=timeline.indexOf(current),c=timeline[Math.max(0,Math.min(timeline.length-1,i+(e.key==='ArrowRight'?1:-1)))];if(c){video.currentTime=c.start+.01;tick();select(c.block);}}else if(e.key==='e'||e.key==='E'){if(current){select(current.block);$('editor').scrollIntoView({behavior:'smooth'});}}};
 document.addEventListener('keydown',keys);
 await open($('lote').value);
 return {dispose(){disposed=true;clearInterval(poll);document.removeEventListener('keydown',keys);video.removeAttribute('src');video.load();}};}
