/**
 * Datos estructurados (schema.org) para buscadores y agentes.
 *
 * El `<` se escapa porque adentro van textos que escribe el fotógrafo —el
 * nombre del evento, su bio—, y un `</script>` en un nombre cerraría la
 * etiqueta y dejaría el resto del texto corriendo como HTML en la página.
 */
export function JsonLd({ datos }: { datos: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, "\\u003c") }}
    />
  );
}
