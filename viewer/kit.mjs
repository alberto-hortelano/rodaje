// Kit de construcción de entornos 3D: el tercer argumento de build(T, data, kit). Sin imports: recibe three como T y funciona en Node.
// Un kit por construcción: caché de materiales y texturas procedurales propias; la de imágenes por URL es del módulo.
// state, textures, textureUrl y onSky son datos de solo lectura con los nombres del antiguo objeto de opciones.
// Todo lo del navegador (canvas) y lo que haría falta de three/examples (fusión de geometrías) llega al constructor por el kit.

// ── Geometría de planta irregular.
export function segDist(x, z, [ax, az], [bx, bz]) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - t * dx, z - az - t * dz); }
export function polyContains(poly, x, z) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; } return inside; }
export function polyDist(poly, x, z) { if (polyContains(poly, x, z)) return 0; let best = Infinity; for (let i = 0; i < poly.length; i++) best = Math.min(best, segDist(x, z, poly[i], poly[(i + 1) % poly.length])); return best; }
export function centroid(poly) { return poly.reduce((a, [x, z]) => [a[0] + x / poly.length, a[1] + z / poly.length], [0, 0]); }
// Desplaza cada lado hacia dentro una distancia y corta los lados contiguos: el polígono de la cara interior de un muro.
// Lados de longitud 0 (vértice duplicado): se saltan y el vértice repite el punto del vecino. Lados colineales: el vértice es el punto desplazado del lado.
export function insetPolygon(poly, dist) {
  const c = centroid(poly), n = poly.length, lines = [];
  for (let i = 0; i < n; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n], L = Math.hypot(bx - ax, bz - az);
    if (!(L > 0)) { lines.push(null); continue; }
    let nx = -(bz - az) / L, nz = (bx - ax) / L;
    if (nx * (c[0] - ax) + nz * (c[1] - az) < 0) { nx = -nx; nz = -nz; }
    lines.push([ax + nx * dist, az + nz * dist, bx - ax, bz - az]);
  }
  if (!lines.some(Boolean)) return poly.map(p => [...p]);
  const next = i => { while (!lines[i % n]) i++; return lines[i % n]; }, prev = i => { while (!lines[(i + n) % n]) i--; return lines[(i + n) % n]; };
  return lines.map((_, i) => {
    const l = next(i), m = prev(i - 1), den = m[2] * l[3] - m[3] * l[2];
    if (Math.abs(den) <= 1e-9 * Math.hypot(m[2], m[3]) * Math.hypot(l[2], l[3])) return [l[0], l[1]];
    const t = ((l[0] - m[0]) * l[3] - (l[1] - m[1]) * l[2]) / den; return [m[0] + t * m[2], m[1] + t * m[3]];
  });
}
// x de un lado (a→b) a la altura z, y z a la x.
export const xAtZ = ([ax, az], [bx, bz], z) => ax + (bx - ax) * (z - az) / (bz - az);
export const zAtX = ([ax, az], [bx, bz], x) => az + (bz - az) * (x - ax) / (bx - ax);
// Rectángulo [x] × [z] menos huecos rectangulares, como lista de celdas.
export function rectMinus([x0, x1], [z0, z1], holes) {
  const xs = [...new Set([x0, x1, ...holes.flatMap(h => h[0])])].filter(v => v >= x0 && v <= x1).sort((a, b) => a - b);
  const zs = [...new Set([z0, z1, ...holes.flatMap(h => h[1])])].filter(v => v >= z0 && v <= z1).sort((a, b) => a - b);
  const cells = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (!holes.some(([hx, hz]) => cx > hx[0] && cx < hx[1] && cz > hz[0] && cz < hz[1])) cells.push([[xs[i], xs[i + 1]], [zs[j], zs[j + 1]]]);
  }
  return cells;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Caché de imágenes por URL: el visor reconstruye la escena al cambiar de estado y no hace falta volver a descargarlas.
const TEXTURES = new Map();

