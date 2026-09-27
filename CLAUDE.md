# Rodaje · instrucciones para agentes

Aplicación local (Node 24, ESM, Three.js, fal.ai) para producir series con IA. Proyecto real: `proyectos/dead-air`.

## Antes de escribir un prompt

Lee, en este orden: `PROCESO.md`, `proyectos/dead-air/REGLAS.md`, `proyectos/dead-air/REGISTRO.md` y el `MAPA.md` del ambiente del bloque. Usa las skills `director-h3` (prompts de vídeo) e `interpretacion` (conducta de personajes). Un prompt solo referencia assets por su tag del registro y pega el descriptor tal cual.

## Idioma

Todo en español (España) con ortografía completa. Los prompts para los modelos, en inglés.

## Generaciones de pago

Nunca lances una generación (fal.ai, ElevenLabs, H3 Max, nano-banana) sin aprobación explícita del usuario en la conversación. Todo envío deja su entrada en `assets/<lote>/<bloque>/attempts.json`. Un reintento cambia **una** línea del prompt y la cita en `changedLine`.

## Ficheros generados: no editar a mano

`personajes/<id>/hoja.md`, `personaje.json`, `ambientes/<id>/escenario.json`, `capitulos/<id>/capitulo.json` y `REGISTRO.md` se regeneran desde `proyecto.json` o `registro.json`. Cambia la fuente con un script (`scripts/perfil.mjs`, `scripts/registro.mjs`) o con la app. Los ficheros extra en esas carpetas (`ref/`, `MAPA.md`) sí se conservan.

## Límites del adaptador H3 Max

15 s por bloque · 8 imágenes de referencia · 768P · mínimo 5 s pedidos · devuelve 0,15–0,7 s de más · ~4 palabras por segundo de diálogo más 1 s de cola.

## Entornos 3D

Para crear o corregir un escenario 3D, seguir `ENTORNOS-3D.md` (constructor en código, cámara calibrada con la referencia, bucle de comparación, planta editable por el usuario).

## Cambios en la app

Lógica nueva = funciones puras en `app/workflow.mjs` con test en `test/*.test.mjs`. `npm test` antes de cerrar. No tocar `app/app.source.js` ni `app/stage.js` salvo petición expresa (`npm run build:ui` tras editar la UI).

## Scripts de producción

`scripts/registro.mjs` (sync · freeze · render · check), `scripts/perfil.mjs` (perfiles de interpretación y voice prompt), `scripts/mapa-espacial.mjs` (borrador de mapa por landmarks), `scripts/pendientes.mjs` (importar · listar el tablero de pendientes), `scripts/entorno-glb.mjs` (exporta a GLB un entorno 3D con constructor), `scripts/entorno-coplanares.mjs` (detecta caras coplanarias que parpadean; pasarlo tras tocar un constructor), `scripts/prompts-pendientes.mjs` (lista los `.prompt.txt` de imagen cuya imagen aún no existe, con sus adjuntos), `scripts/storyboard-a-secuencia.mjs` (rellena una secuencia con las viñetas de un storyboard, para el modo fotograma de `PROCESO.md`), `scripts/storyboard-prompts.mjs` (exporta las viñetas de un storyboard a `.prompt.txt` para ChatGPT y, con `--enlazar`, enlaza los fotogramas generados), `scripts/fusionar.mjs` (herramienta web en :4398 para fusionar una edición de ChatGPT con su original a pincel; guarda la edición cruda como `.chatgpt.png` y la máscara), `scripts/bloques/{masters,planificar,render,prompt,enviar,estado,montar,informe,voces}.mjs`, `scripts/linea-base.mjs` (instantánea de digests, GLB, coplanares y capturas 3D para detectar regresiones; comparar dos con `diff -r`). La vista Montaje de la app (`app/montaje.source.js`, `app/montaje.mjs`) revisa y remonta lotes con los mismos `attempts.json`.

## Git

Dos repositorios: `rodaje/` (código y docs; `proyectos/` ignorado) y `proyectos/dead-air/` (solo texto: reglas, registro, prompts, planes, intentos). Commit solo cuando el usuario lo pida.
