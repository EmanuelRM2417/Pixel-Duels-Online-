# Universal Duels — Alpha pública 0.1

Este proyecto es para la rama `main`. Está diseñado para funcionar con el último editor estable sin modificarlo.

## Fuente de contenido

`main` lee directamente, en modo de aplicación, el catálogo que el editor estable ya guarda en el KV `453d2d63210e42149663b5771e76a803` (`catalog-v1:*` y `type-chart-draft`). No necesita botón de publicación, no usa `/editor-api/*` y no modifica la configuración del editor.

Cuando empieza una batalla, `main` congela esa revisión bajo `public-runtime:snapshot:*`. Las rondas siguientes y las reconexiones usan esa copia, así que editar o borrar contenido después no cambia una batalla en curso.

Los sprites se leen del bucket existente `universal-duels-sprites-test` mediante rutas públicas limitadas a sprites de entidades del catálogo.

## Alcance Alpha 0.1

- Singles online.
- Equipos de exactamente 8 personajes distintos.
- Un activo por lado.
- Movimientos y cambios.
- Estados, cooldowns, habilidades, clima, campo y escenario del motor validado del laboratorio.
- Resolución autoritativa en Durable Object; el navegador no calcula daño.
- Reconexión durante la vida de la sala.
- Rendición.

Doubles, matchmaking global, cuentas/progresión, monedas, invocaciones y ranked quedan fuera de Alpha 0.1.
