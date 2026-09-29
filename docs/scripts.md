# Scripts

Órdenes de línea de comandos sobre `lib/`. Ninguna supone un proyecto: lo toman de `--project <id>`, del posicional `[proyecto]` donde lo había, de `RODAJE_PROJECT` o del proyecto activo en la app (el último abierto en la vista Proyectos), e imprimen `Proyecto: X (fuente)` en stderr; compruébalo antes de dejar que un script escriba. Sin proyecto válido muestran el uso y salen con código 2 sin tocar nada. El uso exacto de cada una está en su cabecera.

## Producción por bloques (`docs/PROCESO.md`)

- `scripts/bloques/masters.mjs`: inserta el plano MASTER de 1 s al inicio de la primera secuencia de cada ambiente (paso 4).
- `scripts/bloques/planificar.mjs`: planifica los bloques de una secuencia y congela el snapshot del proyecto en el lote (paso 5; `--por-plano` en modo fotograma).
- `scripts/bloques/render.mjs`: guía 3D por bloque, sin rótulos: `motion.mp4`, `frame-start.png` y `frame-mid.png` (paso 6; necesita la app abierta).
- `scripts/bloques/prompt.mjs`: esqueleto del prompt de cada bloque en orden fijo; en modo fotograma aplica `assets/<lote>/direccion.json` (paso 7).
- `scripts/bloques/enviar.mjs`: envía un bloque a H3 y registra el intento en `attempts.json` (de pago; R23, R26).
- `scripts/bloques/estado.mjs`: consulta la cola, descarga los intentos y registra el veredicto con `--verdict accepted|rejected|none` (sin `--attempt`, el último intento; las reglas citadas se validan contra `docs/REGLAS.md` y el `REGLAS.md` del proyecto). Misma semántica que la vista Montaje (`reviewBlock` en `lib/lotes.mjs`): una sola toma aceptada por bloque, rango conservado si no se da `--range`, `none` quita la revisión.
- `scripts/bloques/montar.mjs`: montaje incremental del lote (paso 8); en las tomas generadas mezcla las voces fuera de campo con audio en su instante del montaje. Si los planos del lote enlazan viñetas de un storyboard, escribe además un `<corte>.<secuencia>.mp4` por secuencia del storyboard cubierta (unido sin recodificar) y lo lista en `sequences` del `cut.json`.
- `scripts/bloques/informe.mjs`: informe del lote en `INFORME.md`: intentos, aceptación, reglas más violadas, segundos y coste.
- `scripts/bloques/voces.mjs`: voces de ElevenLabs a través de fal (`lineas`, `prueba`, `cambiar`; de pago salvo el ensayo sin `--yes`). `lineas` genera también las fuera de campo, salvo `--solo-en-cuadro`.
- `scripts/bloques/lib.mjs`: utilidades compartidas por los scripts de lote; no es una orden.

## Registro, perfiles y ensayo

- `scripts/registro.mjs`: registro de assets con descriptores congelados: sync · freeze · render · check · describe `id@estado` · textos (textos de prompt del registro: imprime o aplica `--desde fichero.json` con `--simular`).
- `scripts/perfil.mjs`: perfil maestro de interpretación y voice prompt por personaje (skill `interpretacion`).
- `scripts/mapa-espacial.mjs`: borrador de `MAPA.md` por landmarks para un ambiente.
- `scripts/stage-config.mjs`: show · check · set · staging · catalogo · fondo de la configuración del ensayo 3D, `proyecto.stage.rehearsal`, del staging de los planos (y su reparto en el prompt, clave `"cast"` del fichero de parches, y su cámara, clave `"cameraRig"`), del catálogo de variantes, zonas y canales y de la gente de fondo de un ambiente (`fondo [proyecto] --location <id> --background none|people|null`) (formato en `docs/ensayo-3d.md` y `docs/PROCESO.md`; animaciones en `docs/mixamo.md`).

## Storyboards e imágenes (`GENERAR-IMAGENES.md`)

