// Plugins del visor de entornos (viewer/mount.mjs): funciones puras sin imports. Un plugin es un fichero del proyecto,
// declarado en environments[].viewer.plugins, que exporta plugin(api) y devuelve hooks (docs/ARQUITECTURA.md).

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// data-a de la barra que son del visor; un plugin no puede reutilizarlos.
export const CORE_ACTIONS = ['overview', 'preset', 'walk', 'noclip', 'fullscreen', 'capture', 'glb'];
// Claves de window.rodaje.environment que da el visor; expose no puede pisarlas.
export const CORE_API = ['setView', 'setState', 'setWalk', 'mode', 'walk', 'state', 'scene', 'camera', 'controls', 'renderer', 'dispose'];
export const HOOKS = ['onBuild', 'onSky', 'onOverview', 'overview', 'spawn', 'onView', 'passable', 'collision', 'onFrame', 'dispose', 'expose'];

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export function pluginPaths(env) { const v = env?.viewer; return isObject(v) && Array.isArray(v.plugins) ? v.plugins.filter(p => typeof p === 'string' && p) : []; }
export function viewerOptions(env) { if (!isObject(env?.viewer)) return {}; const {plugins, ...options} = env.viewer; return options; }
// Transitorio hasta #11: el estado por defecto vive en model.json (defaultState) o, si falta, en el constructor.
export function initialState(data, builderModule) { return {...(data?.defaultState ?? builderModule?.DEFAULT_STATE ?? {})}; }
export function buttonHTML({a, text, pressed, primary}) { return `<button data-a="${esc(a)}"${primary ? ' class="primary"' : ''}${typeof pressed === 'boolean' ? ` aria-pressed="${pressed}"` : ''}>${esc(text)}</button>`; }

// Une los hooks de varios plugins: los eventos llaman a todos en orden; overview, spawn y collision los da el primero
// que devuelve algo; passable basta con que uno diga sí; expose se acumula sin pisar la API del visor.
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
  const expose = {};
  for (const {file, hooks} of all) for (const [k, v] of Object.entries(hooks.expose || {})) {
    if (reserved.includes(k)) throw Error(`El plugin ${file} expone ${k}, que ya es del visor`);
    expose[k] = v;
  }
  return {
    onBuild: each('onBuild'), onSky: each('onSky'), onOverview: each('onOverview'), overview: first('overview'), spawn: first('spawn'),
    onView: each('onView'), passable: obj => all.some(({hooks}) => !!hooks.passable?.(obj)), collision: first('collision'),
    onFrame: each('onFrame'), dispose: each('dispose'), expose,
  };
}

// Entrada del paseo sin plugin: el primer lugar con vista y punto de mira.
export function defaultSpawn(marks) { const m = (marks || []).find(m => m.view && m.at); return m ? {position: m.view, lookAt: m.at} : {position: [0, 1.6, 30], lookAt: [0, 1.5, 0]}; }
// Encuadre por caja envolvente, como viewer/glb.mjs. Una caja vacía se trata como un punto en el origen.
export function framePose(min, max) {
  const ok = [...min, ...max].every(Number.isFinite), lo = ok ? min : [0, 0, 0], hi = ok ? max : [0, 0, 0];
  const center = lo.map((v, i) => (v + hi[i]) / 2), r = Math.max(...hi.map((v, i) => v - lo[i])) || 1;
  return {position: [center[0] + r * 0.9, center[1] + r * 0.7, center[2] + r * 1.1], target: center};
}
