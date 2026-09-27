#!/usr/bin/env node
// Servidor de solo lectura para leer los documentos de un proyecto desde el móvil en la misma wifi.
//   node scripts/leer-movil.mjs [proyecto] [puerto=4321] [--project id] [--puerto 4321]
// Sirve guion/*.md e ideas/*.md renderizados. No expone la app ni permite escribir nada.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {networkInterfaces} from 'node:os';
import {marked} from 'marked';
import {projectDir} from '../lib/paths.mjs';import {takeOption} from '../lib/args.mjs';import {cliProject,usageExit} from '../lib/cli.mjs';
const USAGE='Uso: leer-movil.mjs [proyecto] [puerto=4321] [--project id] [--puerto 4321]';
const argv=process.argv.slice(2);const p0=takeOption(argv,'--project'),p1=takeOption(argv,'--puerto');
const {project,args:rest}=cliProject({usage:USAGE,opts:{project:p0},args:argv,positional:a=>a.length>0&&!/^\d+$/.test(a[0])});
if(p1===true)usageExit(USAGE,'--puerto necesita un número');const port=Number(p1??rest[0]??4321);if(!Number.isInteger(port)||port<1||port>65535)usageExit(USAGE,'Puerto no válido');
const base=projectDir(project);
const docs=()=>['guion','ideas'].flatMap(d=>{const p=path.join(base,d);return fs.existsSync(p)?fs.readdirSync(p).filter(f=>f.endsWith('.md')).sort().map(f=>d+'/'+f):[];});
const css=`<meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0 auto;padding:20px 16px 60px;font:19px/1.55 Georgia,serif;background:#f4efe6;color:#222;max-width:720px}h1{font-size:1.5em;line-height:1.2}blockquote{margin:1em 0;padding:0 0 0 14px;border-left:3px solid #999}blockquote p{margin:.25em 0}table{border-collapse:collapse;font-size:.8em;display:block;overflow-x:auto}td,th{border:1px solid #bbb;padding:6px;vertical-align:top}hr{border:0;border-top:1px solid #bbb;margin:2em 0}a{color:#7a2e12}ul.idx li{margin:.5em 0}</style>`;
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const title=f=>esc(fs.readFileSync(path.join(base,f),'utf8').split('\n')[0].replace(/^#\s*/,''));
http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);const list=docs();res.setHeader('content-type','text/html; charset=utf-8');
 if(u==='/')return res.end(css+`<h1>${esc(project)}</h1><ul class=idx>`+list.map(f=>`<li><a href="/${f}">${title(f)}</a><br><small>${f}</small></li>`).join('')+'</ul>');
 const f=u.slice(1);if(!list.includes(f)){res.statusCode=404;return res.end('No existe');}
 res.end(css+'<p><a href="/">← índice</a></p>'+marked.parse(fs.readFileSync(path.join(base,f),'utf8')));
}).listen(port,'0.0.0.0',()=>{const ips=Object.values(networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).map(i=>i.address);console.log('Lectura en el móvil: '+ips.map(ip=>`http://${ip}:${port}/`).join('  '));});
