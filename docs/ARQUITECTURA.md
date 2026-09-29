# Arquitectura

Rodaje es una **aplicación**. Los **proyectos** (series, películas) son datos que la aplicación abre.

## Repositorios

- `rodaje/`: la aplicación (código, docs, skills y agentes). Ignora `proyectos/`.
- `proyectos/<id>/`: un repositorio por proyecto. Solo versiona texto; los binarios se ignoran.

## Aplicación

Estado objetivo; las issues de GitHub lo van completando.

```
app/      servidor HTTP, persistencia (store), trabajos, montaje, funciones puras (workflow) y UI (*.source.js → app.js)
lib/      núcleo compartido de Node: rutas y proyecto activo, JSON atómico, argumentos, ffmpeg, fal, TTS, Chrome, lotes, validador de proyectos
viewer/   3D de navegador (kit, visor de entornos, plugins, paseo, visor GLB, editor de plantas), servido en /viewer/<ruta>; detalle en docs/visor-3d.md
scripts/  CLIs finos sobre lib/
docs/     documentación de la aplicación y del proceso de producción
```

**Proveedores (`lib/fal.mjs`, `lib/tts.mjs`).** `lib/fal.mjs` resuelve la clave y crea el cliente de fal.ai para la app y los scripts. Precedencia de `falKey()`: `config.local.json` (`falKey` o `FAL_KEY`) > `FAL_KEY` del entorno > `FAL_KEY` de `.env`; nunca muta `process.env`. Ambos ficheros se leen de `RODAJE_CONFIG_DIR` (por defecto, la raíz del repositorio; la suite la apunta a una carpeta temporal vacía). Ofrece envoltorios genéricos de subida (`uploadFile`, con Content-Type solo si el llamador lo da), cola (`submit`, `status`, `result`), `subscribe`, `outputUrl` y `download` (comprueba `res.ok`). H3, nano-banana y openrouter los usan tal cual. `lib/tts.mjs` agrupa voz y efectos: eleven-v3, sound-effects v2, voice-changer, MiniMax speech-02-hd y voice-design, con sus constructores de input y `speak`, `changeVoice` y `designVoice`. ElevenLabs va solo a través de fal (`fal-ai/elevenlabs/…`), por los derechos comerciales; un test impide llamadas directas a su API. `app/jobs.mjs` sigue exportando `settings` y `settingsFile`, y `scripts/bloques/lib.mjs` reexporta `falClient`. Ningún módulo de `lib/` importa `app/`.

**Vista Animación (`app/anim.source.js`, #50).** Edita `t.cameraRig` de un plano sobre `createStage` con un reloj propio: la lógica (reloj, líneas, muestreo y recorte de la pista, edición del rig, voz por personaje) son funciones puras de `app/workflow.mjs`; la vista solo pinta, llama a `stage.pose(t, false)`, `stage.setCamera(cameraAt(…))` y `stage.orbit(on)`, y guarda con el `save()` de siempre. Detalle en `docs/ensayo-3d.md`.

**Chrome (`lib/chrome.mjs`).** Único lanzador de Chrome headless (previews de la app, guías de `scripts/bloques/render.mjs`, `scripts/entornos/{capturar,recorrer}.mjs` y `scripts/linea-base.mjs`): ruta `CHROME_PATH` o `/usr/bin/google-chrome`, flags `--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader`, `withChrome(fn)` cierra siempre, el viewport de cada llamador está en `VIEWPORTS` y `pinClock` fija `performance.now` en los renders del ensayo (nunca en los entornos, cuyo paseo usa el tiempo real). La boca del que habla depende del tiempo del plano, no del reloj; un test impide lanzar Chrome fuera de este módulo.

## Contrato de proyecto

Un proyecto contiene:
- `proyecto.json`: la fuente de verdad. Las carpetas `personajes/`, `ambientes/`, `capitulos/` y `storyboards/` tienen ficheros derivados que se regeneran desde ahí.
- `registro.json`, `REGLAS.md` (solo las reglas propias del proyecto; las generales están en `docs/REGLAS.md`) y `fusiones.json`.
- Texto propio: `biblia/`, `guion/`, `ideas/`, `MAPA.md`, `capitulos/*/escenas/*.json`.
- Animáticas del storyboard: `storyboards/<id>/animaticas/` no es derivada (no se regenera desde `proyecto.json`): `index.json` es texto versionado en el repositorio del proyecto y sus mp4 se ignoran como los demás binarios. Solo la escribe `lib/animaticas.mjs` (`scripts/storyboard-animatica.mjs` y el trabajo `animatic` de la app); nunca sobrescribe una versión.
- Lotes: `assets/<lote>/<bloque>/` con prompts, `refs.json` y `attempts.json`; `assets/<lote>/direccion.json` opcional por lote (modo fotograma, lo aplica `scripts/bloques/prompt.mjs`).
- Binarios ignorados por git: imágenes, vídeo, audio y GLB.

**Hay dos tipos de código permitido, los dos declarados en `environments[]`**: los constructores de escenario (`builder`) y los plugins del visor (`viewer.plugins`).

```js
export function build(T, data, kit) { … return group }   // T = three, data = model.json, kit = viewer/kit
export function plugin(api) { … return hooks }            // api del visor genérico (viewer/mount.mjs)
```

- Sin `import`, `require`, `document`, `window`, `process`, `fetch`, `eval` ni `globalThis`. El constructor solo exporta `build`; el plugin solo exporta `plugin`, síncrono, y es obligatorio.
- Todo lo genérico (materiales, texturas, visor, paseo) lo da la app: al constructor a través de `kit` y al plugin a través de `api` (los dos en `docs/visor-3d.md`).
- `environments[].viewer` es `{plugins, …opciones}`. Como texto ya no se admite: la app no lo abre y R-manifest lo da como error.

Visor 3D (kit, plugins, paseo, editor de plantas): `docs/visor-3d.md`.

El proyecto de un script se resuelve con `lib/cli.mjs` (`cliProject`, sobre `resolveProject` de `lib/paths.mjs`), por este orden: `--project <id>`, el argumento posicional donde el script ya lo tenía, `RODAJE_PROJECT` y, en cuarto lugar, el proyecto activo en la app. El activo vive en `<DATA>/.activo.json` (`lib/proyecto-activo.mjs`) y solo lo escribe el servidor: `POST /api/active` (con token) al abrir un proyecto en la vista Proyectos, y al crear uno; las recargas con `?project=` y `movil.html` no lo cambian. Los scripts imprimen `Proyecto: X (fuente)` en stderr y, sin proyecto, salen con el uso y código 2 sin tocar el disco (`app/store.mjs` ya no crea `DATA` al importarse; la crea `app/jobs.mjs` al arrancar el servidor). Ningún código de la app contiene ids de proyecto.

`scripts/proyecto-check.mjs` hace cumplir este contrato. A los plugins les aplica R-code (un plugin declarado no cuenta como código suelto), R-builder (contenido: mismas prohibiciones, único export `plugin`) y R-manifest (declaración: lista de rutas, dentro del proyecto, existentes y `.js`/`.mjs`).
