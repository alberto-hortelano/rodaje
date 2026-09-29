# Visor 3D

Código de navegador en `viewer/`, servido en `/viewer/<ruta>`: kit de construcción (`viewer/kit.mjs`), visor genérico de entornos con constructor (`viewer/mount.mjs`), paseo y colisión inyectable (`viewer/walk.mjs`), contrato de plugins (`viewer/plugins.mjs`), visor GLB (`viewer/glb.mjs`) y editor de plantas (`viewer/planta.html`, `viewer/planta.mjs`). El contrato de proyecto (qué código puede tener un proyecto y sus prohibiciones) está en `docs/ARQUITECTURA.md`; el proceso para hacer un escenario, en `docs/ENTORNOS-3D.md`.

## Cómo se abre un entorno

La app abre un entorno así: `builder` y `data` → `/viewer/mount.mjs`; solo `glb` → `/viewer/glb.mjs`. `viewer` como texto (una ruta a un visor propio) ya no se admite: la app no lo abre, muestra en su lugar un mensaje que pide pasarlo a `builder` + `data` con `viewer.plugins` (la tarjeta del entorno dice «VISOR NO VÁLIDO») y `proyecto-check` lo da como error R-manifest. El visor genérico no sabe nada de ningún escenario: luces, niebla, fondo, cortes, piezas atravesables, entrada del paseo y vista general van en los plugins del proyecto (`ambientes/<id>/3d/visor.js`). Sin plugins pone un fondo `#b9c0c4`, luces como el visor GLB y encuadra la caja del modelo.

El visor importa todos los plugins por `/api/asset` antes de montar; si alguno no exporta `plugin`, el entorno no se abre. Monta el DOM, el renderer, una escena vacía, la cámara y los controles; llama a `plugin(api)` de cada uno en orden (las luces del plugin entran antes que el modelo); completa fondo y luces si faltan; prepara colisión y caminante; construye y va a la vista guardada de la pestaña o, si no la hay, a la vista general (ver «Persistencia de la vista»).

## Opciones: `environments[].viewer`

`environments[].viewer` es `{plugins: [...], …opciones}`: rutas `.js`/`.mjs` del proyecto y opciones del visor. Los plugins reciben las opciones (el objeto `viewer` sin `plugins`) en `api.options`.

`viewer.walk` (opcional) ajusta el paseo: `{eye, step, radius, walkSpeed, flySpeed, run, maxDrop}`, solo números; una clave desconocida o un valor no numérico es un error (`walkOptions`, `viewer/plugins.mjs`). Por defecto `step` es 0,3 y `radius` 0,32; lo demás toma los valores de `createWalker` (`viewer/walk.mjs`): `eye` 1,62, `walkSpeed` 3,2, `flySpeed` 6, `run` 2,4 (multiplicador con Mayús) y `maxDrop` 1,2. `step` va a la colisión y al caminante; `radius`, solo a la colisión. Si un plugin da su propia colisión, el hook `collision` recibe `step` y `radius` ya resueltos; si da su propio caminante, el hook `walker` recibe `options` tal cual (con `options.walk` sin resolver) y decide qué usa.

## `api` del plugin

- `T`, `scene`, `camera`, `controls`, `renderer`; `data` (`model.json`), `environment` (la entrada del manifiesto), `options` (`viewer` sin `plugins`).
- `model` (el grupo construido), `state` y `setState(next)`, `mode` (`'orbit'` o `'walk'`), `setWalk(on)`, `setView(id)` (→ `true` si lo atiende un plugin o un lugar, `false` si no existe), `overview()`, `walker` (el caminante; `null` mientras corre `plugin(api)`, se crea después), `noclip` y `setNoclip(on)` (mantiene sincronizado el botón «No clip»).
- `ui.button({a, text, pressed}, onClick)`: botón en la barra tras «Vista general», en orden de llamada; devuelve `{pressed, text}` con setters.
- `ui.action(a, fn)` para `[data-a]` de paneles; `ui.note(text)`, `ui.hint(text)`; `ui.panel({title, html})` y `ui.overlay(html)` devuelven `{el, set(html)}`: `el` es el cuerpo del panel o la capa (un minimapa pone un `<canvas>` en la capa y dibuja con `el.querySelector('canvas').getContext('2d')`).
- `ui.button` y `ui.action` dan error con un `data-a` del visor (`CORE_ACTIONS`: `overview`, `preset`, `walk`, `noclip`, `fullscreen`, `capture`, `glb`) o ya usado por otro botón o acción.

