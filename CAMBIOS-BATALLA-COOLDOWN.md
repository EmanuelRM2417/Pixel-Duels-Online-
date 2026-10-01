# Batalla visual y cooldown

- Control Manual/RNG independiente para J1 y J2.
- El estado visual no adopta los PS finales antes de reproducir los eventos; las barras cambian durante la secuencia.
- El battle log visible se incorpora conforme se reproducen los eventos.
- Los movimientos manuales se eligen dentro de la batalla; al elegir se ocultan y aparece Cancelar durante la confirmación breve.
- Interfaz de comandos compacta: Cambiar e Info abajo a la izquierda; movimientos abajo a la derecha.
- Cada movimiento admite cooldown base 0–50 turnos.
- Cooldown se almacena por entidad y movimiento. Un movimiento bloqueado no puede ser elegido por RNG ni manualmente.
- Reglas de ataques/habilidades/efectos pueden usar `modify_cooldown` con `moveId` y cambio entero.
- Climas/campos/escenarios pueden usar `cooldown_change` al final de ronda, con filtro de tipos, probabilidad, movimiento y cambio.
- El motor registra 2 turnos restantes, 1 turno restante y el momento en que vuelve a estar disponible.

Nota: el botón Cambiar ya ocupa su posición definitiva, pero el selector de cambio voluntario aún no ejecuta relevos; los relevos por KO siguen funcionando.
