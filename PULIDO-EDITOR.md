# Pulido del editor privado

Mejoras: filtro de registros por nombre/ID, contador, selección resaltada, indicador de cambios pendientes, confirmación al cambiar de registro o sección, atajo Ctrl/Cmd+S, duplicación sin asignar ID, exportación JSON por categoría y mejoras de accesibilidad/estilo.

La exportación es una copia local del contenido que devuelve la API; **no importa ni restaura** registros. Si el servidor devuelve un cursor de paginación, solo exporta la página cargada. No se modifica el Worker, la validación del catálogo, el motor de combate ni la rama pública.

Limitaciones existentes: el simulador aún no admite todas las mecánicas ni Doubles. La comprobación local no sustituye pruebas en Cloudflare Access, KV y R2.
