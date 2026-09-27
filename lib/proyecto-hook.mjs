// Hook pre-commit de un repo de proyecto: pasa scripts/proyecto-check.mjs y bloquea el commit solo si hay errores (código 1).
// Puro: genera el guion sh y decide qué hacer con el hook existente. El instalador es scripts/proyecto-hook.mjs.
export const HOOK_MARKER = '# rodaje:proyecto-hook';
const VERSION = 'v1';

export const shQuote = s => "'" + String(s).replace(/'/g, "'\\''") + "'";

// root: carpeta de rodaje; node: ejecutable de node, ambos absolutos y resueltos al instalar. El proyecto es la carpeta del repo
// (id = su nombre, RODAJE_DATA = su padre). Sin rodaje o sin node avisa y deja pasar.
export function hookScript({root, node}) {
  return `#!/bin/sh
${HOOK_MARKER} ${VERSION}
# Generado por rodaje (scripts/proyecto-hook.mjs). No editar: reinstálalo o quítalo con ese script.
RODAJE=${shQuote(root)}
NODE=${shQuote(node)}
top=$(git rev-parse --show-toplevel) || exit 0
if [ ! -x "$NODE" ]; then NODE=$(command -v node) || NODE=''; fi
if [ -z "$NODE" ]; then echo "rodaje: no se encuentra node; se omite proyecto-check." >&2; exit 0; fi
if [ ! -f "$RODAJE/scripts/proyecto-check.mjs" ]; then echo "rodaje: no se encuentra $RODAJE/scripts/proyecto-check.mjs; se omite proyecto-check." >&2; exit 0; fi
id=$(basename "$top")
RODAJE_DATA=$(dirname "$top") "$NODE" "$RODAJE/scripts/proyecto-check.mjs" "$id" >&2
code=$?
if [ "$code" -eq 1 ]; then echo "rodaje: proyecto-check encontró errores. Corrígelos o, si hace falta, git commit --no-verify." >&2; exit 1; fi
if [ "$code" -ne 0 ]; then echo "rodaje: proyecto-check no pudo validar el proyecto (código $code); se deja pasar el commit." >&2; fi
exit 0
`;
}

// existing: contenido del hook actual o null. Nunca pisa ni borra un hook que no lleve el marcador.
export function planHook({action, existing, script}) {
  const ours = typeof existing === 'string' && existing.includes(HOOK_MARKER);
  if (action === 'install') {
    if (existing == null) return {op: 'write', reason: 'nuevo'};
    if (!ours) return {op: 'refuse', reason: 'hook ajeno'};
    return existing === script ? {op: 'none', reason: 'sin cambios'} : {op: 'write', reason: 'actualizado'};
  }
  if (action === 'uninstall') {
    if (existing == null) return {op: 'none', reason: 'no instalado'};
    return ours ? {op: 'remove', reason: 'desinstalado'} : {op: 'refuse', reason: 'hook ajeno'};
  }
  throw Error('Acción no válida: ' + action);
}
