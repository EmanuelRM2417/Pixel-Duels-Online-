# Universal Duels — Editor privado y laboratorio de batalla

Esta entrega se basa en `editor-privado` y **no cambia** la rama `main` ni su despliegue.

## Qué está conectado

- Catálogos persistentes en `EDITOR_DRAFTS` para efectos, ataques, habilidades, entidades, climas, campos, escenarios y estados.
- Referencias desplegables a ataques y habilidades existentes; lista de IDs de ataques con sugerencias.
- Validación al guardar entidades: 1–3 tipos distintos, PS de 1 a 200 y las otras cinco estadísticas de 0 a 200, tres ataques compartidos + uno exclusivo y dos habilidades existentes. Validación de ataques: tipo, categoría, potencia, precisión, crítico y prioridad.
- Constructor de reglas: evento, condición principal, condiciones adicionales Y/O/NO, objetivo, acción, probabilidad, duración y límite de activaciones. JSON avanzado opcional.
- Simulador **privado** `/editor-api/simulate`: Singles 1 contra 1, hasta 50 rondas, semilla repetible, ataque elegido o automático, registro, daño determinista, inmunidades, tipo, STAB, crítico, prioridad, Velocidad, estadísticas actuales, PS enteros y un subconjunto de reglas.
- La simulación lee datos del KV y no concede monedas, no guarda resultados y no cambia el juego público.

## Limitaciones importantes

Este NO es el motor completo del juego. El simulador usa entidades individuales, no equipos de ocho; no implementa Doubles, sustituciones, selección de movimientos turno por turno, matchmaking, inventario ni sincronización de batallas en salas. El ataque seleccionado se repite cada ronda. Los climas y campos son valores consultables por condiciones; sus propias reglas todavía no se ejecutan automáticamente. Los estados se asignan, pero sus reglas de daño/curación por ronda aún no se interpretan. La supresión y restricciones son simplificadas. No se han implementado todas las acciones, objetivos y eventos visibles en el constructor. Los efectos reutilizables solo ejecutan sus reglas de evento `manual`, con profundidad acotada para evitar ciclos infinitos. No existe aún verificación de sprite en R2 ni validación completa de dependencias antes de borrar.

**El motor ignora acciones/condiciones desconocidas en lugar de ejecutarlas arbitrariamente.** No usar el laboratorio como árbitro competitivo todavía.

## Pruebas locales

```bash
node --check worker.js
node --check battle-engine.js
node battle-engine.test.mjs
```

Para probar con Cloudflare, subir estos archivos a **`editor-privado`** y ejecutar únicamente el workflow manual **Deploy Universal Duels Test**, seleccionando esa rama. La ruta es `/editor/` en el Worker de prueba protegido con Access. No desplegar `main` ni usar `wrangler.toml` de producción para esta entrega. Es necesario verificar allí acceso, KV, R2 y el flujo completo antes de considerarlo integrado.

## Orden de uso

1. Crear efectos reutilizables (si los necesitás).
2. Crear ataques, con reglas opcionales.
3. Crear habilidades globales y exclusivas.
4. Crear entidades vinculando los cuatro ataques, las dos habilidades y sus tipos/estadísticas.
5. Abrir el laboratorio, elegir dos entidades y ejecutar una prueba. Corregir lo necesario desde el catálogo.