## API pública: `window.rodaje.environment`

Es el objeto que devuelve `mountEnvironment` y que la app publica en `window.rodaje.environment` mientras la vista es un entorno con visor genérico (con solo `glb` es lo que devuelve `mountGlb`: `{scene, camera, controls, dispose}`). No es la `api` del plugin: tiene las claves de `CORE_API` (`viewer/plugins.mjs`), que son `setView`, `setState`, `setWalk`, `mode`, `walk(keys, seconds)` (→ posición; lo hace el caminante), `state`, `scene`, `camera`, `controls`, `renderer`, `dispose`, `setNoclip`, `noclip` y `saveView()` (guarda la vista ahora y la devuelve; lanza si un plugin da algo no serializable), más lo que añaden los plugins con `expose`. `model`, `walker`, `overview`, `data` y `ui` no se exponen: si un script los necesita, un plugin los expone con un getter. Sobre esta lista trabajan `expose` (no puede pisar ninguna clave de `CORE_API`) y los pasos `call` del recorrido.

## Modos

El visor solo tiene `orbit` y `walk`. Estados propios del escenario (dentro/fuera, planos, mapa) los lleva el plugin: dentro de `walk`, como estado de su caminante; un mapa es `orbit` con `overview`/`onOverview` y el dibujo en `onFrame` cuando `mode === 'orbit'`; `onMode` cambia luces o visibilidad. Al salir del paseo el visor repone `camera.up` a (0, 1, 0).

## Hooks

Todos opcionales; uno desconocido es un error. Con varios plugins se llama a todos, en orden, salvo donde se indica:
- `onBuild(model)` tras cada construcción; `onSky(tx)` tras poner el cielo; `onOverview()` antes de ir a la vista general; `onView(mark, {mode})` antes de mover la cámara a un lugar; `onFrame(dt, {mode})` en cada fotograma; `dispose()`.
- `onMode(mode)` justo después de cambiar de modo en `setWalk` (`'orbit'` o `'walk'`).
- `overview()` → `{position, target, text?}`, `spawn()` → `{position, lookAt}`, `collision({T, step, radius, skip, options})` → `{collect, groundAt, blocked}` y `walker({T, camera, collision, options})` → caminante: gana el primero que devuelve algo.
- `onKey(key, {down, repeat, mode})` y `view(id, {mode})`: se paran en el primero que devuelve `true`. `onKey` recibe la tecla en minúsculas en keydown y keyup; con `true` el visor la consume. `view` se prueba antes que `data.landmarks` en `setView` y en los botones `data-mark`.
- `passable(obj)`: basta con que uno diga sí; se prueba en cada antepasado de la malla.
- `saveView()` → la parte del plugin en la vista guardada (valor serializable; `undefined` = nada) y `restoreView(saved, {mode})` al recuperarla: ver «Persistencia de la vista». `restoreView` no debe llamar a `setState` (el estado ya llegó a la construcción).
- `expose: {…}`: métodos y getters que se añaden a `window.rodaje.environment` (se copian como descriptores: un `get x()` sigue vivo; usa variables del plugin, no `this`); no pueden pisar los del visor (`CORE_API`).

## Persistencia de la vista

