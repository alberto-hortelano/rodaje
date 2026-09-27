// Instantánea para detectar regresiones: digests de todos los planos, GLB y caras coplanarias de cada entorno con constructor, y capturas de las vistas 3D.
// Uso: node scripts/linea-base.mjs <dir> [--url http://127.0.0.1:4320] [--sin-capturas]
//        [--ensayo <proyecto>:<plano>,<plano>,... [--lote <lote> [--sin-respaldo]]]
// --ensayo añade capturas del ensayo 3D (createStage) de esos planos en t=0, a mitad y 0,3 s tras la primera réplica;
// --lote repite los planos con la instantánea del lote, completada con el stage del proyecto vivo salvo --sin-respaldo.
// Escribe solo en <dir>: linea-base.json y capturas/<nombre>.png. Para comparar dos instantáneas: diff -r <a> <b>.
// Las capturas necesitan la app arrancada (npm start) y Chrome (ver lib/chrome.mjs).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {load, digest, dir, shot as findShot} from '../app/store.mjs';
import {sortKeys, stageFallback} from '../app/workflow.mjs';
import {readJSON, writeJSON} from '../lib/json.mjs';
import {withChrome, newRenderContext, pinClock, VIEWPORTS} from '../lib/chrome.mjs';
import {projectIds, environmentsWithBuilder, loadEnvironment, buildEnvironment, exportGlb, coplanarReport} from '../lib/entorno3d.mjs';

const args = process.argv.slice(2);
const url = (args.includes('--url') ? args.splice(args.indexOf('--url'), 2)[1] : 'http://127.0.0.1:4320').replace(/\/$/, '');
const ensayo = args.includes('--ensayo') ? args.splice(args.indexOf('--ensayo'), 2)[1] : null;
const lote = args.includes('--lote') ? args.splice(args.indexOf('--lote'), 2)[1] : null;
const sinRespaldo = args.includes('--sin-respaldo');
const shots = !args.includes('--sin-capturas');
const out = args.find(a => !a.startsWith('--'));
if (ensayo !== null && !/^[^:]+:[^:]+$/.test(ensayo || '')) { console.error('--ensayo necesita <proyecto>:<plano>,<plano>,...'); process.exit(2); }
if ((lote !== null && !ensayo) || (sinRespaldo && !lote)) { console.error('--lote va con --ensayo y --sin-respaldo con --lote'); process.exit(2); }
if (!out) { console.error('Uso: node scripts/linea-base.mjs <dir> [--url http://127.0.0.1:4320] [--sin-capturas]'); process.exit(2); }

if (shots) try { const r = await fetch(url + '/api/state', {signal: AbortSignal.timeout(3000)}); if (!r.ok) throw Error(r.status); } catch {
  console.error(`La app no responde en ${url}. Arráncala (npm start) o usa --sin-capturas.`); process.exit(2);
}

const sha = b => createHash('sha256').update(b).digest('hex');
const projects = projectIds().map(load), envs = environmentsWithBuilder();
const result = {digests: {}, glb: {}, coplanares: {}};
for (const p of projects) {
  const d = result.digests[p.id] = {};
  for (const e of p.episodes || []) for (const s of e.sequences || []) for (const t of s.shots || []) d[t.id] = digest(p, t.id);
}
for (const {projectId, envId} of envs) {
  const ctx = await loadEnvironment(projectId, envId), key = projectId + '/' + envId;
  const {sha256, meshes, bytes} = await exportGlb(buildEnvironment(ctx, {textures: false}), {quiet: true});
  result.glb[key] = {sha256, mallas: meshes, bytes};
  const {total, porPreset} = coplanarReport(ctx, '--todos');
  result.coplanares[key] = {total, porPreset};
}

