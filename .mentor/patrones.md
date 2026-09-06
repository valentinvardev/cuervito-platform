# Patrones

Anotaciones entre tareas. Un patrón necesita al menos dos apariciones para
existir: una vez es un descuido, dos es una tendencia.

## La misma regla escrita en N lugares
- Primera vez: 2026-09-06 (registrado; las apariciones son anteriores)
- Ocurrencias: 3 (fórmula de descuentos, tipografía por layout, `status !== "PAID"`)
- Qué pasa: una decisión —cómo se calcula un descuento, qué fuente usa el
  panel, quién puede bajar las fotos— queda expresada como una línea repetida
  en cada lugar que la necesita, en vez de como un módulo con nombre.
- Por qué importa: mientras la regla no cambia, funciona y no se nota. El costo
  aparece el día que cambia: hay que encontrar las N copias, y la que se olvida
  es un bug silencioso. Las tres veces el arreglo fue el mismo —`lib/descuentos.ts`,
  `tokens.css`, `lib/venta.ts`— y las tres veces se hizo DESPUÉS de que la regla
  cambiara, no antes.
- Señal temprana: si al agregar una funcionalidad hay que editar la misma
  condición en más de dos archivos, esa condición era un módulo.
- Estado: activo
