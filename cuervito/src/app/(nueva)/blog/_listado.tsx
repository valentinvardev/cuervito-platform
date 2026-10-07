import Link from "next/link";

import { CATEGORIAS, type Categoria, fechaLarga, type Post } from "~/server/blog";

/** Las secciones como pestañas. La activa no es link: ya estás ahí. */
export function Secciones({ activa, hay }: { activa: Categoria | null; hay: Categoria[] }) {
  if (hay.length < 2) return null;
  return (
    <nav className="blog-secciones" aria-label="Secciones del blog">
      {activa === null ? <span aria-current="page">Todo</span> : <Link href="/blog">Todo</Link>}
      {hay.map((c) =>
        c === activa ? (
          <span key={c} aria-current="page">
            {CATEGORIAS[c].nombre}
          </span>
        ) : (
          <Link key={c} href={`/blog/${c}`}>
            {CATEGORIAS[c].nombre}
          </Link>
        ),
      )}
    </nav>
  );
}

/** Una tarjeta por post. El título es un h2: cada tarjeta es una sección. */
export function Listado({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="blog-vacio">
        <b>Todavía no hay nada publicado acá.</b>
        <span>Volvé en unos días.</span>
      </div>
    );
  }
  return (
    <ul className="blog-lista">
      {posts.map((p) => (
        <li key={p.slug}>
          <Link href={`/blog/${p.slug}`} className="blog-tarjeta">
            <span className="label">{CATEGORIAS[p.categoria].nombre}</span>
            <h2>{p.titulo}</h2>
            <p>{p.descripcion}</p>
            <span className="blog-meta">
              <time dateTime={p.publicado.toISOString().slice(0, 10)}>{fechaLarga(p.publicado)}</time>
              {" · "}
              {p.minutos} min de lectura
              {p.borrador && <em> · borrador</em>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
