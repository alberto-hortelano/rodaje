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

**Chrome (`lib/chrome.mjs`).** Único lanzador de Chrome headless (previews de la app, guías de `scripts/bloques/render.mjs`, `scripts/entornos/{capturar,recorrer}.mjs` y `scripts/linea-base.mjs`): ruta `CHROME_PATH` o `/usr/bin/google-chrome`, flags `--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader`, `withChrome(fn)` cierra siempre, el viewport de cada llamador está en `VIEWPORTS` y `pinClock` fija `performance.now` en los renders del ensayo (nunca en los entornos, cuyo paseo usa el tiempo real). La boca del que habla depende del tiempo del plano, no del reloj; un test impide lanzar Chrome fuera de este módulo.

## Contrato de proyecto

Un proyecto contiene:
- `proyecto.json`: la fuente de verdad. Las carpetas `personajes/`, `ambientes/`, `capitulos/` y `storyboards/` tienen ficheros derivados que se regeneran desde ahí.
- `registro.json`, `REGLAS.md` (solo las reglas propias del proyecto; las generales están en `docs/REGLAS.md`) y `fusiones.json`.
- Texto propio: `biblia/`, `guion/`, `ideas/`, `MAPA.md`, `capitulos/*/escenas/*.json`.
- Lotes: `assets/<lote>/<bloque>/` con prompts, `refs.json` y `attempts.json`; `assets/<lote>/direccion.json` opcional por lote (modo fotograma, lo aplica `scripts/bloques/prompt.mjs`).
- Binarios ignorados por git: imágenes, vídeo, audio y GLB.

**Hay dos tipos de código permitido, los dos declarados en `environments[]`**: los constructores de escenario (`builder`) y los plugins del visor (`viewer.plugins`).

```js
export function build(T, data, kit) { … return group }   // T = three, data = model.json, kit = viewer/kit
export function plugin(api) { … return hooks }            // api del visor genérico (viewer/mount.mjs)
```

- Sin `import`, `require`, `document`, `window`, `process`, `fetch`, `eval` ni `globalThis`. El constructor solo exporta `build`; el plugin solo exporta `plugin`, síncrono, y es obligatorio.
- Todo lo genérico (materiales, texturas, visor, paseo) lo da la app: al constructor a través de `kit` y al plugin a través de `api`.
- `environments[].viewer` es `{plugins: [...], …opciones}`: rutas `.js`/`.mjs` del proyecto y opciones del visor. `viewer.walk` (opcional) ajusta el paseo: `{eye, step, radius, walkSpeed, flySpeed, run, maxDrop}`, solo números (por defecto `step` 0,3 y `radius` 0,32; lo demás, los de `createWalker`); una clave desconocida es un error. Durante la transición la app tolera un texto (visor propio del proyecto) hasta #36; `proyecto-check` lo sigue marcando como R-manifest.

El proyecto de un script se resuelve con `lib/cli.mjs` (`cliProject`, sobre `resolveProject` de `lib/paths.mjs`), por este orden: `--project <id>`, el argumento posicional donde el script ya lo tenía, `RODAJE_PROJECT` y, en cuarto lugar, el proyecto activo en la app. El activo vive en `<DATA>/.activo.json` (`lib/proyecto-activo.mjs`) y solo lo escribe el servidor: `POST /api/active` (con token) al abrir un proyecto en la vista Proyectos, y al crear uno; las recargas con `?project=` y `movil.html` no lo cambian. Los scripts imprimen `Proyecto: X (fuente)` en stderr y, sin proyecto, salen con el uso y código 2 sin tocar el disco (`app/store.mjs` ya no crea `DATA` al importarse; la crea `app/jobs.mjs` al arrancar el servidor). Ningún código de la app contiene ids de proyecto.

`scripts/proyecto-check.mjs` hace cumplir este contrato. A los plugins les aplica R-code (un plugin declarado no cuenta como código suelto), R-builder (contenido: mismas prohibiciones, único export `plugin`) y R-manifest (declaración: lista de rutas, dentro del proyecto, existentes y `.js`/`.mjs`).

