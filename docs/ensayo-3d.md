# Ensayo 3D: configuración por proyecto y staging por plano

El ensayo y las guías (`app/stage.js`) no conocen personajes, escenas ni atrezo de ningún proyecto: todo lo que depende del proyecto está en `proyecto.stage.rehearsal` y lo que depende del plano, en `t.staging`. Las funciones que lo resuelven son puras y están en `app/workflow.mjs` (tramo «Ensayo 3D»). Un proyecto sin configuración se ensaya igual: sin equipo, sin excepciones de cámara, sin alias ni puntos de mirada.

## `stage.rehearsal`

Se revisa con `node scripts/stage-config.mjs check`, se muestra con `show` y se guarda entero con `set --desde fichero.json`.

- `animations`: `{library, clips:{idle, talk, walk}}`. Figuras y clips en `docs/mixamo.md`. Solo en planos con `rehearsal: true`.
- `voicePitch`: `{<canal o personaje>: número entre 0 y 2}` para la voz sintética del ensayo.
- `exteriors`: `{<clave>: {background:'#rrggbb', parts:[…]}}`. Un plano de ensayo con `staging.exterior` igual a la clave sustituye el decorado por esas piezas. Cada pieza: `shape` (`box` con `size` [x,y,z]; `cylinder` con `radius`, `height` y `segments`; `sphere` con `radius` y `segments` [ancho, alto]), `color`, `position`, y opcionales `rotation`, `drift` (m/s) y `spin` (rad/s). La posición en el instante t de la secuencia es `position + drift·t`; el giro, `rotation + spin·t`. Las piezas se construyen al crear el stage, así que la vista Ensayo (`stageReuseKey`) y las guías de `scripts/bloques/render.mjs` crean uno nuevo cuando cambia el exterior entre planos.
- `gear`: `{<variante>: {kind:'helmet'|'mask', except:[ids]}}`. Equipo que llevan los personajes en esa variante de secuencia o plano, salvo los de `except`. Sin entrada para la variante, nadie lleva nada.
- `cameraIgnores`: `[ids]`. En planos de ensayo la cámara se acerca a quien habla; a estos personajes no los sigue (por ejemplo, alguien que habla desde fuera del grupo).
- `propKinds`: `{<tipo de s.props>: 'swarm'}`. Alias de un tipo de prop de secuencia al comportamiento del motor. `swarm` es una nube de 65 piezas que se anima según `staging.swarm`.
- `lookTargets`: `{<nombre>: [x,y,z]}`. Puntos del decorado a los que el reparto puede mirar con `staging.look`. No pueden llamarse como un gesto (`ceiling`, `down`).
- `mounts`: `{<id de personaje>: {kind:'horse'|'mule', color:'#rrggbb'}}`. Montura de cada personaje cuando va a caballo o la lleva del ronzal. Los dos campos son opcionales (caballo y color neutro por defecto); una entrada mal formada se descarta. Sin entrada, el ensayo pone un caballo neutro y `check` avisa.

Ejemplo:

```json
{
  "gear": {"vacuum": {"kind": "helmet", "except": ["pilot"]}, "smoke": {"kind": "mask"}},
  "cameraIgnores": ["pilot"],
  "propKinds": {"seed-cloud": "swarm"},
  "lookTargets": {"crate": [0.3, 1, 0.05], "door": [-4, 1, -3]}
}
```

## `t.staging`

Se valida con `stage-config check` (errores y avisos por plano) y se cambia con `node scripts/stage-config.mjs staging [proyecto] --desde parches.json [--lote <lote>] [--simular]`. El fichero de parches es `{"shots": {"<idPlano>": {campo: valor | null}}}`: mezcla superficial, `null` borra el campo. Sin `--lote` guarda el proyecto con `store.save`; con `--lote` reescribe `assets/<lote>/project-snapshot.json`. El mismo fichero admite `{"cast": {"<idPlano>": [ids] | null}}`, el reparto del plano en el prompt (`t.cast`, fuera de `staging`; `docs/PROCESO.md`, paso 5), en cualquier plano. Y `{"cameraRig": {"<idPlano>": rig | null}}`, la cámara del plano (`t.cameraRig`, ver «Cámara del plano»), también en cualquier plano. Si hay ids desconocidos o errores, no escribe nada. También renombra la clave heredada `potatoes` a `swarm` en todos los planos.

