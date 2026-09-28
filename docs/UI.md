# Interfaz de la app

`app/app.js` es generado: nunca se edita. Sus fuentes:
- `app/app.source.js`: entrada, vistas y navegación. La vista de un storyboard pide una vez `/api/storyboard-media` (solo lectura, `storyboardMediaFor` de `lib/lotes.mjs`) para mostrar en cada viñeta sus tomas de vídeo y los montajes del storyboard y de sus secuencias; «Montaje →» abre ese lote y bloque en la vista Montaje. En paralelo pide `/api/storyboard-animaticas` (solo lectura, `listAnimatics` de `lib/animaticas.mjs`): si hay animáticas, la cabecera muestra el bloque «Pasos del storyboard» y cada secuencia un «Pasos de la secuencia» plegable, con una fila por paso (Ensayo 3D, Fotogramas, Con voces y Vídeo, que es el montaje de siempre), la versión vigente (la más alta), las anteriores en el selector y pastillas de «incompleta» (con lo que falta en el título), subtítulos en otro idioma e «importada». Sin animáticas, esos bloques quedan como antes. «Generar animáticas» encola un trabajo `animatic` (ejecuta `scripts/storyboard-animatica.mjs`, sin fal) y, mientras dura, se ve «Generando animáticas…».
- `app/montaje.source.js`: vista Montaje (revisión y remontaje de lotes; el servidor está en `app/montaje.mjs`).
- `app/rehearsal.source.js`: ensayo 3D del plano.
- `app/md-editor.source.js`: editor de Markdown (CodeMirror, marked y DOMPurify, empaquetados en local, sin CDN).

Tras editar cualquiera: `npm run build:ui` y commit también de `app/app.js`. No hace falta reiniciar el servidor.

Quedan fuera del paquete y se cargan como módulos aparte: `app/workflow.mjs` (lógica pura compartida con Node y los tests; cambiarlo no exige recompilar) y `app/stage.js` (escenario del ensayo y del render, `app/render.html`; figuras en `docs/mixamo.md`). Estilos en `app/style.css`; copia del móvil en `app/sw.js` y `app/movil.html`.
