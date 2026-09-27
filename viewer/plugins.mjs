// Plugins del visor de entornos (viewer/mount.mjs): funciones puras sin imports. Un plugin es un fichero del proyecto,
// declarado en environments[].viewer.plugins, que exporta plugin(api) y devuelve hooks (docs/visor-3d.md).

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// data-a de la barra que son del visor; un plugin no puede reutilizarlos.
export const CORE_ACTIONS = ['overview', 'preset', 'walk', 'noclip', 'fullscreen', 'capture', 'glb'];
// Claves de window.rodaje.environment que da el visor; expose no puede pisarlas.
export const CORE_API = ['setView', 'setState', 'setWalk', 'mode', 'walk', 'state', 'scene', 'camera', 'controls', 'renderer', 'dispose', 'setNoclip', 'noclip', 'saveView'];
export const HOOKS = ['onBuild', 'onSky', 'onOverview', 'overview', 'spawn', 'onView', 'passable', 'collision', 'walker', 'onKey', 'view', 'onMode', 'onFrame', 'dispose', 'expose', 'saveView', 'restoreView'];
// Teclas del paseo por defecto (las mismas que viewer/walk.mjs, que no se importa: este módulo no tiene imports).
const DEFAULT_WALK_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
// Claves de root.userData que llegan al GLB como extras de la raíz; el resto son datos de ejecución del visor.
export const GLB_USERDATA = ['state', 'units'];
// Opciones del caminante en environments[].viewer.walk; step y radius también van a la colisión.
const WALK_OPTIONS = ['eye', 'step', 'radius', 'walkSpeed', 'flySpeed', 'run', 'maxDrop'];

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export function pluginPaths(env) { const v = env?.viewer; return isObject(v) && Array.isArray(v.plugins) ? v.plugins.filter(p => typeof p === 'string' && p) : []; }
export function viewerOptions(env) { if (!isObject(env?.viewer)) return {}; const {plugins, ...options} = env.viewer; return options; }
// Estado inicial del visor: copia de data.defaultState con el de la vista guardada encima; el constructor lo vuelve a mezclar con kit.state.
export function initialState(data, saved = null) { return {...(data?.defaultState ?? {}), ...(saved?.state ?? {})}; }
export function buttonHTML({a, text, pressed, primary}) { return `<button data-a="${esc(a)}"${primary ? ' class="primary"' : ''}${typeof pressed === 'boolean' ? ` aria-pressed="${pressed}"` : ''}>${esc(text)}</button>`; }

// Une los hooks de varios plugins: los eventos llaman a todos en orden; overview, spawn, collision y walker los da el primero
// que devuelve algo; onKey y view paran en el primero que devuelve true; passable basta con que uno diga sí;
// expose se acumula (con sus getters) sin pisar la API del visor.
export function combineHooks(list, {reserved = CORE_API} = {}) {
  const all = [];
  for (const {file, hooks} of list) {
    if (hooks === undefined || hooks === null) continue;
    if (!isObject(hooks)) throw Error(`El plugin ${file} no devuelve un objeto de hooks`);
    for (const [k, v] of Object.entries(hooks)) {
      if (!HOOKS.includes(k)) throw Error(`El plugin ${file} declara un hook desconocido: ${k}`);
      if (k === 'expose' ? !isObject(v) : typeof v !== 'function') throw Error(`El plugin ${file}: ${k} no es ${k === 'expose' ? 'un objeto' : 'una función'}`);
    }
    all.push({file, hooks});
  }
  const each = k => (...a) => { for (const {hooks} of all) hooks[k]?.(...a); };
  const first = k => (...a) => { for (const {hooks} of all) { const r = hooks[k]?.(...a); if (r != null) return r; } return null; };
  const handled = k => (...a) => all.some(({hooks}) => hooks[k]?.(...a) === true);
  const walker = (...a) => { for (const {file, hooks} of all) { const w = hooks.walker?.(...a); if (w != null) return checkWalker(w, file); } return null; };
  const expose = {};
  for (const {file, hooks} of all) if (hooks.expose) {
    for (const k of Object.keys(hooks.expose)) if (reserved.includes(k)) throw Error(`El plugin ${file} expone ${k}, que ya es del visor`);
    assignExpose(expose, hooks.expose, {reserved});
  }
  return {
    onBuild: each('onBuild'), onSky: each('onSky'), onOverview: each('onOverview'), overview: first('overview'), spawn: first('spawn'),
    onView: each('onView'), passable: obj => all.some(({hooks}) => !!hooks.passable?.(obj)), collision: first('collision'),
    walker, onKey: handled('onKey'), view: handled('view'), onMode: each('onMode'),
    onFrame: each('onFrame'), dispose: each('dispose'), expose,
    // Cada plugin guarda y recupera solo su parte, por la ruta de su fichero.
    saveView() {
      const out = {};
      for (const {file, hooks} of all) if (hooks.saveView) { const v = hooks.saveView(); if (v !== undefined) { checkSerializable(v, `El plugin ${file}: saveView`); out[file] = v; } }
      return out;
    },
    restoreView(parts, ctx) {
      const errors = [];
      for (const {file, hooks} of all) if (hooks.restoreView && isObject(parts) && Object.hasOwn(parts, file)) { try { hooks.restoreView(parts[file], ctx); } catch (error) { errors.push({file, error}); } }
      return errors;
    },
  };
}