El visor recuerda la vista de cada entorno en `sessionStorage`: solo en esa pestaña (otra pestaña empieza en la vista general) y sin que los plugins toquen el almacenamiento.
- Clave `rodaje:visor:<proyecto>:<entorno>` (`viewKey`); valor `{v: 1, mode, camera: {position, quaternion}, target, noclip, state, plugins: {<ruta del plugin>: …}}` (`buildSavedView`, `viewer/plugins.mjs`).
- Se guarda en `pagehide`, al ocultarse la pestaña (`visibilitychange`) y en `dispose()` antes de los `dispose` de los plugins, así que «Guardar cambios» y «Actualizar», que vuelven a montar, la conservan. Nunca por fotograma. Un valor no serializable en un plugin se avisa en la consola y no impide desmontar.
- Se lee y valida (`parseSavedView`) antes de la primera construcción: su `state` se mezcla en el estado inicial, así que el modelo se construye una sola vez. Después, en lugar de la vista general: `setNoclip`; en `walk`, `setWalk(true)` y la pose con `restoreWalkPose` (`viewer/walk.mjs`: por el suelo que haya debajo salvo con «no clip», sin alabeo); en `orbit`, `onOverview()` y la cámara y el objetivo guardados. Luego `restoreView` de cada plugin con su parte (solo si la tiene; un error se avisa en la consola sin cortar).
- Se ignora sin error: JSON roto, otra versión, modo desconocido, posición, objetivo o cuaternión no finitos (o cuaternión nulo), `noclip` no booleano → vista general, y se sobrescribe al guardar. Estados u opciones que ya no existen y partes de plugins que ya no están se descartan clave a clave.
- Precedencia: `persist=0` en la URL (o `persist: false` en `mountEnvironment`) > guardada > vista general. Con `persist=0` no se lee ni se escribe. Un `setView` posterior («Visitar estancia en 3D») gana a lo guardado.
- Los entornos solo con `glb` (`viewer/glb.mjs`) no guardan nada.
- Un plugin guarda lo que no se deduce de la cámara (en la nave: su marco de orientación y alabeo, sala, linterna, puertas y el regreso al interior; el autopiloto nunca se reanuda) y en `restoreView` valida cada campo aparte: repone su estado interno, no la cámara si la recalcula en cada fotograma.

## Teclado

El visor no interpreta las teclas del paseo. Con el foco en `input`, `select`, `textarea` o un elemento editable no hace nada (salvo soltar la tecla en keyup). Si no, primero `onKey`; si ninguno la consume y el modo es `walk`, la tecla entra en `walker.keys` cuando está en `walker.walkKeys` (por defecto las de `WALK_KEYS`). Al perder el foco la ventana se sueltan todas.

## Caminante

Contrato (`checkWalker`; el de `createWalker` lo cumple): `{keys: Set, walkKeys?: string[], noclip (escribible), eye (número), place(x, y, z), aim(from, to), look(dx, dy), update(dt), walk(keys, seconds) → posición}`. El visor llama a `collision.collect(model)` al entrar en el paseo y en cada reconstrucción mientras se está en él; un caminante propio puede ignorarlo y leer el modelo por `api.model` u `onBuild`. El de `createWalker` baja y sube con Q/E en «no clip»; un plugin que use otras teclas declara las suyas en `walkKeys`.

## Suelo del ensayo: `floorProbe`

`floorProbe(T, root, {match, above = 1.5, top = 60, far = 80, bucket = 2})` (`viewer/walk.mjs`) devuelve `fn(x, z, yRef = 0)` → altura del suelo bajo (x, z) en coordenadas del mundo, o `null`. Es la sonda con la que el ensayo (`app/stage.js`) pone a los actores sobre el terreno del entorno (`docs/ensayo-3d.md`).

