# Scripts

Órdenes de línea de comandos sobre `lib/`. Ninguna supone un proyecto: lo toman de `--project <id>`, del posicional `[proyecto]` donde lo había, de `RODAJE_PROJECT` o del proyecto activo en la app (el último abierto en la vista Proyectos), e imprimen `Proyecto: X (fuente)` en stderr; compruébalo antes de dejar que un script escriba. Sin proyecto válido muestran el uso y salen con código 2 sin tocar nada. El uso exacto de cada una está en su cabecera.

## Producción por bloques (`docs/PROCESO.md`)

- `scripts/bloques/masters.mjs`: inserta el plano MASTER de 1 s al inicio de la primera secuencia de cada ambiente (paso 4).
- `scripts/bloques/planificar.mjs`: planifica los bloques de una secuencia y congela el snapshot del proyecto en el lote (paso 5; `--por-plano` en modo fotograma).
- `scripts/bloques/render.mjs`: guía 3D por bloque, sin rótulos: `motion.mp4`, `frame-start.png` y `frame-mid.png` (paso 6; necesita la app abierta).
- `scripts/bloques/prompt.mjs`: esqueleto del prompt de cada bloque en orden fijo; en modo fotograma aplica `assets/<lote>/direccion.json` (paso 7).
- `scripts/bloques/enviar.mjs`: envía un bloque a H3 y registra el intento en `attempts.json` (de pago; R23, R26).
- `scripts/bloques/estado.mjs`: consulta la cola, descarga los intentos y registra el veredicto con `--verdict` (las reglas citadas se validan contra `docs/REGLAS.md` y el `REGLAS.md` del proyecto).
- `scripts/bloques/montar.mjs`: montaje incremental del lote (paso 8).
- `scripts/bloques/informe.mjs`: informe del lote en `INFORME.md`: intentos, aceptación, reglas más violadas, segundos y coste.
- `scripts/bloques/voces.mjs`: voces de ElevenLabs a través de fal (`lineas`, `prueba`, `cambiar`; de pago salvo el ensayo sin `--yes`).
- `scripts/bloques/lib.mjs`: utilidades compartidas por los scripts de lote; no es una orden.

## Registro, perfiles y ensayo

- `scripts/registro.mjs`: registro de assets con descriptores congelados: sync · freeze · render · check · describe `id@estado`.
- `scripts/perfil.mjs`: perfil maestro de interpretación y voice prompt por personaje (skill `interpretacion`).
- `scripts/mapa-espacial.mjs`: borrador de `MAPA.md` por landmarks para un ambiente.
- `scripts/stage-config.mjs`: show · check · set de la configuración del ensayo 3D, `proyecto.stage.rehearsal` (animaciones en `docs/mixamo.md`).

## Storyboards e imágenes (`GENERAR-IMAGENES.md`)

- `scripts/storyboard-a-secuencia.mjs`: rellena una secuencia con las viñetas de un storyboard, para el modo fotograma.
- `scripts/storyboard-prompts.mjs`: exporta las viñetas de un storyboard a `.prompt.txt` para ChatGPT y, con `--enlazar`, enlaza los fotogramas generados.
- `scripts/prompts-pendientes.mjs`: lista los `.prompt.txt` de imagen cuya imagen aún no existe, con sus adjuntos.
- `scripts/fusionar.mjs`: herramienta web en :4398 para fusionar una edición de ChatGPT con su original a pincel; guarda la edición cruda como `.chatgpt.png` y la máscara; registro en `<proyecto>/fusiones.json`, y `--migrar` reparte el antiguo `proyectos/fusiones.json`.

## Entornos 3D (`docs/ENTORNOS-3D.md`)

- `scripts/entorno-glb.mjs`: exporta a GLB un entorno 3D con constructor.
- `scripts/entorno-coplanares.mjs`: detecta caras coplanarias que parpadean; pasarlo tras tocar un constructor.
- `scripts/entornos/capturar.mjs`: capturas de un entorno desde ángulos dados contra un servidor de prueba (`--entorno`, `--url`).
- `scripts/entornos/recorrer.mjs`: recorrido a pie automático con los pasos de `walkthrough` en `model.json` (`--entorno`, `--url`).
- `scripts/entornos/calibrar.mjs`: ajusta la cámara de la referencia A a partir de pares punto 3D ↔ píxel; no usa proyecto.
- `scripts/entornos/retroproyectar.mjs`: proyecta al suelo píxeles de la referencia con la cámara calibrada; no usa proyecto.

## Proyecto y control

- `scripts/proyecto-check.mjs`: valida un proyecto o `--all`: código fuera de constructores, constructores con globales o exports extra, rutas de código en el manifiesto, copias `before` y rutas absolutas (`npm run check:proyectos` lo pasa en modo informe).
- `scripts/linea-base.mjs`: instantánea de digests, GLB, coplanares y capturas 3D para detectar regresiones; se comparan dos con `diff -r`.
- `scripts/pendientes.mjs`: importar · listar el tablero de pendientes.
- `scripts/leer-movil.mjs`: servidor de solo lectura de `guion/` e `ideas/` para leerlos desde el móvil.

La vista Montaje de la app (`app/montaje.source.js`, `app/montaje.mjs`) revisa y remonta lotes con los mismos `attempts.json`.
