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
