import fs from 'node:fs';import os from 'node:os';import path from 'node:path';process.env.RODAJE_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rodaje-suite-'));
