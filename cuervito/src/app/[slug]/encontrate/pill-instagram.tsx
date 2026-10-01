/**
 * El Instagram del fotógrafo, como pill: el glifo y el usuario.
 *
 * Con el glifo y no con una arroba: el atleta reconoce el logo antes de leer,
 * y una arroba sola no dice de qué red es. En la página del fotógrafo y en la
 * del evento, que es la que más se ve y donde el atleta, con sus fotos en la
 * mano, quiere seguirlo o etiquetarlo.
 *
 * En gris como el resto de la tienda y no con los colores de Instagram: en esta
 * plantilla la foto es lo único con color.
 */
export function PillInstagram({ usuario }: { usuario: string }) {
  return (
    <a
      className="et-red"
      href={`https://instagram.com/${usuario}`}
      target="_blank"
      rel="noopener"
      aria-label={`Instagram de @${usuario}`}
    >
      {/* Lucide no trae logos de marcas: es el contorno de siempre, dibujado. */}
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.3" />
        <circle cx="17.4" cy="6.6" r="1.15" className="et-red-punto" />
      </svg>
      @{usuario}
    </a>
  );
}
