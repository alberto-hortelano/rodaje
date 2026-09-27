#!/usr/bin/env node
// Configuración del ensayo 3D de un proyecto (proyecto.stage.rehearsal), staging de sus planos y catálogo de variantes, zonas y canales; formato en docs/ensayo-3d.md.
//   node scripts/stage-config.mjs show [proyecto]
//   node scripts/stage-config.mjs check [proyecto]              (sale con 1 si hay errores; los avisos no cuentan)
//   node scripts/stage-config.mjs set [proyecto] --desde <fichero.json>
//   node scripts/stage-config.mjs staging [proyecto] --desde <parches.json> [--lote <lote>] [--simular]
//   node scripts/stage-config.mjs catalogo [proyecto] [--desde <fichero.json>] [--simular]
// Proyecto: [proyecto] o --project id, RODAJE_PROJECT o el activo en la app.
// set valida y guarda con store.save (sube la revisión y regenera los derivados).
// staging aplica {"shots":{"<idPlano>":{campo:valor|null}}} (null borra) y renombra la clave heredada potatoes a swarm en todos los planos;
// sin --lote guarda con store.save; con --lote reescribe assets/<lote>/project-snapshot.json en su mismo formato; --simular solo lista los planos que cambiarían.
// No escribe nada si hay ids desconocidos o errores de staging.
// catalogo sin --desde imprime {variants, zones, channels, defaultVariant} (null si faltan); con --desde valida y guarda con store.save:
// clave presente reemplaza, null borra, ausente no se toca; --simular solo lista los cambios. Avisa de los datos que quedan fuera del catálogo.
import fs from 'node:fs';
import path from 'node:path';
import {load,save,dir} from '../app/store.mjs';
import {rehearsalStageErrors,rehearsalConfig,stagingIssues,patchProjectStaging,stageFallback,stageCatalogErrors,catalogIssues,STAGE_CATALOG_KEYS} from '../app/workflow.mjs';
import {readJSON,writeJSON,writeFileAtomic} from '../lib/json.mjs';
import {parseArgs} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/stage-config.mjs show|check [proyecto] · set [proyecto] --desde <fichero.json> · staging [proyecto] --desde <parches.json> [--lote <lote>] [--simular] · catalogo [proyecto] [--desde <fichero.json>] [--simular]  [--project id]';
const {args: [cmd, ...rest], opts} = parseArgs(process.argv.slice(2));
if (!['show', 'check', 'set', 'staging', 'catalogo'].includes(cmd) || (opts.desde !== undefined && typeof opts.desde !== 'string') || (['set', 'staging'].includes(cmd) && typeof opts.desde !== 'string') || (opts.lote !== undefined && typeof opts.lote !== 'string')) usageExit(USAGE);
const p = load(cliProject({usage: USAGE, opts, args: rest, positional: 0}).project);
const shotsOf = project => (project.episodes || []).flatMap(e => (e.sequences || []).flatMap(s => (s.shots || []).map(t => ({s, t}))));
const issuesOf = (project, R) => { const errors = [], warnings = []; for (const {s, t} of shotsOf(project)) { const r = stagingIssues(t, s, R); errors.push(...r.errors); warnings.push(...r.warnings); } return {errors, warnings}; };

