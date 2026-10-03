# Publicación manual Alpha 0.1

El editor privado incluye **Publicar Alpha 0.1** dentro de Catálogo.

La publicación crea un snapshot inmutable en KV (`public-v1:snapshot:<revision>`) y mueve el puntero `public-v1:current`. La web pública solo debe leer ese snapshot y nunca las claves `catalog-v1:*`.

Esto permite seguir editando borradores sin alterar partidas públicas hasta volver a publicar.
