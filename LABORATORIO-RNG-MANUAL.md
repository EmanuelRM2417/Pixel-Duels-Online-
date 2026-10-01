# Laboratorio: RNG real y selección por ronda

- No hay casilla de semilla. Cada tirada nueva usa `crypto.getRandomValues` en el Worker.
- El modo **Automático (RNG)** en ambos lados ejecuta hasta el máximo de rondas o hasta que haya ganador. Elige aleatoriamente entre ataques utilizables y descarta ataques ofensivos inmunes cuando hay alternativas.
- Si al menos un lado es **Manual**, se presenta el botón **Resolver esta ronda**. Para cada lado manual, hay que elegir el ataque de esa ronda. El otro lado puede seguir en automático.
- Críticos, precisión/evasión, probabilidades de reglas y desempates se resuelven por RNG incluso en modo manual.
- Las rondas manuales se reconstruyen en el servidor a partir de las órdenes previas y de un historial interno de tiradas. No es una semilla editable: conserva los resultados anteriores mientras se calculan tiradas nuevas en la ronda siguiente.
- Los cambios de entidad manuales no se incluyen en la interfaz por ronda de esta versión; los relevos por KO sí se ejecutan. Las órdenes programadas anteriores se reemplazaron por selección interactiva de ataques.
- La API `/editor-api/simulate-step` sigue protegida por Cloudflare Access y el control de origen. No concede recompensas ni modifica el juego público.
- No se han implementado Doubles ni todos los efectos avanzados.
- No se ha probado este ZIP desplegado en Cloudflare.