export function createKit(T, {state = {}, textures = false, textureUrl = null, onSky = null, palette = {}, tile = 2} = {}) {
  const mats = {};
  let tex = null, proc = null;
  const kit = {
    isKit: true, state, textures, textureUrl, onSky, palette: {...palette}, tile,
    segDist, polyContains, polyDist, centroid, insetPolygon, xAtZ, zAtX, rectMinus, mulberry32,
    configure({palette, tile} = {}) { if (palette) Object.assign(kit.palette, palette); if (tile) kit.tile = tile; return kit; },
    mat(key, extra = {}) {
      const id = key + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v?.isTexture ? 'tex:' + v.uuid : v])));
      if (!mats[id]) {
        if (!tex) tex = kit.textures && typeof document !== 'undefined' ? kit.proceduralTextures() : {};
        const {noTex, ...params} = extra;
        const m = new T.MeshStandardMaterial({color: kit.palette[key] || key, roughness: 0.9, metalness: 0, ...params});
        m.name = key;
        if (tex[key] && !noTex && !('map' in extra)) { m.map = tex[key]; m.color.set('#ffffff'); }
        mats[id] = m;
      }
      return mats[id];
    },
    materials: () => Object.values(mats),
    group(name, parent) { const g = new T.Group(); g.name = name; if (parent) parent.add(g); return g; },
    // UV en metros: una tesela de textura cada `tile` metros, sin estirar según el tamaño de la caja; tile 0 la deja sin escalar.
    uvMeters(geo, tile = kit.tile) {
      if (!tile) return geo;
      const {width: w, height: h, depth: dd} = geo.parameters, uv = geo.attributes.uv, dims = [[dd, h], [dd, h], [w, dd], [w, dd], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
      return geo;
    },
    // UV de una geometría extruida en la escala de las cajas.
    scaleUV(geo, tile = kit.tile) { if (!tile) return geo; const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile); return geo; },
    // Caja por rangos [x0,x1] [y0,y1] [z0,z1].
    box(parent, name, [x0, x1], [y0, y1], [z0, z1], m, {tile} = {}) {
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), dd = Math.abs(z1 - z0);
      if (w < 1e-3 || h < 1e-3 || dd < 1e-3) return null;
      const geo = kit.uvMeters(new T.BoxGeometry(w, h, dd), tile ?? kit.tile);
      const mesh = new T.Mesh(geo, typeof m === 'string' ? kit.mat(m) : m);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (name) mesh.name = name;
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
    // Caja por rangos como geometría ya colocada, sin malla, para fusionarla con merge. matrix (la del padre) se premultiplica; tile 0: UV 0–1 por cara.
    boxGeometry([x0, x1], [y0, y1], [z0, z1], {tile = kit.tile, matrix = null} = {}) {
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), dd = Math.abs(z1 - z0);
      if (w < 1e-3 || h < 1e-3 || dd < 1e-3) return null;
      const geo = new T.BoxGeometry(w, h, dd);
      if (tile) kit.uvMeters(geo, tile);
      geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (matrix) geo.applyMatrix4(matrix);
      return geo;
    },
    // Fusión de geometrías (mergeGeometries de three/examples); null si no son compatibles.
    merge(geometries, {groups = false} = {}) { return mergeGeometries(T, geometries, groups); },
    // Textura dibujada en un canvas; null en Node o con textures:false: el constructor omite entonces lo que sea solo textura.
    canvas(w, h, draw, {repeat = null, wrap = !!repeat, anisotropy = 1, colorSpace = T.SRGBColorSpace} = {}) {
      if (!kit.textures || typeof document === 'undefined') return null;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const tx = new T.CanvasTexture(c); tx.colorSpace = colorSpace; tx.anisotropy = anisotropy;
      if (wrap) tx.wrapS = tx.wrapT = T.RepeatWrapping;
      if (repeat) tx.repeat.set(...(Array.isArray(repeat) ? repeat : [repeat, repeat]));
      return tx;
    },
    // Muro recto con huecos. axis 'x': corre en x, grosor en z; axis 'z': corre en z, grosor en x.
    wall(parent, name, axis, [a0, a1], [t0, t1], [y0, y1], holes, m) {
      const g = kit.group(name, parent);
      const put = (r, y) => { if (r[1] - r[0] <= 1e-3 || y[1] - y[0] <= 1e-3) return; return axis === 'x' ? kit.box(g, '', r, y, [t0, t1], m) : kit.box(g, '', [t0, t1], y, r, m); };
      let cur = a0;
      for (const h of [...(holes || [])].sort((p, q) => p.a[0] - q.a[0])) {
        put([cur, h.a[0]], [y0, y1]);
        put(h.a, [y0, h.y[0]]);
        put(h.a, [h.y[1], y1]);
        cur = h.a[1];
      }
      put([cur, a1], [y0, y1]);
      return g;
    },
    // Tejado a dos aguas con cumbrera en x, entre z0 y z1, desde la altura y0 hasta y0+rise.
    gableRoof(parent, name, [x0, x1], [z0, z1], y0, rise, over = 0.35, m = 'slate', gableM = 'stone') {
      const g = kit.group(name, parent);
      const half = (z1 - z0) / 2, len = Math.hypot(half + over, rise), ang = Math.atan2(rise, half);
      for (const side of [-1, 1]) {
        const slab = new T.Mesh(new T.BoxGeometry(x1 - x0 + over * 2, 0.18, len), kit.mat(m));
        slab.position.set((x0 + x1) / 2, y0 + rise / 2 - 0.05, (z0 + z1) / 2 + side * (half + over) / 2);
        slab.rotation.x = side * ang;
        slab.castShadow = slab.receiveShadow = true;
        g.add(slab);
      }
      const shape = new T.Shape();
      shape.moveTo(z0, 0); shape.lineTo(z1, 0); shape.lineTo((z0 + z1) / 2, rise); shape.lineTo(z0, 0);
      for (const [x, sgn] of [[x0, 1], [x1, -1]]) {
        const tri = new T.Mesh(new T.ExtrudeGeometry(shape, {depth: 0.5, bevelEnabled: false}), kit.mat(gableM));
        tri.rotation.y = -Math.PI / 2;
        tri.position.set(x + (sgn > 0 ? 0.5 : 0), y0, 0);
        tri.castShadow = tri.receiveShadow = true;
        g.add(tri);
      }
      return g;
    },
    cyl(parent, name, r, h, [x, y, z], m, seg = 10) {
      const c = new T.Mesh(new T.CylinderGeometry(r, r, h, seg), typeof m === 'string' ? kit.mat(m) : m);
      c.position.set(x, y + h / 2, z);
      if (name) c.name = name;
      c.castShadow = true;
      parent.add(c);
      return c;
    },
    // Texturas de procedimiento (solo en el navegador), una vez por kit. Piedra en hiladas, pizarra, tablas y losas.
    proceduralTextures() {
      if (typeof document === 'undefined') return {};
      return proc ||= procedural(T);
    },
    loadTexture(url) {
      if (!TEXTURES.has(url)) TEXTURES.set(url, new T.TextureLoader().loadAsync(url).then(tx => { tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 8; return tx; }));
      return TEXTURES.get(url);
    },
    // Imágenes generadas (model.json → textures): sustituyen a la textura de procedimiento en cuanto cargan; si faltan, no pasa nada.
    // defs[clave] = {file, tile, anisotropy?, image?, sky?, hide?, tint?}; con tint la imagen se multiplica por el color del material.
    applyImageTextures(defs = {}) {
      if (!kit.textureUrl || typeof document === 'undefined') return Promise.resolve();
      return Promise.all(Object.entries(defs || {}).map(([key, cfg]) => kit.loadTexture(kit.textureUrl(cfg.file)).then(tx => {
        if (cfg.sky) return kit.onSky?.(tx);
        const t2 = tx.clone(); t2.needsUpdate = true;
        if (cfg.anisotropy) t2.anisotropy = cfg.anisotropy;
        if (!cfg.image) { t2.wrapS = t2.wrapT = T.RepeatWrapping; t2.repeat.set(kit.tile / cfg.tile, kit.tile / cfg.tile); }
        for (const m of Object.values(mats)) {
          if (m.name === key) { m.map = t2; if (!cfg.tint) m.color.set('#ffffff'); m.visible = true; m.needsUpdate = true; }
          if ((cfg.hide || []).includes(m.name)) m.visible = false;
        }
      }).catch(() => {}))).then(() => {});
    },
  };
  return kit;
}

