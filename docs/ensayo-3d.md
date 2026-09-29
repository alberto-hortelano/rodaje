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

Se valida con `stage-config check` (errores y avisos por plano) y se cambia con `node scripts/stage-config.mjs staging [proyecto] --desde parches.json [--lote <lote>] [--simular]`. El fichero de parches es `{"shots": {"<idPlano>": {campo: valor | null}}}`: mezcla superficial, `null` borra el campo. Sin `--lote` guarda el proyecto con `store.save`; con `--lote` reescribe `assets/<lote>/project-snapshot.json`. El mismo fichero admite `{"cast": {"<idPlano>": [ids] | null}}`, el reparto del plano en el prompt (`t.cast`, fuera de `staging`; `docs/PROCESO.md`, paso 5), en cualquier plano. Si hay ids desconocidos o errores, no escribe nada. También renombra la clave heredada `potatoes` a `swarm` en todos los planos.

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
- `placements`: `{<id>: {x, z, yaw, pose, mount}}` que pisa la colocación de la secuencia en este plano (ver «Poses y monturas»). Solo admite personajes del reparto de la secuencia.
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

### Entorno por plano

`staging.environment` se mezcla sobre `s.environment` (`effectiveEnvironment`): cada clave del plano pisa la de la secuencia y `state` se mezcla clave a clave, donde `null` borra la clave de la secuencia (vuelve la del preset). Después, como siempre, el `state` resultante se aplica sobre el del preset. `check` da error si no es un objeto, si `preset` o `spot` no son texto, si `state` no es un objeto o si `rotation` no es un número, y avisa de cualquier otra clave.

### Reutilización del stage y huella

La vista Ensayo y `scripts/bloques/render.mjs` reutilizan el stage entre planos con `updateShot` mientras no cambie `stageReuseKey`: secuencia, ambiente, variante, detalle y exterior, más, solo si el plano los trae, las poses y monturas que cambia respecto a la secuencia y su entorno efectivo. `updateShot` recoloca x, z y yaw de `staging.placements` en cada plano. El digest del plano (`store.digest`) solo añade `staging.environment` si existe: los planos sin él conservan su huella; `placements` no entra; tampoco `t.cast`, `staging.proxies` ni `location.background`, que solo afectan al prompt.

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
