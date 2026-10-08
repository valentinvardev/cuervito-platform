import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { usuarioInstagram } from "~/lib/instagram";
import { buildTemplateStyle, getTemplate } from "~/lib/storefront-templates";
import { urlPublica } from "~/lib/url-publica";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { type Fotografo, traerFotografo } from "./_datos";
import { PerfilEncontrate } from "./encontrate/perfil";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const user = await traerFotografo(slug);
  if (!user) return {};

  const nombre = user.name ?? "Fotógrafo";
  const titulo = `${nombre} · Fotos de eventos deportivos`;
  const descripcion =
    user.bio?.trim() ||
    `Las fotos de ${nombre}${user.location ? ` en ${user.location}` : ""}. Buscá las tuyas por número de dorsal o con una selfie y descargalas al instante, sin crear cuenta.`;
  const url = urlPublica(slug, user.customDomains[0]?.hostname);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: { type: "profile", title: titulo, description: descripcion, url },
    twitter: { title: titulo, description: descripcion },
  };
}

function NavSkeleton({ logoUrl }: { logoUrl: string | null }) {
  return (
    <nav className="nav">
      <div className="nav-left">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="storefront-logo" />
        ) : (
          <span className="logo" aria-hidden="true">
            cuerv<span className="logo-dot" />to
          </span>
        )}
      </div>
    </nav>
  );
}

/* El esqueleto vivía en el layout, alrededor de todo lo de abajo. Bajó acá
   para que el layout pueda responder 404 (ver layout.tsx); la tienda lo sigue
   teniendo igual, con el logo del fotógrafo mientras cargan los eventos. */
export default async function PhotographerPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  // El layout ya respondió 404 si no existe; esto es para el tipo.
  const user = await traerFotografo(slug);
  if (!user) notFound();

  const logoUrl = user.logoKey ? await resolveMediaUrl(user.logoKey) : null;

  return (
    <Suspense fallback={<NavSkeleton logoUrl={logoUrl} />}>
      <Tienda slug={slug} user={user} logoUrl={logoUrl} />
    </Suspense>
  );
}

async function Tienda({
  slug,
  user,
  logoUrl,
}: {
  slug: string;
  user: Fotografo;
  logoUrl: string | null;
}) {
  const eventsRaw = await db.event.findMany({
    where: { ownerId: user.id, isPublished: true, NOT: { status: "ARCHIVED" } },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      coverUrl: true,
      eventDate: true,
      location: true,
      discipline: true,
      pricePerPhoto: true,
      _count: { select: { photos: { where: { fileSize: { not: null } } } } },
    },
  });

  const [events, avatarUrl] = await Promise.all([
    Promise.all(
      eventsRaw.map(async (e) => ({
        ...e,
        coverUrl: e.coverUrl
          ? e.coverUrl.startsWith("http")
            ? e.coverUrl
            : await resolveMediaUrl(e.coverUrl)
          : null,
      })),
    ),
    resolveAvatarUrl(user.image),
  ]);

  const initials =
    user.name
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  const pageStyle = buildTemplateStyle(user.storefrontTemplate, user.storefrontBrandColor);

  // La plantilla de encontrate se dibuja entera aparte: no es este mismo perfil
  // con otros colores, es otra estructura. Las de siempre siguen abajo.
  if (getTemplate(user.storefrontTemplate).layout === "encontrate") {
    return (
      <div style={pageStyle}>
        <PerfilEncontrate
          fotografo={{
            slug,
            nombre: user.name ?? "Fotógrafo",
            bio: user.bio,
            lugar: user.location,
            instagram: usuarioInstagram(user.instagramUrl),
            web: user.websiteUrl,
            iniciales: initials,
            avatarUrl,
            logoUrl,
          }}
          eventos={events.map((e) => ({
            id: e.id,
            slug: e.slug,
            nombre: e.name,
            portada: e.coverUrl,
            fecha: e.eventDate
              ? new Date(e.eventDate).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : null,
            lugar: e.location,
            fotos: e._count.photos,
            precio: `${Number(e.pricePerPhoto).toLocaleString("es-AR")}`,
          }))}
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <nav className="nav">
        <div className="nav-left">
          <Link href="/" className="back-btn" aria-label="Volver al inicio">
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
          </Link>
          <div className="nav-divider"></div>
          {logoUrl ? (
            <Link href="/" aria-label="Inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={user.name ?? "Logo"} className="storefront-logo" />
            </Link>
          ) : (
            <Link href="/" className="logo">
              cuerv<span className="logo-dot"></span>to
            </Link>
          )}
        </div>
      </nav>

      <header className="hero">
        <div className="hero-cover" aria-hidden="true"></div>
        <div className="hero-inner">
          <div className="photog-row">
            <div
              className="photog-avatar"
              style={
                avatarUrl
                  ? {
                      backgroundImage: `url(${avatarUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      color: "transparent",
                    }
                  : undefined
              }
            >
              {!avatarUrl && initials}
            </div>
            <div className="photog-info">
              <h1 className="photog-name">
                <span>{user.name ?? "Fotógrafo"}</span>
                <span className="verified">
                  <i className="ti ti-rosette-discount-check-filled" style={{ fontSize: 12 }} />
                  Verificado
                </span>
              </h1>
              <div className="photog-meta">
                {user.bio && <span>{user.bio}</span>}
                {(user.bio && (user.location || user.instagramUrl)) && <span className="sep"></span>}
                {user.location && <span>{user.location}</span>}
                {user.instagramUrl && (
                  <>
                    {(user.bio || user.location) && <span className="sep"></span>}
                    <a
                      href={`https://instagram.com/${user.instagramUrl.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <i className="ti ti-brand-instagram" style={{ fontSize: 16 }} />
                      <span>@{user.instagramUrl.replace(/^@/, "")}</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "-0.02em",
            marginBottom: 14,
          }}
        >
          Eventos
        </h2>

        {events.length === 0 ? (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              padding: 36,
              textAlign: "center",
              color: "var(--text-tertiary)",
              fontSize: 14,
            }}
          >
            Este fotógrafo todavía no tiene eventos publicados.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/${slug}/${e.slug}`}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 14,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 200ms, transform 200ms",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    aspectRatio: "16/10",
                    background: e.coverUrl
                      ? `url(${e.coverUrl}) top/cover`
                      : "linear-gradient(135deg, rgba(245,130,10,0.3) 0%, rgba(245,130,10,0.05) 60%, var(--bg-base) 100%)",
                  }}
                />
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 16,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {e.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {e.eventDate && (
                      <span>
                        {new Date(e.eventDate).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {e.location && (
                      <>
                        <span style={{ width: 3, height: 3, background: "var(--text-tertiary)", borderRadius: "50%", opacity: 0.6 }}></span>
                        <span>{e.location}</span>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {e._count.photos.toLocaleString("es-AR")} fotos
                    </span>
                    <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                      ${Number(e.pricePerPhoto).toLocaleString("es-AR")} c/u
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
