#!/usr/bin/env node
// Configuración del ensayo 3D de un proyecto (proyecto.stage.rehearsal): animaciones por rol, exteriores y tono de voz.
//   node scripts/stage-config.mjs show [proyecto]
//   node scripts/stage-config.mjs check [proyecto]              (sale con 1 si hay errores)
//   node scripts/stage-config.mjs set [proyecto] --desde <fichero.json>
// Proyecto: [proyecto] o --project id, RODAJE_PROJECT o el activo en la app.
// set valida y guarda con store.save (sube la revisión y regenera los derivados).
import {load,save} from '../app/store.mjs';
import {rehearsalStageErrors} from '../app/workflow.mjs';
import {readJSON} from '../lib/json.mjs';
import {parseArgs} from '../lib/args.mjs';
import {cliProject, usageExit} from '../lib/cli.mjs';

const USAGE = 'Uso: node scripts/stage-config.mjs show|check [proyecto] · set [proyecto] --desde <fichero.json>  [--project id]';
const {args: [cmd, ...rest], opts} = parseArgs(process.argv.slice(2));
if (!['show', 'check', 'set'].includes(cmd) || (cmd === 'set' && typeof opts.desde !== 'string')) usageExit(USAGE);
const p = load(cliProject({usage: USAGE, opts, args: rest, positional: 0}).project);

if (cmd === 'show') console.log(JSON.stringify(p.stage?.rehearsal ?? null, null, 2));
if (cmd === 'check') {
  const cfg = p.stage?.rehearsal, errors = rehearsalStageErrors(cfg);
  for (const e of p.episodes) for (const s of e.sequences || []) for (const t of s.shots || []) {
    const key = t.staging?.exterior;
    if (typeof key === 'string' && !(cfg?.exteriors && Object.hasOwn(cfg.exteriors, key))) errors.push(`${t.id}: staging.exterior «${key}» sin entrada en exteriors`);
  }
  for (const e of errors) console.error('  ' + e);
  console.log(errors.length ? `${p.id}: ${errors.length} errores en stage.rehearsal` : `${p.id}: stage.rehearsal sin errores`);
  process.exit(errors.length ? 1 : 0);
}
if (cmd === 'set') {
  const cfg = readJSON(opts.desde), errors = rehearsalStageErrors(cfg);
  if (errors.length) { for (const e of errors) console.error('  ' + e); console.error('No se guarda: la configuración tiene errores.'); process.exit(1); }
  p.stage = {...p.stage, rehearsal: cfg};
  const saved = save(p, p.revision);
  console.log(`${p.id}: stage.rehearsal guardado (revisión ${saved.revision})`);
}
