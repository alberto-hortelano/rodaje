// Argumentos de CLI: --clave valor (o true si no sigue valor) en opts; el resto, en orden, en args.
export function parseArgs(argv){const args=[],opts={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2);const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;opts[k]=v;}else args.push(a);}return {args,opts};}
