// Recorrido a pie de viewer/mount.mjs: primera persona con colisiones, suelo por rayo (escaleras peldaño a peldaño) y «no clip».
// Sin imports: recibe three como T y funciona en Node. La colisión es inyectable: {collect(root), groundAt(x, y, z), blocked(from, dir, dist, floorY)}.
// Las opciones de createWalker son las de walkOptions (viewer/plugins.mjs); walkKeys son las teclas que el visor le pasa.

export const WALK_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

// Colisión por rayos contra las mallas del modelo; skip(nodo) descarta la malla si lo cumple ella o algún antepasado.
export function raycastCollision(T, {step = 0.3, radius = 0.32, skip = () => false} = {}) {
  const ray = new T.Raycaster();
  let solids = [];
  return {
    collect(root) {
      solids = []; root.updateMatrixWorld(true);
      root.traverse(o => { if (!o.isMesh || o.isInstancedMesh) return; for (let q = o; q && q !== root; q = q.parent) if (skip(q)) return; solids.push(o); });
    },
    groundAt(x, y, z) { ray.set(new T.Vector3(x, y + step + 0.3, z), new T.Vector3(0, -1, 0)); ray.far = 60; const h = ray.intersectObjects(solids, false)[0]; return h ? h.point.y : null; },
    blocked(from, dir, dist, floorY) {
      for (const hgt of [step + 0.05, 1.25]) {
        ray.set(new T.Vector3(from.x, floorY + hgt, from.z), dir); ray.far = dist + radius;
        const h = ray.intersectObjects(solids, false).find(h => { const n = h.face?.normal.clone().transformDirection(h.object.matrixWorld); return !n || Math.abs(n.y) < 0.6; });
        if (h) return true;
      }
      return false;
    },
  };
}

// Suelo pisable del ensayo (#53): mallas llamadas «suelo» o «suelo-…», o que cuelgan de un grupo así; el resto de mallas no cuenta aunque quede debajo.
export const isFloorName=name=>String(name).startsWith('suelo');
// Sonda de suelo en coordenadas del mundo: fn(x, z, yRef) → altura del suelo bajo (x, z) cerca de yRef, o null. Equivale a dos rayos verticales:
// el primero baja desde yRef + above hasta far (el piso en el que está yRef, no el de encima); si no toca, otro baja desde yRef + top hasta yRef + above (rampas y cerros).
// En vez de lanzar rayos, indexa una vez los triángulos de suelo en cubetas de bucket metros en XZ (coordenadas del mundo) y cada consulta prueba solo los de su cubeta
// con baricéntricas en la proyección XZ; como el Raycaster, solo cuentan las caras que miran al rayo (arriba con FrontSide, abajo con BackSide, todas con DoubleSide).
// root.matrixWorld debe estar actualizado y el modelo no debe moverse después. fn.triangles: triángulos indexados.
export function floorProbe(T, root, {match = isFloorName, above = 1.5, top = 60, far = 80, bucket = 2} = {}) {
  const P = [], cells = new Map(), key = (i, k) => i * 1048576 + k, v = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    let floor = false; for (let q = o; q; q = q.parent) { if (match(q.name)) { floor = true; break; } if (q === root) break; }
    const pos = o.geometry?.attributes?.position; if (!floor || !pos) return;
    const index = o.geometry.index, n = index ? index.count : pos.count, flip = o.matrixWorld.determinant() < 0 ? -1 : 1;
    const groups = Array.isArray(o.material) && o.geometry.groups.length ? o.geometry.groups : [{start: 0, count: n, materialIndex: 0}];
    for (const g of groups) {
      const m = Array.isArray(o.material) ? o.material[g.materialIndex] : o.material, side = m?.side ?? T.FrontSide, end = Math.min(n, g.start + g.count);
      if (!m) continue;
      for (let i = g.start; i + 2 < end; i += 3) {
        for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, index ? index.getX(i + k) : i + k).applyMatrix4(o.matrixWorld);
        const [a, b, c] = v, ny = flip * ((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z));
        if (Math.abs(ny) < 1e-12 || (side === T.FrontSide && ny < 0) || (side === T.BackSide && ny > 0)) continue;
        const t = P.length / 9; P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        const i0 = Math.floor(Math.min(a.x, b.x, c.x) / bucket), i1 = Math.floor(Math.max(a.x, b.x, c.x) / bucket), k0 = Math.floor(Math.min(a.z, b.z, c.z) / bucket), k1 = Math.floor(Math.max(a.z, b.z, c.z) / bucket);
        for (let ci = i0; ci <= i1; ci++) for (let ck = k0; ck <= k1; ck++) { const q = key(ci, ck); let list = cells.get(q); if (!list) cells.set(q, list = []); list.push(t); }
      }
    }
  });
  // Alturas de los triángulos que cubren (x, z).
  const heights = (x, z) => {
    const out = [], list = cells.get(key(Math.floor(x / bucket), Math.floor(z / bucket)));
    for (const t of list || []) {
      const o = t * 9, ax = P[o], az = P[o + 2], bx = P[o + 3], bz = P[o + 5], cx = P[o + 6], cz = P[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) out.push(l1 * P[o + 1] + l2 * P[o + 4] + l3 * P[o + 7]);
    }
    return out;
  };
  const highest = (hs, lo, hi) => { let best = null; for (const h of hs) if (h >= lo && h <= hi && (best === null || h > best)) best = h; return best; };
  const fn = (x, z, yRef = 0) => { const hs = heights(x, z); return highest(hs, yRef + above - far, yRef + above) ?? highest(hs, yRef + above, yRef + top); };
  fn.triangles = P.length / 9;
  return fn;
}

