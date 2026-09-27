# Reglas generales de producción

Valen para todos los proyectos de Rodaje. Cada proyecto añade las suyas en `proyectos/<id>/REGLAS.md` y hereda estas: la vista Montaje y `scripts/bloques/estado.mjs --verdict` ofrecen y aceptan las dos listas juntas (`projectRules()` en `lib/lotes.mjs`).

Una regla solo cuenta si lleva su condición de fallo. Toda revisión que rechace un intento cita al menos un id de regla (general o del proyecto) en `attempts.json` → `failedRules`, o añade antes una regla nueva al `REGLAS.md` del proyecto con su origen.

Formato: encabezado de tercer nivel `<ID> · <título>` y tres líneas: **Regla** (qué debe verse) · **Fallo** (qué convierte la toma en *failed take*) · **Dónde** (bloque del prompt y comprobación). El origen de cada regla (el plano que se rompió sin ella) se apunta en el proyecto donde nació.

Numeración: los ids se conservan porque los intentos antiguos los citan. Los huecos (R07, R08, R13–R20, R24, R25) son reglas propias de un proyecto. Un proyecto no puede repetir un id de este fichero: `projectRules()` lo rechaza. Una regla general nueva toma un número que no use ningún proyecto.

## Todos los modos

### R01 · Set idéntico entre bloques consecutivos
Regla: distribución, materiales y color del decorado se mantienen de un bloque al siguiente dentro de la misma escena.
Fallo: cualquier cambio de distribución, material o color entre bloques = failed take.
Dónde: LOCATION MAP y plate del registro; comparar `frame-start.png` del bloque con `frame-mid.png` del anterior.

### R05 · Fondo real en todo primer plano
Regla: un single lleva detrás el set del mapa, no el fondo neutro de la hoja de personaje.
Fallo: fondo gris o liso de hoja en un primer plano = failed take.
Dónde: LOCATION MAP; con guía 3D, la plate va siempre entre las referencias aunque el plano sea cerrado; en modo fotograma, el fotograma aprobado ya lleva el fondo.

### R06 · Una hoja = una persona
Regla: las vistas múltiples de una hoja de personaje describen a una sola persona.
Fallo: las vistas aparecen como personas distintas = failed take.
Dónde: `retention_analysis` (texto fijo).

### R12 · Bloque de 5–15 s con diálogo al reloj real
Regla: palabras ≤ 4 por segundo, más silencios escritos, más 1 s de cola limpia; el presupuesto de diálogo no supera duración − 1 s.
Fallo: última línea cortada, acelerada o solapada con el final = failed take.
Dónde: `dialogueBudget()` en `planificar.mjs`; línea «Finish all words by <t>s».

### R21 · Prohibiciones de estilo como resultados
Regla: el estilo del proyecto (`style` en `proyecto.json`) se escribe como lo que hay en cuadro (superficies, luz, época, desgaste), nunca como lista de prohibiciones; solo se admiten los tres negativos literales de `blockPrompt()`.
Fallo: aparece en cuadro algo que el estilo del proyecto excluye (tecnología, época, acabado o elemento ajeno) = failed take.
Dónde: STYLE (verbatim); lista blanca de negativos en `blockPrompt()` (`app/workflow.mjs`).

### R22 · Nadie mira a cámara
Regla: las miradas van a otros personajes, a props o a landmarks del mapa; los ojos llegan antes que la cabeza.
Fallo: contacto ocular con la lente = failed take.
Dónde: POSITIVE CONSTRAINTS.

### R23 · Pedir `ceil(duración)` y recortar en post
Regla: la duración pedida es el entero superior de la del bloque (mínimo 5 s); el sobrante se recorta con `usedRange`.
Fallo: corte final a mitad de palabra por pedir la duración exacta = failed take.
Dónde: `enviar.mjs`.

### R26 · Una línea por intento; al quinto se cambia el bloque
Regla: cada reintento cambia exactamente una línea del prompt (en modo fotograma, un campo de `direccion.json`) y la cita en `changedLine`; tras 4 intentos se cambia el bloque (dividir, quitar una acción, convertir el final en inserto, cambiar la cámara en el 3D y regenerar la guía, o cambiar el fotograma). Tope duro: 6 intentos.
Fallo: intento sin `changedLine` a partir del segundo, o más de 6 intentos sobre el mismo bloque = protocolo roto.
Dónde: `enviar.mjs` (exige `--changed` y corta en el séptimo), `informe.mjs` (falla).

## Modo guía 3D

### R02 · Reemplazo 1:1 de proxies
Regla: cada maniquí de Video 1 se convierte en exactamente una persona; el número de personas visibles es el del reparto del bloque.
Fallo: maniquí sin reemplazar, persona extra o duplicada = failed take.
Dónde: `summary` («Exactly N …»), `retention_analysis`; contar personas en `frame-start.png` y `frame-mid.png`.

### R03 · Ninguna superficie de blockout visible
Regla: todo lo que está en cuadro tiene material real desde el primer fotograma.
Fallo: gris sin textura o volumen del kit 3D visible en cualquier fotograma = failed take.
Dónde: QUALITY; revisión visual.

### R04 · Guía limpia: sin rótulos ni marcadores
Regla: la guía se renderiza sin etiquetas, luces de señal ni bocas guía; si hay algo parecido que sí debe verse, el prompt lo describe como estado del vestuario o del decorado. Las marcas no controlan al hablante: el modelo las pinta.
Fallo: texto, marcador o rótulo heredado del 3D = failed take.
Dónde: `retention_analysis`, QUALITY; guía limpia obligatoria (`scripts/bloques/render.mjs` sin `--labels`).

### R09 · Beats al reloj de Video 1
Regla: cada acción ocurre en el segundo en que ocurre en la guía, con ±1 s de margen.
Fallo: beat retrasado o adelantado más de 1,5 s respecto a la guía = failed take.
Dónde: ACTION TIMING con tramos `[a–b]`; comparar con `motion.mp4`.

### R10 · Un bloque = un trayecto en un sentido
Regla: si hay desplazamiento, el bloque contiene una sola ida; el regreso o el cambio de sala es otro bloque con su propia guía.
Fallo: ida y vuelta, o cambio de sala, dentro del bloque = failed take.
Dónde: `planificar.mjs` (corte obligatorio); `summary`.

### R11 · Un movimiento de cámara continuo no se convierte en cortes
Regla: si Video 1 lleva travelling, el bloque es una toma continua.
Fallo: corte por línea de diálogo sobre un movimiento continuo = failed take.
Dónde: `summary` («SINGLE CONTINUOUS TAKE matching Video 1»), CAMERA.
