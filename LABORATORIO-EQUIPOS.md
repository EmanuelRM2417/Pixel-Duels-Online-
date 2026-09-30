# Motor de batallas simuladas — estado y uso

Esta entrega extiende el laboratorio privado existente. NO altera las salas online públicas.

## Funciona
- Singles: un combatiente activo por lado; equipos de 1 a 8 entidades sin duplicados.
- Relevo automático al quedar un combatiente en 0 PS y cambio programado con `cambiar:N` (N comienza en cero).
- Ataques programados por ronda, o elección automática; cambio consume la acción del lado correspondiente.
- Orden por prioridad y Velocidad; desempates y críticos reproducibles mediante semilla.
- PS enteros, tabla de tipos, inmunidades, STAB, efectos declarativos ya soportados por el motor anterior.
- Resumen de equipos, barras de PS, registro y snapshots de rondas.
- Simulaciones de solo lectura, sin monedas, rango ni cambios persistentes.

## Limitaciones explícitas
- NO es Doubles, no hay selección de acciones en vivo ni conexión a WebSocket de partidas reales.
- Las reglas de climas, campos y estados definidas en sus propios catálogos NO se ejecutan todavía. Solo se aplican las acciones del subconjunto interpretado por el motor.
- Los efectos temporales del motor anterior conservan su semántica provisional; no se ha implementado el sistema completo de fuentes, acumulación y duración del diseño final.
- No se garantiza todavía el equilibrio ni el cálculo final de daño del juego. No se deben usar resultados para ranked.
- La simulación se detiene al agotarse rondas, y entonces puede no haber ganador definitivo.
- Las pruebas automatizadas no sustituyen probar el despliegue real en Cloudflare Access / KV.

## Instalación
Subir los archivos de este ZIP a la rama `editor-privado` conservando la configuración privada. Ejecutar el workflow de prueba (no `main`) y verificar `/editor/`. El Worker requiere acceso a `EDITOR_DRAFTS` para cargar las referencias.
