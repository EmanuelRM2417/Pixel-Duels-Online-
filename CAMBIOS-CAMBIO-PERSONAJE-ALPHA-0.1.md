# Cambio de personaje — cierre de laboratorio para Alpha 0.1

- El botón Cambiar del laboratorio manual abre los integrantes vivos de la reserva y permite seleccionarlos.
- El cambio ocupa la acción de esa ronda y se envía como una orden `switch` al motor.
- Al salir del campo se reinician los niveles temporales (`stages`) y sus fuentes (`statSources`).
- Estados alterados, PS, cooldowns y efectos con duración no se reinician por cambiar; sus turnos siguen avanzando normalmente también en reserva.
- Las reglas de habilidad `on_enter` se rearman al volver a entrar, por lo que pueden activarse nuevamente en cada entrada.
- Si una habilidad de entrada intenta invocar un clima/campo/escenario que todavía sigue activo, no reinicia su duración.
- Si ese entorno ya terminó, una nueva entrada puede volver a activarlo con su duración normal de 5 rondas.
