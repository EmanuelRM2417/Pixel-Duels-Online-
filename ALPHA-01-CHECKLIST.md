# Checklist de salida — Universal Duels Alpha 0.1

## Antes de desplegar main

- [ ] Desplegar `editor-privado` con el publicador.
- [ ] En Catálogo pulsar **Publicar Alpha 0.1** y confirmar que muestra una revisión `alpha01-...`.
- [ ] Confirmar que los 8+ personajes que se usarán tienen sprite, 4 movimientos y 2 habilidades válidas.
- [ ] Confirmar que la tabla de tipos está guardada.

## Después de desplegar main

- [ ] Abrir `/health`: `ok: true` y `publishedRevision` no nulo.
- [ ] Abrir la página pública en dos navegadores.
- [ ] Crear una sala y unirse con el código.
- [ ] Seleccionar 8 personajes distintos por jugador.
- [ ] Marcar ambos como listos.
- [ ] Probar un movimiento físico, especial y de estado.
- [ ] Probar un cambio de personaje.
- [ ] Probar un cooldown.
- [ ] Probar una alteración de estado y su eliminación.
- [ ] Probar un campo/clima/escenario si el contenido publicado los utiliza.
- [ ] Probar un mirror match (mismo personaje activo).
- [ ] Recargar uno de los navegadores y volver a entrar a la misma sala.
- [ ] Terminar una partida por KO y otra por rendición.

## Si algo falla

No publicar una revisión nueva para “arreglar” una partida que ya está en curso. Cada partida queda fijada a la revisión con la que comenzó. Corregir en `editor-privado`, publicar otro snapshot y crear una sala nueva para probarlo.
