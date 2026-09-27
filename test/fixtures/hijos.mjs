// Registro de los servidores que lanzan los tests (issue #38). test/setup.mjs lo recorre al salir y ante SIGINT, SIGTERM o EPIPE:
// si la señal llega solo al proceso del test (no al grupo), sus hijos no quedan huérfanos escuchando en un puerto.
// Todo spawn de un servidor en test/ pasa por spawnServer() o track(); test/hijos.test.mjs lo comprueba.
import {spawn} from 'node:child_process';
const hijos=new Set();
export const track=child=>{hijos.add(child);child.once('exit',()=>hijos.delete(child));return child;};
export const spawnServer=(...args)=>track(spawn(...args));
// Síncrono: vale dentro de 'exit' y de un manejador de señal.
export const killAll=()=>{for(const c of hijos){try{c.kill();}catch{}hijos.delete(c);}};