// mergeGeometries de three/examples para atributos no entrelazados y sin morph; null (sin console.error) donde aquel falla o no llega.
function mergeGeometries(T, geos, useGroups = false) {
  if (!geos?.length) return null;
  const indexed = geos[0].index !== null, names = Object.keys(geos[0].attributes), merged = new T.BufferGeometry();
  let offset = 0;
  for (const [i, g] of geos.entries()) {
    const own = Object.keys(g.attributes);
    if ((g.index !== null) !== indexed || own.length !== names.length || own.some(n => !names.includes(n))) return null;
    if (Object.values(g.morphAttributes).some(a => a.length) || own.some(n => g.attributes[n].isInterleavedBufferAttribute)) return null;
    if (useGroups) {
      const count = indexed ? g.index.count : g.attributes.position?.count;
      if (count === undefined) return null;
      merged.addGroup(offset, count, i); offset += count;
    }
  }
  if (indexed) {
    const index = []; let base = 0;
    for (const g of geos) { for (let j = 0; j < g.index.count; j++) index.push(g.index.getX(j) + base); base += g.attributes.position.count; }
    merged.setIndex(index);
  }
  for (const n of names) {
    const list = geos.map(g => g.attributes[n]), [a] = list;
    if (list.some(b => b.array.constructor !== a.array.constructor || b.itemSize !== a.itemSize || b.normalized !== a.normalized || b.gpuType !== a.gpuType)) return null;
    const array = new a.array.constructor(list.reduce((s, b) => s + b.count * b.itemSize, 0));
    let at = 0; for (const b of list) { array.set(b.array, at); at += b.count * b.itemSize; }
    const attr = new T.BufferAttribute(array, a.itemSize, a.normalized);
    if (a.gpuType !== undefined) attr.gpuType = a.gpuType;
    merged.setAttribute(n, attr);
  }
  return merged;
}

