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

**Animación 3D de una viñeta (trabajo `anim3d`, #51).** `app/jobs.mjs` renderiza el plano de la instantánea (el que enlaza la viñeta por `storyboardShot`) con la misma captura que la previsualización (`captureFrames`: `render.html` con `/api/render-data`, 1280×720, 24 fps y `pinClock`), sin rótulos de nombre, en serie con `preview` y `export`. `/api/render-data` le da la secuencia con la `location` del plano (`stageSequence`, la misma que usa la vista Animación). `enqueue` lo rechaza si `anim3dReady` da errores (sin viñeta, duración o cámara no válidas). No toca `proyecto.json`: `lib/animacion3d.mjs` mezcla las voces con audio (silencio en el resto, sin ambiente; lo que falta o se sale queda en avisos), codifica, coloca `storyboards/<id>/animacion-3d/<código>-vNN.mp4` sin sobrescribir (desde un `.part.mp4`) y añade la entrada a su `index.json`. `GET /api/storyboard-anim3d?project&storyboard` devuelve esos vídeos por viñeta (`anim3dGroups`). El plano lo crea `scripts/storyboard-3d.mjs`, con la misma fusión (`mergeStoryboardShot`) que `scripts/storyboard-a-secuencia.mjs`.

**Chrome (`lib/chrome.mjs`).** Único lanzador de Chrome headless (previews de la app, guías de `scripts/bloques/render.mjs`, `scripts/entornos/{capturar,recorrer}.mjs` y `scripts/linea-base.mjs`): ruta `CHROME_PATH` o `/usr/bin/google-chrome`, flags `--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader`, `withChrome(fn)` cierra siempre, el viewport de cada llamador está en `VIEWPORTS` y `pinClock` fija `performance.now` en los renders del ensayo (nunca en los entornos, cuyo paseo usa el tiempo real). La boca del que habla depende del tiempo del plano, no del reloj; un test impide lanzar Chrome fuera de este módulo.

## Contrato de proyecto

Un proyecto contiene:
- `proyecto.json`: la fuente de verdad. Las carpetas `personajes/`, `ambientes/`, `capitulos/` y `storyboards/` tienen ficheros derivados que se regeneran desde ahí.
- `registro.json`, `REGLAS.md` (solo las reglas propias del proyecto; las generales están en `docs/REGLAS.md`) y `fusiones.json`.
- Texto propio: `biblia/`, `guion/`, `ideas/`, `MAPA.md`, `capitulos/*/escenas/*.json`.
- Animáticas del storyboard: `storyboards/<id>/animaticas/` no es derivada (no se regenera desde `proyecto.json`): `index.json` es texto versionado en el repositorio del proyecto y sus mp4 se ignoran como los demás binarios. Solo la escribe `lib/animaticas.mjs` (`scripts/storyboard-animatica.mjs` y el trabajo `animatic` de la app); nunca sobrescribe una versión.
- Animación 3D de las viñetas: `storyboards/<id>/animacion-3d/` igual: `index.json` versionado (entradas `{file, name, version, at, duration, storyboardShot, episode, sequence, shot, job, warnings}`) y mp4 ignorados. Solo la escribe el trabajo `anim3d` (`lib/animacion3d.mjs`); un trabajo interrumpido puede dejar un `.part.mp4`, que la versión siguiente salta.
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

### Escaleta, storys y planos (#56)

Una sola lista `episodes[].sequences[]`; el papel de cada secuencia se deduce (`sequenceRole` de `app/workflow.mjs`):

- **Ficha de escaleta**: la secuencia de la escaleta (carátula, texto, minutos). Es el papel por defecto.
- **Secuencia de planos de un story** (contenedor): la que tiene `storyboard` de un story enlazado a su ficha. Cada versión del story tiene la suya; nunca se mezclan planos de dos storys.
- **Prueba**: `test: true`. Sale de la escaleta a un grupo propio.

Campos, todos opcionales:

| Campo | Dónde | Qué es |
|---|---|---|
| `outlineSequence` | `storyboards[]` | Id de la ficha del story. Único enlace story → secuencia. |
| `version` | `storyboards[]` | Entero ≥ 1, único en su ficha; si falta, el primer número libre en el orden de `storyboards`. |
| `currentStoryboard` | ficha | El story vigente; debe estar enlazado a esa ficha (así no puede haber dos vigentes). |
| `test` | secuencia | Solo `true`. |
| `sceneNumber` | secuencia | Número de escena del lote (`escenas/sNN.json`); lo escribe la migración para que insertar fichas no cambie la escena de un lote. |
| `storyboard` | secuencia | El de siempre: el story cuyos planos contiene. |

Un story sin `outlineSequence` funciona como antes (su secuencia con `storyboard` es a la vez ficha y planos), así que un proyecto sin migrar no cambia. `outlineTree` da actos → fichas → storys (versión, vigente, secuencia de planos), las pruebas y los storys sin ficha; `outline` son sus fichas en filas (numeración y «Generar carátulas que faltan»). `storyPlansTarget` y `applyStoryPlans` deciden dónde van los planos de un story (`storyboard-a-secuencia`, `storyboard-3d` y «Crear/actualizar planos del story»). `storyModelIssues` da los errores, que rechazan `store.validate` y R-storys de `check:proyectos` (enlace a una secuencia inexistente, a una prueba o a una secuencia de planos; vigente que no es de la ficha; dos secuencias de planos de un story; planos que enlazan viñetas de otro story; versión repetida o no entera; `test` distinto de `true`), y los avisos, solo en `check:proyectos` (story inexistente, ficha con storys sin vigente, planos en otro acto que su ficha, ficha con storys y planos propios). La migración de datos existentes es `scripts/migrar-storys.mjs` (`docs/scripts.md`); no cambia ids de secuencia ni digests de planos.

La interfaz (#57) navega este modelo con `treeModel`, que deriva de `outlineTree` y baja hasta escenas, viñetas y planos (por `storyboardShot`), y con `shotGroups` para la vista Planos; ninguna de las dos escribe. El estado de la interfaz (nodos abiertos, versión mostrada, escena enfocada) vive en la URL, `localStorage` o `sessionStorage`, nunca en `proyecto.json`; lo único que la navegación escribe es «Marcar como vigente» (`setCurrentStory`). Rutas y alias en `docs/UI.md`.

### Relaciones (#58)

`app/workflow.mjs`, sección «Relaciones». Funciones puras que no escriben; el navegador las carga tal cual.

**Hablante.** `resolveSpeaker(p, entry)` (y `speakerResolver(p)`, que construye el mapa una vez) es el único resolutor de quién dice una línea `{character?, who?}`: `character` si es el id de un personaje; si no, `who` sin espacios alrededor y en minúsculas contra el id, el nombre completo o la primera palabra del nombre, y gana el primer personaje del proyecto que tenga esa clave; `who` vacío o sin coincidencia da `null`. Lo usan `storyboardShotDraft` (planos desde viñetas) y el guardado de la viñeta en la interfaz. Una línea sin personaje no pasa al plano, pero ya no se pierde en silencio: `storyboardSequenceMerge` (y con ella `applyStoryPlans`, «Crear/actualizar planos del story» y `storyboard-a-secuencia`), «Crear capítulo» y `storyboard-3d` la avisan, y `check:proyectos` da un aviso R-hablantes por línea. El remedio es crear el personaje (`scripts/perfil.mjs add`, de tipo `voice` si no tiene cuerpo) o corregir el nombre en la viñeta.

**Índice.** `relationIndex(p)` → `{revision, nodes, links, from, to, panelShots, shotPanel, sequenceShots, locationEnvironments, environmentLocations, unresolved, dangling}`; `relationIndexFor(p)` lo memoriza por objeto y `revision`. No añade campos al proyecto ni lee `environments[].sequences`.

- Nodos (`Map` clave → `{key, kind, id, order, parent, children, data, episode?, role?, sequence?, version?, current?}`) con las claves de `treeModel` (`relKey`): `act/<episodio>`, `seq/<secuencia>`, `sb/<story>`, `scene/<story>/<escena>`, y además `panel/<viñeta>`, `shot/<plano>`, `character/<id>`, `location/<id>` y `environment/<id>`. El árbol es el de `treeModel`: acto → ficha (y prueba) → story → escena → viñeta → plano; el contenedor de planos cuelga de su story y un plano sin viñeta, de su secuencia. `order` es el orden del proyecto (recorrido en profundidad); `panelShots` pone primero los planos del contenedor, luego los de pruebas y luego los de fichas.
- Pertenencia: cada plano guarda en `sequence` la clave de la secuencia que lo contiene, y `sequenceShots` (clave de secuencia → planos, en su orden) es el inverso. Como un plano enlazado cuelga de su viñeta en el árbol, un contenedor o una prueba solo llegan a esos planos por pertenencia: `descendants` y `relatedTo` de una secuencia incluyen sus planos (y lo que cuelga de ellos) y `holders(…, 'sequence')` devuelve, además de la ficha del árbol, la secuencia a la que pertenece el plano. `trail` sigue el árbol, sin pasar por el contenedor ni la prueba.
- Enlaces `{from, to, rel, via, …}`, indexados en `from` y `to`: `appears` (`panel.cast`; en un plano, `shotAppearance`: su `cast`, o `visibleCast` o el reparto de la secuencia más los proxies), `speaks` (`dialogue` resuelto con `resolveSpeaker`, con `channel`, `offscreen` —canal fuera de campo, hablante fuera del reparto de la viñeta o voz— y `line`, el índice; `lines` de un plano con `lineOffscreen` y el id de la línea), `location` (`scene.location`; la viñeta hereda la de su escena; `sequence.location`; el plano, `shot.location` o la de su secuencia) y `environment` (uno por cada entorno del ambiente enlazado, con `through` y `envVia`: `environment` por `location.environment` y `modelSpace` por `modelSpaceEnvironment`). Lo heredado lleva `inherited: true`.
- `unresolved`: líneas de viñeta sin personaje. `dangling`: referencias a ids que no existen (sin enlace).
- Consultas (`q = {rel?, current?, where?}`): `trail` (de la raíz al nodo), `descendants`, `relatedTo` (desde un nodo del árbol, los destinos de su subárbol; desde un personaje, ambiente o entorno, quién lo enlaza), `holders` (nodos de un tipo cuyo subárbol enlaza algo) y `linksTo`. Con `current`, bajo una ficha con story vigente los demás storys no cuentan para la ficha ni para el acto; la secuencia de pertenencia de un plano cuenta siempre. Desde un personaje, ambiente o entorno, `linksTo`/`relatedTo` con `current` dan el corte vigente estricto (ningún enlace cuya rama pase por un story no vigente), mientras que `holders` cuenta cada nodo para sí mismo: las apariciones por nivel de una página salen de `holders`.

**Apariciones (#60).** `appearanceTree(index, key, {current = true, rel, inherited = true})` → `{target, total, roots}`: los enlaces que llegan a un personaje (`appears` y `speaks`), un ambiente (`location`) o un entorno (`environment`) según `linksTo`, colgados de su `trail` y fusionados por clave. Cada nodo `{key, kind, id, label, order, route, role?, version?, current?, stale?, marks, counts, children}` lleva su ruta de la app (`parseRoute`/`routeQuery`), las marcas del enlace (`rel`, `via`, `inherited`, `channel`, `offscreen`, `line` y el texto de la línea) solo en el nodo que enlaza, y `counts` con las viñetas y planos marcados de su subárbol; `stale` marca un story no vigente de una ficha con vigente (solo aparece con `current: false`). `inherited: false` deja fuera lo heredado (la página de ambiente). `appearanceEnvironments(index, key, {current})`: entornos 3D de un personaje (los enlaces `environment` de donde aparece o habla) o de un ambiente (`locationEnvironments`), con `via` y el número de nodos. Contrato de `GET /api/entity?project&kind=character|location&id` (`lib/entidad.mjs`, solo lectura): `{kind, id, registry, assets, docs}`, con los assets del registro (`registryAssetsFor`: `character`, `voice` y los `group` que los incluyen, o `location` por id o alias; sin `sha256`; los estados por nombre; `provider` y `voiceId` en las voces; `exists` del fichero) y los documentos que existen de `ENTITY_DOCS` (hoja, hoja en texto y ficha; referencia, ficha y mapa); 400 con un tipo no válido y 404 con un id que no está en el proyecto.

**Ambiente de las secuencias.** La única fuente es `sequence.location` (y `shot.location` en un plano). `environments[].sequences` queda como dato informativo; `scripts/ambientes-secuencias.mjs` (`sequenceLocationPlan`) lo pasa a `location` solo en secuencias sin planos, así que ningún digest cambia.

### Buscador y facetas (#59)

`app/workflow.mjs`, sección «Buscador y facetas». Funciones puras; la barra (HTML, eventos y memoria) está en `app/filtros.source.js`. El estado de los filtros va en la URL (`q`, `f`) y en `localStorage`, nunca en `proyecto.json`.

- **Ítem** `{key, kind, id, text, facets, group, subs?, ref}`: `text` ya normalizado con `searchText` (minúsculas, sin marcas diacríticas, espacios colapsados), `facets` `{faceta: [valores]}`, `group` para agrupar al pintar y `ref` con los objetos del proyecto. Una sub `{key, kind, scene, label, text, facets}` es una parte buscable del ítem (escena o viñeta de un story).
- **Definición de faceta** `{id, label, sub?, values: [{value, label}]}`: ids cortos en inglés que solo viven dentro de `f`. Con `sub`, la faceta activa también se exige a las subs para marcar coincidencias.
- `filterItems(items, query, filters)`: cada término (`queryTerms`) en `text` o, los que falten, todos en una misma sub; dentro de una faceta, algún valor; entre facetas, todas. `itemHits` da las subs que explican la coincidencia. `facets(items, query, filters, defs)` cuenta cada faceta sobre los ítems que pasan los demás filtros, oculta las de un solo valor (salvo activas) y los valores a 0 (salvo activos), en el orden de la definición y luego los desconocidos. `filterView(items, defs, query, filters)` → `{total, shown, active, filters, facets, results: [{item, hits}]}`, sin facetas desconocidas.
- URL: `parseFilters`/`filtersParam` (`f=faceta:valor,…`), `toggleFilter` (no muta), `activeCount` y `hasFilters(view)` (la vista tiene `q` en `ROUTE_PARAMS`). `q` y `f` están en `ROUTE_KEYS` y `FILTER_PARAMS`, y `routeKey` los ignora.
- Constructores: `storyboardItems(p)` (sobre `treeModel` y `relationIndexFor`: un ítem por story en el orden del árbol, con escenas y viñetas como subs, y uno por prueba; facetas `act`, `sequence`, `kind`, `version`, `cast`, `loc`, `zone`) con `storyboardResultSections(results)` para agruparlos (acto › ficha, pruebas, sin secuencia); `shotItems(p)` (un ítem por plano; `act`, `role`, `sequence`, `loc` y `cast` del índice de relaciones, heredados incluidos, y `panel`) con `filterShotGroups(shotGroups(p), keep)`, que conserva la posición original de cada plano.
- **Una vista nueva (#62, #63)** añade `'q','f'` a su `ROUTE_PARAMS`, un constructor puro `xxxItems(p) → {items, defs}` con test, y en `app/app.source.js` pinta `filterBarHTML(...)` más `<div data-filter-results>` y deja en `fctx` `{view, items, defs, noun, empty, paint(model)}`; `render()` monta la barra con `mountFilters`.
