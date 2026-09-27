# Generar imágenes a partir de los `.prompt.txt`

Instrucciones para el agente que genera las imágenes (ChatGPT en local). Todas las rutas son relativas a `/home/al/Videos/rodaje`.

## Qué generar

```
node scripts/prompts-pendientes.mjs <proyecto> [filtro]
```

Lista los prompts cuya imagen todavía no existe, con sus adjuntos. El filtro es un trozo de ruta: `sb-00`, `ambientes/cruce`, `09-girart`, etc. Genera solo lo que pida el usuario; si no concreta, todo lo que salga en la lista.

## Formato de un `.prompt.txt`

```
Destino: proyectos/conjurados/storyboards/sb-00-ahorcado/render/A23.png
Adjuntar: proyectos/.../ref-A.png (Odila), proyectos/.../render/A01.png (misma luz y mismo sitio)
Uso: A23 · «Ahí no» (4 s). Para qué sirve la imagen, en español.

<prompt en inglés>

Negative: <lo que no debe aparecer>
```

- **Destino**: dónde se guarda la imagen, en PNG y con ese nombre exacto.
- **Adjuntar**: las imágenes de referencia, en orden y separadas por comas. Entre paréntesis va para qué sirve cada una. Si el prompt habla de «Image 1», «Image 2», etc., la numeración sigue este orden. «nada» significa sin referencias.
- **Uso**: contexto para ti. No forma parte del prompt.
- **Prompt**: desde la primera línea en blanco hasta el final, con la línea «Negative:» incluida.

## Para cada prompt

1. **Referencias.** Lee todas las de «Adjuntar» y úsalas como imágenes de referencia en ese orden.
   - El generador admite como mucho 5. Los prompts nuevos ya vienen con 5 o menos. Si alguno trae más, quita primero las de luz o de sitio (`render/A01.png`, las de ambientes), nunca una de personaje u objeto, y dilo en el informe.
   - Algunas rutas antiguas son relativas a la carpeta del proyecto: si `biblia/...` no existe, prueba con `proyectos/<proyecto>/biblia/...`.
   - «si ya existe» significa que es opcional.
2. **Dependencias.** Si una referencia todavía no existe porque también está pendiente, genera antes esa. Ejemplos: las viñetas adjuntan `render/A01.png`, y los sublugares adjuntan la imagen base de su ambiente.
3. **Generación.** Genera una sola imagen con el texto del prompt y respeta el formato que pida (16:9 en las viñetas).
   - Las hojas de personaje fijan cara, ropa y equipo, nunca la pose ni el encuadre.
   - Las imágenes de ambiente fijan el sitio y la luz, nunca el ángulo de cámara.
4. **Guardado.** Guarda la imagen en «Destino» y crea la carpeta si no existe.
5. **Aislamiento.** Empieza cada imagen sin arrastrar nada de las anteriores. Solo cuentan sus propias referencias; las caras y los detalles de otra viñeta no.

## Reglas

- No modifiques ni borres ningún `.prompt.txt`, `.md` o `.json`.
- No sobrescribas una imagen que ya exista. Si el usuario pide rehacer o corregir una, guarda la nueva junto a la original con el sufijo `-v2` (`A23-v2.png`, luego `-v3`…) y avisa.
  - Una corrección que sea una edición de la original se fusiona después con `node scripts/fusionar.mjs <proyecto>`, que empareja `x` con `x-v2`.
- **Rechazo del filtro de contenido.** Reintenta una vez desde cero con el mismo prompt, porque el filtro no es constante. Si vuelve a rechazarlo, sáltalo y di en el informe qué frase crees que lo dispara. No reescribas el prompt por tu cuenta.
- **Referencia que no existe porque se ha rechazado o saltado:**
  - Si es de **luz o de sitio** (`render/A01.png`, la imagen base de un ambiente), genera igualmente sin ella y avisa.
  - Si es de **personaje u objeto** (hojas `ref-*.png`, `anillo.png`), no generes: sáltalo y avisa.
- Al terminar, informa:
  - qué has generado;
  - qué te has saltado y por qué;
  - cualquier imagen en la que no se haya cumplido algo del prompt: una persona de más, un pájaro, texto, un anacronismo o un personaje que no se parece a su hoja.
  - Después, `node scripts/prompts-pendientes.mjs <proyecto> [filtro]` debe dar 0 pendientes en lo generado.

## Después (lo hace el usuario o Claude)

- Viñetas de storyboard: `node scripts/storyboard-prompts.mjs <proyecto> <storyboard> --enlazar` enlaza los fotogramas en la app.
- Refs de la biblia y ambientes: se enlazan en la app cuando se aprueban.
