// Lectura y escritura de JSON. writeJSON es atómica: temporal único en la misma carpeta y rename.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export function writeJSON(f, v) {
  const text = JSON.stringify(v, null, 2) + '\n'; // si no se puede serializar, el disco no cambia
  fs.mkdirSync(path.dirname(f), {recursive: true});
  const tmp = `${f}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try { fs.writeFileSync(tmp, text); fs.renameSync(tmp, f); } catch (e) { fs.rmSync(tmp, {force: true}); throw e; }
}
