# Cambios: estados, fuentes y secuencia visual

- Los estados alterados ejecutan sus efectos `on_status` al final del turno mientras sigan activos.
- Los cambios de estadística de un estado son persistentes mientras exista el estado y no se acumulan cada turno.
- Los estados admiten filtro de tipos: todos, incluir o excluir. Un intento bloqueado informa inmunidad.
- Los cambios de estadística de movimientos guardan fuente, magnitud y autor para el desglose del panel de efectos.
- El panel de efectos suma cambios propios + estado + clima/campo/escenario y permite consultar el desglose.
- Pulsar un estado muestra sus efectos configurados.
- Curaciones/limpiezas que no cambian nada dejan de producir mensajes falsos.
- El log de ataque separa «X usó Y» del resultado; fallo/crítico/daño aparecen después de la animación.
- La barra de PS se actualiza al procesar el evento de daño, no al recibir anticipadamente el estado final de la ronda.
- La caja narrativa se oculta mientras están visibles los comandos manuales.
- La vista Info de los movimientos incluye la descripción del catálogo.
