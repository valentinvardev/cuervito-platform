import Link from "next/link";

import { JsonLd } from "~/app/_components/json-ld";
import { ciudadDe } from "~/lib/disciplinas";
import { usuarioInstagram } from "~/lib/instagram";
import { atributosPlantilla, buildTemplateStyle, getTemplate } from "~/lib/storefront-templates";
import { urlPublica } from "~/lib/url-publica";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import { tonoDeLogo } from "~/server/logo-tono";
import { resolveMediaUrl } from "~/server/media";

import { type Fotografo } from "./_datos";
import { perfilDerivado, textoPerfil } from "./_resumen";
import { PerfilEncontrate } from "./encontrate/perfil";

/**
 * La página del fotógrafo, entera: barra, quién es, sus eventos.
 *
 * La plantilla llega como parámetro y no se lee del usuario, porque la dibujan
 * dos rutas: la pública, con la que tiene guardada, y /vista-tienda, que es el
 * panel mostrándole cómo quedaría con otra antes de cambiarla. Es la MISMA
 * página en los dos casos; si cada ruta tuviera la suya, la previa mentiría en
 * cuanto una cambiara.
 */
export async function Tienda({
  slug,
  user,
  logoUrl,
  plantilla,
  color,
  color2,
}: {
  slug: string;
  user: Fotografo;
  logoUrl: string | null;
  /** El id de la plantilla con la que se dibuja. Null es la de por defecto. */
  plantilla: string | null;
  /** Los colores de marca. Si no vienen, los guardados: la previa del panel
   *  manda los que el fotógrafo está probando. */
  color?: string | null;
  color2?: string | null;
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

  const [events, avatarUrl, derivado] = await Promise.all([
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
    perfilDerivado(user.id),
  ]);

  const ciudad = ciudadDe(user.location);
  const resumen = textoPerfil(ciudad, derivado);
  const url = urlPublica(slug, user.customDomains[0]?.hostname);
  const instagram = usuarioInstagram(user.instagramUrl);

  /* Quién es, para Google: una ProfilePage cuya entidad es la persona, con la
     ciudad y sus redes. Es lo que hace que «fotógrafo deportivo en [ciudad]»
     pueda devolver esta página y no solo la de un evento. */
  const datosEstructurados = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: {
      "@type": "Person",
      name: user.name ?? "Fotógrafo",
      url,
      jobTitle: "Fotógrafo deportivo",
      description: resumen,
      ...(avatarUrl ? { image: avatarUrl } : {}),
      ...(ciudad ? { address: { "@type": "PostalAddress", addressLocality: ciudad, addressCountry: "AR" } } : {}),
      ...(() => {
        const sameAs = [instagram ? `https://instagram.com/${instagram}` : null, user.websiteUrl].filter(Boolean);
        return sameAs.length > 0 ? { sameAs } : {};
      })(),
    },
  };

  const initials =
    user.name
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  const pageStyle = buildTemplateStyle(
    plantilla,
    color ?? user.storefrontBrandColor,
    color2 ?? user.storefrontBrandColor2,
  );
  const piel = atributosPlantilla(plantilla);

  // La plantilla de encontrate se dibuja entera aparte: no es este mismo perfil
  // con otros colores, es otra estructura. Las de siempre siguen abajo.
  if (getTemplate(plantilla).layout === "encontrate") {
    return (
      <div style={pageStyle} {...piel}>
        <JsonLd datos={datosEstructurados} />
        <PerfilEncontrate
          fotografo={{
            slug,
            nombre: user.name ?? "Fotógrafo",
            bio: user.bio,
            resumen,
            lugar: user.location,
            instagram,
            web: user.websiteUrl,
            iniciales: initials,
            avatarUrl,
            logoUrl,
            logoTono: await tonoDeLogo(user.id, user.logoKey),
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
                  year: "numeric", timeZone: "UTC" })
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
      <JsonLd datos={datosEstructurados} />
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
              {/* Qué cubre, con sus números: lo lee el organizador que llega
                  buscando un fotógrafo, y lo lee Google. */}
              <p style={{ margin: "10px 0 0", maxWidth: 620, fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                {resumen}
              </p>
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
                          year: "numeric", timeZone: "UTC" })}
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