function procedural(T) {
  const make = (draw, repeat) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); draw(g);
    const tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(repeat, repeat); tx.colorSpace = T.SRGBColorSpace;
    return tx;
  };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stones = (base, var_, rowH) => g => {
    g.fillStyle = '#4e4a44'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += rowH) for (let x = -rnd() * 40; x < 256; x += 30 + rnd() * 36) {
      const l = base + (rnd() - 0.5) * var_; g.fillStyle = `hsl(38,${8 + rnd() * 8}%,${l}%)`;
      g.fillRect(x + 2, y + 2, 26 + rnd() * 30, rowH - 4);
    }
  };
  return {
    stone: make(stones(56, 14, 22), 1), stoneDark: make(stones(44, 10, 20), 1), stoneInner: make(stones(60, 8, 26), 1),
    slate: make(g => { g.fillStyle = '#2e3238'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 * 12; x < 256; x += 24) { g.fillStyle = `hsl(215,8%,${30 + rnd() * 10}%)`; g.fillRect(x + 1, y + 1, 22, 14); } }, 1),
    oak: make(g => { g.fillStyle = '#5a4230'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(30,20,12,${0.15 + rnd() * 0.25})`; g.beginPath(); const y = rnd() * 256; g.moveTo(0, y); g.bezierCurveTo(90, y + rnd() * 8, 170, y - rnd() * 8, 256, y); g.stroke(); } }, 1),
    flag: make(g => { g.fillStyle = '#5c5850'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 42) for (let x = -rnd() * 30; x < 256; x += 40 + rnd() * 30) { g.fillStyle = `hsl(35,6%,${48 + rnd() * 12}%)`; g.fillRect(x + 2, y + 2, 38 + rnd() * 24, 38); } }, 0.6),
    earth: make(g => { g.fillStyle = '#6a5541'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.fillStyle = `hsla(30,25%,${25 + rnd() * 25}%,.5)`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); } }, 0.5),
  };
}
