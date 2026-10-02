# Sincronización visual inmediata — Alpha 0.1

- Los cambios de estadísticas generan un evento visual con el estado de la entidad justo cuando se aplican.
- El panel de Efectos puede reflejar base → actual durante la resolución, sin esperar al snapshot final de ronda.
- Los cambios de personaje generan un evento visual de switch con el nuevo activo exacto.
- Nombre, sprite, PS, tipos y efectos se sustituyen al aparecer la narración de entrada.
- El snapshot final sigue usándose como reconciliación al terminar la secuencia.
