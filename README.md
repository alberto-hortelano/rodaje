# Rodaje

Aplicación local para crear series y películas desde su historia hasta la previsualización y conversión final por planos.

## Abrir

Ejecuta `./abrir.sh` desde esta carpeta. Abre http://127.0.0.1:4320.

Necesita Node.js 24+, FFmpeg/FFprobe y Google Chrome. Las dependencias están instaladas; para reinstalarlas: `npm ci`. Puerto configurable con `PORT=4321 npm start`; Chrome con `CHROME_PATH=/ruta/chrome`. Guarda todo localmente en `proyectos/` (o en `RODAJE_DATA`).

## Recorrido

1. Crea un proyecto de serie o película. Define premisa, idioma y estilo.
2. Escribe documentos en **Historia e ideas**, o importa Markdown/texto.
3. Crea **Personajes y voces**. Describe apariencia y vestuario; genera una hoja o importa referencias. Asigna un nombre/ID de voz ElevenLabs y escucha muestras antes de producir diálogos.
4. Crea **Ambientes** con referencias visuales. Elige una base 3D: bosque, interior, ciudad o espacio libre.
5. Dibuja **Storyboards**: viñetas con código, duración, zona, cámara, acción, diálogo por canal y sonido. Sube un boceto o un fotograma, o genera el fotograma con el modelo de imagen a partir del boceto, las referencias y un prompt (explícito o compuesto). Un storyboard se exporta e importa en JSON y se convierte en capítulo con un clic.
6. Crea capítulos y secuencias manualmente, o genera un borrador de desglose a partir de la biblia con IA. El borrador siempre es editable.
7. Abre cada plano. Coloca al reparto de la secuencia, elige postura, añade volúmenes y define cámara inicial/final orbitando el visor. Ajusta duración e intervenciones con sus silencios. Genera/importa voz por intervención y ambiente por secuencia.
8. Ensaya con audio, renderiza el vídeo 3D, revísalo y apruébalo. El servidor comprueba que las frases completas caben y que no se solapan.
9. Genera y revisa el fotograma visual usando el snapshot 3D y las referencias. Convierte con **H3 Max Reference to Video**. Se envían movimiento 3D, referencias de personaje y ambiente y audio. Se recorta la cola de preparación y se monta la pista original, sin acelerar las voces.
10. Revisa los resultados y monta el capítulo. Versiones anteriores y solicitudes remotas quedan guardadas.

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

El ejemplo Conjurados contiene copias locales de sus referencias y audios. No modifica ni depende del proyecto original. Importador opcional: `node scripts/import-conjurados.mjs /ruta/conjurados`.

## Alcance actual

Aplicación local, para un usuario. Figuras Y-Bot con respiración, miradas y gestos procedurales, de pie o sentadas; cámara interpolada entre dos posiciones. No es un editor de animación esquelética completo ni un rig facial. Las bases 3D son esquemáticas y se completan con volúmenes; no reconstruyen automáticamente una fotografía. Máximo 15 segundos y 8 referencias de personajes por plano para el adaptador actual. Los diálogos no se estiran: hay que alargar/dividir el plano cuando no caben.

Pruebas: `npm test`. La validación de integración usa render local y proveedores simulados; no consume generaciones de pago.
