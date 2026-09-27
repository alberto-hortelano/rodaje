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
viewer/   3D de navegador: kit de construcción, visor de entornos, paseo y colisiones, visor GLB, editor de plantas; se sirve en /viewer/<ruta> (kit.mjs; mount.mjs, visor de entornos con constructor; walk.mjs, paseo y colisión inyectable; plugins.mjs, contrato de plugins; glb.mjs)
scripts/  CLIs finos sobre lib/
docs/     documentación de la aplicación y del proceso de producción
```

**Proveedores (`lib/fal.mjs`, `lib/tts.mjs`).** `lib/fal.mjs` resuelve la clave y crea el cliente de fal.ai para la app y los scripts. Precedencia de `falKey()`: `config.local.json` (`falKey` o `FAL_KEY`) > `FAL_KEY` del entorno > `FAL_KEY` de `.env`; nunca muta `process.env`. Ambos ficheros se leen de `RODAJE_CONFIG_DIR` (por defecto, la raíz del repositorio; la suite la apunta a una carpeta temporal vacía). Ofrece envoltorios genéricos de subida (`uploadFile`, con Content-Type solo si el llamador lo da), cola (`submit`, `status`, `result`), `subscribe`, `outputUrl` y `download` (comprueba `res.ok`). H3, nano-banana y openrouter los usan tal cual. `lib/tts.mjs` agrupa voz y efectos: eleven-v3, sound-effects v2, voice-changer, MiniMax speech-02-hd y voice-design, con sus constructores de input y `speak`, `changeVoice` y `designVoice`. ElevenLabs va solo a través de fal (`fal-ai/elevenlabs/…`), por los derechos comerciales; un test impide llamadas directas a su API. `app/jobs.mjs` sigue exportando `settings` y `settingsFile`, y `scripts/bloques/lib.mjs` reexporta `falClient`. Ningún módulo de `lib/` importa `app/`.

## Contrato de proyecto

Un proyecto contiene:
- `proyecto.json`: la fuente de verdad. Las carpetas `personajes/`, `ambientes/`, `capitulos/` y `storyboards/` tienen ficheros derivados que se regeneran desde ahí.
- `registro.json`, `REGLAS.md` (solo las reglas propias del proyecto; las generales están en `docs/REGLAS.md`) y `fusiones.json`.
- Texto propio: `biblia/`, `guion/`, `ideas/`, `MAPA.md`, `capitulos/*/escenas/*.json`.
- Lotes: `assets/<lote>/<bloque>/` con prompts, `refs.json` y `attempts.json`.
- Binarios ignorados por git: imágenes, vídeo, audio y GLB.

**Hay dos tipos de código permitido, los dos declarados en `environments[]`**: los constructores de escenario (`builder`) y los plugins del visor (`viewer.plugins`).

```js
export function build(T, data, kit) { … return group }   // T = three, data = model.json, kit = viewer/kit
export function plugin(api) { … return hooks }            // api del visor genérico (viewer/mount.mjs)
```

- Sin `import`, `require`, `document`, `window`, `process`, `fetch`, `eval` ni `globalThis`. El constructor solo exporta `build`; el plugin solo exporta `plugin`, síncrono, y es obligatorio.
- Todo lo genérico (materiales, texturas, visor, paseo) lo da la app: al constructor a través de `kit` y al plugin a través de `api`.
- `environments[].viewer` es `{plugins: [...], …opciones}`: rutas `.js`/`.mjs` del proyecto y opciones del visor. Durante la transición la app tolera un texto (visor propio del proyecto) hasta #11 (caserón) y #14 (nave); `proyecto-check` lo sigue marcando como R-manifest.

El proyecto de un script se resuelve con `lib/cli.mjs` (`cliProject`, sobre `resolveProject` de `lib/paths.mjs`), por este orden: `--project <id>`, el argumento posicional donde el script ya lo tenía, `RODAJE_PROJECT` y, en cuarto lugar, el proyecto activo en la app. El activo vive en `<DATA>/.activo.json` (`lib/proyecto-activo.mjs`) y solo lo escribe el servidor: `POST /api/active` (con token) al abrir un proyecto en la vista Proyectos, y al crear uno; las recargas con `?project=` y `movil.html` no lo cambian. Los scripts imprimen `Proyecto: X (fuente)` en stderr y, sin proyecto, salen con el uso y código 2 sin tocar el disco (`app/store.mjs` ya no crea `DATA` al importarse; la crea `app/jobs.mjs` al arrancar el servidor). Ningún código de la app contiene ids de proyecto.

`scripts/proyecto-check.mjs` hace cumplir este contrato. A los plugins les aplica R-code (un plugin declarado no cuenta como código suelto), R-builder (contenido: mismas prohibiciones, único export `plugin`) y R-manifest (declaración: lista de rutas, dentro del proyecto, existentes y `.js`/`.mjs`).

### Plugins del visor

La app abre un entorno así: `viewer` como texto → visor propio del proyecto (legado); `builder` y `data` → `/viewer/mount.mjs`; solo `glb` → `/viewer/glb.mjs`. El visor genérico no sabe nada de ningún escenario: luces, niebla, fondo, cortes, piezas atravesables, entrada del paseo y vista general van en los plugins del proyecto (`ambientes/<id>/3d/visor.js`). Sin plugins pone un fondo `#b9c0c4`, luces como el visor GLB y encuadra la caja del modelo.

El visor importa todos los plugins por `/api/asset` antes de montar; si alguno no exporta `plugin`, el entorno no se abre. Monta el DOM, el renderer, una escena vacía, la cámara y los controles; llama a `plugin(api)` de cada uno en orden (las luces del plugin entran antes que el modelo); completa fondo y luces si faltan; prepara colisión y caminante; construye y va a la vista general.

`api`:
- `T`, `scene`, `camera`, `controls`, `renderer`; `data` (`model.json`), `environment` (la entrada del manifiesto), `options` (`viewer` sin `plugins`).
- `model` (el grupo construido), `state` y `setState(next)`, `mode` (`'orbit'` o `'walk'`), `setWalk(on)`, `setView(id)`, `overview()`, `walker` (`viewer/walk.mjs`).
- `ui.button({a, text, pressed}, onClick)`: botón en la barra tras «Vista general», en orden de llamada; devuelve `{pressed, text}` con setters. Un `data-a` del visor o repetido es un error.
- `ui.action(a, fn)` para `[data-a]` de paneles; `ui.note(text)`, `ui.hint(text)`; `ui.panel({title, html})` y `ui.overlay(html)` devuelven `{set(html)}`.

Hooks (todos opcionales; uno desconocido es un error). Con varios plugins se llama a todos, en orden, salvo donde se indica:
- `onBuild(model)` tras cada construcción; `onSky(tx)` tras poner el cielo; `onOverview()` antes de ir a la vista general; `onView(mark, {mode})` antes de mover la cámara a un lugar; `onFrame(dt, {mode})` en cada fotograma; `dispose()`.
- `overview()` → `{position, target, text?}`, `spawn()` → `{position, lookAt}` y `collision({T, step, radius, skip})` → `{collect, groundAt, blocked}`: gana el primero que devuelve algo.
- `passable(obj)`: basta con que uno diga sí; se prueba en cada antepasado de la malla.
- `expose: {…}`: métodos que se añaden a `window.rodaje.environment`; no pueden pisar los del visor.

### El tercer argumento: `kit`

El visor, el ensayo y los scripts crean un kit nuevo en cada construcción con `createKit(T, {state, textures, textureUrl, onSky})` (`viewer/kit.mjs`, sin imports, funciona en Node) y lo pasan como tercer argumento. Todo llega por ahí:
- `kit.state`: el estado pedido (preset, secuencia o controles del visor), sin mezclar; el constructor lo combina con su estado por defecto: `{...data.defaultState, ...kit.state}`.
- `kit.textures`: `true` si se quieren texturas procedurales; en Node o al exportar GLB es `false` y no se crea ningún canvas.
- `kit.textureUrl(file)`: resuelve las imágenes de `data.textures` respecto a la carpeta de `data`; `kit.onSky(tx)` recibe la del cielo. El constructor solo llama a `kit.applyImageTextures(data.textures)`.
- Herramientas: `mat`, `group`, `box`, `wall`, `gableRoof`, `cyl`, `uvMeters`, `scaleUV`, `proceduralTextures`, `loadTexture` y los helpers de polígono. La paleta y la tesela las fija el constructor con `kit.configure({palette, tile})`.

`state`, `textures`, `textureUrl` y `onSky` son datos de solo lectura con los mismos nombres que el antiguo objeto de opciones: un constructor antiguo funciona igual si recibe un kit. No hay cuarto argumento y `data` (`model.json`) no se modifica. No confundir con `locations[].modelSpace.kit`, que es una lista de piezas.