export function createWalker(T, camera, {collision, eye = 1.62, step = 0.3, walkSpeed = 3.2, flySpeed = 6, run = 2.4, maxDrop = 1.2} = {}) {
  const keys = new Set(), euler = new T.Euler(0, 0, 0, 'YXZ');
  let floorY = 0;
  const w = {
    keys, walkKeys: WALK_KEYS, noclip: false, eye, collision,
    get floorY() { return floorY; },
    place(x, y, z) { const g = w.collision.groundAt(x, y, z); floorY = g ?? y; camera.position.set(x, floorY + eye, z); },
    aim(from, to) { const dx = to[0] - from[0], dy = to[1] - (from[1]), dz = to[2] - from[2]; euler.set(Math.atan2(dy, Math.hypot(dx, dz)) * 0.6, Math.atan2(-dx, -dz), 0); camera.quaternion.setFromEuler(euler); },
    look(dx, dy) { euler.setFromQuaternion(camera.quaternion); euler.y -= dx * 0.0025; euler.x = Math.max(-1.45, Math.min(1.45, euler.x - dy * 0.0025)); euler.z = 0; camera.quaternion.setFromEuler(euler); },
    update(dt) {
      const noclip = w.noclip, speed = (noclip ? flySpeed : walkSpeed) * (keys.has('shift') ? run : 1) * dt;
      const fwd = camera.getWorldDirection(new T.Vector3()); if (!noclip) { fwd.y = 0; fwd.normalize(); }
      const right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize();
      const move = new T.Vector3();
      if (keys.has('w') || keys.has('arrowup')) move.add(fwd); if (keys.has('s') || keys.has('arrowdown')) move.sub(fwd);
      if (keys.has('d') || keys.has('arrowright')) move.add(right); if (keys.has('a') || keys.has('arrowleft')) move.sub(right);
      if (noclip) { if (keys.has('e')) move.y += 1; if (keys.has('q')) move.y -= 1; if (move.lengthSq()) camera.position.addScaledVector(move.normalize(), speed); return; }
      if (!move.lengthSq()) return;
      move.normalize().multiplyScalar(speed);
      // Deslizamiento: prueba el paso completo y, si choca, cada eje por separado.
      for (const m of [move, new T.Vector3(move.x, 0, 0), new T.Vector3(0, 0, move.z)]) {
        const len = m.length(); if (len < 1e-5) continue;
        const pos = camera.position, dir = m.clone().normalize();
        if (w.collision.blocked(pos, dir, len, floorY)) continue;
        const g = w.collision.groundAt(pos.x + m.x, floorY, pos.z + m.z);
        if (g === null || g - floorY > step || floorY - g > maxDrop) continue;
        pos.x += m.x; pos.z += m.z; floorY = g; pos.y = floorY + eye; break;
      }
    },
    walk(keysDown, seconds) { keysDown.forEach(k => keys.add(k)); for (let t = 0; t < seconds; t += 1 / 30) w.update(1 / 30); keysDown.forEach(k => keys.delete(k)); return camera.position.toArray(); },
  };
  return w;
}

// Vista guardada (viewer/mount.mjs) sobre un caminante ya colocado: posición (sin «no clip», por el suelo que haya debajo;
// sin suelo conserva la altura) y orientación sin alabeo y con la inclinación acotada, como look().
export function restoreWalkPose(T, walker, camera, {position, quaternion}) {
  if (walker.noclip) camera.position.set(...position);
  else walker.place(position[0], position[1] - walker.eye, position[2]);
  const euler = new T.Euler().setFromQuaternion(new T.Quaternion().fromArray(quaternion), 'YXZ');
  euler.x = Math.max(-1.45, Math.min(1.45, euler.x)); euler.z = 0;
  camera.quaternion.setFromEuler(euler);
}