// Vista guardada en sessionStorage por viewer/mount.mjs (docs/visor-3d.md, «Persistencia de la vista»).
export const VIEW_VERSION = 1;
export const viewKey = (projectId, envId) => `rodaje:visor:${projectId}:${envId}`;
// false con persist === false o con persist=0 en la URL.
export function persistEnabled({persist, search = ''} = {}) { return persist !== false && new URLSearchParams(search).get('persist') !== '0'; }
// Solo null, booleanos, textos, números finitos, arrays y objetos planos; lanza con la ruta del primer valor que no lo es.
export function checkSerializable(value, where = 'vista') {
  const seen = new Set();
  const walk = (v, at) => {
    const fail = tipo => { throw Error(`${where}: valor no serializable (${tipo}) en ${at || 'la raíz'}`); };
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) fail(String(v)); return; }
    if (typeof v !== 'object') fail(typeof v);
    if (seen.has(v)) fail('ciclo');
    if (Array.isArray(v)) { seen.add(v); v.forEach((x, i) => walk(x, `${at}[${i}]`)); seen.delete(v); return; }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) fail(v.constructor?.name || 'instancia');
    seen.add(v); for (const k of Object.keys(v)) walk(v[k], `${at}.${k}`); seen.delete(v);
  };
  walk(value, '');
}
export function buildSavedView({mode, position, quaternion, target, noclip, state, plugins}) {
  const view = {v: VIEW_VERSION, mode, camera: {position, quaternion}, target, noclip, state, plugins};
  checkSerializable(view);
  return view;
}
const finite = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
// Nunca lanza: null si el texto no es una vista válida; el estado y las partes de plugins que ya no existen se descartan clave a clave.
export function parseSavedView(text, {data, plugins: files = []} = {}) {
  if (typeof text !== 'string') return null;
  let v; try { v = JSON.parse(text); } catch { return null; }
  if (!isObject(v) || v.v !== VIEW_VERSION || !['orbit', 'walk'].includes(v.mode)) return null;
  const position = v.camera?.position, quaternion = v.camera?.quaternion;
  if (!finite(position, 3) || !finite(v.target, 3) || !finite(quaternion, 4) || typeof v.noclip !== 'boolean') return null;
  const norm = Math.hypot(...quaternion); if (!Number.isFinite(norm) || norm < 1e-6) return null;
  const states = isObject(data?.states) ? data.states : {}, state = {};
  if (isObject(v.state)) for (const [k, o] of Object.entries(v.state)) if (Object.hasOwn(states, k) && typeof o === 'string' && isObject(states[k]?.options) && Object.hasOwn(states[k].options, o)) state[k] = o;
  const plugins = {};
  if (isObject(v.plugins)) for (const f of Array.isArray(files) ? files : []) if (Object.hasOwn(v.plugins, f)) plugins[f] = v.plugins[f];
  return {mode: v.mode, position, quaternion: quaternion.map(x => x / norm), target: v.target, noclip: v.noclip, state, plugins};
}

