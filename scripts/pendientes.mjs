#!/usr/bin/env node
// Pendientes (tablero kanban) de un proyecto desde la línea de órdenes.
//   node scripts/pendientes.mjs importar [proyecto] <analisis.md>   Vuelca los puntos de un análisis crítico (A2…, C14…) como pendientes; por código, sin duplicar.
//   node scripts/pendientes.mjs listar [proyecto]                    Muestra el tablero por columnas.
import fs from 'node:fs';
import {load,save} from '../app/store.mjs';
import {parseIssues,upsertIssues,issueBoard} from '../app/workflow.mjs';import {takeOption} from '../lib/args.mjs';import {cliProject,usageExit} from '../lib/cli.mjs';
// Proyecto: [proyecto] o --project id, RODAJE_PROJECT o el activo en la app.
const USAGE='Uso: pendientes.mjs importar [proyecto] <fichero.md> | listar [proyecto]  [--project id]';
const argv=process.argv.slice(2);const p0=takeOption(argv,'--project');const [cmd,...more]=argv;
if(!['importar','listar'].includes(cmd))usageExit(USAGE);
if(cmd==='importar'&&!more.length)usageExit(USAGE,'Falta el fichero Markdown');
const {project,args:[file]}=cliProject({usage:USAGE,opts:{project:p0},args:more,positional:cmd==='importar'?1:0});
if(cmd==='importar'&&!file)usageExit(USAGE,'Falta el fichero Markdown');
const p=load(project);
if(cmd==='importar'){const r=upsertIssues(p,parseIssues(fs.readFileSync(file,'utf8')));save(p);console.log(`${p.name}: ${r.added} pendientes nuevos, ${r.updated} actualizados; revisión ${p.revision}`);}
else if(cmd==='listar'){for(const col of issueBoard(p)){console.log(`\n${col.label} (${col.items.length})`);for(const i of col.items)console.log(`  ${(i.code||'').padEnd(4)} ${i.severity||''}`.padEnd(14)+` ${i.title}`);}}
