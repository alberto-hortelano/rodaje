# Proceso de producción (canónico)

Pipeline único para producir un episodio con Rodaje: **bloques de 5–15 s con guía 3D y diálogo nativo de H3 Max**. La app genera la escena 3D, las guías y las aprobaciones; los bloques se planifican, se generan, se revisan y se montan con los scripts de `scripts/bloques/`. La app **no** emite vídeo final (su paso "fotograma + H3" se conserva solo para pruebas; ver README).

Está inspirado en la disciplina de *The Prompter* (Allan Ripley, Higgsfield, 2026): registro de assets con descriptores congelados, reglas con condición de fallo, prompt en bloques de orden fijo, mapa espacial por landmarks, master shot por escena, interpretación como conducta, una línea por intento y montaje en paralelo. Se adapta a nuestras dos diferencias: tenemos guía de vídeo 3D (blocking, cámara y tiempos van en Video 1) y H3 Max limita a 15 s, 8 imágenes y 768P.

## Proyecto

Los scripts no suponen ningún proyecto. Lo toman, por este orden, de `--project <id>`, del argumento posicional donde el script ya lo admitía (`[proyecto]`), de `RODAJE_PROJECT` o del proyecto activo en la app (el último abierto o creado en la vista Proyectos, guardado en `<datos>/.activo.json`). Siempre imprimen en stderr `Proyecto: X (fuente)`: compruébalo antes de dejar que un script escriba. Sin proyecto válido muestran el uso y salen con código 2 sin tocar nada.

## Los ocho pasos

1. **Guion → capítulo de ensayo.** `storyboardToEpisode()` (la vista Storyboards lo hace con un clic) o un importador de un solo uso escrito para el guion del proyecto. Cada plano lleva `gravity`, `variant`, `staging` (tareas, movimientos, estado de props) y `coverage`.
2. **Ensayo 3D con voz del navegador y rough cut v0.** Coste cero. Mide duraciones reales y deja el episodio completo visible desde el primer día (`scripts/bloques/montar.mjs` con guía + TTS).
3. **Registro de assets.** Cada personaje por variante, cada voz, cada ambiente y cada sonido firma tiene un tag fijo y un descriptor congelado en `proyectos/<id>/registro.json`. **Si no está en el registro, no entra en el prompt.** `node scripts/registro.mjs sync|freeze|render|check [proyecto]` (con `freeze`, los TAG van detrás; un proyecto con id en mayúsculas va con `--project`).
4. **Mapa espacial y master shot por ambiente.** `ambientes/<id>/MAPA.md`: landmarks en orden de lectura, lado de cámara, línea de 180°, vocabulario de posiciones (nunca metros). Un plano `MASTER · <ambiente>` de 1 s, gran angular y sin líneas, abre la primera secuencia de cada ambiente; su primer fotograma aceptado pasa a ser la plate del registro (continuidad por referencia, no por extensión).
5. **Planificación de bloques.** `node scripts/bloques/planificar.mjs <lote> <episodio> <secuencia> [--project id]` produce `assets/<lote>/plan.json`: bloques 5–15 s, nunca parte una línea, presupuesto de diálogo ≤ duración−1 s, un ambiente y un trayecto por bloque, corte preferente en cambio de cobertura.
6. **Guía por bloque.** `node scripts/bloques/render.mjs <lote> [--project id]` → `motion.mp4` (sin rótulos), `frame-start.png`, `frame-mid.png`.
7. **Prompt, envío, intento, revisión.** `node scripts/bloques/prompt.mjs <lote> [bloque] [--project id]` genera el esqueleto en orden fijo con huecos `[[ACTING]]` y `[[LOCAL]]` que rellena la skill `director-h3`. `enviar.mjs` rechaza prompts con huecos, resuelve referencias por tag y **registra el intento** en `attempts.json`. La revisión (`estado.mjs --verdict` o la vista Montaje) cita reglas de `docs/REGLAS.md` o de `proyectos/<id>/REGLAS.md`, o crea antes una nueva en el del proyecto. Reintento = una línea cambiada; al quinto intento se cambia el bloque (R26).
8. **Montaje incremental y sonido.** `montar.mjs` sustituye cada hueco del rough cut por el bloque aceptado (`edit.mp4` con `usedRange`). Voces off (PA, radio remota) y sonidos firma se generan aparte y se mezclan en post. Música: un tema recurrente, fuera del prompt. La vista **Montaje** de la app reproduce cada corte con el plano, la toma, la viñeta y la escena de cada momento; desde ahí se acepta o rechaza cada toma (con sus reglas), se recorta el tramo usado y se vuelve a montar (solo se recodifican los bloques que cambian).

## Montaje y sonido

