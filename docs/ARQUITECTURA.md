# Arquitectura

Rodaje es una **aplicación**. Los **proyectos** (series, películas) son datos que la aplicación abre.

## Repositorios

- `rodaje/`: la aplicación (código, docs, skills y agentes). Ignora `proyectos/`.
- `proyectos/<id>/`: un repositorio por proyecto. Solo versiona texto; los binarios se ignoran.

## Aplicación

Estado objetivo; las issues #3 a #20 lo van completando.

```
app/      servidor HTTP, persistencia (store), trabajos, montaje, funciones puras (workflow) y UI (*.source.js → app.js)
lib/      núcleo compartido de Node: rutas y proyecto activo, JSON atómico, argumentos, ffmpeg, fal, TTS, Chrome, lotes, validador de proyectos
viewer/   3D de navegador: kit de construcción, visor de entornos, paseo y colisiones, visor GLB, editor de plantas; se sirve en /viewer/<ruta> (glb.mjs, kit.mjs)
scripts/  CLIs finos sobre lib/
docs/     documentación de la aplicación y del proceso de producción
```

## Contrato de proyecto

Un proyecto contiene:
- `proyecto.json`: la fuente de verdad. Las carpetas `personajes/`, `ambientes/`, `capitulos/` y `storyboards/` tienen ficheros derivados que se regeneran desde ahí.
- `registro.json`, `REGLAS.md` (solo las reglas propias del proyecto; las generales están en `docs/REGLAS.md`) y `fusiones.json`.
- Texto propio: `biblia/`, `guion/`, `ideas/`, `MAPA.md`, `capitulos/*/escenas/*.json`.
- Lotes: `assets/<lote>/<bloque>/` con prompts, `refs.json` y `attempts.json`.
- Binarios ignorados por git: imágenes, vídeo, audio y GLB.

**El único código permitido son los constructores de escenario** que declara `environments[].builder`:

```js
export function build(T, data, kit) { … return group }   // T = three, data = model.json, kit = viewer/kit
```

- Sin `import`, `require`, `document`, `window`, `process`, `fetch`, `eval` ni `globalThis`.
- Todo lo genérico (materiales, texturas, visor, paseo) lo da la app a través de `kit`.
- `environments[].viewer` es un objeto de opciones, no una ruta a un `.js`.

El proyecto de un script se resuelve con `lib/cli.mjs` (`cliProject`, sobre `resolveProject` de `lib/paths.mjs`), por este orden: `--project <id>`, el argumento posicional donde el script ya lo tenía, `RODAJE_PROJECT` y, en cuarto lugar, el proyecto activo en la app. El activo vive en `<DATA>/.activo.json` (`lib/proyecto-activo.mjs`) y solo lo escribe el servidor: `POST /api/active` (con token) al abrir un proyecto en la vista Proyectos, y al crear uno; las recargas con `?project=` y `movil.html` no lo cambian. Los scripts imprimen `Proyecto: X (fuente)` en stderr y, sin proyecto, salen con el uso y código 2 sin tocar el disco (`app/store.mjs` ya no crea `DATA` al importarse; la crea `app/jobs.mjs` al arrancar el servidor). Ningún código de la app contiene ids de proyecto.

`scripts/proyecto-check.mjs` hace cumplir este contrato.

### El tercer argumento: `kit`

El visor, el ensayo y los scripts crean un kit nuevo en cada construcción con `createKit(T, {state, textures, textureUrl, onSky})` (`viewer/kit.mjs`, sin imports, funciona en Node) y lo pasan como tercer argumento. Todo llega por ahí:
- `kit.state`: el estado pedido (preset, secuencia o controles del visor), sin mezclar; el constructor lo combina con su estado por defecto: `{...data.defaultState, ...kit.state}`.
- `kit.textures`: `true` si se quieren texturas procedurales; en Node o al exportar GLB es `false` y no se crea ningún canvas.
- `kit.textureUrl(file)`: resuelve las imágenes de `data.textures` respecto a la carpeta de `data`; `kit.onSky(tx)` recibe la del cielo. El constructor solo llama a `kit.applyImageTextures(data.textures)`.
- Herramientas: `mat`, `group`, `box`, `wall`, `gableRoof`, `cyl`, `uvMeters`, `scaleUV`, `proceduralTextures`, `loadTexture` y los helpers de polígono. La paleta y la tesela las fija el constructor con `kit.configure({palette, tile})`.

`state`, `textures`, `textureUrl` y `onSky` son datos de solo lectura con los mismos nombres que el antiguo objeto de opciones: un constructor antiguo funciona igual si recibe un kit. No hay cuarto argumento y `data` (`model.json`) no se modifica. No confundir con `locations[].modelSpace.kit`, que es una lista de piezas.
