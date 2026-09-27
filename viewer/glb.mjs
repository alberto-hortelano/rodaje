// Visor genérico de entornos 3D sin visor propio: carga el GLB, lo encuadra y deja orbitar.
import * as T from 'three';
import {OrbitControls} from '/three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';

export async function mountGlb(container, {url, name}) {
  container.innerHTML = '<div style="position:relative;aspect-ratio:16/9;background:#1b2126;border-radius:10px;overflow:hidden"></div><p class="muted" style="margin-top:8px"></p>';
  const view = container.firstElementChild, info = container.lastElementChild;
  const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
  view.append(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  const scene = new T.Scene(); scene.background = new T.Color('#b9c0c4');
  scene.add(new T.HemisphereLight('#e2e8ee', '#5a5042', 1.8));
  const sun = new T.DirectionalLight('#f3eee4', 2); sun.position.set(20, 40, 25); scene.add(sun);
  const camera = new T.PerspectiveCamera(45, 16 / 9, 0.05, 2000), controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  const gltf = await new GLTFLoader().loadAsync(url);
  scene.add(gltf.scene);
  const box = new T.Box3().setFromObject(gltf.scene), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
  const r = Math.max(size.x, size.y, size.z) || 1;
  camera.position.copy(center).add(new T.Vector3(r * 0.9, r * 0.7, r * 1.1)); controls.target.copy(center); controls.update();
  let meshes = 0; gltf.scene.traverse(o => { if (o.isMesh) meshes++; });
  info.textContent = `${name} · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m · ${meshes} mallas`;
  const resize = () => { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(view); resize();
  let raf, stopped = false;
  const loop = () => { if (stopped) return; controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
  loop();
  return {scene, camera, controls, dispose() { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); container.innerHTML = ''; }};
}
