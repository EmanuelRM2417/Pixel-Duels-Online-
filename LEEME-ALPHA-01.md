# Universal Duels — Alpha pública 0.1

Esta carpeta está preparada para la rama `main`.

## Flujo de publicación

1. Desplegar primero la versión correspondiente de `editor-privado`.
2. En el editor privado, abrir **Catálogo** y usar **Publicar Alpha 0.1**. Esto crea un snapshot inmutable en el KV de pruebas.
3. Desplegar `main` con este proyecto. `main` solo lee `public-v1:current` y el snapshot publicado; no expone `catalog-v1:*` ni `/editor-api/*`.
4. Abrir `/health` y confirmar que `publishedRevision` no sea `null`.
5. Probar una sala real con dos navegadores/dispositivos antes de compartir el enlace.

## Recursos usados por Alpha 0.1

- Worker público: `duelo-pixel-rooms`.
- Durable Object: `ROOMS`.
- Contenido publicado: binding `PUBLIC_CONTENT` al KV de pruebas `453d2d63210e42149663b5771e76a803`.
- Sprites publicados: binding `PUBLIC_SPRITES` al bucket `universal-duels-sprites-test`.

Esto evita crear infraestructura nueva para la primera Alpha. Para una Beta conviene separar contenido publicado a recursos de producción propios.

## Alcance de Alpha 0.1

- Singles online.
- Equipos de exactamente 8 personajes, sin duplicados dentro del equipo.
- Un activo por lado.
- Movimientos, cambios, estados, cooldowns, habilidades, clima, campo y escenario usando `battle-engine.js` validado en el laboratorio.
- Resolución autoritativa en el Durable Object; el navegador no calcula daño.
- Reconexión a la misma sala durante la vida de la sala.
- Rendición.

Doubles, matchmaking global, cuenta/progresión, monedas, invocaciones y ranked no forman parte de este corte de Alpha 0.1.
