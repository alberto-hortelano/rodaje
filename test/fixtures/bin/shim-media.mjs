// ffmpeg y ffprobe falsos para las pruebas de proveedores: registran el argv en RODAJE_MOCK_LOG y fingen el resultado.
//   ffprobe: fichero inexistente → código 1; si no, la duración del nombre (…-1.5s.wav), RODAJE_MOCK_DURATION o 9.5.
//   ffmpeg: -version imprime y sale; RODAJE_MOCK_FFMPEG_FAIL=1 → «falla simulada» y código 1; salida '-' → 96×64 bytes
//   derivados del contenido de la entrada; otra salida → crea el último argumento.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const [bin,...argv]=process.argv.slice(2);const log=process.env.RODAJE_MOCK_LOG;
if(!log){process.stderr.write('shim-media: falta RODAJE_MOCK_LOG\n');process.exit(1);}
fs.appendFileSync(log,JSON.stringify({kind:'exec',bin,argv})+'\n');
const last=argv.at(-1);
if(bin==='ffprobe'){if(!last||!fs.existsSync(last)){process.stderr.write(`${last}: No such file or directory\n`);process.exit(1);}
 const m=path.basename(last).match(/-(\d+(?:\.\d+)?)s\.[A-Za-z0-9]+$/);process.stdout.write((m?m[1]:process.env.RODAJE_MOCK_DURATION||'9.5')+'\n');process.exit(0);}
if(argv.includes('-version')){process.stdout.write('ffmpeg version shim\n');process.exit(0);}
if(process.env.RODAJE_MOCK_FFMPEG_FAIL==='1'){process.stderr.write('falla simulada\n');process.exit(1);}
if(last==='-'){const input=argv[argv.indexOf('-i')+1];let h=createHash('sha256').update(fs.readFileSync(input)).digest();const out=[];while(out.length*32<96*64){out.push(h);h=createHash('sha256').update(h).digest();}process.stdout.write(Buffer.concat(out).subarray(0,96*64));process.exit(0);}
fs.mkdirSync(path.dirname(last),{recursive:true});fs.writeFileSync(last,'shim:ffmpeg:'+path.basename(last));
