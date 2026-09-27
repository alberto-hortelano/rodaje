import fs from 'node:fs';import os from 'node:os';import path from 'node:path';process.env.RODAJE_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-suite-'));
// Nunca la clave real en la suite (loadEnv no pisa una variable ya definida) ni la configuración local del repositorio.
process.env.FAL_KEY='test:dummy';process.env.RODAJE_CONFIG_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-config-'));
