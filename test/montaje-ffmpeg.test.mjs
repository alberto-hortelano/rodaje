// montar() de la vista Montaje con ffmpeg falso en fallo: el error del trabajo es la cola limpia del script (issue #28).
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
const H=await import('./fixtures/providers/harness.mjs');
// Antes de importar la app: DATA se fija al importar lib/paths.mjs y el script hijo hereda process.env.
Object.assign(process.env,{RODAJE_DATA:H.cliData(),RODAJE_MOCK_LOG:path.join(H.tmp('rodaje-prov-log-'),'montar.jsonl'),RODAJE_MOCK_FFMPEG_FAIL:'1',PATH:[path.join(H.ROOT,'test/fixtures/bin'),path.dirname(process.execPath),process.env.PATH].join(path.delimiter)});
delete process.env.RODAJE_PROJECT;
const M=await import('../app/montaje.mjs');
test('montar: un ffmpeg fallido deja el trabajo en failed con «falla simulada» y sin traza de Node',{timeout:30000},async()=>{
 const job=M.montar(H.CLI_PROJECT,'lote-a');assert.equal(job.state,'running');
 const t0=Date.now();while(job.state==='running'){assert.ok(Date.now()-t0<25000,'montar no terminó');await new Promise(r=>setTimeout(r,50));}
 assert.equal(job.state,'failed');assert.match(job.error,/falla simulada/);assert.doesNotMatch(job.error,/Node\.js v/);assert.doesNotMatch(job.error,/^\s+at /m);
 assert.match(job.error,/montar: ffmpeg falló \(código 1\)/);assert.equal(M.loteDetail(H.CLI_PROJECT,'lote-a').montando,job);});
