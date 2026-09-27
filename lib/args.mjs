// Argumentos de CLI: --clave valor (o true si no sigue valor) en opts; el resto, en orden, en args.
export function parseArgs(argv){const args=[],opts={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2);const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;opts[k]=v;}else args.push(a);}return {args,opts};}
// Saca de argv (lo muta) «name valor» o «name» suelto: devuelve el valor, true si no le sigue valor (o le sigue otra --opción) o undefined si no está.
export function takeOption(argv,name){const i=argv.indexOf(name);if(i<0)return undefined;const next=argv[i+1],v=next!==undefined&&!next.startsWith('--')?next:true;argv.splice(i,v===true?1:2);return v;}