- **Cortes J y L.** El sonido cruza el corte: en un corte L la voz del plano anterior sigue sobre el siguiente (la reacción del que escucha); en un J la del siguiente entra antes de que cambie la imagen (la voz que abre el contraplano). La reacción empieza antes de que acabe la frase del otro.
- **Eje de 180°.** Todas las cámaras de una conversación quedan del mismo lado de la línea que une a los personajes; el lado se fija en el `MAPA.md` del ambiente y en el `coverage` del plano. Cruzarlo exige un plano que lo motive.
- **Una sola cama de ambiente.** El ambiente es una pista continua por escena, aparte del vídeo, que no se reinicia en los cortes; al cambiar de sala cambia el tono con un fundido corto (unos 0,6 s). Bajo el diálogo, atenuación suave.
- **Diálogo.** Voces con el nivel activo igualado; radio, megafonía o teléfono con su filtrado propio, aplicado después de limpiar la voz (`docs/mixamo.md`, «Limpieza de voces»). Las pausas entre réplicas son decisiones de cada escena, no reglas.
- **Pistas separadas.** Ambiente, efectos, diálogo y mezcla en ficheros aparte, con un informe de niveles (RMS, pico) y tiempos; la aprobación de la escucha es del usuario.

## Modo fotograma (sin guía 3D)

Para escenas que el visor 3D no puede representar, como exteriores a caballo, cada plano se genera desde el fotograma aprobado de su viñeta de storyboard. Se usa `minimax/h3-max/image-to-video`: el fotograma es el primer fotograma exacto y la frase ya dicha va como `target_audio_url`. No hay vídeo guía ni hojas adjuntas, así que la identidad se sostiene con el fotograma y los descriptores del registro.

1. `node scripts/storyboard-a-secuencia.mjs [proyecto] <storyboard> <secuencia>`: rellena la secuencia con un plano por viñeta.
2. Voces con ElevenLabs, en `scripts/bloques/voces.mjs`. Todo es de pago salvo el ensayo sin `--yes`. Siempre por fal, que incluye derechos de uso comercial: solo ve las voces de serie y las de la biblioteca pública de ElevenLabs, no las de una cuenta propia. El vídeo usa el audio de la frase tal cual y los labios lo siguen, así que la interpretación de la voz es la del vídeo.
   - `lineas <episodio> <secuencia>`: genera cada frase. Usa la estabilidad y las etiquetas por defecto del `casting.json` del personaje (campos `stability` y `tags`, p. ej. `"[quietly]"`) y, si la línea lo trae, las etiquetas de su campo `delivery`. Las etiquetas no se pronuncian: dirigen la entonación.
   - `prueba --voz <id> --texto "…" [--estabilidad n]`: una frase suelta para comparar voces, sin tocar el proyecto.
   - `cambiar <episodio> <secuencia> <línea> <grabación>`: una grabación con la interpretación buscada, pasada a la voz del personaje con el cambiador de voz.

   Si cambia el audio de una frase, repetir `planificar.mjs --force` y `prompt.mjs` del bloque, para que la copia del lote y `refs.json` recojan el audio nuevo.
3. `node scripts/bloques/planificar.mjs <lote> <episodio> <secuencia> --project <id> --por-plano`: un bloque por plano.
4. `prompt.mjs`: hace el esqueleto con `framePrompt()`. La skill `director-h3` no edita `prompt.txt`: escribe la entrada del bloque en `assets/<lote>/direccion.json` (`camera`, `action`, `acting`, `local`, opcionales `people` y `fin`) a partir del fotograma, y `node scripts/bloques/prompt.mjs <lote> [bloque] --force` la aplica: rellena `[[CAMERA]]`, `[[ACTION]]` y `[[LOCAL]]` (frase de reparto, `local` y las coletillas de `locks`) y sustituye CHARACTER ACTING. `fin: true` pone el fotograma como `endImage` en `refs.json`. Un bloque sin entrada es un prompt dirigido a mano: `prompt.mjs` no lo toca salvo que se nombre. Un reintento cambia un solo campo, mueve el valor anterior a `historial` (`{"camera": "…", "hasta": "intento 2"}`) y cita ese campo en `changedLine`. Sin `--force`, `prompt.mjs` deja `prompt.generated.txt` para comparar y regenera `refs.json` conservando `endImage`, como tras cambiar una voz.

   ```json
   {"_nota": "texto libre", "locks": ["Anyone entering the frame = failed take (R-xx).", {"text": "Any look into the lens = failed take (R-yy).", "when": "cast"}],
    "blocks": {"b02": {"camera": "…", "action": "…", "acting": "…", "local": "…", "fin": true}}}
   ```

   Los estados de un personaje (a pie, muerto, sin cinto…) se guardan en `registro.json`, en `states` del asset (`{"a-pie": {"drop": [", on horseback"], "note": "on foot, …"}}`); `node scripts/registro.mjs describe [proyecto] <id>@a-pie` imprime el descriptor que se pega en la viñeta o en `people`, y `check` avisa si una frase quitada ya no está en el descriptor. `[[LOCAL]]` lleva solo las restricciones que tocan a ese plano, nunca las de toda la escena: una restricción que describe otra acción («los seis se van a caballo») hace que el modelo la pinte.
