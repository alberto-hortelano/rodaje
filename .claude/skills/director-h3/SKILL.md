---
name: director-h3
description: Rellena y revisa el prompt de un bloque de vídeo para H3 Max (reference-to-video con guía 3D) siguiendo PROCESO.md y REGLAS.md. Úsala cuando haya que escribir, completar o reintentar el prompt de un bloque de un lote en proyectos/<id>/assets/<lote>/<bloque>/.
---

# Director de prompts H3

Eres el director de prompts de un bloque. El generador `scripts/bloques/prompt.mjs` ya ha escrito el esqueleto en orden fijo con todo lo que sale de datos. Tu trabajo es rellenar los huecos `[[ACTING]]`, `[[LOCAL]]` (y `[[LOCATION MAP]]` si no hay mapa) y, en un reintento, cambiar **una sola línea**. Nunca envías: eso lo hace el usuario con `enviar.mjs` tras aprobar.

## Modo fotograma: la salida es direccion.json

En un lote en modo fotograma (image-to-video desde la viñeta, `PROCESO.md`) no editas `prompt.txt`. Escribes la entrada del bloque en `assets/<lote>/direccion.json`, dentro de `blocks`: `camera`, `action`, `acting` (sustituye CHARACTER ACTING entero) y `local` (solo los locks de este plano). `people` sustituye el recuento del resumen y la frase de reparto cuando hay figuras de fondo que no están en la viñeta; `fin: true` ancla el mismo fotograma como fotograma final. Las coletillas de `REGLAS.md` del proyecto que valen para todo el lote van una sola vez en `locks` (`{"text": …, "when": "cast"}` si solo aplican con reparto) y no se repiten en `local`. Después, `node scripts/bloques/prompt.mjs <lote> <bloque> --force` genera el `prompt.txt`. En un reintento cambias **un** campo, mueves el valor anterior a `historial` con `hasta` y citas el campo en `changedLine`. Para el descriptor de un personaje en un estado (a pie, muerto…), `node scripts/registro.mjs describe id@estado`.

## Qué lees antes de escribir

1. `PROCESO.md` (qué controla cada referencia) y `proyectos/<id>/REGLAS.md`.
2. `proyectos/<id>/registro.json`: solo tags `approved`; los descriptores se pegan tal cual, nunca se parafrasean.
3. `proyectos/<id>/ambientes/<ambiente>/MAPA.md` del bloque.
4. `proyectos/<id>/capitulos/<episodio>/escenas/sNN.json` (interpretación de la escena, creada con la skill `interpretacion`).
5. `assets/<lote>/<bloque>/frame-start.png` y `frame-mid.png` (la guía) y, si existe, `attempts.json` (para no repetir un cambio ya probado).

Los scripts imprimen el proyecto que usan (`Proyecto: X (fuente)`, en stderr); compruébalo antes de dejar que escriban.

## Cuatro fases, en silencio

**1. Deconstruir.** Solo este bloque. Elimina cualquier referencia a otros bloques ("como antes", "continúa"), personajes que no están en cuadro, props que no se ven y tags no usados.

**2. Diagnosticar.** Responde estos doce checks y convierte cada riesgo en un lock local dentro de `[[LOCAL]]`, citando la regla:
- ¿El primer fotograma contiene a todos los que deben verse en las posiciones de Video 1? (FIRST FRAME)
- ¿El número de personas es exactamente el número de proxies? (R02)
- ¿Cada línea tiene el canal de voz de su variante: radio en roja, muffled en amarilla, directo en verde? (R07)
- ¿Las voces off (PA, radio remota, EXT) aparecen como evento sin `<d>` y sin cuerpo? (R08)
- ¿PHYSICS refleja la gravedad del plano y el estado de los props de `staging`? (R15, R16)
- ¿El lado de cámara y el eje de 180° son los del `MAPA.md` y los del bloque anterior? (R19)
- ¿Hay una sola óptica y coincide con la guía? (R20)
- ¿El diálogo cabe: `dialogueBudget` ≤ duración − 1 s? (R12)
- ¿Las posiciones se atan a landmarks del mapa y nunca a metros?
- ¿Todas las prohibiciones están escritas como resultados? Solo se admiten los negativos de la lista blanca de `blockPrompt()`. (R21)
- ¿La interpretación está escrita como conducta, sin "sad/angry/afraid"? (skill `interpretacion`, R17)
- ¿Cada riesgo detectado tiene su lock con "= failed take" y número de regla?

**3. Rellenar.** Solo los huecos. No reordenes secciones ni reescribas lo generado. `[[ACTING]]`: un párrafo por personaje en cuadro, en su registro, reescrito para este bloque (nunca pegado del perfil maestro). `[[LOCAL]]`: los locks de la fase 2, en frases de estado ("Visors stay closed" y no "no open visors"). En un **reintento**: cambia exactamente una línea, el resto palabra por palabra; escribe la línea nueva en `attempts.json.changedLine`. Al quinto intento no cambies la frase: propón cambiar el bloque (dividir, quitar una acción, inserto de objeto, otra cámara en el 3D) y para.

**4. Entregar.** Guarda `prompt.txt` (el script de envío lo versiona como `prompt-vNN.txt`) y responde con el diff frente al intento anterior y la lista de reglas que cubre cada lock. Nada de razonamiento dentro del prompt.

## Lenguaje del prompt

Inglés directo y físico: verbos visibles (stands, keys, grips, turns, drifts), lados de cuadro (frame-left, frame-right), landmarks del mapa, tiempos con dos decimales. Estados, no transiciones: el personaje ya está a mitad de acción. Densidad alta donde hay control (identidad, primer frame, manos, tiempos, gravedad, luz) y baja en adjetivos.
