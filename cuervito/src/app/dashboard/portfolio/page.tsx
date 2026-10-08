import { ArrowRight, Eye, Plus } from "lucide-react";
import Link from "next/link";

import { clasesFuentes } from "~/app/_portfolio/fuentes";
import { PLANTILLA_POR_DEFECTO, PLANTILLAS } from "~/app/_portfolio/plantillas/registro";
import { disenoDe } from "~/server/portfolio";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { hace } from "../_components/formato";
import { sesionPortfolio } from "./_acceso";

export const dynamic = "force-dynamic";

const MUESTRAS = [PLANTILLAS.halcyon, PLANTILLAS.meridian, PLANTILLAS.vernissage];

export default async function PortfolioPagina() {
  const { userId, slug } = await sesionPortfolio();

  const [portfolios, consultas] = await Promise.all([
    db.portfolio.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        nombre: true,
        slug: true,
        diseno: true,
        publicadoAt: true,
        vistas: true,
        updatedAt: true,
        fotos: {
          where: { photo: { deletedAt: null } },
          orderBy: { orden: "asc" },
          take: 1,
          select: { photo: { select: { portfolioKey: true, thumbKey: true } } },
        },
        _count: {
          select: {
            fotos: { where: { photo: { deletedAt: null } } },
            consultas: { where: { leidaAt: null } },
          },
        },
      },
    }),
    db.consultaPortfolio.findMany({
      where: { portfolio: { ownerId: userId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        nombre: true,
        mensaje: true,
        createdAt: true,
        leidaAt: true,
        portfolio: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  const tarjetas = await Promise.all(
    portfolios.map(async (p) => {
      const f = p.fotos[0]?.photo;
      const clave = f?.portfolioKey ?? f?.thumbKey;
      const plantilla = PLANTILLAS[disenoDe(p).templateId ?? PLANTILLA_POR_DEFECTO];
      return { ...p, portada: clave ? await resolveMediaUrl(clave) : null, plantilla };
    }),
  );

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Portfolio</h1>
            <p>Tu mejor trabajo en una página propia, sin precio ni carrito.</p>
          </div>
          {tarjetas.length > 0 && (
            <div className="head-r">
              <Link href="/dashboard/portfolio/nuevo" className="btn btn-pri">
                <Plus /> Nuevo portfolio
              </Link>
            </div>
          )}
        </div>

        <div className="pf-interno">
          <Eye />
          <span>
            <b>Vista interna.</b> Sólo la ven los admins; los fotógrafos siguen viendo Portfolio como «Pronto».
          </span>
        </div>

        {tarjetas.length === 0 ? (
          <Vacio />
        ) : (
          <div className="pf-grilla">
            {tarjetas.map((p) => (
              <Link key={p.id} href={`/dashboard/portfolio/${p.id}`} className="pf-tarjeta">
                <div className="pf-portada">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.portada && <img src={p.portada} alt="" loading="lazy" />}
                  <div className="pf-portada-pie">
                    <span>{p.plantilla.name}</span>
                    <span className="pf-paleta" aria-hidden>
                      {[p.plantilla.defaultPalette?.bg, p.plantilla.defaultPalette?.fg, p.plantilla.defaultPalette?.accent].map((c, i) => (
                        <i key={i} style={{ background: c }} />
                      ))}
                    </span>
                  </div>
                </div>
                <div className="pf-cuerpo">
                  <div className="pf-cuerpo-h">
                    <div>
                      <b>{p.nombre}</b>
                      <span>encontrate.app/{slug}/p/{p.slug}</span>
                    </div>
                    {p.publicadoAt ? (
                      <span className="pill live"><i /> Publicado</span>
                    ) : (
                      <span className="pill draft"><i /> Borrador</span>
                    )}
                  </div>
                  <div className="pf-numeros">
                    <div>
                      <b>{p.publicadoAt ? p.vistas.toLocaleString("es-AR") : "—"}</b>
                      <span>{p.publicadoAt ? "visitas" : "sin publicar"}</span>
                    </div>
                    <div>
                      <b>{p._count.fotos}</b>
                      <span>fotos</span>
                    </div>
                    {p._count.consultas > 0 ? (
                      <div className="hot">
                        <b>{p._count.consultas}</b>
                        <span>{p._count.consultas === 1 ? "consulta nueva" : "consultas nuevas"}</span>
                      </div>
                    ) : (
                      <div>
                        <b>{hace(p.updatedAt)}</b>
                        <span>última edición</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}

            <Link href="/dashboard/portfolio/nuevo" className="pf-nuevo">
              <div className="pf-muestras" aria-hidden>
                {MUESTRAS.map((t) => (
                  <i key={t.id} style={{ background: t.defaultPalette?.bg }} />
                ))}
              </div>
              <div>
                <b>Otro portfolio</b>
                <p>Uno por disciplina, por cliente o por temporada. Elegís las fotos de tus eventos y una de tres plantillas.</p>
              </div>
              <span>
                Empezar <ArrowRight />
              </span>
            </Link>
          </div>
        )}

        {consultas.length > 0 && (
          <section className="card">
            <div className="card-h">
              <div>
                <h2>Consultas</h2>
                <div className="sub">Lo que te escriben desde el formulario de contacto de tus portfolios</div>
              </div>
            </div>
            {consultas.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/portfolio/${c.portfolio.id}?pestana=consultas`}
                className={`pf-consulta${c.leidaAt ? " leida" : ""}`}
              >
                <span className={c.leidaAt ? "" : "punto"} />
                <span className="quien">{c.nombre}</span>
                <span className="que">{c.mensaje}</span>
                <span className="cuando">{hace(c.createdAt)}</span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

/** La primera vez: qué es y cómo se arma, en vez de una grilla vacía. */
function Vacio() {
  return (
    <section className="pf-vacio">
      <div className="pf-vacio-t">
        <span className="cap">Nuevo en encontrate</span>
        <h2>Tus fotos ya están acá. Armá tu portfolio con ellas.</h2>
        <p>Una página para mostrar lo mejor que sacaste, sin precios ni carrito. Para que te contraten clubes, organizadores y marcas.</p>
        <ol className="pf-pasos">
          <li><span>01</span> Elegís las fotos de tus eventos</li>
          <li><span>02</span> Elegís una de las tres plantillas</li>
          <li><span>03</span> Cambiás los textos y publicás</li>
        </ol>
        <div>
          <Link href="/dashboard/portfolio/nuevo" className="btn btn-pri btn-lg">
            Crear mi portfolio <ArrowRight className="go" />
          </Link>
        </div>
      </div>
      <div className={`pf-vacio-v ${clasesFuentes}`} aria-hidden>
        {MUESTRAS.map((t, i) => (
          <div
            key={t.id}
            style={{
              background: t.defaultPalette?.bg,
              width: "62%",
              height: "70%",
              left: `${i * 18}%`,
              top: `${i * 12}%`,
              transform: `rotate(${(i - 1) * 3}deg)`,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ padding: 18, fontFamily: t.defaultTypography?.serif, color: t.defaultPalette?.fg, fontSize: 26, lineHeight: 1.05 }}>
              {t.name}
              <div style={{ marginTop: 10, width: 46, height: 3, background: t.defaultPalette?.accent }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
