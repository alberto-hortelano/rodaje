// Fusión de ediciones de imagen (ChatGPT): la original encima, la editada debajo; se borra a pincel la zona editada y se guarda el resultado.
// Uso: node scripts/fusionar.mjs [proyecto] [--puerto 4398]   → abre http://127.0.0.1:4398
// Busca pares original/editada (mismo tamaño, casi idénticas). Al guardar:
//   <editada>.png            ← la fusión (sustituye a la editada, así las rutas del proyecto siguen valiendo)
//   <editada>.chatgpt.png    ← la edición tal como salió de ChatGPT (solo la primera vez)
//   <editada>.mascara.png    ← la máscara, para retomar la fusión
// Registro de fusiones en <DATA>/fusiones.json. Respeta RODAJE_DATA y usa safe de lib/paths (rechaza "..", absolutas y enlaces fuera de proyectos).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {ROOT, DATA, safe} from '../lib/paths.mjs';
import {writeJSON} from '../lib/json.mjs';

const args = process.argv.slice(2);
const port = Number(args.includes('--puerto') ? args.splice(args.indexOf('--puerto'), 2)[1] : 4398);
const only = args[0];
const LOG = path.join(DATA, 'fusiones.json');
const SKIP = /\.(chatgpt|mascara)\.png$/;
const SKIP_DIR = /^(node_modules|versiones|trabajos|capturas|texturas|\.git)$|^sample-|^p\d+$|^b\d+$/;

const inData = rel => safe(DATA, rel);
const pngSize = f => { const b = Buffer.alloc(24); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
const thumbs = new Map();
const thumb = f => { if (!thumbs.has(f)) thumbs.set(f, execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=96:64,format=gray', '-f', 'rawvideo', '-'])); return thumbs.get(f); };
const compare = (a, b) => { const A = thumb(a), B = thumb(b); let sum = 0, big = 0; for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); sum += d; if (d > 40) big++; } return {media: sum / A.length, cambiado: big / A.length}; };

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walk(path.join(d, e.name), out); }
    else if (e.name.endsWith('.png') && !SKIP.test(e.name)) out.push(path.join(d, e.name));
  }
  return out;
}

// Orden original → editada: 1) lista de portadas del proyecto, 2) nombre (base < base-v2, v01 < v02, _old primero), 3) fecha.
function coverOrder(project) {
  const order = new Map();
  try {
    const p = JSON.parse(fs.readFileSync(path.join(DATA, project, 'proyecto.json'), 'utf8'));
    (function visit(o) { if (Array.isArray(o)) o.forEach(visit); else if (o && typeof o === 'object') { if (Array.isArray(o.covers)) o.covers.forEach((c, i) => c?.file && order.set(path.join(DATA, project, c.file), i)); Object.values(o).forEach(visit); } })(p);
  } catch {}
  return order;
}
const rank = f => { const n = path.basename(f, '.png'); if (/_old$/.test(n)) return -1; const m = n.match(/-v?(\d+)$/); return m ? Number(m[1]) : 0; };
function orient(a, b, covers) {
  if (covers.has(a) && covers.has(b)) return covers.get(a) < covers.get(b) ? [a, b] : [b, a];
  const ra = rank(a), rb = rank(b), sa = path.basename(a, '.png').replace(/(_old|-v?\d+)$/, ''), sb = path.basename(b, '.png').replace(/(_old|-v?\d+)$/, '');
  if (sa === sb && ra !== rb) return ra < rb ? [a, b] : [b, a];
  return fs.statSync(a).mtimeMs <= fs.statSync(b).mtimeMs ? [a, b] : [b, a];
}

