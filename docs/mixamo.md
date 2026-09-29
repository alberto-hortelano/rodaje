# Figuras Mixamo en el ensayo 3D

El ensayo y las guías (`app/stage.js`) ponen por personaje una figura Y-Bot de Mixamo (`/assets/y_bot.fbx`, en la carpeta `assets/` del repositorio) con el color del personaje. Las animaciones son opcionales y se configuran por proyecto.

## Configuración

`proyecto.json` → `stage.rehearsal.animations`: `library` (carpeta de FBX dentro del proyecto) y `clips`, con un nombre de clip por rol: `idle` (espera y base de conversación), `talk` (quien habla) y `walk` (desplazamientos). El fichero es `<library>/<clip>.fbx`. Solo se aplican en planos con `rehearsal: true`. Se revisa con `node scripts/stage-config.mjs check` y se guarda con `set --desde fichero.json`. Sin configuración, las figuras usan solo la pose procedural (respiración, miradas, gestos).

## Unidades

El rig de Mixamo está en centímetros y la escena en metros: el modelo se escala a 0,01. Las posiciones de los planos (blocking, cámaras) van en metros; las de los huesos y lo que cuelga de un hueso (cabeza, boca, casco), en centímetros.

## Qué entra de cada clip

- `talk`, y cualquier clip en pose sentada o montada: solo hombros, brazos, manos y dedos (pistas Shoulder, Arm, Hand, Thumb, Index, Middle, Ring y Pinky). Se descartan raíz, piernas y tronco: hay clips de «hablar de pie» con la cadera a unos 70 cm que, enteros, sientan a la figura.
- Raíz (`mixamorigHips.position`): se anulan X y Z (el recorrido lo manda el plano, no el clip) y la Y se reescala a una cadera de 100 cm (factor 100 ÷ altura de cadera del clip). Tras quitar X/Z hay que comprobar que los pies no flotan ni se hunden.
- Los tres clips corren a la vez y se mezclan por peso; al empezar solo pesa `idle`.
- Pose sentada: cadera a 60 cm, piernas y brazos orientados con un apuntado simple y un asiento de caja.
- Pose montada: cadera a la altura de la silla, muslos abiertos y piernas colgando. El jinete no usa `walk` (pesa `idle` aunque el plano lo desplace): el paso lo da la montura (`docs/ensayo-3d.md`).

## Elegir clips

- Probados: `walking` (recorrido), `idle_breathing` (espera) y `standing_talking` (solo tren superior, sumado al reposo con peso fijo de 0,28 mientras el personaje habla en cuadro y no camina; sin transición al empezar ni al terminar).
- Candidatos: `idle_neutral`, `idle_look_around`, `sitting_idle`, `sitting_talking`, `arms_crossed`, `drinking`, `leaning_wall`.
- Nada de clips de combate para gestos cotidianos. Si no hay clip para una acción (sujetar una caja), capa procedural sobre el reposo.

## Limpieza de voces

- Se conserva el original. La copia limpia es WAV PCM de igual duración y posición: paso alto a 40 Hz, reducción espectral suave (8 dB, suelo −42 dB), entrada de 18 ms y salida de 55 ms.
- Nada de recortar sílabas ni cambiar la velocidad. El desfase se comprueba por correlación: debe ser 0 ms.
- Escucha A/B: original, pausa, procesada. La bajada de nivel al inicio mide energía, no demuestra que todo fuera ruido: donde la voz empieza de inmediato manda conservar la palabra.
- Radio y megafonía se aplican después de limpiar.
- Si el artefacto es parte de la locución, se prueba otra toma o el aislador de voz (por fal) antes de cambiar el casting. Eleven v3 no ofrece similarity, speed ni speaker boost.
