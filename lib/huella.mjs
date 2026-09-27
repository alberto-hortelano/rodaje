// Huella del contenido de un entorno 3D para store.digest (#30): sha256 del constructor, de data y de cada textura de data.textures.
// Solo contenido, sin rutas: mover o renombrar ficheros no caduca aprobaciones; cambiar un byte de lo que se renderiza, sí.
// Fuera glb y viewer.plugins: app/stage.js no los usa para renderizar el plano.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {safe} from './paths.mjs';

const cache = new Map();
// sha256 de un fichero con caché por (ruta, mtime, tamaño, inodo); null si falta o no se lee. Nunca lanza.
export function fileHash(file) {
  try {
    const st = fs.statSync(file, {bigint: true});
    if (!st.isFile()) return null;
    const key = st.mtimeNs + ':' + st.size + ':' + st.ino, hit = cache.get(file);
    if (hit?.key === key) return hit.hash;
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    cache.set(file, {key, hash});
    return hash;
  } catch { return null; }
}
const rel = (root, f) => { try { return fileHash(safe(root, f)); } catch { return null; } };

const defsCache = new Map(); // sha256 de data → data.textures
// root = carpeta del proyecto; env = entrada de proyecto.environments. Las texturas se resuelven como textureUrl en app/stage.js:
// carpeta de env.data + '/' + file, relativa al proyecto.
export function environmentContent(root, env) {
  const builder = env.builder ? rel(root, env.builder) : null, data = env.data ? rel(root, env.data) : null;
  let textures = null;
  if (data) try {
    if (!defsCache.has(data)) defsCache.set(data, JSON.parse(fs.readFileSync(safe(root, env.data), 'utf8')).textures);
    const defs = defsCache.get(data), base = env.data.split('/').slice(0, -1).join('/');
    if (defs && typeof defs === 'object') textures = Object.fromEntries(Object.entries(defs).map(([k, cfg]) => [k, typeof cfg?.file === 'string' ? rel(root, base + '/' + cfg.file) : null]));
  } catch {}
  return {builder, data, textures};
}
