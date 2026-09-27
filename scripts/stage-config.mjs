#!/usr/bin/env node
// Configuración del ensayo 3D de un proyecto (proyecto.stage.rehearsal) y staging de sus planos; formato en docs/ensayo-3d.md.
//   node scripts/stage-config.mjs show [proyecto]
//   node scripts/stage-config.mjs check [proyecto]              (sale con 1 si hay errores; los avisos no cuentan)
//   node scripts/stage-config.mjs set [proyecto] --desde <fichero.json>
//   node scripts/stage-config.mjs staging [proyecto] --desde <parches.json> [--lote <lote>] [--simular]
// Proyecto: [proyecto] o --project id, RODAJE_PROJECT o el activo en la app.
// set valida y guarda con store.save (sube la revisión y regenera los derivados).
// staging aplica {"shots":{"<idPlano>":{campo:valor|null}}} (null borra) y renombra la clave heredada potatoes a swarm en todos los planos;
// sin --lote guarda con store.save; con --lote reescribe assets/<lote>/project-snapshot.json en su mismo formato; --simular solo lista los planos que cambiarían.
// No escribe nada si hay ids desconocidos o errores de staging.
import fs from 'node:fs';
import path from 'node:path';
import {load,save,dir} from '../app/store.mjs';
import {rehearsalStageErrors,rehearsalConfig,stagingIssues,patchProjectStaging,stageFallback} from '../app/workflow.mjs';
import {readJSON,writeJSON,writeFileAtomic} from '../lib/json.mjs';
import {parseArgs} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/stage-config.mjs show|check [proyecto] · set [proyecto] --desde <fichero.json> · staging [proyecto] --desde <parches.json> [--lote <lote>] [--simular]  [--project id]';
const {args: [cmd, ...rest], opts} = parseArgs(process.argv.slice(2));
if (!['show', 'check', 'set', 'staging'].includes(cmd) || (['set', 'staging'].includes(cmd) && typeof opts.desde !== 'string') || (opts.lote !== undefined && typeof opts.lote !== 'string')) usageExit(USAGE);
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
  const staging = issuesOf(p, rehearsalConfig(p));
  errors.push(...staging.errors);
  for (const e of errors) console.error('  ' + e);
  for (const w of staging.warnings) console.error('  aviso: ' + w);
  console.log(errors.length ? `${p.id}: ${errors.length} errores en stage.rehearsal o staging` : `${p.id}: stage.rehearsal y staging sin errores${staging.warnings.length ? ` (${staging.warnings.length} avisos)` : ''}`);
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
