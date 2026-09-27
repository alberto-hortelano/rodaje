// Editor de plantas: lógica pura, sin DOM, compartida por viewer/planta.html y lib/planta.mjs (validación en el servidor).
// Una planta es {version, formas: [{id, nombre, cerrada, puntos: [[x, z]…], lados?}], marcas?: [{id, nombre, punto}], revision}.
// lados[i] es el papel del lado puntos[i] → puntos[i + 1]; al añadir o quitar vértices se mantiene alineado.
// Todas las funciones devuelven copias: la planta de entrada no cambia.
import {polyContains, centroid} from './kit.mjs';

export {centroid};
export const PALETA = ['#8e887d', '#b08a5a', '#c2410c', '#6b7280', '#8a6b3a', '#4d7c0f', '#1d4ed8', '#9333ea'];
export const colorForma = i => PALETA[((i % PALETA.length) + PALETA.length) % PALETA.length];
// Forma cerrada que contiene todos los vértices de al menos otra (un muro perimetral, una parcela): se pinta sin relleno y con trazo grueso.
export const contenedora = (forma, formas) => !!forma?.cerrada && forma.puntos.length >= 3 && formas.some(o => o !== forma && o.puntos?.length && o.puntos.every(([x, z]) => polyContains(forma.puntos, x, z)));
export const numLados = f => f.cerrada ? f.puntos.length : Math.max(0, f.puntos.length - 1);
// Ajuste a 10 cm; libre, a 1 cm.
export const snap = (v, libre = false) => libre ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;

const conForma = (planta, fi, fn) => { const p = structuredClone(planta), f = p.formas[fi]; if (!f) throw Error('Forma no encontrada: ' + fi); fn(f); return p; };
export const moverVertice = (planta, fi, i, [x, z]) => conForma(planta, fi, f => { f.puntos[i] = [x, z]; });
// Inserta el vértice en el lado `lado` (entre puntos[lado] y el siguiente); los dos lados nuevos heredan su papel.
export const anadirVertice = (planta, fi, lado, [x, z]) => conForma(planta, fi, f => { f.puntos.splice(lado + 1, 0, [x, z]); if (Array.isArray(f.lados)) f.lados.splice(lado + 1, 0, f.lados[lado]); });
// Quita el vértice i; el lado fusionado conserva el papel del lado anterior. Devuelve {planta} o {error} si la forma quedaría por debajo del mínimo.
export function quitarVertice(planta, fi, i) {
  const f = planta.formas[fi], n = f.puntos.length;
  if (n <= (f.cerrada ? 3 : 2)) return {error: f.cerrada ? 'Una forma cerrada necesita al menos tres vértices.' : 'Una línea necesita al menos dos vértices.'};
  return {planta: conForma(planta, fi, f => { f.puntos.splice(i, 1); if (Array.isArray(f.lados)) f.lados.splice(f.cerrada ? i : Math.max(0, Math.min(i, n - 2)), 1); })};
}

// Lado más cercano a q a menos de tol (metros); la forma activa gana a igualdad aproximada. → {forma, lado, punto, d} | null.
export function ladoMasCercano(planta, [qx, qz], tol, activa = -1) {
  let best = null;
  planta.formas.forEach((f, fi) => {
    for (let i = 0; i < numLados(f); i++) {
      const [ax, az] = f.puntos[i], [bx, bz] = f.puntos[(i + 1) % f.puntos.length], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((qx - ax) * dx + (qz - az) * dz) / (dx * dx + dz * dz || 1))), punto = [ax + t * dx, az + t * dz];
      const d = Math.hypot(qx - punto[0], qz - punto[1]), dd = d - (fi === activa ? tol * 0.5 : 0);
      if (!best || dd < best.dd) best = {forma: fi, lado: i, punto, d, dd};
    }
  });
  if (!best || best.dd > tol) return null;
  const {dd, ...r} = best;
  return r;
}

