# Cambios: cooldown, estados y comandos de batalla

- Cooldown se reduce al final de los turnos posteriores al uso; el turno de uso no cuenta.
- Modificar cooldown activo afecta a todos los movimientos del objetivo que ya tengan cooldown > 0.
- Cooldown al usar permite sumar/restar cooldown a cualquier movimiento usado, incluso con cooldown base 0; los entornos pueden filtrarlo por tipo.
- Daño y curación de reglas se expresan como porcentaje de PS máximos.
- Los movimientos admiten curación porcentual basada en el daño realmente infligido.
- Estados alterados usan evento implícito on_status, condición Siempre, objetivo portador y sin límite; el editor oculta esos controles.
- Interfaz: Info/Cancelar arriba y Cambiar abajo a la izquierda; movimientos 2x2 a la derecha; Info alterna detalles dentro de los botones.