if (shots) {
  const views = [
    ...envs.map(({projectId, envId}) => ({name: `entorno-${projectId}-${envId}`, path: `/?project=${encodeURIComponent(projectId)}&view=environment&environment=${encodeURIComponent(envId)}`, ready: 'window.rodaje?.environment', canvas: '#environment-model canvas[data-engine]'})),
    ...projects.filter(p => p.shipModel).map(p => ({name: `nave-${p.id}`, path: `/?project=${encodeURIComponent(p.id)}&view=ship`, ready: 'window.rodaje?.ship', canvas: '#ship-model canvas[data-engine]'}))
  ];
  const failures = [];
  await withChrome(async browser => {
    result.chrome = browser.version();
    result.capturas = {};
    fs.mkdirSync(path.join(out, 'capturas'), {recursive: true});
    const context = await newRenderContext(browser, VIEWPORTS.lineaBase);
    for (const v of views) {
      const page = await context.newPage(), errors = [];
      page.on('request', r => { if (r.method() !== 'GET') errors.push(`petición ${r.method()} ${r.url()}`); });
      await page.route('**/*', r => r.request().method() === 'GET' ? r.continue() : r.abort()); // solo lectura: nada llega a la app
      page.on('pageerror', e => errors.push('error en la página: ' + e.message));
      try {
        await page.goto(url + v.path, {waitUntil: 'networkidle'});
        await page.waitForFunction(v.ready, null, {timeout: 30000});
        await page.waitForTimeout(1500);
        const png = await page.locator(v.canvas).screenshot();
        const archivo = 'capturas/' + v.name + '.png';
        fs.writeFileSync(path.join(out, archivo), png);
        result.capturas[v.name] = {archivo, sha256: sha(png)};
      } catch (e) { errors.push(e.message.split('\n')[0]); }
      if (errors.length) failures.push(...errors.map(e => `${v.name}: ${e}`));
      await page.close();
    }
    if (ensayo) {
      result.ensayo = {};
      const [pid, list] = ensayo.split(':'), ids = list.split(',').filter(Boolean), live = load(pid);
      const sources = [{prefix: 'ensayo-', project: live}];
      if (lote) { const snap = readJSON(path.join(dir(pid), 'assets', lote, 'project-snapshot.json')); sources.push({prefix: `ensayo-lote-${lote}-`, project: sinRespaldo ? snap : stageFallback(snap, live)}); }
      for (const {prefix, project} of sources) for (const id of ids) {
        const page = await context.newPage(), errors = [], asked = new Set(), names = [];
        page.on('request', r => { if (r.method() !== 'GET') errors.push(`petición ${r.method()} ${r.url()}`); const u = new URL(r.url()); if (u.pathname === '/api/asset') asked.add(u.searchParams.get('file')); });
        await page.route('**/*', r => r.request().method() === 'GET' ? r.continue() : r.abort());
        page.on('pageerror', e => errors.push('error en la página: ' + e.message));
        await pinClock(page);
        try {
          const {sequence: s, shot: t} = findShot(project, id);
          await page.goto(url + '/'); await page.waitForTimeout(800);
          await page.evaluate(() => { document.body.innerHTML = '<div id="render"></div>'; });
          asked.clear();
          await page.evaluate(async ({p, s, t}) => { window.st = await (await import('/stage.js')).createStage(document.querySelector('#render'), {project: p, sequence: {...s, location: t.location || s.location}, shot: t}); }, {p: project, s, t});
          const times = [0, t.duration / 2, ...(t.lines.length ? [t.lines[0].start + .3] : [])];
          for (const time of times) {
            const png = await page.evaluate(({t, time}) => { const l = t.lines.find(l => time >= l.start && time < l.start + (l.estimatedDuration || 3)); st.setSpeaker(l || null); return st.frame(time); }, {t, time});
            const buf = Buffer.from(png.split(',')[1], 'base64'), name = `${prefix}${id}-${time.toFixed(2)}`, archivo = 'capturas/' + name + '.png';
            fs.writeFileSync(path.join(out, archivo), buf);
            result.ensayo[name] = {archivo, sha256: sha(buf)}; names.push(name);
          }
        } catch (e) { errors.push(e.message.split('\n')[0]); }
        const peticiones = [...asked].sort();
        for (const n of names) result.ensayo[n].peticiones = peticiones;
        if (errors.length) failures.push(...errors.map(e => `${prefix}${id}: ${e}`));
        await page.close();
      }
    }
  });
  if (failures.length) { console.error('Fallos en las capturas:'); for (const f of failures) console.error('  ' + f); process.exit(1); }
}

fs.mkdirSync(out, {recursive: true});
writeJSON(path.join(out, 'linea-base.json'), sortKeys(result));
for (const p of projects) console.log(`${p.id}: ${Object.keys(result.digests[p.id]).length} digests de planos`);
for (const [k, g] of Object.entries(result.glb)) console.log(`${k}: GLB ${g.mallas} mallas · ${(g.bytes / 1024).toFixed(0)} KB · ${g.sha256.slice(0, 12)} · ${result.coplanares[k].total} pares coplanarios`);
if (result.capturas) console.log(`${Object.keys(result.capturas).length} capturas (${result.chrome})`);
if (result.ensayo) console.log(`${Object.keys(result.ensayo).length} capturas de ensayo`);
console.log('Escrito ' + path.join(out, 'linea-base.json'));
