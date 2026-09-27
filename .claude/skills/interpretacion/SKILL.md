---
name: interpretacion
description: Escribe la interpretación de los personajes como conducta bajo presión (objetivo, obstáculo, tácticas, beats, business, tics con disparador) para una escena o un bloque, y los perfiles maestros y voice prompts por personaje. Úsala al crear escenas/sNN.json, al rellenar [[ACTING]] o al definir `acting`/`voicePrompt` con scripts/perfil.mjs.
---

# Sistema de interpretación

Axioma: actuar es **conducta bajo presión**, nunca mostrar una emoción. Un personaje quiere algo, algo se interpone, y actúa; la emoción aparece sola. Las palabras "sad", "angry", "afraid", "happy", "nervous", "worried", "scared" no aparecen jamás en un prompt (`forbiddenEmotionWords()` lo comprueba).

## Cuando no se ve la cara

Si el plano oculta la cara (casco, máscara, distancia, de espaldas), la interpretación es cuerpo, manos, ritmo, orientación de la cabeza, distancia entre cuerpos y voz. Si solo se ven los ojos, se añade la vida ocular. Con la cara visible se aplica todo. Qué variante o vestuario oculta qué lo fija el `REGLAS.md` del proyecto.

## Los cinco pilares, por personaje y por escena

1. **Objetivo**: un verbo dirigido a otro personaje ("make her brother sign before the notary arrives"). Nunca un estado.
2. **Obstáculo y apuesta**: qué lo impide y qué pasa si no lo consigue.
3. **Tácticas**: verbos de acción en orden (cut short, command, deflect, stall, charm, shame). Cuando una falla, cambia.
4. **Beats**: 2–4 cambios visibles en el bloque: una pausa, un cambio de postura, de tempo, un giro de cabeza. Sin cambio visible, la escena es plana.
5. **Business**: la tarea física (una cuerda, un cierre, un panel, una taza). La acción interrumpida es el acento más fuerte: si deja de apretar el nudo en una frase, la frase se convierte en evento.

Además: **escucha** (la reacción empieza antes de que acabe la línea del otro), **proxémica** (quién acorta la distancia, quién la rompe), **estatus** (quien manda se mueve menos y habla más bajo), y **estados, no transiciones** (ya está mid-acción).

## Perfil maestro (campo `acting` del personaje, vía `scripts/perfil.mjs`)

Los scripts imprimen el proyecto que usan (`Proyecto: X (fuente)`, en stderr); compruébalo antes de escribir con `perfil.mjs set`.

Un párrafo de 150–220 palabras en inglés, con este orden: cuerpo como biografía (edad, complexión, postura, desgaste) · motor psicológico en una frase · perfil vocal dramático (cómo cambia bajo presión) · tics **con disparador** ("when someone mentions the debt, she laughs once through her nose") · un andar con nombre ("a low, rolling old-steward's walk") · la máscara y su grieta ("However, when the bell rings, she looks at the door for one beat") · un solo objeto de ternura. Sin vestuario, sin cámara, sin color: el perfil sobrevive a cualquier variante.

## Voice prompt (campo `voicePrompt`, va al registro como `<ID>_VOICE`)

Una o dos frases, fijas para toda la serie, pegadas siempre verbatim: "A [edad]-year-old [origen/acento]. [Timbre y registro]; [ritmo y manera]; [carácter, y cómo cambia bajo presión]."

## Adaptación por escena: `capitulos/<episodio>/escenas/sNN.json`

```json
{"scene":1,"axis":"the table; camera on the window side",
 "characters":{"ana":{"objective":"…","obstacle":"…","tactics":["…"],"beats":["…"],"business":"…","tic":{"trigger":"…","action":"…"},"mask_crack":"However, when …","paragraph":"ANA … (prosa final en inglés, 60–110 palabras, en su registro)"}},
 "local_constraints":["A posed smile = failed take (regla de interpretación del proyecto)","Any turn toward the lens = failed take (R22)"]}
```

`paragraph` es lo que entra en CHARACTER ACTING: reescribe el perfil maestro para este momento, no lo pegues. Transforma un tic que no cabe (si está sentado, el andar se convierte en balanceo) en vez de borrarlo. Cada personaje en cuadro tiene su párrafo; ninguno que no esté.

## Comprobación antes de entregar

Objetivo como verbo hacia alguien · apuesta real · 2–4 beats visibles · reacción antes de que acabe la línea del otro · business y acción interrumpida · distancias motivadas · tics con disparador y máscara con grieta · voice prompt verbatim · sin vestuario, cámara ni color · sin palabras de emoción · ¿puntúa 4 de 5 (vivo: conducta continua, tácticas contrastadas, subtexto distinto del texto)?
