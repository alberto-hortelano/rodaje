# Rodaje

Aplicación local para crear series y películas desde su historia hasta la previsualización y conversión final por planos.

## Abrir

Ejecuta `./abrir.sh` desde esta carpeta. Abre http://127.0.0.1:4320.

Necesita Node.js 24+, FFmpeg/FFprobe y Google Chrome. Las dependencias están instaladas; para reinstalarlas: `npm ci`. Puerto configurable con `PORT=4321 npm start`; Chrome con `CHROME_PATH=/ruta/chrome`. Para usarla desde el móvil en la misma wifi: `npm run start:lan` (o `RODAJE_LAN=1`), que escucha en todas las interfaces y muestra la dirección local al arrancar; cualquier dispositivo de esa red puede entonces usar la app entera, generaciones incluidas. Guarda todo localmente en `proyectos/` (o en `RODAJE_DATA`).

## Proyecto activo

Al abrir un proyecto en la vista Proyectos, la app lo guarda como activo en `proyectos/.activo.json` (local, fuera de los repositorios de los proyectos). Los scripts de `scripts/` lo usan cuando no reciben otro: `--project <id>` > proyecto posicional (donde el script lo admite) > `RODAJE_PROJECT` > activo en la app. Todos imprimen en stderr `Proyecto: <id> (fuente)`; sin ninguno, muestran el uso y salen con código 2.

## Copia en el móvil sin servidor

La app se puede instalar en el móvil como PWA y guardar en él un proyecto entero (interfaz, datos, imágenes, audios, vídeos y el visor 3D) para verlo con el servidor apagado. La copia es de **solo lectura**: sin servidor, guardar o generar devuelve «Sin conexión con el servidor: la copia del móvil es de solo lectura».

1. `npm run start:lan` y, en el móvil (misma wifi), abre la dirección que imprime como «Copia para el móvil» (`http://<ip>:4320/movil.html`).
2. Pulsa **Guardar en este dispositivo** en el proyecto que quieras (un proyecto con storyboards y entornos 3D puede ocupar más de 100 MB). La misma página permite actualizar la copia o quitarla.
3. Añádela a la pantalla de inicio (Chrome: menú ⋮ → *Añadir a pantalla de inicio*; Safari: Compartir → *Añadir a pantalla de inicio*). Después abre esa app aunque el ordenador esté apagado.

El navegador solo permite guardar la app sin conexión en una dirección segura, y `http://192.168…` no lo es. Hay que resolverlo una vez:

- **Chrome en Android, sin tocar el servidor:** abre `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, activa la opción, escribe `http://<ip>:4320` en su cuadro y relanza Chrome. Conviene que el router asigne siempre la misma IP al ordenador.
- **HTTPS en la red local:** con un certificado (por ejemplo, de `mkcert`, cuya CA se instala en el móvil) arranca `RODAJE_LAN=1 RODAJE_TLS_CERT=cert.pem RODAJE_TLS_KEY=key.pem npm start`; se abre además `https://<ip>:4321` (puerto configurable con `RODAJE_TLS_PORT`). Vale también para iPhone.
- **Tailscale:** `tailscale serve --bg 4320` publica la app con certificado válido en `https://<equipo>.<tailnet>.ts.net`, dentro y fuera de casa; añade ese host con `RODAJE_HOSTS=https://<equipo>.<tailnet>.ts.net`.

Cómo funciona: `app/sw.js` (service worker) guarda la interfaz y todo lo que se pide al servidor; sin conexión sirve la copia, incluidos vídeos por rangos. `app/movil.html` descarga un proyecto completo (`projectRequests` en `app/workflow.mjs`). Con el servidor encendido el comportamiento no cambia: siempre se usa primero la red.

## Recorrido