5. `enviar.mjs`: como siempre. Por defecto usa H3 Max. Con `--modelo h3` usa el H3 original, que respeta mucho mejor el encuadre del fotograma. En producción, H3 Max cortaba a otro plano o se acercaba a una cara en los planos de grupo y en los de una figura lejana, aunque se le prohibiera y se anclara el fotograma final; H3 original los sacó a la primera. Los planos largos (12 s) siguen invitando a cortes, así que conviene no pasar de unos 8 s. Exige el fotograma y los descriptores del reparto congelados, y monta `voz.wav` con silencio hasta el inicio de la línea.

## Qué controla cada referencia

| Referencia | Controla | No controla |
|---|---|---|
| Video 1 (guía 3D) | Encuadre, trayectoria de cámara, posiciones y rutas, contacto con props, estado de gravedad, tiempos de habla | Aspecto de personas y materiales |
| Imagen de personaje (tag `<ID>_<VARIANTE>`) | Identidad, vestuario y su estado | Posición, encuadre |
| Imagen de ambiente (tag `<AMBIENTE>_PLATE`) | Geometría, materiales, luz y atmósfera **solamente** | Encuadre (nunca es un ángulo de cámara) |
| Audio n (tag `<ID>_VOICE`) | Timbre y acento del hablante n | Texto, tiempos (van en el prompt) |

**La guía no elige quién habla.** H3 no ofrece control del hablante por máscaras ni por una boca dibujada en la guía: se probaron rótulos, luces de pecho y bocas guía que se abrían con el audio, y el modelo los pinta en vez de obedecerlos. La guía va limpia (R04) y quién habla se fija en ACTION TIMING y con las referencias de voz. Si el modelo intercambia hablantes, se divide la conversación por intervención, con un solo hablante visible por plano.

## Orden del prompt

Se conservan los nombres de sección que H3 Max ya respeta (`subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, `non_diegetic_music`). Dentro de `detailed_description` los bloques van siempre en este orden: LOCATION MAP → FIRST FRAME → OPTICS → CAMERA → ACTION TIMING → CHARACTER ACTING → PHYSICS → LIGHTING → STYLE → QUALITY → POSITIVE CONSTRAINTS. Las prohibiciones se escriben como resultados ("the table stays clear"), no como bans; solo se admiten tres negativos literales (ver `blockPrompt()` en `app/workflow.mjs`).

## Límites del adaptador

15 s por bloque, 8 imágenes de referencia, 768P, mínimo 5 s pedidos (el modelo devuelve entre 0,15 y 0,7 s de más: se recorta en post). Diálogo al reloj real: ~4 palabras por segundo más silencios más 1 s de cola limpia.

## Registro de intentos y coste

Cada envío crea una entrada en `assets/<lote>/<bloque>/attempts.json` con prompt versionado (`prompt-vNN.txt`), referencias por tag, duración pedida y devuelta, segundos de inferencia, veredicto, reglas incumplidas y línea cambiada. `node scripts/bloques/informe.mjs <lote> [--project id]` agrega el lote en `INFORME.md` con coste estimado según `precios.json`.

## Decisión pendiente

Migrar a Seedance 2.5 (hasta 50 referencias, voz nativa) **solo** si, tras repetir la escena 1 con este protocolo, la aceptación por bloque sigue por debajo del 50 %. Hasta entonces, H3 Max en fal.ai.

## Documentos relacionados

- `README.md`: cómo abrir y usar la app.
- `docs/REGLAS.md`: reglas generales con condición de fallo; las de cada proyecto, en `proyectos/<id>/REGLAS.md`, que las hereda.
- `proyectos/<id>/REGISTRO.md`: registro legible de assets (generado).
- `.claude/skills/director-h3/SKILL.md` y `.claude/skills/interpretacion/SKILL.md`.
- `docs/mixamo.md`: figuras del ensayo 3D y limpieza de voces.
- `docs/ENTORNOS-3D.md`: cómo se hace un escenario 3D.
- `docs/scripts.md`: catálogo de scripts.
- `GENERAR-IMAGENES.md`: imágenes que genera el usuario con ChatGPT.
