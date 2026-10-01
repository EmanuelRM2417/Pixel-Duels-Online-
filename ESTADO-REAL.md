# Estado real del editor de mecánicas — Universal Duels

## Implementado en esta entrega

- Campos de ayuda específicos por casilla, accesibles en el editor.
- No se asigna automáticamente evento, condición, objetivo, acción, probabilidad, duración ni límite al crear reglas nuevas. Si falta alguno, el guardado falla con un mensaje.
- Selección explícita de tipo, categoría y clase (global/exclusivo) para nuevos ataques; selección explícita de clase para habilidades.
- El servidor valida las reglas admitidas, rangos y datos requeridos; no modifica los valores elegidos ni aplica balance automático.
- El editor oculta acciones, objetivos, eventos y condiciones que el motor de prueba no interpreta, y el servidor también rechaza configuraciones desconocidas o que se ignorarían.
- Se corrigió la evaluación de condiciones adicionales: la condición principal **siempre** se considera, junto a las adicionales Y/O/NO.
- Entidades: el servidor comprueba que los tres ataques compartidos y la habilidad compartida sean `global`, y que el ataque y la habilidad exclusivos sean `unique`.
- No se cambia `main` ni se despliega nada automáticamente.

## Limitaciones: NO es el editor completo solicitado

- El motor es todavía un laboratorio Singles 1 contra 1, no el combate final por equipos de 8 ni Doubles.
- Las reglas de climas, campos, estados, escenarios y entidades **no** se ejecutan. El servidor ahora rechaza reglas en estas categorías en lugar de guardarlas silenciosamente.
- No hay grupos de condiciones anidados con paréntesis ni ejecución general de efectos persistentes con fuentes y duraciones independientes.
- No hay constructor de cadenas de acciones dentro de una sola regla; se pueden crear reglas adicionales.
- El laboratorio tiene semánticas simplificadas de supresión, restricciones y estados. Las descripciones de casillas indican los alcances conocidos.
- No se verifica aún la propiedad exclusiva de un ataque o habilidad entre **distintas** entidades; la clase sí se valida.
- No hay historial de versiones, edición simultánea con control de conflictos, validación de dependencias al borrar ni migración de registros antiguos.
- Los ataques guardados en la versión anterior **no tienen** `kind`. Abrilos, elegí global/exclusivo y guardalos antes de vincularlos a nuevas entidades. No se migran automáticamente porque el usuario debe decidir.
- El sistema requiere pruebas reales de Cloudflare Access, KV y R2 después de desplegar en el Worker de prueba.

## Pruebas

`node --check worker.js`, `node --check battle-engine.js`, `node --check catalog-validation.js`, `node catalog-validation.test.mjs`, `node battle-engine.test.mjs`.

Para desplegar: solo rama `editor-privado` y workflow manual `Deploy Universal Duels Test`. No usar `main` ni el `wrangler.toml` de producción.