**Editor de plantas** (`viewer/planta.html` + `viewer/planta.mjs`). Editor genérico de siluetas 2D para cualquier entorno con constructor (`builder` + `data`); se abre desde la vista del entorno («Editar planta», `/viewer/planta.html?project=…&env=…`). La planta vive solo en los datos del entorno (`env.data` → `dims.planta`). `viewer/planta.mjs` es lógica pura compartida por navegador y servidor: mover/añadir/quitar vértices manteniendo `lados` alineados, encuadre y `validarPlanta`. `GET /api/planta?project&environment` la lee y `POST /api/planta` (token y origen como el resto) la guarda mediante `lib/planta.mjs`. Este toma la ruta siempre de `proyecto.json` con `safe()` (nunca del cliente), valida contra la del disco y exige la misma `revision` (409 si no coincide). Sustituye solo el tramo de texto de `dims.planta` (`replaceJsonValue` de `lib/json.mjs`), así que el resto del fichero no cambia; sube `revision` en uno y escribe de forma atómica. No invalida aprobaciones ni regenera el GLB (#30).

### Plugins del visor

La app abre un entorno así: `viewer` como texto → visor propio del proyecto (legado); `builder` y `data` → `/viewer/mount.mjs`; solo `glb` → `/viewer/glb.mjs`. El visor genérico no sabe nada de ningún escenario: luces, niebla, fondo, cortes, piezas atravesables, entrada del paseo y vista general van en los plugins del proyecto (`ambientes/<id>/3d/visor.js`). Sin plugins pone un fondo `#b9c0c4`, luces como el visor GLB y encuadra la caja del modelo.

El visor importa todos los plugins por `/api/asset` antes de montar; si alguno no exporta `plugin`, el entorno no se abre. Monta el DOM, el renderer, una escena vacía, la cámara y los controles; llama a `plugin(api)` de cada uno en orden (las luces del plugin entran antes que el modelo); completa fondo y luces si faltan; prepara colisión y caminante; construye y va a la vista general.

`api`:
- `T`, `scene`, `camera`, `controls`, `renderer`; `data` (`model.json`), `environment` (la entrada del manifiesto), `options` (`viewer` sin `plugins`).
- `model` (el grupo construido), `state` y `setState(next)`, `mode` (`'orbit'` o `'walk'`), `setWalk(on)`, `setView(id)` (→ `true` si lo atiende un plugin o un lugar, `false` si no existe), `overview()`, `walker` (el caminante; `null` mientras corre `plugin(api)`, se crea después), `noclip` y `setNoclip(on)` (mantiene sincronizado el botón «No clip»).
- `ui.button({a, text, pressed}, onClick)`: botón en la barra tras «Vista general», en orden de llamada; devuelve `{pressed, text}` con setters. Un `data-a` del visor o repetido es un error.
- `ui.action(a, fn)` para `[data-a]` de paneles; `ui.note(text)`, `ui.hint(text)`; `ui.panel({title, html})` y `ui.overlay(html)` devuelven `{el, set(html)}`: `el` es el cuerpo del panel o la capa (un minimapa pone un `<canvas>` en la capa y dibuja con `el.querySelector('canvas').getContext('2d')`).

Modos: el visor solo tiene `orbit` y `walk`. Estados propios del escenario (dentro/fuera, planos, mapa) los lleva el plugin: dentro de `walk`, como estado de su caminante; un mapa es `orbit` con `overview`/`onOverview` y el dibujo en `onFrame` cuando `mode === 'orbit'`; `onMode` cambia luces o visibilidad. Al salir del paseo el visor repone `camera.up` a (0, 1, 0).

Hooks (todos opcionales; uno desconocido es un error). Con varios plugins se llama a todos, en orden, salvo donde se indica:
- `onBuild(model)` tras cada construcción; `onSky(tx)` tras poner el cielo; `onOverview()` antes de ir a la vista general; `onView(mark, {mode})` antes de mover la cámara a un lugar; `onFrame(dt, {mode})` en cada fotograma; `dispose()`.
- `onMode(mode)` justo después de cambiar de modo en `setWalk` (`'orbit'` o `'walk'`).
- `overview()` → `{position, target, text?}`, `spawn()` → `{position, lookAt}`, `collision({T, step, radius, skip, options})` → `{collect, groundAt, blocked}` y `walker({T, camera, collision, options})` → caminante: gana el primero que devuelve algo.
- `onKey(key, {down, repeat, mode})` y `view(id, {mode})`: se paran en el primero que devuelve `true`. `onKey` recibe la tecla en minúsculas en keydown y keyup; con `true` el visor la consume. `view` se prueba antes que `data.landmarks` en `setView` y en los botones `data-mark`.
- `passable(obj)`: basta con que uno diga sí; se prueba en cada antepasado de la malla.
- `expose: {…}`: métodos y getters que se añaden a `window.rodaje.environment` (se copian como descriptores: un `get x()` sigue vivo; usa variables del plugin, no `this`); no pueden pisar los del visor.

Teclado: el visor no interpreta las teclas del paseo. Con el foco en `input`, `select`, `textarea` o un elemento editable no hace nada (salvo soltar la tecla en keyup). Si no, primero `onKey`; si ninguno la consume y el modo es `walk`, la tecla entra en `walker.keys` cuando está en `walker.walkKeys` (por defecto las de `WALK_KEYS`). Al perder el foco la ventana se sueltan todas.

Contrato del caminante (`checkWalker`; el de `createWalker` lo cumple): `{keys: Set, walkKeys?: string[], noclip (escribible), eye (número), place(x, y, z), aim(from, to), look(dx, dy), update(dt), walk(keys, seconds) → posición}`. El visor llama a `collision.collect(model)` al entrar en el paseo; un caminante propio puede ignorarlo y leer el modelo por `api.model` u `onBuild`. El de `createWalker` baja y sube con Q/E en «no clip»; un plugin que use otras teclas declara las suyas en `walkKeys`.

**root.userData: datos de ejecución del visor.** Un constructor puede dejar en `root.userData.<clave>` lo que su visor necesita en tiempo de ejecución (volúmenes, colisiones, puertas, kits…). Debe ser serializable (números finitos, textos, booleanos, arrays y objetos planos) y referirse a los nodos por su nombre (únicos), nunca por referencia a objetos de three. El visor lo rehidrata una vez (Matrix4.fromArray, Vector3). Al exportar a GLB (botón del visor y `exportGlb` de `lib/entorno3d.mjs`) la raíz conserva solo las claves de `GLB_USERDATA` (`state`, `units`; `viewer/plugins.mjs`) y el resto no llega a `extras`; los hijos no se tocan y la raíz recupera su `userData` tras exportar. Ejemplo: un constructor deja en `userData.ship` volúmenes y puertas, y el plugin `visor.js` de su entorno los lee.

**Recorrido (`walkthrough` en `model.json`).** Lo ejecuta `scripts/entornos/recorrer.mjs` contra la app arrancada. Cada paso: `{label, walk?, view?, position?, yawDeg?, noclip?, keys?, seconds?, call?, args?, expect?, tolerance?, snapshot?}`. `call` es un método o getter de `window.rodaje.environment` (nombre simple, nunca `dispose`), con `args` solo si es un método; el valor del paso es el de `call` o, si no hay, la posición tras `keys` o la de la cámara. `expect` se compara con ese valor (`matchExpect`: objetos parciales, listas elemento a elemento, números con `tolerance`, por defecto 1e-6). El paso falla si su `view` no existe, si `call` falla o si no cumple `expect`; el script imprime `OK` o `FALLO: …` por paso y sale con 1 si falla alguno o hay errores en la página.

**Texturas teñidas.** `kit.applyImageTextures(defs)` con `defs[clave] = {file, tile, anisotropy?, image?, sky?, hide?, tint?}`: con `tint: true` la imagen se multiplica por el color del material (se conserva `color`). Sin `tint` el color pasa a blanco, como hasta ahora. Varias variantes de color pueden compartir así una misma imagen, siempre que usen la clave de la textura en `kit.mat(clave, {color})`.

### El tercer argumento: `kit`

El visor, el ensayo y los scripts crean un kit nuevo en cada construcción con `createKit(T, {state, textures, textureUrl, onSky})` (`viewer/kit.mjs`, sin imports, funciona en Node) y lo pasan como tercer argumento. Todo llega por ahí:
- `kit.state`: el estado pedido (preset, secuencia o controles del visor), sin mezclar; el constructor lo combina con su estado por defecto: `{...data.defaultState, ...kit.state}`. El visor arranca con una copia de `data.defaultState` (`initialState`); el constructor no exporta estado propio.
- `kit.textures`: `true` si se quieren texturas procedurales y de canvas; en Node o al exportar GLB es `false` y no se crea ningún canvas (`kit.canvas` devuelve `null`).
- `kit.textureUrl(file)`: resuelve las imágenes de `data.textures` respecto a la carpeta de `data`; `kit.onSky(tx)` recibe la del cielo. El constructor solo llama a `kit.applyImageTextures(data.textures)`.
- Herramientas: `mat`, `group`, `box`, `boxGeometry`, `merge`, `canvas`, `wall`, `gableRoof`, `cyl`, `uvMeters`, `scaleUV`, `proceduralTextures`, `loadTexture` y los helpers de polígono. La paleta y la tesela las fija el constructor con `kit.configure({palette, tile})`.
  - `kit.canvas(w, h, draw, {repeat, wrap, anisotropy, colorSpace})`: `CanvasTexture` dibujada una vez con `draw(ctx, w, h)`, o `null` sin `document` o con `textures:false`. Convención: si da `null`, el constructor omite las piezas que son solo textura (rótulos, placas); el resto queda con color liso.
  - `kit.merge(geometries, {groups})`: como `mergeGeometries` de three/examples (atributos no entrelazados, sin morph); `null` si no son compatibles. El constructor no importa nada de three/examples.
  - `kit.boxGeometry(xr, yr, zr, {tile, matrix})`: la caja de `box` como geometría ya colocada (sin malla) para fusionarla; `matrix` (la del padre) se premultiplica y `tile: 0` deja la UV en 0–1 por cara. `box(…, m, {tile})` admite también una tesela por llamada.
  - `kit.mat(key, extra)`: `extra` admite cualquier parámetro de `MeshStandardMaterial` (`side`, `emissive`, `metalness`, `transparent`, `opacity`, `depthWrite`, `color`…). Un `map` explícito, textura o `null`, gana a la textura procedural y conserva el color; las texturas cuentan en la caché por su `uuid`. Como conserva el color de la paleta, la textura sale teñida: para verla tal cual, pasa también `color: '#ffffff'`.
  - `applyImageTextures` admite `anisotropy` por textura (por defecto, la de `loadTexture`: 8).
  - `uvMeters(geo, 0)` y `scaleUV(geo, 0)` dejan la UV sin escalar.

`state`, `textures`, `textureUrl` y `onSky` son datos de solo lectura con los mismos nombres que el antiguo objeto de opciones: un constructor antiguo funciona igual si recibe un kit. No hay cuarto argumento y `data` (`model.json`) no se modifica. No confundir con `locations[].modelSpace.kit`, que es una lista de piezas.
