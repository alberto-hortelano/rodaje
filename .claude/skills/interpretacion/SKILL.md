---
name: interpretacion
description: Escribe la interpretación de los personajes como conducta bajo presión (objetivo, obstáculo, tácticas, beats, business, tics con disparador) para una escena o un bloque, y los perfiles maestros y voice prompts por personaje. Úsala al crear escenas/sNN.json, al rellenar [[ACTING]] o al definir `acting`/`voicePrompt` con scripts/perfil.mjs.
---

# Sistema de interpretación

Axioma: actuar es **conducta bajo presión**, nunca mostrar una emoción. Un personaje quiere algo, algo se interpone, y actúa; la emoción aparece sola. Las palabras "sad", "angry", "afraid", "happy", "nervous", "worried", "scared" no aparecen jamás en un prompt (`forbiddenEmotionWords()` lo comprueba).

## Nuestra limitación cambia el sistema

En **zona roja** el casco está sellado y el visor es opaco: no hay cara. La interpretación es cuerpo, manos, ritmo, orientación del casco, distancia entre cuerpos y voz. En **zona amarilla** se ven los ojos sobre el respirador: se añade la vida ocular. En **zona verde** se aplica todo, cara incluida.

## Los cinco pilares, por personaje y por escena

1. **Objetivo**: un verbo dirigido a otro personaje ("make Earl lock the cradle before Brady spends the money"). Nunca un estado.
2. **Obstáculo y apuesta**: qué lo impide y qué pasa si no lo consigue.
3. **Tácticas**: verbos de acción en orden (cut short, command, deflect, stall, charm, shame). Cuando una falla, cambia.
4. **Beats**: 2–4 cambios visibles en el bloque: una pausa, un cambio de postura, de tempo, un giro de casco. Sin cambio visible, la escena es plana.
5. **Business**: la tarea física (cincha, cierre, panel, botón de radio). La acción interrumpida es el acento más fuerte: si deja de tensar la cincha en una frase, la frase se convierte en evento.

Además: **escucha** (la reacción empieza antes de que acabe la línea del otro), **proxémica** (quién acorta la distancia, quién la rompe), **estatus** (quien manda se mueve menos y habla más bajo), y **estados, no transiciones** (ya está mid-acción).

## Perfil maestro (campo `acting` del personaje, vía `scripts/perfil.mjs`)

Un párrafo de 150–220 palabras en inglés, con este orden: cuerpo como biografía (edad, complexión, postura, desgaste) · motor psicológico en una frase · perfil vocal dramático (cómo cambia bajo presión) · tics **con disparador** ("when someone says Brady, she exhales a cough-laugh over the radio") · un andar con nombre ("a low, rolling old-steward's walk") · la máscara y su grieta ("However, when the PA speaks, she looks at the mural for one beat") · un solo objeto de ternura. Sin vestuario, sin cámara, sin color: el perfil sobrevive a cualquier variante.

## Voice prompt (campo `voicePrompt`, va al registro como `<ID>_VOICE`)

Una o dos frases, fijas para toda la serie, pegadas siempre verbatim: "A [edad]-year-old [origen/acento]. [Timbre y registro]; [ritmo y manera]; [carácter, y cómo cambia bajo presión]."

## Adaptación por escena: `capitulos/<episodio>/escenas/sNN.json`

```json
{"scene":1,"axis":"the centre rail; camera on the rail side",
 "characters":{"roz":{"objective":"…","obstacle":"…","tactics":["…"],"beats":["…"],"business":"…","tic":{"trigger":"…","action":"…"},"mask_crack":"However, when …","paragraph":"ROZ … (prosa final en inglés, 60–110 palabras, en su registro)"}},
 "local_constraints":["A smile behind the visor = failed take (R17)","Any turn toward the lens = failed take (R22)"]}
```

`paragraph` es lo que entra en CHARACTER ACTING: reescribe el perfil maestro para este momento, no lo pegues. Transforma un tic que no cabe (si está sentado, el andar se convierte en balanceo) en vez de borrarlo. Cada personaje en cuadro tiene su párrafo; ninguno que no esté.

## Comprobación antes de entregar

Objetivo como verbo hacia alguien · apuesta real · 2–4 beats visibles · reacción antes de que acabe la línea del otro · business y acción interrumpida · distancias motivadas · tics con disparador y máscara con grieta · voice prompt verbatim · sin vestuario, cámara ni color · sin palabras de emoción · ¿puntúa 4 de 5 (vivo: conducta continua, tácticas contrastadas, subtexto distinto del texto)?
