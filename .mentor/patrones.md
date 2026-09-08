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

## Estado derivado que se calcula una vez y nunca se reconcilia
- Primera vez: 2026-09-08 (registrado; la primera aparición fue el relleno de miniaturas)
- Ocurrencias: 2 (thumbKey → hizo falta `rellenar-miniaturas.mjs`; previewGeneratedAt → 160 fotos cobrables invisibles en un evento publicado)
- Qué pasa: el trabajo que deriva algo de una foto —miniatura, marca de agua,
  OCR, caras— corre una sola vez, en memoria, disparado por el commit. Si el
  proceso se reinicia (cada deploy hace `pm2 restart`), lo que estaba en cola se
  pierde y nada vuelve a preguntarse "¿a qué foto le falta algo?".
- Por qué importa: la falla es silenciosa. La foto existe, tiene tamaño, el
  fotógrafo la ve en su panel; la tienda no la muestra y el atleta no la
  encuentra. Se descubre por casualidad o por queja, meses después.
- Señal temprana: si un campo se llena "después" de crear la fila, tiene que
  existir la consulta que lista las filas donde sigue vacío, y algo que la corra.
- Estado: activo
