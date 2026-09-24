#!/usr/bin/env node
// Pendientes (tablero kanban) de un proyecto desde la línea de órdenes.
//   node scripts/pendientes.mjs importar <proyecto> <analisis.md>   Vuelca los puntos de un análisis crítico (A2…, C14…) como pendientes; por código, sin duplicar.
//   node scripts/pendientes.mjs listar <proyecto>                    Muestra el tablero por columnas.
import fs from 'node:fs';
import {load,save} from '../app/store.mjs';
import {parseIssues,upsertIssues,issueBoard} from '../app/workflow.mjs';
const [cmd,project,file]=process.argv.slice(2);
if(!cmd||!project){console.error('Uso: pendientes.mjs importar <proyecto> <fichero.md> | listar <proyecto>');process.exit(1);}
const p=load(project);
if(cmd==='importar'){if(!file)throw Error('Falta el fichero Markdown');const r=upsertIssues(p,parseIssues(fs.readFileSync(file,'utf8')));save(p);console.log(`${p.name}: ${r.added} pendientes nuevos, ${r.updated} actualizados; revisión ${p.revision}`);}
else if(cmd==='listar'){for(const col of issueBoard(p)){console.log(`\n${col.label} (${col.items.length})`);for(const i of col.items)console.log(`  ${(i.code||'').padEnd(4)} ${i.severity||''}`.padEnd(14)+` ${i.title}`);}}
else throw Error('Orden desconocida: '+cmd);
