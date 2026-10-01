# Interfaz visual del laboratorio

- Perspectiva intercambiable entre Jugador 1 y Jugador 2 sin recalcular la batalla.
- El jugador usa la mitad derecha (espalda) del sprite y el rival la mitad izquierda (frente).
- Ataque físico: desplazamiento del atacante hacia el rival.
- Ataque especial: vibración del atacante seguida de reacción del defensor.
- Ataque de estado: movimiento circular corto del atacante.
- Los mensajes del motor se reproducen secuencialmente y se conservan en Battle log.
- Panel independiente de efectos del jugador y del rival.
- Panel de Clima, Campo y Escenario con sus efectos configurados.
- En manual el jugador elige el movimiento; precisión/evasión, críticos, probabilidades de efectos y desempates siguen bajo RNG del servidor.
- La primera decisión manual puede seleccionarse en Preparar batalla. Las siguientes aparecen sobre la vista de batalla según la perspectiva.

Esta interfaz no cambia las reglas matemáticas del motor. Es una capa visual sobre el laboratorio privado.