1. Crea un proyecto de serie o película. Define premisa, idioma y estilo.
2. Escribe documentos en **Historia e ideas**, o importa Markdown/texto.
3. Crea **Personajes y voces**. Describe apariencia y vestuario; genera una hoja o importa referencias. Asigna un nombre/ID de voz ElevenLabs y escucha muestras antes de producir diálogos.
4. Crea **Ambientes** con referencias visuales. Elige una base 3D: bosque, interior, ciudad o espacio libre.
5. Dibuja **Storyboards**: viñetas con código, duración, zona, cámara, acción, diálogo por canal y sonido. Sube un boceto o un fotograma, o genera el fotograma con el modelo de imagen a partir del boceto, las referencias y un prompt (explícito o compuesto). Un storyboard se exporta e importa en JSON y se convierte en capítulo con un clic.
5b. **Entornos 3D**: decorados en 3D con medidas reales. Pueden ser un GLB subido (de Tripo, Meshy o Hunyuan3D, visto en un visor genérico) o un entorno del proyecto con constructor, datos y plugins del visor (`environments`: `builder`, `data`, `viewer: {plugins}`, `glb`). Un ambiente enlaza su entorno (`environment`). Cada secuencia elige el lugar que queda en el centro del reparto, el estado y el giro, y el escenario de los planos lo usa en lugar de la base procedural. `node scripts/entorno-glb.mjs [proyecto] <entorno> [preset]` exporta el GLB (con preset, el proyecto va como posicional o con `--project`). Proceso en `docs/ENTORNOS-3D.md`.
6. Mira la **Escaleta**: cada secuencia de los capítulos o actos en orden, con su número, minutos, texto y una carátula. El prompt de la carátula se edita en la propia tarjeta (o se compone con el estilo del proyecto y el texto), y la imagen se genera con el modelo de imagen o se sube; las versiones se conservan.
7. Crea capítulos y secuencias manualmente, o genera un borrador de desglose a partir de la biblia con IA. El borrador siempre es editable.
8. Abre cada plano. Coloca al reparto de la secuencia, elige postura, añade volúmenes y define cámara inicial/final orbitando el visor. Ajusta duración e intervenciones con sus silencios. Genera/importa voz por intervención y ambiente por secuencia.
9. Ensaya con audio, renderiza el vídeo 3D, revísalo y apruébalo. El servidor comprueba que las frases completas caben y que no se solapan.
10. Producción real: sigue `docs/PROCESO.md` (bloques de 5–15 s con guía 3D y diálogo nativo de H3 Max, registro de assets, reglas con condición de fallo). Los botones **Generar fotograma** y **Convertir con H3 Max** de la app son el flujo antiguo (fotograma nano-banana + audio pregrabado remuxado); se conservan para pruebas y no se usan en producción.
11. Revisa los resultados y monta el capítulo. Versiones anteriores y solicitudes remotas quedan guardadas.

## Generación

En **Ajustes**, introduce tu clave de fal.ai. Se guarda en `config.local.json`, con permisos 600, y nunca se entrega al navegador. También admite `FAL_KEY` al iniciar. Sin clave funcionan edición, importación, ensayo, render y aprobación locales. Los botones de generación realizan llamadas facturables a tu cuenta y envían las referencias seleccionadas.

Modelos integrados: Nano Banana Pro (hojas, ambientes y fotogramas), ElevenLabs v3 (voces), Sound Effects v2 (ambiente), H3 Max reference-to-video y OpenRouter router para el guion (modelo editable en Ajustes). Sus contratos se consultaron en fal.ai el 15-09-2026. La aceptación de referencias no garantiza fidelidad exacta ni lipsync perfecto: revisar cada salida.

## Continuidad y almacenamiento

Cada aprobación identifica el contenido del plano y su render. Cambiar referencias, voz, escena, posiciones, cámara, diálogo o ambiente invalida esa aprobación para producción. Un resultado que termina después de una edición se conserva en el historial y no sustituye a la versión vigente. Los trabajos remotos guardan su ID y se consultan de nuevo al reiniciar; un envío interrumpido sin ID no se repite automáticamente.

```
proyectos/<id>/
  proyecto.json
  ideas/*.md
  personajes/<id>/hoja.md, personaje.json, hoja.png
  ambientes/<id>/escenario.json, referencia.png
  capitulos/<id>/capitulo.json
  storyboards/<id>/storyboard.json
  assets/                 originales, audios, snapshots, escenas y vídeos
  versiones/              revisiones completas del proyecto
  trabajos/               solicitudes, estados y resultados
```

Cada proyecto guarda copias locales de sus referencias y audios; no depende de las carpetas de origen.

## Proceso de producción

El proceso canónico está en `docs/PROCESO.md`; las reglas generales, en `docs/REGLAS.md`, y las de cada proyecto, en `proyectos/<id>/REGLAS.md`, que las hereda; el registro de assets, en `proyectos/<id>/REGISTRO.md` (generado). Más documentación: `docs/ARQUITECTURA.md`, `docs/FLUJO-ISSUES.md`, `docs/ENTORNOS-3D.md`, `docs/visor-3d.md`, `docs/mixamo.md`, `docs/UI.md`, `docs/scripts.md` y `GENERAR-IMAGENES.md`. Los agentes de IA leen `CLAUDE.md`.

## Alcance actual

Aplicación local, para un usuario. Figuras Y-Bot (`docs/mixamo.md`) con respiración, miradas y gestos procedurales, de pie o sentadas; cámara interpolada entre dos posiciones. No es un editor de animación esquelética completo ni un rig facial. Las bases 3D son esquemáticas y se completan con volúmenes; no reconstruyen automáticamente una fotografía. Máximo 15 segundos y 8 referencias de personajes por plano para el adaptador actual. Los diálogos no se estiran: hay que alargar/dividir el plano cuando no caben.

Pruebas: `npm test`. La validación de integración usa render local y proveedores simulados; no consume generaciones de pago.
