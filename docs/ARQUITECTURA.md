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
viewer/   3D de navegador: kit de construcción, visor de entornos, paseo y colisiones, visor GLB, editor de plantas
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

El proyecto activo se indica con `--project <id>` o con `RODAJE_PROJECT`. Ningún código de la app contiene ids de proyecto.

`scripts/proyecto-check.mjs` hace cumplir este contrato.
