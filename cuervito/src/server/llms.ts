import "server-only";

import { SITIO } from "~/lib/marca";
import { COMISION, INCLUIDO, PREGUNTAS } from "~/lib/producto";
import { CATEGORIAS, listarPosts, type Post } from "~/server/blog";

/**
 * /llms.txt y /llms-full.txt: lo que un agente lee para entender qué es
 * encontrate sin tener que adivinarlo del HTML.
 *
 * El formato es la propuesta de llmstxt.org: markdown, un título, una cita con
 * el resumen, y secciones de links con una línea cada uno. No es un estándar
 * que Google use; lo leen los agentes que van a buscar contexto antes de
 * contestar, y para esos es la diferencia entre citar el precio que es y
 * citar uno que inventaron.
 *
 * Todo sale de lib/producto y del blog: si la comisión cambia, cambia acá
 * sola.
 */

function cabecera(): string {
  return `# encontrate.app

> Plataforma argentina para vender y encontrar fotos de eventos deportivos: carreras de calle, trail, ciclismo, duatlón, partidos. El fotógrafo sube las fotos del evento; cada atleta encuentra las suyas por número de dorsal o con una selfie, y las compra y descarga al instante sin crear cuenta. El pago entra directo a la cuenta de Mercado Pago del fotógrafo.

## Para atletas

- [Buscar mis fotos](${SITIO}/eventos): elegí el evento y buscá tus fotos por número de dorsal o con una selfie.
- No hace falta crear cuenta: se compra con el email y las fotos llegan por un link de descarga.
- La selfie se usa para buscar y se descarta: no se guarda.
- Se paga con Mercado Pago.

## Para fotógrafos

- Precio: sin cuota mensual, sin alta y sin permanencia. Comisión de ${COMISION.conReconocimiento}% por venta con reconocimiento de cara y número, o ${COMISION.sinReconocimiento}% si el evento es sólo galería.
- Cobro: cada venta entra en el momento a la cuenta de Mercado Pago del fotógrafo, con la comisión ya descontada. La plataforma no retiene el dinero.
- Incluye: ${INCLUIDO.join("; ")}.
- [Crear una cuenta](${SITIO}/signup)
- [Ver cómo se sube un evento](${SITIO}/demo/subida)
- [Comparativa con otras plataformas](${SITIO}/comparativa)

## Preguntas frecuentes

${PREGUNTAS.map((q) => `- **${q.p}** ${q.r}`).join("\n")}
`;
}

function linkDePost(p: Post): string {
  return `- [${p.titulo}](${SITIO}/blog/${p.slug}): ${p.descripcion}`;
}

/** El MDX como markdown: los componentes no significan nada fuera de la página. */
function aMarkdown(cuerpo: string): string {
  return cuerpo
    .replace(/<Comision\s+sin\s*\/>/g, `${COMISION.sinReconocimiento}%`)
    .replace(/<Comision\s*\/>/g, `${COMISION.conReconocimiento}%`)
    .replace(/<Nota\s+titulo="([^"]*)"\s*>/g, "> **$1**")
    .replace(/<\/?Nota\s*>/g, "")
    .replace(/^\s*<[A-Z][^>]*\/>\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function llmsTxt(): Promise<string> {
  const posts = await listarPosts();
  const blog = posts.length
    ? `\n## Blog\n\n${posts.map(linkDePost).join("\n")}\n`
    : "";

  return `${cabecera()}${blog}
## Opcional

- [Todo el blog en un archivo](${SITIO}/llms-full.txt)
- [Mapa del sitio](${SITIO}/sitemap.xml)
- [Términos](${SITIO}/terminos)
- [Privacidad](${SITIO}/privacidad)
`;
}

export async function llmsFullTxt(): Promise<string> {
  const posts = await listarPosts();
  const cuerpos = posts.map(
    (p) =>
      `---\n\n# ${p.titulo}\n\nURL: ${SITIO}/blog/${p.slug}\nSección: ${CATEGORIAS[p.categoria].nombre}\nPublicado: ${p.publicado.toISOString().slice(0, 10)}\n\n${aMarkdown(p.cuerpo)}\n`,
  );
  return `${cabecera()}\n${cuerpos.join("\n")}`;
}
