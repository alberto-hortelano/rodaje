// Instantánea para detectar regresiones: digests de todos los planos, GLB y caras coplanarias de cada entorno con constructor, y capturas de las vistas 3D.
// Uso: node scripts/linea-base.mjs <dir> [--url http://127.0.0.1:4320] [--sin-capturas]
// Escribe solo en <dir>: linea-base.json y capturas/<nombre>.png. Para comparar dos instantáneas: diff -r <a> <b>.
// Las capturas necesitan la app arrancada (npm start) y Chrome (CHROME_PATH o /usr/bin/google-chrome).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {load, digest} from '../app/store.mjs';
import {sortKeys} from '../app/workflow.mjs';
import {projectIds, environmentsWithBuilder, loadEnvironment, buildEnvironment, exportGlb, coplanarReport} from '../lib/entorno3d.mjs';

const args = process.argv.slice(2);
const url = (args.includes('--url') ? args.splice(args.indexOf('--url'), 2)[1] : 'http://127.0.0.1:4320').replace(/\/$/, '');
const shots = !args.includes('--sin-capturas');
const out = args.find(a => !a.startsWith('--'));
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
  const {chromium} = await import('playwright');
  const views = [
    ...envs.map(({projectId, envId}) => ({name: `entorno-${projectId}-${envId}`, path: `/?project=${encodeURIComponent(projectId)}&view=environment&environment=${encodeURIComponent(envId)}`, ready: 'window.rodaje?.environment', canvas: '#environment-model canvas[data-engine]'})),
    ...projects.filter(p => p.shipModel).map(p => ({name: `nave-${p.id}`, path: `/?project=${encodeURIComponent(p.id)}&view=ship`, ready: 'window.rodaje?.ship', canvas: '#ship-model canvas[data-engine]'}))
  ];
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']});
  const failures = [];
  try {
    result.chrome = browser.version();
    result.capturas = {};
    fs.mkdirSync(path.join(out, 'capturas'), {recursive: true});
    const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, serviceWorkers: 'block'});
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
  } finally { await browser.close(); }
  if (failures.length) { console.error('Fallos en las capturas:'); for (const f of failures) console.error('  ' + f); process.exit(1); }
}

fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'linea-base.json'), JSON.stringify(sortKeys(result), null, 2) + '\n');
for (const p of projects) console.log(`${p.id}: ${Object.keys(result.digests[p.id]).length} digests de planos`);
for (const [k, g] of Object.entries(result.glb)) console.log(`${k}: GLB ${g.mallas} mallas · ${(g.bytes / 1024).toFixed(0)} KB · ${g.sha256.slice(0, 12)} · ${result.coplanares[k].total} pares coplanarios`);
if (result.capturas) console.log(`${Object.keys(result.capturas).length} capturas (${result.chrome})`);
console.log('Escrito ' + path.join(out, 'linea-base.json'));
