# Checklist de salida — Universal Duels Alpha 0.1

## Editor

- [ ] No modificar ni redeplegar el editor si ya funciona.
- [ ] Confirmar que hay al menos 8 personajes guardados.
- [ ] Confirmar que los personajes de prueba tienen 4 movimientos y 2 habilidades válidas.
- [ ] Confirmar que la tabla de tipos está guardada.

## Main

- [ ] Desplegar este proyecto en la rama `main` con `Deploy Duelo Pixel`.
- [ ] Abrir `/health`: debe responder `ok: true`, una `revision: draft-...` y `source: editor-kv-readonly`.
- [ ] Abrir la página pública en dos navegadores.
- [ ] Crear una sala y unirse con el código.
- [ ] Seleccionar 8 personajes distintos por jugador y marcar ambos listos.
- [ ] Probar movimiento físico, especial y de estado.
- [ ] Probar cambio, cooldown y alteración de estado.
- [ ] Probar campo/clima/escenario si el catálogo los utiliza.
- [ ] Probar mirror match.
- [ ] Recargar un navegador y volver a entrar a la misma sala.
- [ ] Terminar una partida por KO y otra por rendición.

Cada batalla queda fijada a su revisión automática. Los cambios posteriores del editor solo afectan salas nuevas.
