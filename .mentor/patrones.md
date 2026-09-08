# Patrones

Anotaciones entre tareas. Un patrón necesita al menos dos apariciones para
existir: una vez es un descuido, dos es una tendencia.

## La misma regla escrita en N lugares
- Primera vez: 2026-09-06 (registrado; las apariciones son anteriores)
- Ocurrencias: 4 (fórmula de descuentos, tipografía por layout, `status !== "PAID"`, candado ADMIN de la vista previa /v2 — 2026-09-08)
- Qué pasa: una decisión —cómo se calcula un descuento, qué fuente usa el
  panel, quién puede bajar las fotos— queda expresada como una línea repetida
  en cada lugar que la necesita, en vez de como un módulo con nombre.
- Por qué importa: mientras la regla no cambia, funciona y no se nota. El costo
  aparece el día que cambia: hay que encontrar las N copias, y la que se olvida
  es un bug silencioso. Las tres veces el arreglo fue el mismo —`lib/descuentos.ts`,
  `tokens.css`, `lib/venta.ts`— y las tres veces se hizo DESPUÉS de que la regla
  cambiara, no antes.
- La cuarta fue la más cara: el candado `role !== "ADMIN"` de cuando el panel
  era vista previa estaba en cada página Y en /api/v2/buscar. Al abrir el panel
  se sacó de las páginas y quedó en el endpoint. Todo fotógrafo real que
  escribía en la barra tiraba el panel entero en blanco, durante semanas, y
  nadie del equipo lo vio porque el equipo es admin y pasaba el candado.
- Señal temprana: si al agregar una funcionalidad hay que editar la misma
  condición en más de dos archivos, esa condición era un módulo.
- Estado: activo
