// Visor genérico de entornos con constructor: órbita, lugares, estados, recorrido a pie, «no clip», pantalla completa, captura y GLB.
// mountEnvironment(container, {project, environment, persist}) → {setView, setState, setWalk, setNoclip, mode, noclip, walk, state, scene, camera, controls, renderer, saveView, dispose}.
// Recuerda la vista en sessionStorage (solo la pestaña) salvo con persist: false o persist=0 en la URL (docs/visor-3d.md).
// Lo propio de cada escenario (luces, cortes, piezas atravesables, entrada del paseo, vista general) llega por los plugins
// del proyecto (environments[].viewer.plugins); sin plugins pone luces y fondo por defecto y encuadra la caja del modelo.
import * as T from 'three';
import {OrbitControls} from '/three/examples/jsm/controls/OrbitControls.js';
import {GLTFExporter} from '/three/examples/jsm/exporters/GLTFExporter.js';
import {createKit} from './kit.mjs';
import {createWalker, raycastCollision, restoreWalkPose} from './walk.mjs';
import {esc, pluginPaths, viewerOptions, initialState, buttonHTML, combineHooks, defaultSpawn, framePose, CORE_ACTIONS, assignExpose, walkOptions, handleKey, withGlbUserData, viewKey, persistEnabled, parseSavedView, buildSavedView} from './plugins.mjs';

const CSS = `.env3d{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px}.env3d-view{position:relative;background:#1b2126;border-radius:10px;overflow:hidden;aspect-ratio:16/9}.env3d-view canvas{width:100%;height:100%;display:block}.env3d-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center}.env3d-bar select{max-width:260px}.env3d-side{display:flex;flex-direction:column;gap:10px;max-height:78vh;overflow:auto}.env3d-side h4{margin:4px 0}.env3d-marks button{display:block;width:100%;text-align:left;margin:2px 0;padding:6px 8px}.env3d-marks small{display:block;opacity:.7;font-size:11px;line-height:1.3}.env3d-note{position:absolute;left:12px;bottom:10px;right:12px;color:#e8e4da;font-size:13px;text-shadow:0 1px 3px #000;pointer-events:none}.env3d-state label{display:block;font-size:12px;margin:4px 0}.env3d-cross{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fff;font:18px monospace;text-shadow:0 0 3px #000;pointer-events:none;display:none}.env3d-hint{position:absolute;left:12px;top:10px;right:12px;color:#f1eee6;font-size:12px;text-shadow:0 1px 3px #000;pointer-events:none;display:none}.env3d-walk .env3d-cross,.env3d-walk .env3d-hint{display:block}.env3d-view:fullscreen{aspect-ratio:auto}.env3d-state select{width:100%}.env3d-overlay{position:absolute;inset:0;pointer-events:none}@media(max-width:900px){.env3d{grid-template-columns:1fr}}`;