// Copia las claves de expose como descriptores: un getter sigue vivo en window.rodaje.environment (sin this).
export function assignExpose(target, expose, {reserved = CORE_API} = {}) {
  for (const k of Object.keys(expose || {})) {
    if (reserved.includes(k)) throw Error(`expose no puede pisar ${k}, que ya es del visor`);
    const d = Object.getOwnPropertyDescriptor(expose, k);
    Object.defineProperty(target, k, {...d, enumerable: true, configurable: true});
  }
  return target;
}

// Contrato del caminante de un plugin (el de viewer/walk.mjs lo cumple).
export function checkWalker(w, file) {
  const fail = x => Error(`El plugin ${file}: el caminante no tiene ${x}`);
  if (!isObject(w)) throw fail('forma de objeto');
  for (const k of ['place', 'aim', 'look', 'update', 'walk']) if (typeof w[k] !== 'function') throw fail(k + '()');
  if (!w.keys || !['add', 'delete', 'has', 'clear'].every(k => typeof w.keys[k] === 'function')) throw fail('keys (Set)');
  if (!Number.isFinite(w.eye)) throw fail('eye numérico');
  const d = (() => { for (let o = w; o; o = Object.getPrototypeOf(o)) { const d = Object.getOwnPropertyDescriptor(o, 'noclip'); if (d) return d; } })();
  if (!d || (d.get ? !d.set : !d.writable)) throw fail('noclip escribible');
  if (w.walkKeys !== undefined && !(Array.isArray(w.walkKeys) && w.walkKeys.every(k => typeof k === 'string' && k))) throw fail('walkKeys como lista de teclas');
  return w;
}

// environments[].viewer.walk → opciones del caminante y de la colisión (step y radius con los valores de siempre).
export function walkOptions(options) {
  const walk = options?.walk, out = {step: 0.3, radius: 0.32};
  if (walk === undefined) return out;
  if (!isObject(walk)) throw Error('viewer.walk debe ser un objeto');
  for (const [k, v] of Object.entries(walk)) {
    if (!WALK_OPTIONS.includes(k)) throw Error(`viewer.walk.${k} no es una opción del paseo (${WALK_OPTIONS.join(', ')})`);
    if (!Number.isFinite(v)) throw Error(`viewer.walk.${k} debe ser un número`);
    out[k] = v;
  }
  return out;
}

export function ignoresKeys({tag, editable}) { return ['INPUT', 'SELECT', 'TEXTAREA'].includes(String(tag || '').toUpperCase()) || !!editable; }
// Teclado del visor: el núcleo no interpreta teclas; primero el plugin (onKey) y luego las del caminante. true = preventDefault.
export function handleKey({key, down, repeat = false, tag, editable}, {mode, onKey, walker, walkKeys}) {
  const k = String(key || '').toLowerCase();
  if (!down) walker?.keys.delete(k);
  if (ignoresKeys({tag, editable})) return false;
  if (onKey?.(k, {down, repeat, mode}) === true) return true;
  if (down && mode === 'walk' && (walkKeys || walker?.walkKeys || DEFAULT_WALK_KEYS).includes(k)) { walker.keys.add(k); return true; }
  return false;
}

export function glbUserData(userData) { const out = {}; for (const [k, v] of Object.entries(userData || {})) if (GLB_USERDATA.includes(k)) out[k] = v; return out; }
// Exporta con la raíz reducida a GLB_USERDATA y la deja como estaba, también si fn lanza.
export async function withGlbUserData(root, fn) {
  const saved = root.userData;
  root.userData = glbUserData(saved);
  try { return await fn(); } finally { root.userData = saved; }
}

// Entrada del paseo sin plugin: el primer lugar con vista y punto de mira.
export function defaultSpawn(marks) { const m = (marks || []).find(m => m.view && m.at); return m ? {position: m.view, lookAt: m.at} : {position: [0, 1.6, 30], lookAt: [0, 1.5, 0]}; }
// Encuadre por caja envolvente, como viewer/glb.mjs. Una caja vacía se trata como un punto en el origen.
export function framePose(min, max) {
  const ok = [...min, ...max].every(Number.isFinite), lo = ok ? min : [0, 0, 0], hi = ok ? max : [0, 0, 0];
  const center = lo.map((v, i) => (v + hi[i]) / 2), r = Math.max(...hi.map((v, i) => v - lo[i])) || 1;
  return {position: [center[0] + r * 0.9, center[1] + r * 0.7, center[2] + r * 1.1], target: center};
}
