# Eventos de efectos y limpieza de estados — candidato Alpha 0.1

## Movimientos
- `manual` / **Al usar el movimiento**: se ejecuta siempre que el movimiento llega a usarse, incluso si luego falla precisión.
- `on_attack` / **Al atacar**: se ejecuta al iniciar la acción ofensiva.
- `on_hit` / **Al acertar**: se ejecuta únicamente después de superar la comprobación de impacto y no quedar anulado por una inmunidad total al ataque.
- Un movimiento fallado conserva el cooldown correspondiente a su uso.

## Climas, campos y escenarios
El editor expone el momento de activación del efecto:
- Continuo mientras el entorno esté activo.
- Inicio de turno.
- Final de turno.
- Final de ronda.

Los efectos periódicos de daño, curación y modificación de cooldown activo usan un momento discreto; `cooldown_on_use` e inmunidad de daño permanecen continuos mientras el entorno esté activo.

## Estados y efectos derivados
Los efectos temporales generados por un estado guardan su fuente. Si el estado termina o es eliminado, se eliminan también únicamente los efectos derivados de ese estado.

Ejemplo: Congelación puede aplicar `restrict_moves`; si Congelación se quita a sí misma, esa restricción desaparece inmediatamente. Si una regla elimina el estado durante su evaluación, no se siguen ejecutando reglas posteriores del mismo estado en ese evento.