function findPairs() {
  const log = readLog(), pairs = [];
  for (const project of fs.readdirSync(DATA).filter(p => fs.existsSync(path.join(DATA, p, 'proyecto.json')) && (!only || p === only))) {
    const covers = coverOrder(project), byDir = new Map();
    for (const f of walk(path.join(DATA, project))) { const d = path.dirname(f); if (!byDir.has(d)) byDir.set(d, []); byDir.get(d).push(f); }
    for (const files of byDir.values()) {
      const sized = files.map(f => [f, pngSize(f)]).filter(([, s]) => s);
      for (let i = 0; i < sized.length; i++) for (let j = i + 1; j < sized.length; j++) {
        const [a, sa] = sized[i], [b, sb] = sized[j];
        if (sa[0] !== sb[0] || sa[1] !== sb[1]) continue;
        let c; try { c = compare(a, b); } catch { continue; }
        // Emparentadas por nombre (x, x-v2, x_old) o por la lista de portadas: se aceptan también las dudosas.
        const stem = f => path.basename(f, '.png').replace(/(_old|-v?\d+)$/, '');
        const related = stem(a) === stem(b) || (covers.has(a) && covers.has(b));
        if (related ? c.media > 9 || c.cambiado > 0.06 : c.media > 5 || c.cambiado > 0.005) continue;
        const [orig, edit] = orient(a, b, covers), rel = f => path.relative(DATA, f);
        pairs.push({original: rel(orig), editada: rel(edit), tamano: sa, media: +c.media.toFixed(1), cambiado: +(c.cambiado * 100).toFixed(1), segura: c.media <= 5 && c.cambiado <= 0.02, fusionada: log[rel(edit)]?.fecha || null, mascara: fs.existsSync(edit.replace(/\.png$/, '.mascara.png'))});
      }
    }
  }
  // Una editada puede salir emparejada con varias; se queda la original más parecida.
  const best = new Map();
  for (const p of pairs) if (!best.has(p.editada) || best.get(p.editada).media > p.media) best.set(p.editada, p);
  return [...best.values()].sort((x, y) => x.editada.localeCompare(y.editada));
}
const readLog = () => { try { return JSON.parse(fs.readFileSync(LOG, 'utf8')); } catch { return {}; } };

const body = req => new Promise((ok, ko) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', ko); });
const send = (res, code, data, type = 'application/json') => { res.writeHead(code, {'content-type': type, 'cache-control': 'no-store'}); res.end(type === 'application/json' ? JSON.stringify(data) : data); };

let cache = null;
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') return send(res, 200, fs.readFileSync(path.join(ROOT, 'scripts/fusionar.html')), 'text/html; charset=utf-8');
    if (u.pathname === '/api/pares') { if (!cache || u.searchParams.has('recargar')) cache = findPairs(); return send(res, 200, cache); }
    if (u.pathname === '/img') {
      let f = inData(u.searchParams.get('f'));
      // La editada se pinta siempre desde la salida de ChatGPT si existe (la .png ya puede ser una fusión).
      if (u.searchParams.has('cruda') && fs.existsSync(f.replace(/\.png$/, '.chatgpt.png'))) f = f.replace(/\.png$/, '.chatgpt.png');
      if (!fs.existsSync(f)) return send(res, 404, {error: 'No existe'});
      return send(res, 200, fs.readFileSync(f), 'image/png');
    }
    if (u.pathname === '/api/guardar' && req.method === 'POST') {
      if (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${port}` && req.headers.origin !== `http://localhost:${port}`) return send(res, 403, {error: 'Origen no permitido'});
      const edit = inData(u.searchParams.get('editada')), orig = inData(u.searchParams.get('original')), kind = u.searchParams.get('tipo');
      const data = await body(req);
      if (data.toString('ascii', 1, 4) !== 'PNG') return send(res, 400, {error: 'No es un PNG'});
      if (kind === 'mascara') { fs.writeFileSync(edit.replace(/\.png$/, '.mascara.png'), data); return send(res, 200, {ok: true}); }
      const raw = edit.replace(/\.png$/, '.chatgpt.png');
      if (!fs.existsSync(raw)) fs.copyFileSync(edit, raw);
      fs.writeFileSync(edit, data);
      const log = readLog(); log[path.relative(DATA, edit)] = {original: path.relative(DATA, orig), cruda: path.relative(DATA, raw), fecha: new Date().toISOString()};
      writeJSON(LOG, log);
      cache = null;
      return send(res, 200, {ok: true, cruda: path.relative(DATA, raw)});
    }
    send(res, 404, {error: 'No encontrado'});
  } catch (e) { send(res, 500, {error: e.message}); }
}).listen(port, '127.0.0.1', () => console.log(`Fusión de ediciones: http://127.0.0.1:${port}  (Ctrl+C para salir)`));