// Caja de formas y marcas en metros, o null si no hay puntos.
export function cajaPlanta(planta) {
  const pts = [...(planta?.formas || []).flatMap(f => f.puntos || []), ...(planta?.marcas || []).map(m => m.punto).filter(Boolean)];
  if (!pts.length) return null;
  return {min: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))], max: [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]};
}
// Vista que encuadra la planta: {x, z} es el punto del mundo en la esquina superior izquierda y s los píxeles por metro, entre 6 y 120.
export function encuadre(planta, ancho, alto, margen = 40) {
  const c = cajaPlanta(planta);
  if (!c) return {x: -22, z: -20, s: 22};
  const w = c.max[0] - c.min[0], h = c.max[1] - c.min[1];
  const s = Math.max(6, Math.min(120, (ancho - 2 * margen) / (w || 1e-9), (alto - 2 * margen) / (h || 1e-9)));
  return {x: (c.min[0] + c.max[0]) / 2 - ancho / 2 / s, z: (c.min[1] + c.max[1]) / 2 - alto / 2 / s, s};
}
export const aPantalla = (v, [x, z]) => [(x - v.x) * v.s, (z - v.z) * v.s];
export const aMundo = (v, px, py) => [px / v.s + v.x, py / v.s + v.z];

// Errores de una planta editada frente a la anterior (la del disco). El editor solo mueve, añade o quita vértices:
// se rechaza cambiar la versión, los ids o el orden de formas y marcas, o si una forma es cerrada; y los lados desalineados.
export function validarPlanta(planta, anterior) {
  if (!planta || typeof planta !== 'object' || Array.isArray(planta)) return ['La planta no es un objeto JSON.'];
  const e = [], par = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  if (planta.version === undefined) e.push('Falta la versión (version).');
  else if (anterior && planta.version !== anterior.version) e.push(`La versión cambió (${anterior.version} → ${planta.version}).`);
  if (!Array.isArray(planta.formas)) return [...e, 'Faltan las formas (formas).'];
  if (planta.marcas !== undefined && !Array.isArray(planta.marcas)) return [...e, 'Las marcas (marcas) deben ser una lista.'];
  const ids = l => JSON.stringify((l || []).map(x => x?.id));
  if (anterior && ids(planta.formas) !== ids(anterior.formas)) e.push('Las formas no coinciden con las guardadas: se pueden mover, añadir o quitar vértices, no crear, borrar, renombrar ni reordenar formas.');
  if (anterior && ids(planta.marcas) !== ids(anterior.marcas)) e.push('Las marcas no coinciden con las guardadas.');
  planta.formas.forEach((f, fi) => {
    const nombre = `Forma ${f?.id ?? fi + 1}`, antes = anterior?.formas?.find(a => a.id === f?.id);
    if (!f || typeof f !== 'object') return e.push(nombre + ': no es un objeto.');
    if (antes && !!f.cerrada !== !!antes.cerrada) e.push(nombre + ': no se puede cambiar si es cerrada.');
    if (!Array.isArray(f.puntos) || !f.puntos.every(par)) return e.push(nombre + ': cada punto debe ser un par de números [x, z].');
    if (f.puntos.length < (f.cerrada ? 3 : 2)) e.push(nombre + (f.cerrada ? ': necesita al menos tres vértices.' : ': necesita al menos dos vértices.'));
    if (f.lados !== undefined && (!Array.isArray(f.lados) || f.lados.length !== numLados(f))) e.push(`${nombre}: tiene ${Array.isArray(f.lados) ? f.lados.length : 0} papeles de lado para ${numLados(f)} lados.`);
    if (f.lados === undefined && Array.isArray(antes?.lados)) e.push(nombre + ': ha perdido los papeles de sus lados (lados).');
  });
  (planta.marcas || []).forEach((m, i) => { if (!par(m?.punto)) e.push(`Marca ${m?.id ?? i + 1}: el punto debe ser un par de números [x, z].`); });
  return e;
}
