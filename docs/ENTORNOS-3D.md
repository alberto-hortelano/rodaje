# Entornos 3D: cómo se hace un escenario

Proceso fijado el 2026-09-25 con el primer escenario con constructor. Para cada escenario nuevo se sigue el mismo orden.

## 1. Datos del guion

Antes de dibujar nada, se reúne todo lo que los guiones fijan del sitio:
- puertas, ventanas y huecos que usa la acción;
- quién entra por dónde;
- qué se rompe o se quema y en qué secuencia.

Eso da los **lugares** (landmarks) y los **estados** por secuencia, con un preset por tramo.

## 2. Imagen de referencia (la genera el usuario con ChatGPT)

- Se escriben los prompts en `ambientes/<id>/ref/*.prompt.txt`, con la ruta de destino en la cabecera. El usuario los genera con ChatGPT (cuota de la suscripción, no la API).
- **A**: objeto aislado en vista aérea de tres cuartos, fondo gris liso, luz uniforme, sin paisaje. Es la que se usa para comparar.
- **B**: opcional, una hoja de cuatro vistas ortogonales.
- Antes de modelar se revisa la imagen contra el guion (puertas que no deben existir, etc.) y se pide una edición si hace falta.

## 3. Constructor en código (Three.js), no generador de imagen a 3D

Carpeta `ambientes/<id>/3d/`:
- **`model.json`**:
  - `dims`, con la planta en `dims.planta`;
  - `landmarks`: `at`, `view` y `floor` en interiores;
  - `states` y `presets`;
  - `textures`.
- **Constructor** (`<id>.js`): `export function build(T, data, kit)`, sin imports. Trabaja en metros, con piezas con nombre y una marca por lugar. El estado por defecto va en `model.json` → `defaultState` y el constructor lo mezcla: `{...data.defaultState, ...kit.state}`.
- **Visor:** lo da la app (`/viewer/mount.mjs`): orbitar, lugares, estados, recorrido a pie con colisiones y escaleras, «no clip», pantalla completa, captura y GLB. Lo propio del escenario (luces y niebla, cortes, piezas atravesables, entrada del paseo, vista general) va en un plugin `ambientes/<id>/3d/visor.js` con `export function plugin(api)` (modelo: el `visor.js` de cualquier entorno existente; contrato en `docs/ARQUITECTURA.md`).
- **Registro:** en `proyecto.json`, `environments[]` con `data`, `builder`, `viewer: {plugins: ["ambientes/<id>/3d/visor.js"]}` y `glb`, y el ambiente con `environment: <id>` para usarlo en los planos. Tras escribirlo, `node scripts/proyecto-check.mjs <proyecto>`.

Reglas que costó aprender:
- **Nada a escuadra salvo lo necesario.** Plantas irregulares, remates de muro a escalones y añadidos girados. Lo perfectamente recto se ve falso.
- **Nada de caras coplanarias.** Se pasa `node scripts/entorno-coplanares.mjs [proyecto] <id> --todos` hasta que dé 0. Separar 1–3 cm o recortar suelos con celdas.
- **UV en metros** (una tesela cada 2 m) y texturas generadas en `texturas/` e `imagenes/`, con sus prompts en `PROMPTS-TEXTURAS.md`. Si una imagen no existe, se usa la de procedimiento.
- **Tejados de siluetas no rectangulares:** cada alero es un plano y el tejado es el más bajo de todos, recortado (`clipHalf`). Una malla de celdas deja dientes de sierra.
- **Suelos bajo puertas y arcos** (umbrales), y el terreno por debajo de la plataforma dentro del recinto, o el recorrido a pie se cae por los huecos.

## 4. Comparar con la referencia: bucle, no a ojo

1. **Calibrar la cámara** de la imagen A con puntos conocidos del edificio principal (esquinas, puerta, vértices del tejado): `node scripts/entornos/calibrar.mjs '[[nombre,[x,y,z],[px,py]],…]'`. Poner una rejilla sobre la imagen para leer los píxeles. Error aceptable: unos 20 px sobre 1254.
2. **Leer la planta real** proyectando al suelo puntos de la imagen: esquinas del recinto, puertas, esquinas de los añadidos. Se usa `node scripts/entornos/retroproyectar.mjs`, con la cámara calibrada escrita dentro. No hay que suponer orientaciones: en el primer escenario un ala se leyó mal tres veces antes de medirla.
3. **Bucle:**
   - cambiar un parámetro;
   - regenerar el GLB;
   - `entorno-coplanares`;
   - capturar desde la cámara calibrada (`scripts/entornos/capturar.mjs <carpeta> '<ángulos>' --entorno <id> [--project id] [--url http://127.0.0.1:4399]`, con un servidor de prueba `PORT=4399`); qué se oculta en la captura sale de `capture` en los datos del entorno (`model.json`): `root`, `group` con los hijos visibles en `keep` y `fog`;
   - montar la captura junto a la referencia, entera y con recorte de la zona dudosa;
   - comparar y repetir.

   Se prueban varias variantes en paralelo y se decide por la imagen, no por la intuición.
4. **Recorrido a pie automático** (`scripts/entornos/recorrer.mjs <carpeta> --entorno <id> [--project id] [--url …]`): entrar por la puerta, cruzar, subir y bajar escaleras, chocar con un muro. Los pasos van en `walkthrough` dentro de los datos del entorno (`model.json`): `label` y, opcionales, `walk`, `view`, `position` + `yawDeg`, `noclip`, `keys` + `seconds` y `snapshot` (nombre de la captura). Se repite tras cada cambio de planta.

## 5. La planta la corrige el usuario

- La planta vive solo en los datos del entorno (`model.json` → `dims.planta`): formas con `id`, `nombre`, `cerrada`, `puntos` y, si hace falta, `lados` (el papel de cada lado, p. ej. `fachada`, `alero`, `hastial`, `chimenea`, `casa`), y marcas.
- Se edita en la app: **Entornos 3D → el entorno → Editar planta** (`viewer/planta.html`, genérico para cualquier entorno con constructor). Arrastrar vértices, doble clic en un lado para añadir, clic derecho para quitar. Al añadir o quitar vértices los `lados` siguen alineados; no se crean, borran ni renombran formas.
- **Guardar** escribe solo el tramo de `dims.planta` en `model.json` y sube `revision`; si otra pestaña guardó antes, avisa (revisión distinta) y conviene **Descargar copia** y recargar.
- Después se vuelve a pasar el bucle del punto 4 y se regenera el GLB.
- Un escenario nuevo solo necesita su `dims.planta` en los datos del entorno; el editor lo encuadra solo.

## 6. Cierre

- **Lugares:** recolocar los que dependen de la planta leyéndolos del modelo construido, con un script de un solo uso que lea las marcas de lugar del grupo construido (no se versiona).
- **`LEEME.md` del entorno:** qué fija el guion, qué es propuesta, planta, recorrido y comparación (en `capturas/`).
- **Tests:** `npm test`, y commit cuando lo pida el usuario.