- **Qué es suelo:** las mallas (no instanciadas) bajo `root` cuyo nombre, o el de un antepasado hasta `root`, cumple `match`; por defecto `isFloorName`: empieza por `suelo` (`suelo`, `suelo-sala`, `suelo-bodega`…). El tejado, los muebles y las figuras quedan fuera, así que un actor bajo un tejado no se sube a él. Para que un terreno cuente, se llama `suelo-<algo>` o se cuelga de un grupo así.
- **Varios niveles:** el primer rayo baja desde `yRef + above`, así que encuentra el piso en el que está `yRef` y no el de encima (en una casa de dos plantas, `yRef` 0 da la planta baja y `yRef` 2,2 la alta). Si no toca nada, un segundo rayo baja desde `yRef + top` hasta `yRef + above`: rampas, cerros y taludes más altos que el actor.
- **Sin Raycaster:** al crearla indexa una sola vez los triángulos de suelo en coordenadas del mundo, en cubetas de `bucket` metros en XZ, y cada consulta prueba solo los de su cubeta (altura por baricéntricas en la proyección XZ). Da las mismas alturas que los dos rayos y, como el Raycaster, solo cuenta las caras que miran al rayo (hacia arriba con `FrontSide`, hacia abajo con `BackSide`, todas con `DoubleSide`). En el cruce (207 030 triángulos) el índice tarda unos 0,25 s y cada consulta, alrededor de 1 µs; un rayo contra esa malla costaba unos 20 ms. `fn.triangles` dice cuántos triángulos indexó.
- El `matrixWorld` de `root` debe estar actualizado al crearla y el modelo no debe moverse después. El ensayo la crea una vez por entorno montado y la reutiliza en `updateShot`.
- El ensayo la envuelve en `groundGrid` (`app/workflow.mjs`): rejilla de 20 cm con interpolación bilineal y esquinas memorizadas (cada esquina se consulta una vez).

## `root.userData`: datos de ejecución del visor

Un constructor puede dejar en `root.userData.<clave>` lo que su visor necesita en tiempo de ejecución (volúmenes, colisiones, puertas, kits…). Debe ser serializable (números finitos, textos, booleanos, arrays y objetos planos) y referirse a los nodos por su nombre (únicos), nunca por referencia a objetos de three. El visor genérico no lo lee ni lo transforma: si hace falta rehidratarlo (`Matrix4.fromArray`, `Vector3`), lo hace el plugin del proyecto, una vez, por ejemplo en `onBuild`. Al exportar a GLB (botón del visor y `exportGlb` de `lib/entorno3d.mjs`) la raíz conserva solo las claves de `GLB_USERDATA` (`state`, `units`; `viewer/plugins.mjs`) y el resto no llega a `extras`; los hijos no se tocan y la raíz recupera su `userData` tras exportar. Ejemplo: un constructor deja en `userData.ship` volúmenes y puertas, y el plugin `visor.js` de su entorno los lee.

## Recorrido: `walkthrough` en `model.json`

Lo ejecuta `scripts/entornos/recorrer.mjs <carpeta> --entorno <id> [--project id] [--url …]` contra la app arrancada (un servidor de prueba con otro `PORT`); para qué sirve y cuándo se pasa, en `docs/ENTORNOS-3D.md`. Nunca llama a `dispose`. Abre el visor con `persist=0`, así que siempre empieza en la vista general y no toca la vista guardada.

Cada paso: `{label, walk?, view?, position?, yawDeg?, noclip?, keys?, seconds?, call?, args?, expect?, tolerance?, snapshot?}`. Lo valida `walkthroughSteps` (`lib/entorno3d.mjs`) antes de abrir Chrome; un `walkthrough` vacío o ausente es un error:
- `label` es obligatorio;
- `view` es un texto; `position`, tres números;
- `yawDeg` solo va con `position` (0 por defecto);
- `keys` es una lista de teclas no vacía y exige `seconds` > 0; `seconds` sin `keys` es un error;
- `call` es un identificador (`^[A-Za-z_$][\w$]*$`) distinto de `dispose`;
- `args` solo va con `call` y es un array;
- `tolerance` solo va con `expect` y es un número ≥ 0;
- `snapshot` cumple `^[\w.-]+$` (es el nombre de la captura, `<carpeta>/<snapshot>.png`).

