# Proceso de producción (canónico)

Pipeline único para producir un episodio con Rodaje: **bloques de 5–15 s con guía 3D y diálogo nativo de H3 Max**. La app genera la escena 3D, las guías y las aprobaciones; los bloques se planifican, se generan, se revisan y se montan con los scripts de `scripts/bloques/`. La app **no** emite vídeo final (su paso "fotograma + H3" se conserva solo para pruebas; ver README).

Está inspirado en la disciplina de *The Prompter* (Allan Ripley, Higgsfield, 2026): registro de assets con descriptores congelados, reglas con condición de fallo, prompt en bloques de orden fijo, mapa espacial por landmarks, master shot por escena, interpretación como conducta, una línea por intento y montaje en paralelo. Se adapta a nuestras dos diferencias: tenemos guía de vídeo 3D (blocking, cámara y tiempos van en Video 1) y H3 Max limita a 15 s, 8 imágenes y 768P.

## Los ocho pasos

1. **Guion → capítulo de ensayo.** `storyboardToEpisode()` o un importador como `assets/ep01-rehearsal-v01/import.mjs`. Cada plano lleva `gravity`, `variant`, `staging` (tareas, movimientos, estado de props) y `coverage`.
2. **Ensayo 3D con voz del navegador y rough cut v0.** Coste cero. Mide duraciones reales y deja el episodio completo visible desde el primer día (`scripts/bloques/montar.mjs` con guía + TTS).
3. **Registro de assets.** Cada personaje por variante, cada voz, cada ambiente y cada sonido firma tiene un tag fijo y un descriptor congelado en `proyectos/<id>/registro.json`. **Si no está en el registro, no entra en el prompt.** `node scripts/registro.mjs sync|freeze|render|check`.
4. **Mapa espacial y master shot por ambiente.** `ambientes/<id>/MAPA.md`: landmarks en orden de lectura, lado de cámara, línea de 180°, vocabulario de posiciones (nunca metros). Un plano `MASTER · <ambiente>` de 1 s, gran angular y sin líneas, abre la primera secuencia de cada ambiente; su primer fotograma aceptado pasa a ser la plate del registro (continuidad por referencia, no por extensión).
5. **Planificación de bloques.** `node scripts/bloques/planificar.mjs <lote> <episodio> <secuencia>` produce `assets/<lote>/plan.json`: bloques 5–15 s, nunca parte una línea, presupuesto de diálogo ≤ duración−1 s, un ambiente y un trayecto por bloque, corte preferente en cambio de cobertura.
6. **Guía por bloque.** `node scripts/bloques/render.mjs <lote>` → `motion.mp4` (sin rótulos), `frame-start.png`, `frame-mid.png`.
7. **Prompt, envío, intento, revisión.** `node scripts/bloques/prompt.mjs <lote> [bloque]` genera el esqueleto en orden fijo con huecos `[[ACTING]]` y `[[LOCAL]]` que rellena la skill `director-h3`. `enviar.mjs` rechaza prompts con huecos, resuelve referencias por tag y **registra el intento** en `attempts.json`. La revisión cita reglas de `REGLAS.md` o crea una nueva. Reintento = una línea cambiada; al quinto intento se cambia el bloque (R26).
8. **Montaje incremental y sonido.** `montar.mjs` sustituye cada hueco del rough cut por el bloque aceptado (`edit.mp4` con `usedRange`). Voces off (PA, radio remota) y sonidos firma se generan aparte y se mezclan en post. Música: un tema recurrente, fuera del prompt. La vista **Montaje** de la app reproduce cada corte con el plano, la toma, la viñeta y la escena de cada momento; desde ahí se acepta o rechaza cada toma (con sus reglas), se recorta el tramo usado y se vuelve a montar (solo se recodifican los bloques que cambian).

## Modo fotograma (sin guía 3D)

Para escenas que el visor 3D no puede representar, como exteriores a caballo, cada plano se genera desde el fotograma aprobado de su viñeta de storyboard. Se usa `minimax/h3-max/image-to-video`: el fotograma es el primer fotograma exacto y la frase ya dicha va como `target_audio_url`. No hay vídeo guía ni hojas adjuntas, así que la identidad se sostiene con el fotograma y los descriptores del registro.

