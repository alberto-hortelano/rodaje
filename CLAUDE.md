# Rodaje · instrucciones para agentes

Aplicación local (Node 24, ESM, Three.js, fal.ai) para producir series y películas con IA. Cada proyecto vive en `proyectos/<proyecto>/`, con su propio repositorio; el código de la app nunca nombra un proyecto concreto.

## Antes de escribir un prompt

Lee, en este orden: `docs/PROCESO.md`, `docs/REGLAS.md` (reglas generales), `proyectos/<proyecto>/REGLAS.md` (las propias, que heredan las generales), `proyectos/<proyecto>/REGISTRO.md` y el `MAPA.md` del ambiente del bloque. Usa las skills `director-h3` (prompts de vídeo) e `interpretacion` (conducta de personajes). Un prompt solo referencia assets por su tag del registro y pega el descriptor tal cual. Las imágenes que genera el usuario con ChatGPT siguen `GENERAR-IMAGENES.md`: tú dejas el `.prompt.txt` con su destino.

## Idioma

Todo en español (España) con ortografía completa. Los prompts para los modelos, en inglés.

## Generaciones de pago

Nunca lances una generación (fal.ai, ElevenLabs, H3, nano-banana) sin aprobación explícita del usuario en la conversación. ElevenLabs, siempre a través de fal. Todo envío deja su entrada en `assets/<lote>/<bloque>/attempts.json`; un reintento cambia **una** línea del prompt y la cita en `changedLine` (R26). Los límites del modelo de vídeo están en `docs/PROCESO.md`.

## Ficheros generados: no editar a mano

`personajes/<id>/hoja.md`, `personaje.json`, `ambientes/<id>/escenario.json`, `capitulos/<id>/capitulo.json` y `REGISTRO.md` se regeneran desde `proyecto.json` o `registro.json`. Cambia la fuente con un script (`scripts/perfil.mjs`, `scripts/registro.mjs`) o con la app. Los ficheros extra en esas carpetas (`ref/`, `MAPA.md`) sí se conservan.

## Cambios en la app

- Todo cambio va por una issue y sigue `docs/FLUJO-ISSUES.md` (agentes en `.claude/agents/`: crítico, arquitecto, ingeniero y QA).
- Arquitectura y contratos: `docs/ARQUITECTURA.md`. `app/` es servidor e interfaz; `lib/`, el núcleo de Node (no importa de `app/`); `viewer/`, el visor 3D del navegador; `scripts/`, órdenes finas sobre `lib/`. El único código de un proyecto son sus constructores de escenario y sus plugins del visor, declarados en `environments[]`.
- Lógica nueva: funciones puras con test en `test/*.test.mjs`. `npm test` en verde antes de cerrar.
- Interfaz: se editan los `app/*.source.js`, nunca `app/app.js`; después, `npm run build:ui` y commit también de `app/app.js` (`docs/UI.md`). `app/stage.js` (ensayo 3D, `docs/mixamo.md`) solo cuando la issue lo pida.
- Escenarios 3D: `docs/ENTORNOS-3D.md`.

## Scripts

Ningún script supone un proyecto: lo toman de `--project <id>`, del posicional `[proyecto]` donde lo había, de `RODAJE_PROJECT` o del proyecto activo en la app, e imprimen `Proyecto: X (fuente)` en stderr; compruébalo antes de dejar que un script escriba. Catálogo completo en `docs/scripts.md`.

## Git

Un repositorio para la app (`rodaje/`, con `proyectos/` ignorado) y uno por proyecto en `proyectos/<proyecto>/` (texto: reglas, registro, prompts, planes, intentos; los binarios se ignoran). Commit solo cuando el usuario lo pida.
