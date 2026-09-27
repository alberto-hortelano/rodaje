# Flujo de trabajo por issues

Todo trabajo en la app se apunta en una issue de GitHub:

- **Código y arquitectura:** van a `alberto-hortelano/rodaje`. El repo es público, así que no se copian textos de guion ni detalles de producción.
- **Contenido de un proyecto:** va a su propio repo (`alberto-hortelano/dead-air`, privado; `alberto-hortelano/conjurados`). Si una issue de la app tiene una parte en un proyecto, se abre una issue compañera allí y las dos se enlazan.

Etiquetas: `arquitectura`, `3d`, `limpieza`, `contenido`, `flujo-agentes`.

## Agentes

Cada issue pasa por cuatro subagentes, definidos en `.claude/agents/` (modelo opus). El orquestador (la sesión principal de Claude Code) los lanza en orden y les pasa lo que ha producido el paso anterior.

| Paso | Agente | Entrega | ¿Edita? |
|---|---|---|---|
| 1 | `critico` | Veredicto LISTO/BLOQUEADO, hechos comprobados, riesgos, criterios de aceptación, preguntas | No |
| 2 | `arquitecto` | Diseño, ficheros, firmas, migración, plan de pruebas | No |
| 3 | `ingeniero` | Implementación con tests, `npm test` en verde | Sí |
| 4 | `qa` | Veredicto APROBADO/RECHAZADO contrastado con la línea base | No |

Cómo se encadenan los pasos:

- **Crítico BLOQUEADO:** el orquestador pasa las preguntas al usuario y espera. No se diseña nada sin respuesta.
- **QA RECHAZADO:** la lista de QA vuelve al ingeniero. Si hay más de dos vueltas, se consulta al usuario.
- **QA APROBADO:** el orquestador hace commit con `Closes #N` y comenta en la issue un resumen de las verificaciones. La rama es `issue-N`, o `master` directamente si el cambio es pequeño y el usuario ya autorizó los commits.

## Reglas comunes

- Ninguna generación de pago (fal.ai, ElevenLabs, H3, nano-banana) sin aprobación explícita del usuario.
- `npm test` en verde al terminar cada issue.
- Si se toca la UI, ejecutar `npm run build:ui` y hacer commit también de `app/app.js`.
- Línea base: `node scripts/linea-base.mjs <dir> [--url http://127.0.0.1:4320] [--sin-capturas]` sirve para comparar el antes y el después (digests de planos, GLB, coplanares y capturas de las vistas 3D; las capturas necesitan la app arrancada). Compara dos con `diff -r <antes> <después>`.