1. `node scripts/storyboard-a-secuencia.mjs <proyecto> <storyboard> <secuencia>`: rellena la secuencia con un plano por viñeta.
2. Voces con ElevenLabs, en `scripts/bloques/voces.mjs`. Todo es de pago salvo el ensayo sin `--yes`. Siempre por fal, que incluye derechos de uso comercial: solo ve las voces de serie y las de la biblioteca pública de ElevenLabs, no las de una cuenta propia. El vídeo usa el audio de la frase tal cual y los labios lo siguen, así que la interpretación de la voz es la del vídeo.
   - `lineas <episodio> <secuencia>`: genera cada frase. Usa la estabilidad y las etiquetas por defecto del `casting.json` del personaje (campos `stability` y `tags`, p. ej. `"[quietly]"`) y, si la línea lo trae, las etiquetas de su campo `delivery`. Las etiquetas no se pronuncian: dirigen la entonación.
   - `prueba --voz <id> --texto "…" [--estabilidad n]`: una frase suelta para comparar voces, sin tocar el proyecto.
   - `cambiar <episodio> <secuencia> <línea> <grabación>`: una grabación con la interpretación buscada, pasada a la voz del personaje con el cambiador de voz.

   Si cambia el audio de una frase, repetir `planificar.mjs --force` y `prompt.mjs` del bloque, para que la copia del lote y `refs.json` recojan el audio nuevo.
3. `node scripts/bloques/planificar.mjs <lote> <episodio> <secuencia> --project <id> --por-plano`: un bloque por plano.
4. `prompt.mjs`: hace el esqueleto con `framePrompt()`. La skill `director-h3` rellena `[[CAMERA]]`, `[[ACTION]]` y `[[LOCAL]]` a partir del fotograma, y reescribe CHARACTER ACTING para ese momento. `[[LOCAL]]` lleva solo las restricciones que tocan a ese plano, nunca las de toda la escena: una restricción que describe otra acción («los seis se van a caballo») hace que el modelo la pinte (ahorcado-v01, b25, intentos 1 y 2).
5. `enviar.mjs`: como siempre. Por defecto usa H3 Max. Con `--modelo h3` usa el H3 original, que respeta mucho mejor el encuadre del fotograma. En el Ahorcado, H3 Max cortaba a otro plano o se acercaba a una cara en los planos de la fosa, el colgado y los grupos, aunque se le prohibiera y se anclara el fotograma final. H3 original los sacó a la primera. Los planos largos (12 s) siguen invitando a cortes, así que conviene no pasar de unos 8 s. Exige el fotograma y los descriptores del reparto congelados, y monta `voz.wav` con silencio hasta el inicio de la línea.

## Qué controla cada referencia

| Referencia | Controla | No controla |
|---|---|---|
| Video 1 (guía 3D) | Encuadre, trayectoria de cámara, posiciones y rutas, contacto con props, estado de gravedad, tiempos de habla | Aspecto de personas y materiales |
| Imagen de personaje (tag `<ID>_<VARIANTE>`) | Identidad, traje, estado de casco | Posición, encuadre |
| Imagen de ambiente (tag `<AMBIENTE>_PLATE`) | Geometría, materiales, luz y atmósfera **solamente** | Encuadre (nunca es un ángulo de cámara) |
| Audio n (tag `<ID>_VOICE`) | Timbre y acento del hablante n | Texto, tiempos (van en el prompt) |

## Orden del prompt

Se conservan los nombres de sección que H3 Max ya respeta (`subject_definitions`, `summary`, `retention_analysis`, `detailed_description`, `overall_soundscape`, `non_diegetic_music`). Dentro de `detailed_description` los bloques van siempre en este orden: LOCATION MAP → FIRST FRAME → OPTICS → CAMERA → ACTION TIMING → CHARACTER ACTING → PHYSICS → LIGHTING → STYLE → QUALITY → POSITIVE CONSTRAINTS. Las prohibiciones se escriben como resultados ("visors stay closed and reflective"), no como bans; solo se admiten tres negativos literales (ver `blockPrompt()` en `app/workflow.mjs`).

## Límites del adaptador

15 s por bloque, 8 imágenes de referencia, 768P, mínimo 5 s pedidos (el modelo devuelve entre 0,15 y 0,7 s de más: se recorta en post). Diálogo al reloj real: ~4 palabras por segundo más silencios más 1 s de cola limpia.

## Registro de intentos y coste

Cada envío crea una entrada en `assets/<lote>/<bloque>/attempts.json` con prompt versionado (`prompt-vNN.txt`), referencias por tag, duración pedida y devuelta, segundos de inferencia, veredicto, reglas incumplidas y línea cambiada. `node scripts/bloques/informe.mjs <lote>` agrega el lote en `INFORME.md` con coste estimado según `precios.json`.

## Decisión pendiente

Migrar a Seedance 2.5 (hasta 50 referencias, voz nativa) **solo** si, tras repetir la escena 1 con este protocolo, la aceptación por bloque sigue por debajo del 50 %. Hasta entonces, H3 Max en fal.ai.

## Documentos relacionados

- `README.md`: cómo abrir y usar la app.
- `proyectos/dead-air/REGLAS.md`: reglas con condición de fallo.
- `proyectos/dead-air/REGISTRO.md`: registro legible de assets (generado).
- `.claude/skills/director-h3/SKILL.md` y `.claude/skills/interpretacion/SKILL.md`.
- Guía de mezcla: `proyectos/dead-air/assets/chapter0-edit-v04/NOTES.md`.