Orden dentro de un paso: `walk` → `view` → `position`/`yawDeg` → `noclip` → `keys` → `call`.
- `walk: true` solo entra en el paseo (`setWalk(true)`; si ya se estaba en él, vuelve a la entrada); `walk: false` no sale.
- `view` llama a `setView`; si devuelve `false` (no existe), el paso falla.
- `position` coloca la cámara directamente (sin `walker.place`, así que no busca el suelo) y `yawDeg` fija la orientación (sin inclinación).
- `noclip: true` pulsa el botón «No clip», así que lo alterna, no lo fija; `noclip: false` no hace nada.
- `keys` + `seconds` llaman a `walk(keys, seconds)`, que simula ese tiempo a 30 pasos por segundo.
- `call` es un método o getter de `window.rodaje.environment` (los del visor y los que expone un plugin, p. ej. una auditoría o una ruta), con `args` solo si es un método; si es un método se espera su resultado.

El valor del paso es el de `call` o, si no hay, la posición tras `keys` o la de la cámara. `expect` se compara con ese valor (`matchExpect`: objetos parciales, listas elemento a elemento, números con `tolerance`, por defecto 1e-6; el resto con `===`). El paso falla si su `view` no existe, si `call` no existe o lanza, si lleva `args` y `call` no es un método, o si no cumple `expect`. El script imprime `OK` o `FALLO: …` por paso y sale con 1 si falla alguno o hay errores en la página.

El bucle de la app (`requestAnimationFrame`) sigue corriendo entre pasos: no se comprueban tiempos, solo estados (una ruta ha llegado cuando su índice iguala su longitud).

## Capturas: `capture` en `model.json`

`scripts/entornos/capturar.mjs` (con `persist=0`, como el recorrido y las capturas de `scripts/linea-base.mjs`) lee `capture` con `captureSetup` (`lib/entorno3d.mjs`): `root` es el nombre del objeto raíz en la escena (por defecto, el id del entorno); `group`, si existe, es un descendiente de la raíz (el primero con ese nombre) del que solo quedan visibles los hijos cuyo nombre está en `keep` (por defecto, ninguno); `fog: false` quita la niebla (por defecto se deja).

## Editor de plantas

`viewer/planta.html` + `viewer/planta.mjs`. Editor genérico de siluetas 2D para cualquier entorno con constructor (`builder` + `data`); se abre desde la vista del entorno («Editar planta», `/viewer/planta.html?project=…&env=…`). La planta vive solo en los datos del entorno (`env.data` → `dims.planta`). `viewer/planta.mjs` es lógica pura compartida por navegador y servidor: mover/añadir/quitar vértices manteniendo `lados` alineados, encuadre y `validarPlanta`. Cómo la usa el usuario, en `docs/ENTORNOS-3D.md`.

