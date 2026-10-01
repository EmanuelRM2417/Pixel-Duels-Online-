# Climas, campos y escenarios — editor de efectos

## Configuración

Los tres catálogos tienen **duración base fija de cinco rondas**. Se activan exclusivamente mediante la acción `set_weather`, `set_field` o `set_scenario` de un ataque o habilidad. No requieren evento, condición, objetivo ni límite de activaciones en su definición. Intentar activar el mismo ID mientras ya está activo no renueva la duración. Activar un ID distinto de la misma categoría reemplaza el anterior. Clima, campo y escenario pueden coexistir (una instancia por categoría).

Cada efecto se aplica a las **entidades activas**. Filtro de tipos: `all` afecta a todas; `include` afecta a entidades con al menos uno de los tipos seleccionados; `exclude` afecta a entidades sin ninguno de esos tipos. La probabilidad se comprueba por entidad y evaluación. Una entidad con varios tipos coincidentes no recibe el mismo efecto varias veces por esa coincidencia.

### Acciones de entorno

- `damage_percent`: resta el porcentaje elegido de los **PS máximos**, al final de ronda; redondeo entero, mínimo 1 para porcentaje positivo.
- `heal_percent`: recupera el porcentaje elegido de los **PS máximos**, al final de ronda, sin exceder el máximo.
- `stat_change`: modifica entre −10 y +10 niveles una estadística (Ataque, Defensa, Ataque especial, Defensa especial, Velocidad, Precisión, Evasión o Probabilidad de crítico). Los PS no admiten niveles. Los niveles del entorno se calculan sobre el activo sin acumularse cada ronda y desaparecen cuando termina.
- `critical_change`: variante de niveles de crítico; se conserva por compatibilidad con contenido JSON. El editor visual utiliza `stat_change` para crítico.
- `remove_status`: elimina estados alterados según la evaluación configurada.
- `block_status`: elimina estados alterados e impide aplicarlos mientras se cumpla el efecto del entorno.

La probabilidad de los modificadores continuos se evalúa al refrescar las condiciones activas; en el simulador esto ocurre al inicio de ronda y tras algunos cambios o activaciones. El editor **no** impone probabilidades: elegí cada una.

### Excepciones desde habilidades o ataques

- `environment_immunity` con valor `weathers`, `fields`, `scenarios` o `all` protege al objetivo de esa clase de entorno.
- `prevent_environment` con uno de esos valores impide activar esa clase de entorno mientras la entidad que lo porta está activa.
- Duración `0` en estas acciones representa un efecto persistente para el laboratorio; valores positivos expiran al contar rondas. Las inmunidades provenientes de habilidades quedan inactivas durante la supresión de habilidades.

## Limitaciones reales

Esta integración corresponde al **laboratorio privado de Singles**. No es todavía el motor de Doubles ni las salas públicas. Las probabilidades y los efectos simultáneos siguen el orden de evaluación del simulador actual. Los modificadores de precisión y evasión usan la escala del motor de prueba, que aún no está homologada a todas las reglas finales del juego. No se realizó despliegue ni prueba real contra Cloudflare.

Para probar el escenario «Inframundo», creá dos efectos: daño 5 % con filtro `exclude` para Espectro y Fuego, y curación 5 % con filtro `include` para Espectro y Fuego. Creá después un ataque con acción `set_scenario` y valor `inframundo`.

Si existían entornos antiguos con reglas en el JSON, el nuevo validador no los convierte silenciosamente: deben migrarse manualmente a `fieldEffects`. Esto evita alterar las mecánicas sin autorización.
