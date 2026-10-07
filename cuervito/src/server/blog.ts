import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { compileMDX } from "next-mdx-remote/rsc";
import { cache } from "react";
import { z } from "zod";

/**
 * El blog: archivos MDX en content/blog, uno por post, y el nombre del archivo
 * es la dirección. «como-vender-fotos.mdx» se publica en /blog/como-vender-fotos.
 *
 * Todo se lee en el build. Ninguna página del blog toca la base ni lee la
 * sesión, así que salen como HTML estático: no le cuestan nada al VPS y es lo
 * que mejor leen Google y los agentes.
 */

const CARPETA = path.join(process.cwd(), "content", "blog");

/**
 * Las secciones del blog. Viven en /blog/{clave}, al mismo nivel que los
 * posts: la categoría no va adentro de la dirección del post, porque si un
 * post se muda de sección su dirección no tiene que cambiar.
 *
 * Al compartir el nivel, un post no puede llamarse como una sección. El build
 * lo frena (ver listarPosts).
 */
export const CATEGORIAS = {
  fotografos: {
    nombre: "Para fotógrafos",
    titulo: "Guías para fotógrafos deportivos",
    descripcion:
      "Cómo vender las fotos de un evento deportivo: precios, entrega, cobro con Mercado Pago y cómo llegar a los atletas.",
  },
  atletas: {
    nombre: "Para atletas",
    titulo: "Guías para atletas: encontrá tus fotos",
    descripcion:
      "Cómo encontrar tus fotos de una carrera o un partido, comprarlas y descargarlas sin crear cuenta.",
  },
  ayuda: {
    nombre: "Ayuda",
    titulo: "Ayuda de encontrate.app",
    descripcion: "Respuestas paso a paso para fotógrafos y atletas que usan encontrate.app.",
  },
} as const;

export type Categoria = keyof typeof CATEGORIAS;

export function esCategoria(clave: string): clave is Categoria {
  return Object.hasOwn(CATEGORIAS, clave);
}

/* El título va entero al <title>, y Google corta cerca de los 60 caracteres.
   La descripción es el texto del resultado: entre 70 y 160 es lo que se ve
   completo. Fuera de eso, el build se queja ahora y no en Search Console en
   un mes. */
const esquema = z.object({
  titulo: z.string().min(15).max(70),
  descripcion: z.string().min(70).max(160),
  categoria: z.enum(Object.keys(CATEGORIAS) as [Categoria, ...Categoria[]]),
  publicado: z.coerce.date(),
  actualizado: z.coerce.date().optional(),
  /** En producción no se publica. En desarrollo se ve, para poder revisarlo. */
  borrador: z.boolean().default(false),
});

export type MetaPost = z.infer<typeof esquema>;

export type Post = MetaPost & {
  slug: string;
  /** El MDX sin el frontmatter. */
  cuerpo: string;
  minutos: number;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lectura a 200 palabras por minuto, que es lo que se usa para texto de pantalla. */
function minutosDeLectura(texto: string): number {
  const palabras = texto.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}

/**
 * Todos los posts publicables, del más nuevo al más viejo.
 *
 * Tira en vez de saltear: un post con el frontmatter mal o con un nombre que
 * choca con una sección rompe el build. Saltearlo en silencio sería publicar
 * un blog al que le falta un post y no enterarse.
 */
export const listarPosts = cache(async (): Promise<Post[]> => {
  const archivos = (await fs.readdir(CARPETA)).filter((a) => a.endsWith(".mdx"));
  const enProduccion = process.env.NODE_ENV === "production";

  const posts = await Promise.all(
    archivos.map(async (archivo): Promise<Post> => {
      const slug = archivo.replace(/\.mdx$/, "");
      if (!SLUG.test(slug)) {
        throw new Error(`blog: «${archivo}» no sirve como dirección. Sólo minúsculas, números y guiones.`);
      }
      if (esCategoria(slug)) {
        throw new Error(`blog: «${archivo}» se llama igual que la sección /blog/${slug}.`);
      }

      const fuente = await fs.readFile(path.join(CARPETA, archivo), "utf8");
      // Sólo para leer el frontmatter: el contenido se compila de verdad en la
      // página, con los componentes.
      const { frontmatter } = await compileMDX({
        source: fuente,
        options: { parseFrontmatter: true },
      });
      const meta = esquema.safeParse(frontmatter);
      if (!meta.success) {
        throw new Error(`blog: el frontmatter de «${archivo}» está mal: ${meta.error.message}`);
      }

      const cuerpo = fuente.replace(/^---[\s\S]*?---\s*/, "");
      return { ...meta.data, slug, cuerpo, minutos: minutosDeLectura(cuerpo) };
    }),
  );

  return posts
    .filter((p) => !(enProduccion && p.borrador))
    .sort((a, b) => b.publicado.getTime() - a.publicado.getTime());
});

export async function traerPost(slug: string): Promise<Post | null> {
  return (await listarPosts()).find((p) => p.slug === slug) ?? null;
}

/** Las secciones que tienen al menos un post. Una sección vacía no se publica. */
export async function categoriasConPosts(): Promise<Categoria[]> {
  const usadas = new Set((await listarPosts()).map((p) => p.categoria));
  return (Object.keys(CATEGORIAS) as Categoria[]).filter((c) => usadas.has(c));
}

/** «7 de octubre de 2026», con la fecha del frontmatter tal como se escribió. */
export function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    // El YAML lee «2026-10-07» como medianoche UTC. En hora argentina eso es
    // el 6 a la noche.
    timeZone: "UTC",
  });
}
