// Lectura y escritura de JSON. writeJSON es atómica: temporal único en la misma carpeta y rename.
// replaceJsonValue cambia un solo valor en el texto y deja el resto del fichero byte a byte (formato a mano, sin salto final…).
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {randomBytes} from 'node:crypto';

export const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export function writeFileAtomic(f, text) {
  fs.mkdirSync(path.dirname(f), {recursive: true});
  const tmp = `${f}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try { fs.writeFileSync(tmp, text); fs.renameSync(tmp, f); } catch (e) { fs.rmSync(tmp, {force: true}); throw e; }
}
export function writeJSON(f, v) {
  const text = JSON.stringify(v, null, 2) + '\n'; // si no se puede serializar, el disco no cambia
  writeFileAtomic(f, text);
}

// Escáner mínimo sobre JSON ya válido: fin de una cadena, de un valor y valor de una clave en un objeto.
const ws = (t, i) => { while (t[i] === ' ' || t[i] === '\n' || t[i] === '\r' || t[i] === '\t') i++; return i; };
function strEnd(t, i) { for (i++; i < t.length; i++) { if (t[i] === '\\') i++; else if (t[i] === '"') return i + 1; } throw Error('JSON: cadena sin cerrar'); }
function valueEnd(t, i) {
  if (t[i] === '"') return strEnd(t, i);
  if (t[i] === '{' || t[i] === '[') {
    let depth = 0;
    for (; i < t.length; i++) {
      const c = t[i];
      if (c === '"') i = strEnd(t, i) - 1;
      else if (c === '{' || c === '[') depth++;
      else if ((c === '}' || c === ']') && --depth === 0) return i + 1;
    }
    throw Error('JSON: objeto sin cerrar');
  }
  let j = i; while (j < t.length && !/[\s,}\]]/.test(t[j])) j++;
  return j;
}
// Inicio del valor de key en el objeto que empieza en i; con claves repetidas, la última (como JSON.parse). -1 si no está.
function member(t, i, key) {
  let found = -1;
  i = ws(t, i + 1);
  while (i < t.length && t[i] !== '}') {
    const kEnd = strEnd(t, i), k = JSON.parse(t.slice(i, kEnd)), v = ws(t, ws(t, kEnd) + 1);
    if (k === key) found = v;
    i = ws(t, valueEnd(t, v));
    if (t[i] === ',') i = ws(t, i + 1);
  }
  return found;
}
// [inicio, fin) del valor en la ruta de claves, o null si no existe.
export function jsonValueSpan(text, keys) {
  let i = ws(text, 0);
  for (const k of keys) { if (text[i] !== '{') return null; i = member(text, i, k); if (i < 0) return null; }
  return [i, valueEnd(text, i)];
}
// Sustituye el valor de la ruta por value (sangría de 2, alineada con la línea de la clave). Comprueba que el resultado es el
// original con solo ese valor cambiado; lanza si la ruta no existe.
export function replaceJsonValue(text, keys, value) {
  const span = jsonValueSpan(text, keys);
  if (!span) throw Error('No existe ' + keys.join('.') + ' en el JSON');
  const json = JSON.stringify(value, null, 2);
  if (json === undefined) throw Error('Valor no serializable');
  const indent = /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', span[0] - 1) + 1))[0];
  const out = text.slice(0, span[0]) + json.replace(/\n/g, '\n' + indent) + text.slice(span[1]);
  const expected = JSON.parse(text);
  keys.slice(0, -1).reduce((o, k) => o[k], expected)[keys.at(-1)] = JSON.parse(json);
  if (!isDeepStrictEqual(JSON.parse(out), expected)) throw Error('La sustitución de ' + keys.join('.') + ' no es segura');
  return out;
}
