import {EditorView,keymap,lineNumbers,drawSelection} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {defaultKeymap,history,historyKeymap,undo,redo} from '@codemirror/commands';
import {markdown} from '@codemirror/lang-markdown';
import {syntaxHighlighting,defaultHighlightStyle} from '@codemirror/language';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
export function mountMarkdown(dialog,value){
 dialog.classList.add('md-dialog');const form=dialog.querySelector('form'),host=dialog.querySelector('[data-md-editor]');
 host.innerHTML=`<div class="md-tools" aria-label="Formato Markdown"></div><div class="md-modes" aria-label="Vista del documento"></div><div class="md-panes"><div class="md-source"></div><article class="md-preview" aria-label="Vista previa del documento"></article></div><div class="md-status"></div>`;
 const field=document.createElement('input');field.type='hidden';field.name='text';field.value=value;form.append(field);
 const preview=host.querySelector('.md-preview'),status=host.querySelector('.md-status');let timer;
 function refresh(){const text=field.value;preview.innerHTML=DOMPurify.sanitize(marked.parse(text),{USE_PROFILES:{html:true},FORBID_TAGS:['input','form','button','style']});preview.querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer';});status.textContent=`${text.trim()?text.trim().split(/\s+/u).length:0} palabras · Markdown · Ctrl/Cmd+B negrita · Ctrl/Cmd+I cursiva`;}
 let editor;
 const wrap=(before,after=before,placeholder='texto')=>{const {from,to}=editor.state.selection.main,selected=editor.state.sliceDoc(from,to)||placeholder;editor.dispatch({changes:{from,to,insert:before+selected+after},selection:{anchor:from+before.length,head:from+before.length+selected.length}});editor.focus();return true;};
 const prefix=mark=>{const sel=editor.state.selection.main,from=editor.state.doc.lineAt(sel.from).from,to=editor.state.doc.lineAt(sel.to).to,text=editor.state.sliceDoc(from,to);editor.dispatch({changes:{from,to,insert:text.split('\n').map(l=>mark+l).join('\n')}});editor.focus();};
 editor=new EditorView({parent:host.querySelector('.md-source'),state:EditorState.create({doc:value,extensions:[lineNumbers(),drawSelection(),history(),markdown(),syntaxHighlighting(defaultHighlightStyle),EditorView.lineWrapping,EditorView.contentAttributes.of({'aria-label':'Contenido Markdown',spellcheck:'true'}),keymap.of([{key:'Mod-b',run:()=>wrap('**')},{key:'Mod-i',run:()=>wrap('*')},...defaultKeymap,...historyKeymap]),EditorView.updateListener.of(u=>{if(u.docChanged){field.value=u.state.doc.toString();clearTimeout(timer);timer=setTimeout(refresh,120);}})]})});
 const tools=[['H2','Encabezado',()=>prefix('## ')],['B','Negrita',()=>wrap('**')],['I','Cursiva',()=>wrap('*')],['•','Lista',()=>prefix('- ')],['1.','Lista numerada',()=>prefix('1. ')],['❝','Cita',()=>prefix('> ')],['↗','Enlace',()=>wrap('[','](https://ejemplo.com)','texto del enlace')],['<>','Bloque de código',()=>wrap('```\n','\n```','código')],['↶','Deshacer',()=>{undo(editor);editor.focus();}],['↷','Rehacer',()=>{redo(editor);editor.focus();}]];
 for(const [label,title,fn]of tools){const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onmousedown=e=>e.preventDefault();b.onclick=fn;host.querySelector('.md-tools').append(b);}
 const modes=[];for(const [mode,label] of [['edit','Editar'],['split','En paralelo'],['preview','Vista previa']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{host.dataset.mode=mode;for(const [m,el]of modes)el.setAttribute('aria-pressed',String(m===mode));refresh();editor.requestMeasure();};modes.push([mode,b]);host.querySelector('.md-modes').append(b);}
 modes[1][1].click();refresh();dialog.addEventListener('close',()=>{clearTimeout(timer);editor.destroy();dialog.classList.remove('md-dialog');},{once:true});return editor;
}