`/api/planta` (`app/server.mjs`, `lib/planta.mjs`):
- `GET /api/planta?project&environment` → `{planta, revision, environment: {id, name}}`. La revisión vive en `dims.planta.revision` (0 si no existe).
- `POST /api/planta` (token y origen como el resto) con el cuerpo `{project, environment, revision, planta}` → `{revision, planta}`.
- `lib/planta.mjs` toma la ruta siempre de `proyecto.json` con `safe()` (nunca del cliente), valida contra la planta del disco y exige la misma `revision`. Sustituye solo el tramo de texto de `dims.planta` (`replaceJsonValue` de `lib/json.mjs`), así que el resto del fichero no cambia; sube `revision` en uno y escribe de forma atómica. No invalida aprobaciones ni regenera el GLB (#30).
- Errores: 404 si no existe el entorno, si su `data` no es un `.json` o si no tiene `dims.planta`; 400 si la planta no pasa `validarPlanta`; 409 si la revisión no coincide con la del disco.

## Texturas teñidas

`kit.applyImageTextures(defs)` con `defs[clave] = {file, tile, anisotropy?, image?, sky?, hide?, tint?}`: con `tint: true` la imagen se multiplica por el color del material (se conserva `color`). Sin `tint` el color pasa a blanco, como hasta ahora. Varias variantes de color pueden compartir así una misma imagen, siempre que usen la clave de la textura en `kit.mat(clave, {color})`.

## El tercer argumento del constructor: `kit`

El visor, el ensayo y los scripts crean un kit nuevo en cada construcción con `createKit(T, {state, textures, textureUrl, onSky, palette, tile})` (`viewer/kit.mjs`, sin imports, funciona en Node) y lo pasan como tercer argumento. Todo llega por ahí:
- `kit.isKit` (`true`), `kit.palette` (copia de la paleta; `{}` por defecto) y `kit.tile` (metros por tesela; 2 por defecto).
- `kit.state`: el estado pedido (preset, secuencia o controles del visor), sin mezclar; el constructor lo combina con su estado por defecto: `{...data.defaultState, ...kit.state}`. El visor arranca con una copia de `data.defaultState` y, encima, el estado de la vista guardada (`initialState`); el constructor no exporta estado propio.
- `kit.textures`: `true` si se quieren texturas procedurales y de canvas; en Node o al exportar GLB es `false` y no se crea ningún canvas (`kit.canvas` devuelve `null`).
- `kit.textureUrl(file)`: resuelve las imágenes de `data.textures` respecto a la carpeta de `data`; `kit.onSky(tx)` recibe la del cielo. El constructor solo llama a `kit.applyImageTextures(data.textures)`.
- Herramientas: `mat`, `materials`, `group`, `box`, `boxGeometry`, `merge`, `canvas`, `wall`, `gableRoof`, `cyl`, `uvMeters`, `scaleUV`, `proceduralTextures`, `loadTexture`; los helpers de polígono (`segDist`, `polyContains`, `polyDist`, `centroid`, `insetPolygon`, `xAtZ`, `zAtX`, `rectMinus`) y `mulberry32` (números pseudoaleatorios con semilla). La paleta y la tesela las fija el constructor con `kit.configure({palette, tile})` (la paleta se mezcla con la que haya).
  - `kit.canvas(w, h, draw, {repeat, wrap, anisotropy, colorSpace})`: `CanvasTexture` dibujada una vez con `draw(ctx, w, h)`, o `null` sin `document` o con `textures:false`. Convención: si da `null`, el constructor omite las piezas que son solo textura (rótulos, placas); el resto queda con color liso.
  - `kit.merge(geometries, {groups})`: como `mergeGeometries` de three/examples (atributos no entrelazados, sin morph); `null` si no son compatibles. El constructor no importa nada de three/examples.
  - `kit.boxGeometry(xr, yr, zr, {tile, matrix})`: la caja de `box` como geometría ya colocada (sin malla) para fusionarla; `matrix` (la del padre) se premultiplica y `tile: 0` deja la UV en 0–1 por cara. `box(…, m, {tile})` admite también una tesela por llamada.
  - `kit.mat(key, extra)`: `extra` admite cualquier parámetro de `MeshStandardMaterial` (`side`, `emissive`, `metalness`, `transparent`, `opacity`, `depthWrite`, `color`…). Un `map` explícito, textura o `null`, gana a la textura procedural y conserva el color; las texturas cuentan en la caché por su `uuid`. Como conserva el color de la paleta, la textura sale teñida: para verla tal cual, pasa también `color: '#ffffff'`.
  - `applyImageTextures` admite `anisotropy` por textura (por defecto, la de `loadTexture`: 8).
  - `uvMeters(geo, 0)` y `scaleUV(geo, 0)` dejan la UV sin escalar.

`state`, `textures`, `textureUrl` y `onSky` son datos de solo lectura con los mismos nombres que el antiguo objeto de opciones: un constructor antiguo funciona igual si recibe un kit. No hay cuarto argumento y `data` (`model.json`) no se modifica. No confundir con `locations[].modelSpace.kit`, que es una lista de piezas.