- `props`: atrezo del director para el plano (`cargo`, `cart`, `crate`, `tied-bags`, `bags`, `dog`). `cart` solo aparece si no hay `cargo`.
- `tasks`: `{<id>: tarea}` con lo que hace cada personaje (`push`, `console`, `screen`, `count`, `collect`, `offer-bag`, `receive`, `offer-mask`, `shovel`, `eat`, `serve`, `hold`, `lock`).
- `moves`: `{<id>: {kind, delta}}`. Desplazamiento del personaje: `walk` y `glide-in` llegan a su marca al final del plano; `glide-out` sale de ella.
- `propMoves`: `{cargo|dog: {at, delta, kind, gait}}`. Posición del atrezo del director: `at` fija; con `kind:'in'` llega a `at` al final (`at + delta·(f−1)`, f la fracción del plano); con `kind:'out'` sale de `at` (`at + delta·f`). `gait: true` mueve las patas del perro. Sin `propMoves.cargo` la carga queda en [0.3, 0, 0.05]; el perro sin `propMoves.dog`, en el origen.
- `carrier`: id de quien empuja el carro. Si no está en el plano, el primer actor.
- `look`: gesto (`ceiling`, la cabeza arriba; `down`, baja poco a poco a lo largo del plano), id de un actor del plano o nombre de `lookTargets`. Si no resuelve, no hace nada y `check` avisa.
- `swarm`: estado del enjambre: `none`, `single`, `settled`, `leak`, `stream` o `cloud`. El prompt de vídeo lo cita en la línea PHYSICS.
- `insert`: plano detalle en lugar del reparto (`broken-screen`, `gravity-arrives`, `cargo-release` u otro, que pone una bandeja genérica).
- `exterior`: clave de `stage.rehearsal.exteriors`.
- `title`: rótulo a pantalla completa; el plano no lleva nada más.
- `placements`: `{<id>: {x, y, z, yaw, pose, mount}}` que pisa la colocación de la secuencia en este plano (ver «Poses y monturas»). Solo admite personajes del reparto de la secuencia.
- `proxies`: `{<id>: {x, z}}`, personajes que en la guía son figuras del entorno (no actores del ensayo) y que el prompt trata como sujetos con su posición en FIRST FRAME. Solo personajes del proyecto que no estén en el reparto de la secuencia (para esos, `placements`); `x` y `z` numéricos. No crean figura en el ensayo ni entran en la huella del plano. `check` avisa de otras claves y de un proxy que falta en `t.cast` cuando el plano lo declara.
- `environment`: `{preset, state, spot, rotation}` que pisa el `environment` de la secuencia en este plano (ver «Entorno por plano»).
- `cut`: al cambiar a este plano la cámara salta a su posición inicial.

Los rótulos `scene` y `shot` que tienen algunos planos son informativos: el motor no los lee.

### Poses y monturas

`pose` y `mount` van en la colocación de la secuencia (`s.cast[]`) y un plano los pisa con `staging.placements` (por ejemplo, para desmontar), sin tocar la secuencia. La colocación efectiva es la de la secuencia con la del plano encima (`effectivePlacement`); sin `mount`, no hay montura.

- `pose`: `standing` (de pie; los pies se enganchan al suelo), `seated` (cadera a 60 cm sobre una caja; los clips solo mueven el tren superior) o `mounted` (a caballo). Sin `pose`, o con un valor desconocido, el perfil «legado» de siempre: sentado en la caja pero con la etiqueta y la cámara a la altura de alguien de pie. `check` da error con una pose desconocida.
- A caballo: la cadera va a la altura de la silla (1,35 m el caballo, 1,15 m la mula), los muslos abiertos a los lados, las piernas colgando y la montura de primitivas (cuerpo, cuello, cabeza, patas, cola y silla) debajo, del color y tipo de `stage.rehearsal.mounts`. Con `moves` `walk` jinete y montura avanzan juntos, orientados al movimiento, y las patas dan un paso de cuatro tiempos; quieta, la montura respira y cabecea. El jinete no usa el clip `walk`: respira con `idle` y, si habla en cuadro, `talk` sobre el tren superior.
- `mount`: `led` lleva la montura sin jinete, del ronzal, a su derecha; `none` (por defecto), ninguna. Con `pose: mounted` no hace falta.
- Etiqueta, señal de pecho y foco de la cámara salen del perfil de la pose (`poseProfile`).