if (cmd === 'show') console.log(JSON.stringify(p.stage?.rehearsal ?? null, null, 2));
if (cmd === 'check') {
  const cfg = p.stage?.rehearsal, errors = rehearsalStageErrors(cfg, {characters: p.characters.map(c => c.id)});
  for (const {t} of shotsOf(p)) {
    const key = t.staging?.exterior;
    if (typeof key === 'string' && !(cfg?.exteriors && Object.hasOwn(cfg.exteriors, key))) errors.push(`${t.id}: staging.exterior «${key}» sin entrada en exteriors`);
  }
  const staging = issuesOf(p, rehearsalConfig(p)), warnings = [...staging.warnings, ...catalogIssues(p)];
  errors.push(...staging.errors, ...stageCatalogErrors(p.stage));
  for (const e of errors) console.error('  ' + e);
  for (const w of warnings) console.error('  aviso: ' + w);
  console.log(errors.length ? `${p.id}: ${errors.length} errores en stage.rehearsal, el catálogo o staging` : `${p.id}: stage.rehearsal, catálogo y staging sin errores${warnings.length ? ` (${warnings.length} avisos)` : ''}`);
  process.exit(errors.length ? 1 : 0);
}
if (cmd === 'set') {
  const cfg = readJSON(opts.desde), errors = rehearsalStageErrors(cfg, {characters: p.characters.map(c => c.id)});
  if (errors.length) { for (const e of errors) console.error('  ' + e); console.error('No se guarda: la configuración tiene errores.'); process.exit(1); }
  p.stage = {...p.stage, rehearsal: cfg};
  const saved = save(p, p.revision);
  console.log(`${p.id}: stage.rehearsal guardado (revisión ${saved.revision})`);
}
if (cmd === 'staging') {
  const patches = readJSON(opts.desde)?.shots;
  if (!patches || typeof patches !== 'object' || Array.isArray(patches)) { console.error('El fichero de parches necesita {"shots":{"<idPlano>":{...}}}.'); process.exit(1); }
  const file = opts.lote ? path.join(dir(p.id), 'assets', opts.lote, 'project-snapshot.json') : null;
  const raw = file ? fs.readFileSync(file, 'utf8') : null, target = file ? JSON.parse(raw) : p, where = file ? `${opts.lote}/project-snapshot.json` : 'proyecto.json';
  const {project: next, changed, unknown} = patchProjectStaging(target, patches);
  const {errors, warnings} = issuesOf(next, rehearsalConfig(file ? stageFallback(next, p) : next));
  if (unknown.length) errors.unshift(...unknown.map(id => `${id}: no hay plano con staging con ese id en ${where}`));
  for (const e of errors) console.error('  ' + e);
  for (const w of warnings) console.error('  aviso: ' + w);
  if (errors.length) { console.error(`No se guarda: ${errors.length} errores.`); process.exit(1); }
  if (opts.simular) { for (const id of changed) console.log(id); console.log(`${where}: ${changed.length} planos cambiarían (simulación, sin escribir)`); process.exit(0); }
  if (!changed.length) { console.log(`${where}: sin cambios`); process.exit(0); }
  // La instantánea conserva su formato (algunas son JSON compacto en una línea) para que el diff muestre solo el staging.
  if (file) { if (/^\{\s*\n/.test(raw)) writeJSON(file, next); else writeFileAtomic(file, JSON.stringify(next) + (raw.endsWith('\n') ? '\n' : '')); }
  else next.revision = save(next, p.revision).revision;
  console.log(`${where}: staging actualizado en ${changed.length} planos${file ? '' : ` (revisión ${next.revision})`}`);
}
if (cmd === 'catalogo') {
  const current = Object.fromEntries(STAGE_CATALOG_KEYS.map(k => [k, p.stage?.[k] ?? null]));
  if (opts.desde === undefined) { console.log(JSON.stringify(current, null, 2)); process.exit(0); }
  const patch = readJSON(opts.desde);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) { console.error('El fichero necesita {"variants":[…],"zones":[…],"channels":[…],"defaultVariant":"…"}.'); process.exit(1); }
  const extra = Object.keys(patch).filter(k => !STAGE_CATALOG_KEYS.includes(k));
  const stage = {...p.stage};
  for (const [k, v] of Object.entries(patch)) if (v === null) delete stage[k]; else stage[k] = v;
  const errors = [...extra.map(k => `clave «${k}» fuera del catálogo (${STAGE_CATALOG_KEYS.join(', ')})`), ...stageCatalogErrors(stage)];
  if (errors.length) { for (const e of errors) console.error('  ' + e); console.error('No se guarda: el catálogo tiene errores.'); process.exit(1); }
  const changed = STAGE_CATALOG_KEYS.filter(k => Object.hasOwn(patch, k) && JSON.stringify(p.stage?.[k] ?? null) !== JSON.stringify(stage[k] ?? null));
  const next = {...p, stage};
  for (const w of catalogIssues(next)) console.error('  aviso: ' + w);
  for (const k of changed) console.log(`${k}: ${p.stage?.[k] === undefined ? 'nuevo' : stage[k] === undefined ? 'se borra' : 'cambia'}`);
  if (opts.simular) { console.log(`${p.id}: ${changed.length} claves del catálogo cambiarían (simulación, sin escribir)`); process.exit(0); }
  if (!changed.length) { console.log(`${p.id}: catálogo sin cambios`); process.exit(0); }
  p.stage = stage;
  const saved = save(p, p.revision);
  console.log(`${p.id}: catálogo guardado (revisión ${saved.revision})`);
}