export async function mountEnvironment(container, {project, environment: env, persist}) {
  const asset = f => '/api/asset?project=' + encodeURIComponent(project.id) + '&file=' + encodeURIComponent(f);
  const data = await (await fetch(asset(env.data))).json();
  const builder = await import(asset(env.builder));
  const plugins = [];
  for (const file of pluginPaths(env)) { const m = await import(asset(file)); if (typeof m.plugin !== 'function') throw Error(`El plugin ${file} no exporta plugin(api)`); plugins.push({file, plugin: m.plugin}); }
  // Vista guardada: se lee antes de la primera construcción para construir una sola vez con su estado.
  const storeKey = viewKey(project.id, env.id);
  let store = null;
  if (persistEnabled({persist, search: location.search})) try { store = sessionStorage; } catch {}
  let savedText = null; try { savedText = store?.getItem(storeKey) ?? null; } catch {}
  const saved = parseSavedView(savedText, {data, plugins: pluginPaths(env)});
  let state = initialState(data, saved);
  const marks = data.landmarks || [];
  // 1 · DOM, renderer, escena vacía, cámara y controles.
  container.innerHTML = `<style>${CSS}</style><div class="env3d-bar">
    <button data-a="overview" class="primary">Vista general</button>
    <select data-a="preset"><option value="">Estado por secuencia…</option>${(data.presets || []).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
    <button data-a="walk" aria-pressed="false">Recorrer a pie</button><button data-a="noclip" aria-pressed="false">No clip · desactivado</button><button data-a="fullscreen">Pantalla completa</button><button data-a="capture">Guardar vista</button><button data-a="glb">GLB</button></div>
    <div class="env3d"><div class="env3d-view" tabindex="0"><div class="env3d-note"></div><div class="env3d-cross">+</div><div class="env3d-hint">Clic para mirar con el ratón (o arrastra) · WASD o flechas para andar · Mayús corre · Q/E bajan y suben con «no clip» · Esc suelta el ratón · las puertas se atraviesan</div></div>
    <aside class="env3d-side"><div class="env3d-state"><h4>Estado</h4>${Object.entries(data.states || {}).map(([k, v]) => `<label>${esc(v.label)}<select data-state="${esc(k)}">${Object.entries(v.options).map(([o, l]) => `<option value="${esc(o)}">${esc(l)}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="env3d-marks"><h4>Lugares</h4>${marks.map(m => `<button data-mark="${esc(m.id)}">${esc(m.name)}<small>${esc(m.note || '')}</small></button>`).join('')}</div></aside></div>`;
  const view = container.querySelector('.env3d-view'), note = container.querySelector('.env3d-note'), hint = container.querySelector('.env3d-hint'), side = container.querySelector('.env3d-side');
  const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  view.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(45, 16 / 9, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.96;
  let model = null, mode = 'orbit', drag = false, raf, stopped = false;
  // Se crean en el paso 4, después de los plugins: api.walker es null mientras corre plugin(api).
  let collision = null, walker = null;

  // 2 · Plugins: cada uno recibe la API y devuelve sus hooks.
  const actions = new Map();
  let lastButton = container.querySelector('[data-a=overview]');
  const claim = a => { if (CORE_ACTIONS.includes(a) || actions.has(a)) throw Error(`data-a ya usado: ${a}`); };
  const ui = {
    button({a, text, pressed}, onClick) {
      claim(a); lastButton.insertAdjacentHTML('afterend', buttonHTML({a, text, pressed}));
      const b = lastButton = lastButton.nextElementSibling; actions.set(a, onClick);
      return {
        get pressed() { return b.getAttribute('aria-pressed') === 'true'; }, set pressed(v) { b.setAttribute('aria-pressed', String(v)); },
        get text() { return b.textContent; }, set text(v) { b.textContent = v; },
      };
    },
    action(a, fn) { claim(a); actions.set(a, fn); },
    note(text) { note.textContent = text; },
    hint(text) { hint.textContent = text; },
    panel({title = '', html = ''} = {}) {
      side.insertAdjacentHTML('beforeend', `<div class="env3d-panel">${title ? `<h4>${esc(title)}</h4>` : ''}<div></div></div>`);
      const body = side.lastElementChild.lastElementChild; body.innerHTML = html;
      return {el: body, set(h) { body.innerHTML = h; }};
    },
    overlay(html = '') { view.insertAdjacentHTML('beforeend', '<div class="env3d-overlay"></div>'); const o = view.lastElementChild; o.innerHTML = html; return {el: o, set(h) { o.innerHTML = h; }}; },
  };
  const api = {
    T, scene, camera, controls, renderer, data, environment: env, options: viewerOptions(env), ui,
    get model() { return model; }, get state() { return {...state}; }, setState: next => setState(next),
    get mode() { return mode; }, setWalk: on => setWalk(on), setView: id => setView(id), overview: () => overviewAction(),
    get walker() { return walker; }, get noclip() { return !!walker?.noclip; }, setNoclip: on => setNoclip(on),
  };
  const hooks = combineHooks(plugins.map(p => ({file: p.file, hooks: p.plugin(api)})));

  // 3 · Lo que ningún plugin haya puesto: fondo y luces como viewer/glb.mjs.
  if (!scene.background) scene.background = new T.Color('#b9c0c4');
  if (!scene.children.some(o => o.isLight)) {
    scene.add(new T.HemisphereLight('#e2e8ee', '#5a5042', 1.8));
    const sun = new T.DirectionalLight('#f3eee4', 2); sun.position.set(20, 40, 25); scene.add(sun);
  }

  // 4 · Colisión y caminante.
  const w = walkOptions(api.options), skip = q => !q.visible || hooks.passable(q);
  collision = hooks.collision({T, step: w.step, radius: w.radius, skip, options: api.options})
    ?? raycastCollision(T, {step: w.step, radius: w.radius, skip});
  walker = hooks.walker({T, camera, collision, options: api.options})
    ?? createWalker(T, camera, {collision, ...w});

  const onSky = tx => { const sky = tx.clone(); sky.mapping = T.EquirectangularReflectionMapping; sky.needsUpdate = true; scene.background = sky; hooks.onSky(tx); };
  const rebuild = () => {
    if (model) { scene.remove(model); model.traverse(o => { o.geometry?.dispose(); }); }
    const base = env.data.split('/').slice(0, -1).join('/');
    model = builder.build(T, data, createKit(T, {state, textures: true, textureUrl: f => asset(base + '/' + f), onSky}));
    scene.add(model); hooks.onBuild(model); if (mode === 'walk') collision.collect(model);
    container.querySelectorAll('[data-state]').forEach(s => { s.value = state[s.dataset.state]; });
  };
  const go = (pos, target, text = '') => { camera.position.set(...pos); controls.target.set(...target); controls.update(); note.textContent = text; };
  const goOverview = () => {
    let o = hooks.overview();
    if (!o) { const box = new T.Box3().setFromObject(model); o = framePose(box.min.toArray(), box.max.toArray()); }
    go(o.position, o.target, o.text ?? env.name);
  };
  const walkButton = container.querySelector('[data-a=walk]');
  function setWalk(on) {
    mode = on ? 'walk' : 'orbit'; hooks.onMode(mode); controls.enabled = !on; view.classList.toggle('env3d-walk', on);
    walkButton.setAttribute('aria-pressed', String(on));
    walkButton.textContent = on ? 'Salir del recorrido' : 'Recorrer a pie';
    if (on) { collision.collect(model); const s = hooks.spawn() ?? defaultSpawn(marks); walker.place(s.position[0], s.position[1], s.position[2]); walker.aim(camera.position.toArray(), s.lookAt); note.textContent = 'Recorrido a pie · ' + env.name; view.focus(); }
    else { if (document.pointerLockElement) document.exitPointerLock(); camera.up.set(0, 1, 0); controls.target.copy(camera.position).add(camera.getWorldDirection(new T.Vector3()).multiplyScalar(5)); controls.update(); }
  }
  // true si un plugin (hook view) o un lugar de data.landmarks atiende id; false si no existe.
  function setView(id) {
    if (hooks.view(id, {mode})) return true;
    const m = marks.find(x => x.id === id); if (!m) return false;
    hooks.onView(m, {mode});
    const text = m.name + (m.note ? ' — ' + m.note : '');
    if (mode === 'walk') { walker.place(m.view[0], m.view[1] - walker.eye + 0.2, m.view[2]); walker.aim(camera.position.toArray(), m.at); note.textContent = text; return true; }
    go(m.view, m.at, text);
    return true;
  }
  const noclipButton = container.querySelector('[data-a=noclip]');
  function setNoclip(on) { walker.noclip = !!on; noclipButton.setAttribute('aria-pressed', String(walker.noclip)); noclipButton.textContent = 'No clip · ' + (walker.noclip ? 'activado' : 'desactivado'); }
  function setState(next) { state = {...state, ...next}; rebuild(); }
  function overviewAction() { if (mode === 'walk') setWalk(false); hooks.onOverview(); goOverview(); }

  const key = down => e => {
    const used = handleKey({key: e.key, down, repeat: e.repeat, tag: e.target?.tagName, editable: e.target?.isContentEditable}, {mode, onKey: hooks.onKey, walker, walkKeys: walker.walkKeys});
    if (used) e.preventDefault();
  };
  const onKey = key(true), onKeyUp = key(false);
  const onBlur = () => { walker.keys.clear(); drag = false; };
  const onMouse = e => { if (mode !== 'walk' || !(document.pointerLockElement === renderer.domElement || drag)) return; walker.look(e.movementX, e.movementY); };
  const onUp = () => { drag = false; };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur); window.addEventListener('mousemove', onMouse); window.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointerdown', () => { if (mode === 'walk') drag = true; });
  renderer.domElement.addEventListener('click', () => { if (mode === 'walk') { try { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch {} } });
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  container.addEventListener('click', async e => {
    const b = e.target.closest('button, [data-a]'); if (!b || !container.contains(b)) return;
    if (b.dataset.mark) return setView(b.dataset.mark);
    const a = b.dataset.a;
    if (actions.has(a)) return actions.get(a)(e);
    if (a === 'overview') overviewAction();
    if (a === 'walk') setWalk(mode !== 'walk');
    if (a === 'noclip') setNoclip(!walker.noclip);
    if (a === 'fullscreen') { if (document.fullscreenElement) document.exitFullscreen(); else view.requestFullscreen?.(); }
    if (a === 'capture') { renderer.render(scene, camera); renderer.domElement.toBlob(bl => download(bl, env.id + '-vista.png')); }
    if (a === 'glb') { const s2 = new T.Scene(), root = builder.build(T, data, createKit(T, {state, textures: false})); s2.add(root); const glb = await withGlbUserData(root, () => new GLTFExporter().parseAsync(s2, {binary: true})); download(new Blob([glb], {type: 'model/gltf-binary'}), env.id + '.glb'); }
  });
  container.querySelector('[data-a=preset]').onchange = e => { const p = (data.presets || []).find(x => x.id === e.target.value); if (p) setState(p.state); };
  container.querySelectorAll('[data-state]').forEach(s => { s.onchange = () => setState({[s.dataset.state]: s.value}); });
  const resize = () => { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(view);
  // 5 · Primera construcción y vista guardada o general.
  rebuild(); resize();
  if (saved) restoreSaved(saved); else { hooks.onOverview(); goOverview(); }
  function restoreSaved(s) {
    setNoclip(s.noclip);
    if (s.mode === 'walk') { setWalk(true); restoreWalkPose(T, walker, camera, s); }
    else { hooks.onOverview(); go(s.position, s.target, hooks.overview()?.text ?? env.name); }
    for (const {file, error} of hooks.restoreView(s.plugins, {mode})) console.warn(`El plugin ${file}: restoreView: ${error?.message ?? error}`);
  }
  const snapshot = () => buildSavedView({mode, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
    target: controls.target.toArray(), noclip: !!walker.noclip, state: {...state}, plugins: hooks.saveView()});
  // Lanza si algo no es serializable; los guardados automáticos lo avisan sin cortar.
  function saveView() { const snap = snapshot(); store?.setItem(storeKey, JSON.stringify(snap)); return snap; }
  const saveQuiet = () => { try { saveView(); } catch (e) { console.error('No se pudo guardar la vista: ' + e.message); } };
  const onHidden = () => { if (document.visibilityState === 'hidden') saveQuiet(); };
  window.addEventListener('pagehide', saveQuiet); document.addEventListener('visibilitychange', onHidden);
  let last = performance.now();
  const loop = () => { if (stopped) return; const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; if (mode === 'walk') walker.update(dt); else controls.update(); hooks.onFrame(dt, {mode}); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
  loop();
  const stage = {
    setView, setState, setWalk, setNoclip, saveView, get mode() { return mode; }, get noclip() { return walker.noclip; }, walk: (keysDown, seconds) => walker.walk(keysDown, seconds), get state() { return {...state}; }, scene, camera, controls, renderer,
    dispose() { saveQuiet(); window.removeEventListener('pagehide', saveQuiet); document.removeEventListener('visibilitychange', onHidden); stopped = true; cancelAnimationFrame(raf); hooks.dispose(); ro.disconnect(); controls.dispose(); renderer.dispose(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); window.removeEventListener('mousemove', onMouse); window.removeEventListener('pointerup', onUp); if (document.pointerLockElement) document.exitPointerLock(); container.innerHTML = ''; },
  };
  return assignExpose(stage, hooks.expose);
}
