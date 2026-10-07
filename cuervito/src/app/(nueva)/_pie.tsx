import Link from "next/link";

/**
 * El pie de la landing, de /eventos y del blog.
 *
 * Es el único enlace que está en todas las páginas públicas, así que es por
 * donde Google y los agentes llegan al blog desde cualquier lado.
 */
export function Pie() {
  return (
    <footer>
      <div className="wrap foot">
        <span>© {new Date().getFullYear()} encontrate.app · Hecho en Argentina</span>
        {/* Inline porque el pie está en tres páginas y la única hoja que
            cargan las tres es landing-encontrate.css, que es copia del
            laboratorio y no se toca acá. */}
        <span style={{ display: "flex", gap: "var(--s-5)", flexWrap: "wrap" }}>
          <Link href="/blog">Blog</Link>
          <Link href="/eventos">Buscar mis fotos</Link>
          <Link href="/terminos">Términos y privacidad</Link>
        </span>
      </div>
    </footer>
  );
}
