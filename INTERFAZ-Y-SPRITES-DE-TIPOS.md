# Interfaz de estudio y sprites de tipos

- Menú lateral: inicio/sprites de entidades, tabla de tipos, sprites de tipos, 8 catálogos y laboratorio. Los formularios existentes permanecen intactos y se navegan sin recargar.
- La biblioteca de tipos acepta un PNG independiente por cada uno de los 20 tipos, incluido **viento**. Cada PNG se guarda en el R2 privado `EDITOR_SPRITES` bajo `type-icons/<tipo>.png` y se puede reemplazar expresamente. Máximo 2 MB, firma PNG comprobada. No cambia la tabla de efectividades.
- Rutas nuevas (bajo verificación existente de Cloudflare Access): GET `/editor-api/type-icons`, GET `/editor-api/type-icons/<tipo>`, PUT `/editor-api/type-icons/<tipo>` (PNG, mismo origen).
- La biblioteca muestra los iconos guardados y permite elegir el tipo haciendo clic en su tarjeta. Los sprites de entidades se previsualizan en el formulario y en el listado de entidades cuando hay referencias disponibles.
- Se conserva la regla CSS existente que arregla la esquina de la tabla; no se modifica su disposición.
- No se ha desplegado en Cloudflare ni probado en el navegador remoto. Subir **solo a editor-privado** y usar el workflow de pruebas. `main` permanece sin cambios.
- Los iconos de tipos son recursos visuales privados: todavía no se consumen desde el juego público. El motor de combate conserva sus limitaciones documentadas en `ESTADO-REAL.md`.
