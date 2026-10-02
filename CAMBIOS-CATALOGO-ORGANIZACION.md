# Catálogo y organización — octubre 2026

## Cambios principales

- La navegación de contenido se concentra en una pestaña **Catálogo** con subcategorías: Personajes, Habilidades, Movimientos, Alteraciones de estado, Plantillas de efectos, Climas, Campos y Escenarios.
- La barra de búsqueda indexa nombres visibles, etiquetas, tipos, referencias por nombre, reglas y efectos. Los IDs siguen existiendo internamente para mantener referencias estables, pero no son el criterio de búsqueda.
- Filtros generales y orden independiente de la búsqueda específica. Personajes pueden ordenarse por PS o cualquiera de las cinco stats base; movimientos por potencia, precisión o cooldown.
- Etiquetas configurables en Personajes, Movimientos y Habilidades.
- Entidades: referencias a habilidades y movimientos mediante buscadores por nombre; movimiento exclusivo y movimientos 2/3/4 separados.
- Selectores visuales de tipos con los sprites de tipos.
- Biblioteca de tipos: además de PNG individual, admite una hoja horizontal de 20 símbolos, con previsualización de los recortes antes de guardarlos.
- `Espíritu` pasa a llamarse `Valor`. La tabla conserva compatibilidad de lectura con datos antiguos `espiritu`.
- PS base: 0–500. Ataque, Defensa, Ataque especial, Defensa especial y Velocidad: 0–200; total máximo de esas cinco: 1000. PS no forman parte del total.
- Niveles positivos: +10 % por nivel. Niveles negativos: −5 % por nivel.
- Panel de efectos en batalla: muestra las cinco stats base y sus valores actuales.
- Plantillas de efectos reutilizables. En reglas se pueden insertar por nombre; en entornos se copian las operaciones compatibles.
- Referencias de reglas a estados, campos, climas, escenarios y plantillas se resuelven por nombre en la interfaz.
- Campos que no corresponden a la condición/acción elegida se ocultan. En movimientos, evento y condición de impacto quedan implícitos en la ejecución del movimiento.
- Nueva acción **Inmunidad a daño**, con clase Todo/Físico/Especial y filtro por tipos de movimiento. También disponible como efecto de clima/campo/escenario.
- El laboratorio permite explícitamente `Ninguno` para clima, campo y escenario inicial.

## Compatibilidad

Los IDs siguen guardándose internamente en KV porque son claves estables, pero el editor muestra nombres para crear y enlazar contenido. Contenido antiguo con tipo `espiritu` se presenta como `Valor` y al volver a guardarlo queda normalizado.

## Pruebas

Se ejecutaron todas las pruebas `*.test.mjs`, incluida `catalog-organization.test.mjs`, además de `node --check` para Worker, motor, validación y JavaScript embebido del editor.
