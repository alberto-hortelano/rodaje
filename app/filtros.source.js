// Barra de búsqueda y facetas de las vistas transversales (#59). La lógica (filterView, toggleFilter…) está en workflow.mjs; aquí, el HTML y los
// eventos. La barra se pinta una vez por render(); teclear o pulsar una faceta solo repinta resultados, facetas, contador y «Limpiar» (el <input> no
// se toca, así que no pierde el foco ni el cursor). Filtrar nunca escribe en el proyecto.
import {filterView,toggleFilter} from './workflow.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Memoria por navegador y vista (rodaje-filtros-<proyecto>-<vista>): {q, f}; nada, vacío o ilegible → null.
export const filterStorageKey=(projectId,view)=>'rodaje-filtros-'+projectId+'-'+view;
export function loadFilters(projectId,view){try{const x=JSON.parse(localStorage.getItem(filterStorageKey(projectId,view)));if(!x||typeof x!=='object')return null;
 const q=typeof x.q==='string'?x.q:'',f=Object.fromEntries(Object.entries(x.f&&typeof x.f==='object'&&!Array.isArray(x.f)?x.f:{}).map(([k,v])=>[k,Array.isArray(v)?v.filter(s=>typeof s==='string'):[]]).filter(([,v])=>v.length));
 return q.trim()||Object.keys(f).length?{q,f}:null;}catch{return null;}}
export function saveFilters(projectId,view,{q,f}){try{const k=filterStorageKey(projectId,view);if(String(q||'').trim()||Object.values(f||{}).some(v=>v?.length))localStorage.setItem(k,JSON.stringify({q:q||'',f:f||{}}));else localStorage.removeItem(k);}catch{}}
export const filterBarHTML=({view,query,placeholder,open})=>`<div class="filter-bar" role="search" data-filter-bar="${esc(view)}"><div class="filter-row"><input type="search" data-filter-q aria-label="Buscar" placeholder="${esc(placeholder)}" value="${esc(query)}" autocomplete="off"><span class="filter-count" data-filter-count aria-live="polite"></span><button type="button" data-filter-clear hidden>Limpiar</button></div><details class="filter-facets" data-filter-facets${open?' open':''}><summary>Filtros</summary><div data-filter-chips></div></details></div>`;
export const chipsHTML=list=>list.map(f=>`<fieldset class="facet"><legend>${esc(f.label)}</legend>${f.values.map(v=>`<button type="button" class="chip" data-facet="${esc(f.id)}" data-value="${esc(v.value)}" aria-pressed="${v.active}">${esc(v.label)} <small>${v.count}</small></button>`).join('')}</fieldset>`).join('');
const emptyHTML=text=>`<div class="empty"><h2>Nada coincide.</h2><p>${esc(text||'Prueba con otras palabras o quita algún filtro.')}</p><button type="button" data-filter-clear>Limpiar filtros</button></div>`;
// ctx = {view, items, defs, paint(model) → html, noun:[singular, plural], empty}; state = {q, f}, se actualiza en sitio. onChange solo tras un
// cambio del usuario (el primer pintado no guarda: una ruta con foco que ignora la memoria no la borra).
export function mountFilters({bar,results,ctx,state,bind,onChange,onToggle}){
 const q=bar.querySelector('[data-filter-q]'),count=bar.querySelector('[data-filter-count]'),clear=bar.querySelector('[data-filter-clear]'),det=bar.querySelector('[data-filter-facets]'),chips=bar.querySelector('[data-filter-chips]'),summary=det.querySelector('summary');
 let timer=null,alive=true;const ro=new ResizeObserver(()=>setTop());
 // En móvil la barra lateral va fija arriba: la de filtros se pega justo debajo (su alto cambia al cargar los estilos o al girar la pantalla).
 const setTop=()=>{const side=matchMedia('(max-width: 750px)').matches&&document.querySelector('.sidebar');bar.style.setProperty('--sticky-top',(side?side.offsetHeight:0)+'px');};
 const refresh=(changed=true)=>{if(!alive)return;const m=filterView(ctx.items,ctx.defs,state.q,state.f);state.f=m.filters;
  results.innerHTML=m.shown||!m.active?ctx.paint(m):emptyHTML(ctx.empty);
  chips.innerHTML=chipsHTML(m.facets)||'<p class="tiny">No hay filtros para estos datos.</p>';
  const [one,many]=ctx.noun,n=m.active-(String(state.q||'').trim()?1:0);
  count.textContent=(m.active?m.shown+' de ':'')+m.total+' '+(m.total===1?one:many);
  clear.hidden=!m.active;clear.textContent=`Limpiar (${m.active})`;summary.textContent=n?`Filtros (${n} ${n===1?'activo':'activos'})`:'Filtros';
  bind(results);if(changed)onChange?.(state);};
 const reset=()=>{clearTimeout(timer);timer=null;state.q='';state.f={};q.value='';refresh();q.focus();};
 const typed=()=>{clearTimeout(timer);timer=setTimeout(()=>{timer=null;state.q=q.value;refresh();},150);};
 q.addEventListener('input',e=>{if(!e.isComposing)typed();});q.addEventListener('compositionend',typed);
 bar.addEventListener('click',e=>{const c=e.target.closest('[data-facet]');if(c){const {facet,value}=c.dataset;state.f=toggleFilter(state.f,facet,value);refresh();chips.querySelector(`[data-facet="${CSS.escape(facet)}"][data-value="${CSS.escape(value)}"]`)?.focus();return;}if(e.target.closest('[data-filter-clear]'))reset();});
 results.addEventListener('click',e=>{if(e.target.closest('[data-filter-clear]'))reset();});
 det.addEventListener('toggle',()=>onToggle?.(det.open));
 addEventListener('resize',setTop);const side=document.querySelector('.sidebar');if(side)ro.observe(side);setTop();refresh(false);
 return {refresh,dispose(){if(timer){clearTimeout(timer);state.q=q.value;}timer=null;alive=false;removeEventListener('resize',setTop);ro.disconnect();}};}