### Altura del terreno

Con entorno 3D, cada actor pisa el suelo del entorno (#53): su altura es la del suelo (mallas `suelo` y `suelo-…`, `floorProbe` de `viewer/walk.mjs`, ver `docs/visor-3d.md`) bajo su x, z en cada instante, así que un `walk` sube y baja con el terreno; `delta[1]` de `moves` se suma encima. Una `y` numérica en la colocación (`s.cast[]` o `staging.placements`) manda sobre el suelo (`check` da error si no es un número). Sin entorno, o si falla al construirse, la altura es 0 como siempre y no se lanza ningún rayo.

- `actorPositionAt(placement, move, time, duration, ground)` y `cameraContext({shot, sequence, R, ground})` reciben el suelo como función: los actores, los `proxies` y el seguimiento de la cámara (`cameraRig` `follow` y el seguimiento de quien habla sin rig) usan la misma altura. En Node y en el prompt (`firstFrameCast`, `blockPrompt`) no hay suelo: la altura es 0.
- `createStage` y `updateShot` calientan la rejilla del suelo (`warmGround`) con los instantes de la reproducción a 24 fps de cada actor y con los `staging.proxies`; después, reproducir a 24 fps no consulta el suelo de nuevo (`diagnostics().ground.probes` cuenta las consultas). Cada consulta cuesta alrededor de 1 µs (`floorProbe` usa un índice de triángulos, no rayos), así que otros instantes tampoco pesan.
- En gravedad cero el actor flota 12 cm sobre su suelo.
- Las monturas cuelgan del grupo del actor: suben y bajan con el terreno pero no se inclinan en pendiente. El pie del actor se engancha al suelo con `footLock` como antes.
- El lugar elegido del entorno (`spot`) sigue colocándose con su propio rayo contra `suelo`.

### Entorno por plano

`staging.environment` se mezcla sobre `s.environment` (`effectiveEnvironment`): cada clave del plano pisa la de la secuencia y `state` se mezcla clave a clave, donde `null` borra la clave de la secuencia (vuelve la del preset). Después, como siempre, el `state` resultante se aplica sobre el del preset. `check` da error si no es un objeto, si `preset` o `spot` no son texto, si `state` no es un objeto o si `rotation` no es un número, y avisa de cualquier otra clave.

### Reutilización del stage y huella

La vista Ensayo y `scripts/bloques/render.mjs` reutilizan el stage entre planos con `updateShot` mientras no cambie `stageReuseKey`: secuencia, ambiente, variante, detalle y exterior, más, solo si el plano los trae, las poses y monturas que cambia respecto a la secuencia y su entorno efectivo. `updateShot` recoloca x, y, z y yaw de `staging.placements` en cada plano. El digest del plano (`store.digest`) solo añade `staging.environment` y `cameraRig` si existen: los planos sin él conservan su huella; los planos con entorno construible (con `builder` y `data`) llevan además `ground` (#53: los actores pisan el terreno), así que su huella cambió una vez; `placements` no entra; tampoco `t.cast`, `staging.proxies` ni `location.background`, que solo afectan al prompt.

## Cámara del plano (`t.cameraRig`)

Opcional, fuera de `staging`. Describe cómo se mueve la cámara a lo largo del plano y lo usan igual la vista Ensayo, `render.mjs` y el prompt. Sin él, todo queda como antes: `camera`/`cameraEnd`, `coverage`, `cameraMotion` y, en planos de ensayo, el seguimiento de quien habla.

```json
{"type": "fixed|move|follow|track|handheld",
 "start": {"position": [x,y,z], "target": [x,y,z], "fov": 40}, "end": {"position": [], "target": [], "fov": 40},
 "easing": "linear|smooth|ease-in|ease-out", "hold": [0, 1],
 "follow": {"character": "<id>", "mode": "look|track", "offset": [x,y,z], "smoothing": 0.5},
 "track": [{"t": 0, "position": [], "target": [], "fov": 40}], "trackSmoothing": 0.5,
 "shake": 0.03, "seed": 0}
```

`cameraAt(rig, time, duration, ctx)` (`app/workflow.mjs`) devuelve `{position, target, fov}` en cada instante. Es una función del tiempo, nunca del fotograma anterior: la vista en vivo, `frame(t)` y el render headless dan la misma cámara. `ctx = cameraContext({shot, sequence, R})` sabe dónde está cada actor en cada instante (colocación efectiva, `staging.moves` con `actorPositionAt`, la misma cuenta que mueve a los actores del ensayo, con la altura del terreno si recibe `ground`) y su altura de foco sobre el suelo (`poseProfile`: 1,45 m de pie, 1,2 m sentado, silla + 0,6 m a caballo); los `staging.proxies`, a 1,45 m.

- `fixed`: `start` todo el plano.
- `move`: de `start` a `end` (obligatorio) con la curva `easing` (por defecto `smooth`, smoothstep; `ease-in` f², `ease-out` 1−(1−f)²). `hold: [a, b]` (fracciones del plano, 0 ≤ a < b ≤ 1, por defecto [0, 1]): quieta en `start` hasta `a` y en `end` desde `b`.
- `follow`: `mode: look` (por defecto), cámara plantada en `start` que desplaza el objetivo lo que se ha movido el personaje desde t=0; `mode: track`, además la posición se desplaza igual; con `offset`, la cámara va a punto de mira + `offset` y mira al punto de mira, así el personaje queda siempre en cuadro. El punto de mira es el actor a la altura de su foco, suavizado con una media ponderada (rampa lineal, más peso al presente, 16 muestras) de la ventana [t − w, t], w = `smoothing` (por defecto 0,5) × 1,5 s; `smoothing: 0` sigue sin retraso. Si el personaje no está colocado, `start`.
- `track`: trayectoria grabada. Sin muestras, `start`; con una, esa; con varias, interpolación lineal por tramos sujeta a la primera y la última. Una muestra sin `fov` toma el de la anterior (o el de `start`). `trackSmoothing` > 0 promedia la ventana centrada [t − w/2, t + w/2] (sujeta a [0, duración]), w = `trackSmoothing` × 1 s: redondea las esquinas y respeta los tramos quietos.
- `handheld`: `start` (o el movimiento de `move` si hay `end`) más un temblor Σ aⱼ·sin(2π fⱼ t + φ) con f = 0,37, 0,83 y 1,71 Hz y a = 0,6, 0,3 y 0,1, una fase por eje de posición y otra por eje de objetivo. Amplitud `shake` en metros (por defecto 0,03; 0 sin temblor). Semilla `seed` o, si falta, `seedOf(t.id)` (FNV-1a del id del plano): el mismo plano tiembla igual en cada render.

**Prioridad**: `cameraRig` > `coverage` > `cameraMotion` > seguimiento de quien habla > `camera`/`cameraEnd`. Con rig, `createStage` y `updateShot` ponen `cameraAt(rig, 0)` sin el ajuste de los planos de ensayo (25 % hacia el objetivo, altura mínima 1,6 m, fov 46), y `pose(t)` pone `cameraAt(rig, t)`. `pose(t, false)` no mueve la cámara, con rig o sin él (así se puede grabar muestreando `stage.camera()`).

**Tipos de grabación**: `cameraPresets(camera, {characters})` construye rigs de partida desde la cámara actual: `fixed` «Plano fijo»; `truck-right` y `truck-left` «Travelling lateral a la derecha/izquierda» (1,5 m por la horizontal derecha de la cámara, `smooth`); `dolly-in` «Acercamiento» (avanza el 35 % hacia el objetivo); `dolly-out` «Alejamiento» (retrocede el 50 %); por personaje, `pan-follow:<id>` «Panorámica siguiendo a X» (`look`) y `follow:<id>` «Acompañar a X» (`track`), con `smoothing` 0,5; `handheld` «Cámara en mano» (`shake` 0,03); `free` «Grabación libre» (`track` con una muestra en t=0 y `trackSmoothing` 0,5).

**Validación** (`cameraRigIssues`, en `stagingIssues` y `stage-config check`, con el prefijo `<idPlano>: cameraRig:`): `type` conocido; `start` obligatoria y `end` opcional (salvo en `move`), con vectores de 3 números y `fov` entre 1 y 100 (`CAMERA_FOV`, también en `camera` y `cameraEnd`); `easing` conocida; `hold` creciente dentro de [0, 1]; `follow` con `character` del reparto del plano y colocado (reparto de la secuencia o `staging.proxies`), `mode` `look` o `track`, `offset` de 3 números y `smoothing` en [0, 1]; `track` con al menos una muestra, `t` ≥ 0, estrictamente crecientes y dentro de la duración; `trackSmoothing` en [0, 1], `shake` en [0, 0,5] y `seed` entero ≥ 0. Avisa de claves desconocidas, de `coverage` o `cameraMotion` que el rig deja sin efecto y de un zum (la fov varía más de 0,5° a lo largo del plano, `rigFovSpan`). `store.validate` rechaza al guardar un rig mal formado («Cámara del plano no válida: …»).

**Huella**: el digest del plano incluye `cameraRig` solo si existe; sin él, la huella, `stageReuseKey` y las rutas no cambian.

**Prompt**: `blockPrompt` describe la cámara según el tipo (`cameraLine`): «Locked-off» solo con `fixed`; `move`, un travelling continuo sobre dolly con sus matices (acercarse, alejarse, subir, bajar) y las esperas de `hold`; `handheld`, el movimiento en mano; `follow`, la panorámica que mantiene al personaje en cuadro (`look`) o la cámara que le acompaña a distancia constante (`track`); `track`, el recorrido grabado de Video 1. OPTICS y FIRST FRAME usan la cámara de `cameraAt` en el inicio del bloque; si la fov varía más de 0,5° en el tramo del primer plano del bloque, OPTICS describe un zum lento y continuo de la fov inicial a la final (`rigOpticsLine`) en lugar de «One lens for the whole take».

### Vista Animación

La vista Animación de la app (`view=anim&episode=…&sequence=…&shot=…`, `app/anim.source.js`) edita el `cameraRig` de un plano. Se abre con «Animación» en cada plano de Capítulos o con «Animación 3D» en la viñeta del storyboard enlazada al plano (`t.storyboardShot`). Si la viñeta no tiene plano, el botón aparece desactivado. Si tiene varios, se elige en un menú. Un plano que no existe devuelve a Capítulos.

- **Borrador**: sin rig, parte de `{type: 'fixed', start: t.camera}` sin escribir nada. Cada edición confirmada (fijar inicio o fin, tipo, preset, curva, tramo, seguimiento, temblor, suavizado, recorte, grabación) copia el borrador en `t.cameraRig` y marca el proyecto como modificado. No hay autoguardado: «Guardar» usa el guardado de siempre (`POST /api/project`, con control de revisión y una copia en `versiones/`). Si falla (por ejemplo, un 409 porque el proyecto cambió), el proyecto sigue en la página con la pista y se ve el error. «Guardar» se desactiva mientras `cameraRigIssues` dé errores, que se muestran en vivo junto con los avisos.
- **Reloj**: ▶, ⏸, ■, bucle y scrub de 0 a la duración con paso de 1/24 s, con una marca por línea de diálogo. Cada línea suena a su `start` con la voz del navegador (`speechSynthesis`), con las mismas voces por personaje, preferencias (`rodaje-tts-<id>`) y `voicePitch` que el Ensayo. Quien habla hace el gesto de hablar (`setSpeaker`). Pausar, parar o mover el scrub corta la voz. «Solo subtítulos» no usa voz y mueve el gesto con el reloj.
- **Cámara en pantalla**: «Libre» navega con OrbitControls y no mueve la cámara con el tiempo (`stage.pose(t, false)`). «Ver resultado» pone en cada instante `cameraAt(borrador, t)` con el contexto del propio stage (`stage.cameraContext()`, con el suelo del entorno), el mismo que usa el render. «Fijar inicio» y «Fijar fin» toman la cámara actual. Fijar el fin de un plano fijo lo convierte en `move` (`smooth`). `follow` no tiene fin. En `track`, ni el inicio ni el fin se fijan: se graba o se recorta. «Partir de un tipo de grabación» aplica `cameraPresets` sobre la cámara actual, con un seguimiento por cada personaje colocado del reparto del plano.
- **Órbita y Vuelo**: en «Libre», un subselector elige la cámara a mano; recuerda por navegador el modo y la velocidad (`localStorage` `rodaje-anim-camera`, `{mode, speed}`, leído con `flyPrefs`). Cambiar de uno a otro no mueve la cámara: el vuelo parte de `stage.camera()` (`flyFromCamera`) y, al volver a la órbita, su centro es el punto al que se mira. El vuelo mantiene el objetivo delante de la cámara (a la distancia que tenía, mínimo 1 m), así que «Fijar inicio/fin», los presets y la grabación funcionan igual. La física está en funciones puras de `app/workflow.mjs` (`flyStep`, `flyCamera`, `flySpeedStep`): velocidad de 0,25 a 20 m/s (2 por defecto), Mayús ×3, aceleración y frenada con constante de 0,12 s integradas de forma exacta (el movimiento no depende de los fotogramas por segundo) y pasos de como mucho 0,1 s. Las teclas solo actúan con el visor enfocado y nunca en un campo de texto; se sueltan al perder el foco, al ocultar la pestaña, al pasar a «Ver resultado» o al terminar la grabación.

  | Control | Órbita | Vuelo |
  |---|---|---|
  | Arrastrar con el ratón | Orbita alrededor del centro | Mira (guiñada y cabeceo, ±1,45 rad, sin alabeo; sin bloquear el puntero) |
  | Rueda | Acerca y aleja | Velocidad (×1,15 o ÷1,15 por muesca); también con el control «Velocidad de vuelo» |
  | W/S o ↑/↓ | — | Adelante y atrás en la dirección de la mirada |
  | A/D o ←/→ | — | A los lados, en horizontal |
  | E/Q | — | Sube y baja en la vertical del mundo |
  | Mayús | — | Rápido (×3) |
  | Dedo (táctil) | Orbita y pellizca | Orbita mientras toca; al soltar sigue el vuelo desde donde quedó |

  Con el vuelo, el visor no desplaza la página con las flechas, el espacio ni la rueda. La pista grabada volando es una pista normal (`track`) y se ve igual en «Ver resultado» y en el render.
- **Grabar**: tras una cuenta atrás de 3 s, pasa a modo libre y arranca el reloj desde 0 con el diálogo. La usuaria mueve la cámara con el ratón o el dedo, o volando con el teclado, hasta el final del plano; la grabación respeta la cámara elegida (Órbita o Vuelo). Se toma una muestra de `stage.camera()` cada 1/24 s del reloj del plano, no de la pantalla: si el navegador va lento, se repite la cámara del momento. Una grabación completa tiene `floor(duración·24) + 1` muestras (`recordSamples`). Al terminar, el borrador pasa a `{type: 'track', start: primera muestra, track, trackSmoothing: 0.5}` y se ve el resultado. Mientras graba, el bucle y el scrub están desactivados. Ocultar la pestaña o parar cancela la grabación y conserva la cámara anterior.
- **Pista**: `t` en múltiplos de 1/24 s con 3 decimales; posición, objetivo y fov con 3 decimales. «Recortar» parte siempre de la última grabación o, al abrir, de la pista guardada: deja las muestras del tramo e interpola sus extremos, sin desplazar los tiempos, así que antes y después del tramo la cámara queda quieta (`trimTrack`). El suavizado va de 0 a 1 en pasos de 0,05 y se ve al moverlo.
- **Voz**: las voces por defecto se reparten entre los hablantes del capítulo por orden de aparición (`episodeSpeakers`, `ttsVoiceURI`). Una elección guardada manda.

La vista del plano también toca el rig: «Inicio de cámara» y «Final de cámara» (`applyShotCamera`) cambian `camera`/`cameraEnd` como siempre y, si el plano tiene rig, su `start`/`end`. Con el fin se aplican las mismas reglas: un rig fijo pasa a `move` y `follow` no admite fin. En un rig `track` avisan y ofrecen «Abrir en Animación».

**Migración**: el formato no cambia. Un plano sin rig queda intacto hasta que se guarda uno. Guardar un rig cambia la huella del plano, así que su previsualización aprobada vuelve a quedar pendiente. Los lotes ya planificados conservan su `project-snapshot.json` y no heredan el rig: hay que volver a planificar o aplicar el rig al lote con `stage-config staging --lote <lote>` y un parche `{"cameraRig": {…}}`.

## Catálogo: variantes, zonas y canales

Junto a `rehearsal`, `proyecto.stage` guarda el catálogo del proyecto: las variantes visuales del reparto, las zonas de las viñetas del storyboard y los canales de voz. La app, el ensayo, la validación y los scripts de bloques lo leen con las funciones puras del tramo «Catálogo del proyecto» de `app/workflow.mjs` (`projectVariants`, `projectZones`, `projectChannels`, `projectDefaultVariant`). Se muestra con `node scripts/stage-config.mjs catalogo [proyecto]` y se cambia con `catalogo [proyecto] --desde fichero.json [--simular]`: cada clave presente reemplaza la actual, `null` la borra y una clave ausente no se toca. Si hay errores no escribe nada; `check` los cuenta como errores y avisa de los datos que usan ids fuera del catálogo.

- `variants`: `[{id, label}]`. `id` en minúsculas, dígitos y guiones, empezando por letra. Siempre existe la variante `''` («Diseño base»); una entrada con `id: ""` solo cambia su etiqueta. Con más de una variante, cada personaje tiene su botón «Variantes por zona».
- `defaultVariant`: id de una variante. Es la del prompt de vídeo cuando la secuencia no tiene variante.
- `zones`: `[{id, label, color?, variant?}]`. `color` es `#rrggbb` y tiñe la pastilla de la viñeta; `variant` es la variante que toma la secuencia al convertir el storyboard en capítulo. Siempre existe `other` («Sin zona»), al final si el catálogo no la coloca; solo admite `label` y `color`.
- `channels`: `[{id, label, color?, offscreen?, speakLight?, prompt?}]`. `id` solo con letras minúsculas (el diálogo del storyboard se escribe `Nombre (canal): texto`). `color` es el borde de la línea en el storyboard. `offscreen: true` hace del canal una voz sin cuerpo: no se genera en el vídeo del bloque (va como evento en ACTION TIMING y se monta en post), no cuenta en el presupuesto de diálogo ni pide voz de referencia, no mueve la boca en el ensayo, no obliga a que el hablante esté en el reparto, se marca «fuera de campo» al elegirlo y el montaje lo rotula «(OFF)». `speakLight: true` enciende la luz de habla del casco en el ensayo. Siempre existen `direct` («Directo», primero) y `pa` («Voz en off», fuera de campo, al final); el catálogo solo cambia su `label`, su `color` y su `prompt`. Una línea sin canal va por `direct`; un canal que no está en el catálogo se muestra y se conserva, sin comportamiento.
  `prompt` es el texto del canal en el prompt de vídeo, en inglés: `voice` acompaña a la réplica en cuadro («At approximately 2.00s, ANA, `voice`, says exactly…»), `offscreen` nombra la voz fuera de campo en ACTION TIMING («an offscreen `offscreen` from…»; sin él, «voice») y `direction` es la indicación del flujo antiguo de vídeo (`voiceDirection`). Las tres son opcionales y, si están, texto no vacío. Una línea con un canal fuera del catálogo toma el `prompt` de `direct`; un canal sin `prompt` no añade nada.

Un proyecto sin catálogo ve «Diseño base», «Sin zona», «Directo» y «Voz en off». Las instantáneas de lote y de trabajo que no traen catálogo lo toman del proyecto vivo (`stageFallback`), y sus canales sin `prompt` toman, por id, el del canal vivo.

Ejemplo:

```json
{
  "variants": [{"id": "day", "label": "Día · ropa de calle"}, {"id": "storm", "label": "Tormenta · impermeable"}],
  "defaultVariant": "day",
  "zones": [
    {"id": "street", "label": "Calle", "color": "#487432", "variant": "day"},
    {"id": "harbour", "label": "Puerto · temporal", "color": "#364973", "variant": "storm"},
    {"id": "other", "label": "Otro"}
  ],
  "channels": [
    {"id": "direct", "label": "Directo · caras"},
    {"id": "phone", "label": "TELÉFONO · auricular", "color": "#4b6a63", "speakLight": true,
     "prompt": {"voice": "thin phone voice", "offscreen": "phone call", "direction": "speaks into the phone; only their lips move."}},
    {"id": "tv", "label": "TV · fuera de campo", "color": "#7a5a2c", "offscreen": true},
    {"id": "pa", "label": "Megafonía", "color": "#8a4d7a"}
  ]
}
```