- `scripts/storyboard-a-secuencia.mjs`: rellena una secuencia con las viñetas de un storyboard, para el modo fotograma.
- `scripts/storyboard-prompts.mjs`: exporta las viñetas de un storyboard a `.prompt.txt` para ChatGPT y, con `--enlazar`, enlaza los fotogramas generados.
- `scripts/storyboard-animatica.mjs` (`[proyecto] <storyboard> [--paso 3d|fotogramas|voces] [--secuencia id] [--capitulo-secuencia id] [--plan] [--importar fichero --paso paso [--subtitulos es] [--nota texto]]`): animáticas del storyboard por paso (ensayo 3D, fotogramas y fotogramas con voces), por secuencia y entera, con rótulo de plano y subtítulos; ffmpeg local, sin coste. Deja `storyboards/<id>/animaticas/<paso>[.<secuencia>]-vNN.mp4` y su `index.json` sin sobrescribir nada; `--plan` imprime la línea de tiempo y lo que falta sin escribir; `--importar` incorpora una hecha a mano como la siguiente versión. Reglas en `docs/PROCESO.md`, «Animáticas». La vista Storyboards lo lanza con «Generar animáticas».
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

- `scripts/proyecto-check.mjs`: valida un proyecto o `--all`: código fuera de constructores, constructores con globales o exports extra, rutas de código en el manifiesto, copias `before` y rutas absolutas. Sale con 1 si hay errores (los avisos no cuentan); `--report` siempre sale con 0. `npm run check:proyectos` pasa `--all` y falla si hay errores. `--all` sin carpeta de datos no valida nada y sale con 0.
- `scripts/proyecto-rutas.mjs` (`[proyecto] [--origen nombre=/ruta/abs]... [--aplicar] [--forzar]`): reescribe las rutas absolutas de los datos de un proyecto según «Rutas en los datos de un proyecto». Sin `--aplicar` es un simulacro que no escribe: plan por fichero, un ejemplo por prefijo y los tokens sin resolver. `--aplicar` exige el repo del proyecto limpio (`--forzar` lo salta), guarda `proyecto.json` con `store.save` (regenera los derivados) y sustituye los tokens en el resto de `.json`, `.md` y `.txt` dejando lo demás byte a byte. Sale con 0 si todo se resuelve, 1 si queda algo (lo resoluble se aplica) y 2 por uso o árbol sucio.
- `scripts/proyecto-hook.mjs` (`install|uninstall [proyecto]`): instala o quita en el repo del proyecto un hook `pre-commit` que pasa `proyecto-check` y bloquea el commit solo si hay errores (se salta con `git commit --no-verify`). Respeta `core.hooksPath`, no toca un `pre-commit` ajeno (sale con 1) y, si faltan rodaje o node, el hook avisa y deja pasar.
- `scripts/linea-base.mjs`: instantánea de digests, GLB, coplanares y capturas 3D para detectar regresiones; se comparan dos con `diff -r`.
- `scripts/pendientes.mjs`: importar · listar el tablero de pendientes.
- `scripts/leer-movil.mjs`: servidor de solo lectura de `guion/` e `ideas/` para leerlos desde el móvil.

La vista Montaje de la app (`app/montaje.source.js`, `app/montaje.mjs`) revisa y remonta lotes con los mismos `attempts.json`.

## Rutas en los datos de un proyecto

Los datos de un proyecto no llevan rutas absolutas de la máquina (`proyecto-check`, regla R-abs):

- Dentro del proyecto: ruta relativa POSIX a la raíz del proyecto (`assets/lote/b01/edit.mp4`), sin `./`.
- Listas de `ffmpeg -f concat` (`concat.txt`, `*-concat.txt`, `list.txt`): cada `file '…'` relativa a la carpeta de la lista (`file '../b01/edit.mp4'`); `ffmpeg` las resuelve desde ahí.
- Fuera del proyecto (material de origen, carpetas de otras herramientas): `origen:<nombre>/<resto>`, o `origen:<nombre>` para la raíz del origen; por ejemplo, `origen:codex/<id>/exec-….png`. El nombre cumple `^[a-z0-9][a-z0-9-]*$`. La correspondencia entre nombre y carpeta no se guarda en los datos: se da con `--origen nombre=/ruta/abs` al migrar, y la app no resuelve `origen:`; solo conserva la procedencia.
