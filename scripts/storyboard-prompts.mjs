// Exporta las viñetas de un storyboard a prompts de imagen para ChatGPT y enlaza los fotogramas ya generados.
// Uso: node scripts/storyboard-prompts.mjs <proyecto> <storyboard> [--enlazar]
//   Escribe storyboards/<id>/prompts/<código>.prompt.txt (cabecera Destino/Adjuntar/Uso, prompt en inglés y Negative)
//   con destino storyboards/<id>/render/<código>.png. No sobrescribe el prompt de una viñeta cuya imagen ya existe.
//   Una viñeta con `version: N` se exporta como <código>-vN (prompt e imagen nuevos, el anterior se conserva).
//   --enlazar: pone `render` en cada viñeta cuyo PNG exista, la última versión si hay -v2, -v3… (guarda con el store).
import fs from 'node:fs';
import path from 'node:path';
import {load, save, dir} from '../app/store.mjs';
import {ROOT} from '../lib/paths.mjs';

const args = process.argv.slice(2);
const link = args.includes('--enlazar');
const [projectId, sbId] = args.filter(a => !a.startsWith('--'));
if (!projectId || !sbId) throw Error('Uso: node scripts/storyboard-prompts.mjs <proyecto> <storyboard> [--enlazar]');
const p = load(projectId), base = dir(projectId), rel = path.relative(ROOT, base);
const sb = (p.storyboards || []).find(b => b.id === sbId);
if (!sb) throw Error('Storyboard no encontrado: ' + sbId);
const out = path.join(base, 'storyboards', sb.id, 'prompts');
fs.mkdirSync(out, {recursive: true});
let written = 0, kept = 0, linked = 0;
for (const s of sb.sequences) for (const t of s.shots) {
  // Una viñeta rehecha lleva `version` (2, 3…): su prompt va a <código>-vN.prompt.txt y su imagen a <código>-vN.png; el anterior queda como registro.
  const name = t.version > 1 ? `${t.code}-v${t.version}` : t.code;
  const render = `storyboards/${sb.id}/render/${name}.png`, exists = fs.existsSync(path.join(base, render));
  // Enlaza la última versión: A01.png, A01-v2.png, A01-v3.png…
  const dirR = path.join(base, 'storyboards', sb.id, 'render'), version = f => Number(f.match(/-v(\d+)\.png$/)?.[1] || 1);
  const latest = fs.existsSync(dirR) ? fs.readdirSync(dirR).filter(f => new RegExp(`^${t.code}(-v\\d+)?\\.png$`).test(f)).sort((x, y) => version(y) - version(x))[0] : null;
  const current = latest && `storyboards/${sb.id}/render/${latest}`;
  if (link && current && t.render !== current) { t.render = current; t.renders = [...(t.renders || []), {file: current, at: new Date().toISOString(), source: 'ChatGPT'}]; linked++; }
  const file = path.join(out, `${name}.prompt.txt`);
  if (exists && fs.existsSync(file)) { kept++; continue; }
  const [prompt, negative = ''] = String(t.prompt || '').split(/\n\nNegative: /);
  const attach = (t.references || []).map(r => `${rel}/${r.path} (${r.role})`).join(', ') || 'nada';
  fs.writeFileSync(file, `Destino: ${rel}/${render}\nAdjuntar: ${attach}\nUso: ${t.code} · ${t.title} (${t.duration} s). ${t.action}\n\n${prompt.trim()}\n${negative ? `\nNegative: ${negative.trim()}\n` : ''}`);
  written++;
}
if (linked) save(p, p.revision);
console.log(`${written} prompts escritos · ${kept} conservados (imagen ya generada)${link ? ` · ${linked} fotogramas enlazados` : ''}`);
