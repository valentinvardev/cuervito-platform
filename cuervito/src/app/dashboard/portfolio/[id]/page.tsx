import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";

import { PLANTILLA_POR_DEFECTO } from "~/app/_portfolio/plantillas/registro";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { disenoDe } from "~/server/portfolio";

import { portfolioPropio, sesionPortfolio } from "../_acceso";
import { VistaEscalada } from "../_vista";
import { Ajustes } from "./_ajustes";
import { Consultas } from "./_consultas";
import { CopiarUrl } from "./_copiar";
import { Datos } from "./_datos";
import { Fotos, type GrupoPanel } from "./_fotos";
import { Publicar } from "./_publicar";

export const dynamic = "force-dynamic";

const PESTANAS = [
  { id: "fotos", texto: "Fotos" },
  { id: "consultas", texto: "Consultas" },
  { id: "datos", texto: "Dirección y Google" },
  { id: "ajustes", texto: "Ajustes" },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

export default async function DetallePortfolio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestana?: string }>;
}) {
  const { userId, slug } = await sesionPortfolio();
  const { id } = await params;
  const p = await portfolioPropio(userId, id);
  const q = await searchParams;
  const pestana: Pestana = PESTANAS.some((x) => x.id === q.pestana) ? (q.pestana as Pestana) : "fotos";

  const [fotos, consultas, sinLeer] = await Promise.all([
    db.portfolioFoto.findMany({
      where: { portfolioId: id, photo: { deletedAt: null } },
      orderBy: { orden: "asc" },
      select: {
        photoId: true,
        grupo: true,
        photo: { select: { thumbKey: true, previewKey: true, portfolioKey: true } },
      },
    }),
    pestana === "consultas"
      ? db.consultaPortfolio.findMany({
          where: { portfolioId: id },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { id: true, nombre: true, email: true, mensaje: true, createdAt: true, leidaAt: true },
        })
      : Promise.resolve([]),
    db.consultaPortfolio.count({ where: { portfolioId: id, leidaAt: null } }),
  ]);

  // Los grupos, en el orden en que aparece su primera foto.
  const grupos: GrupoPanel[] = [];
  for (const f of fotos) {
    const clave = f.photo.thumbKey ?? f.photo.previewKey;
    if (!clave) continue;
    let g = grupos.find((x) => x.nombre === f.grupo);
    if (!g) {
      g = { nombre: f.grupo, fotos: [] };
      grupos.push(g);
    }
    g.fotos.push({ photoId: f.photoId, src: await resolveMediaUrl(clave), lista: Boolean(f.photo.portfolioKey) });
  }

  const url = `/${slug}/p/${p.slug}`;
  const plantilla = disenoDe(p).templateId ?? PLANTILLA_POR_DEFECTO;

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="pf-miga">
          <Link href="/dashboard/portfolio">Portfolio</Link>
          <span>/</span>
          <span>{p.nombre}</span>
        </div>

        <div className="head">
          <div>
            <div className="pf-titulo-fila">
              <h1>{p.nombre}</h1>
              {p.publicadoAt ? (
                <span className="pill live"><i /> Publicado</span>
              ) : (
                <span className="pill draft"><i /> Borrador</span>
              )}
            </div>
            <div className="pf-url">
              <span>encontrate.app{url}</span>
              <CopiarUrl url={`https://encontrate.app${url}`} />
            </div>
          </div>
          <div className="head-r">
            <a href={url} target="_blank" rel="noopener" className="btn btn-ghost">
              <ExternalLink /> {p.publicadoAt ? "Ver página" : "Vista previa"}
            </a>
            <Link href={`/dashboard/portfolio/${id}/editor`} className="btn btn-ghost">
              <Pencil /> Editor
            </Link>
            <Publicar id={id} publicado={Boolean(p.publicadoAt)} />
          </div>
        </div>

        <nav className="pf-pestanas">
          {PESTANAS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "fotos" ? `/dashboard/portfolio/${id}` : `/dashboard/portfolio/${id}?pestana=${t.id}`}
              aria-current={pestana === t.id ? "page" : undefined}
              scroll={false}
            >
              {t.texto}
              {t.id === "consultas" && sinLeer > 0 && <> <b>{sinLeer}</b></>}
            </Link>
          ))}
        </nav>

        {pestana === "fotos" && (
          <div className="pf-dos">
            <Fotos portfolioId={id} grupos={grupos} />
            <section className="card" style={{ display: "grid", gap: 14 }}>
              <div className="card-h" style={{ marginBottom: 0 }}>
                <div>
                  <h2>Cómo se ve</h2>
                  <div className="sub">Así lo ve un visitante, con tus cambios guardados</div>
                </div>
                <Link href={`/dashboard/portfolio/${id}/editor`} className="btn btn-sm btn-ghost">Editar</Link>
              </div>
              <VistaEscalada src={url} ancho={1280} alto={1600} className="pf-previa" titulo="Vista previa" />
              <div className="pf-nota">
                <span>
                  Las fotos van sin marca de agua y achicadas a 1600 px: se ven bien en cualquier pantalla y nadie se
                  lleva el archivo que vendés.
                </span>
              </div>
            </section>
          </div>
        )}

        {pestana === "consultas" && <Consultas consultas={consultas} />}

        {pestana === "datos" && (
          <Datos
            portfolioId={id}
            slugFotografo={slug}
            inicial={{ nombre: p.nombre, slug: p.slug, seoTitulo: p.seoTitulo ?? "", seoDescripcion: p.seoDescripcion ?? "" }}
          />
        )}

        {pestana === "ajustes" && <Ajustes portfolioId={id} plantilla={plantilla} />}
      </div>
    </main>
  );
}
