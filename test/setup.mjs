import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {killAll} from './fixtures/hijos.mjs';
// Una sola raíz temporal por proceso: DATA, configuración y TMPDIR (os.tmpdir() lo lee en cada llamada, así que los mkdtemp de los tests
// y de sus subprocesos caen dentro). En Node 26 el coordinador de node --test no carga --import: cada proceso de test tiene su propia
// raíz en /tmp y la borra al salir, también con SIGINT o SIGTERM (Ctrl-C), que no emiten 'exit'. Solo un SIGKILL deja basura.
// Un fichero atascado en un bucle de spawnSync no atiende la señal: sigue hasta escribir en el stdout del coordinador ya muerto y
// muere por EPIPE sin emitir 'exit' (código 7). Por eso también se borra ante un EPIPE no capturado (otros errores los gestiona el runner).
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-suite-'));
process.env.TMPDIR=root;
process.env.RODAJE_DATA=path.join(root,'data');fs.mkdirSync(process.env.RODAJE_DATA);
// Nunca la clave real en la suite (loadEnv no pisa una variable ya definida) ni la configuración local del repositorio.
process.env.FAL_KEY='test:dummy';process.env.RODAJE_CONFIG_DIR=path.join(root,'config');fs.mkdirSync(process.env.RODAJE_CONFIG_DIR);
// Antes de borrar, mata los servidores registrados en fixtures/hijos.mjs (issue #38).
const clean=()=>{killAll();try{fs.rmSync(root,{recursive:true,force:true,maxRetries:3});}catch{}};
process.on('exit',clean);process.on('uncaughtExceptionMonitor',e=>{if(e?.code==='EPIPE')clean();});
// Borra, quita el manejador y se reenvía la señal: se conservan el código de salida y el comportamiento del runner.
for(const sig of ['SIGINT','SIGTERM']){const h=()=>{clean();process.off(sig,h);process.kill(process.pid,sig);};process.on(sig,h);}
