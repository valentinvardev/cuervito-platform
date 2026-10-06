/**
 * "Agregar al carrito": el carrito con el más, el mismo de la plantilla de
 * cuervito (event-coverage-shell), que lo usa de la fuente de íconos Tabler.
 *
 * Copiado acá como SVG (Tabler 3.5.0, licencia MIT) y no cargando la fuente:
 * la plantilla de encontrate no la usa para nada más, y bajar una fuente de
 * íconos entera por uno solo es pagarlo en cada página de evento. Lucide no
 * tiene un carrito con más; el más solo no dice "carrito".
 *
 * Toma el color y el tamaño del lugar donde va, como los íconos de Lucide.
 */
export function CarritoMas() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M12.5 17h-6.5v-14h-2" />
      <path d="M6 5l14 1l-.86 6.017m-2.64 .983h-10.5" />
      <path d="M16 19h6" />
      <path d="M19 16v6" />
    </svg>
  );
}
