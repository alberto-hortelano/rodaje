// Único lanzador de Chrome headless (issue #6): previews de la app, guías H3, capturas de entornos y línea base. Nunca importa app/.
// swiftshader = render por software, determinista. playwright se importa al lanzar, no al cargar el módulo.
export const CHROME_DEFAULT='/usr/bin/google-chrome';
export const CHROME_ARGS=Object.freeze(['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);
const vp=(width,height)=>Object.freeze({width,height});
// Cada llamador conserva su tamaño: 1280×720 guía H3 (→ 960×540), 1400×1300 y 1500×1100 calibración de cámara, 1280×800 línea base.
export const VIEWPORTS=Object.freeze({preview:vp(1280,720),guia:vp(1280,720),captura:vp(1400,1300),recorrido:vp(1500,1100),lineaBase:vp(1280,800)});
export const FIXED_NOW=1000;
export function chromePath(env=process.env){return env.CHROME_PATH||CHROME_DEFAULT;}
export function chromeArgs(extra=[]){return [...new Set([...CHROME_ARGS,...extra])];}
export function launchOptions({env=process.env,extraArgs=[],headless=true}={}){return {executablePath:chromePath(env),headless,args:chromeArgs(extraArgs)};}
export function contextOptions(viewport){return {viewport:{...viewport},deviceScaleFactor:1,serviceWorkers:'block'};}
export async function launchChrome(opts={}){const {chromium}=await import('playwright');return chromium.launch(launchOptions(opts));}
// Lanza, ejecuta fn(browser) y cierra siempre, también si fn lanza.
export async function withChrome(fn,opts={},launch=launchChrome){const browser=await launch(opts);try{return await fn(browser);}finally{await browser.close();}}
export function newRenderContext(browser,viewport){return browser.newContext(contextOptions(viewport));}
// Fija performance.now en la página o el contexto (renders de stage: guías, previews, ensayo). Nunca en entornos: el paseo usa el dt real.
export function pinClock(target,now=FIXED_NOW){return target.addInitScript(ms=>{performance.now=()=>ms;},now);}
