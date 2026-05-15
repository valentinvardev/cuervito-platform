"use client";

import Link from "next/link";
import { useState } from "react";

import { CartProvider, useCart } from "./cart-context";
import { CartSheet } from "./cart-sheet";
import { PublicLightbox } from "./public-lightbox";
import { SelfieSearchButton, type SelfieResult } from "./selfie-search";

type Photographer = {
  slug: string;
  name: string;
  bio: string | null;
  location: string | null;
  instagramUrl: string | null;
  initials: string;
  avatarUrl: string | null;
};

type EventInfo = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  discipline: string | null;
  location: string | null;
  eventDate: string | null;
  coverUrl: string | null;
  pricePerPhoto: number;
  currency: string;
  photosCount: number;
};

type Photo = {
  id: string;
  previewUrl: string;
  bibNumbers: string | null;
  width: number | null;
  height: number | null;
};

const PAGE_SIZE = 24;

export function EventCoverageShell(props: {
  photographer: Photographer;
  event: EventInfo;
  photos: Photo[];
  testMode?: boolean;
}) {
  return (
    <CartProvider
      eventId={props.event.id}
      pricePerPhoto={props.event.pricePerPhoto}
      currency={props.event.currency}
    >
      <ShellInner {...props} />
    </CartProvider>
  );
}

function ShellInner({
  photographer,
  event,
  photos,
  testMode,
}: {
  photographer: Photographer;
  event: EventInfo;
  photos: Photo[];
  testMode?: boolean;
}) {
  const { items, openCart, isInCart, add, remove } = useCart();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selfieFilter, setSelfieFilter] = useState<Set<string> | null>(null);
  const [selfieMessage, setSelfieMessage] = useState<string | null>(null);

  // Apply selfie filter first, then bib filter, then pagination
  const photosAfterSelfie = selfieFilter
    ? photos.filter((p) => selfieFilter.has(p.id))
    : photos;
  const visiblePhotos = photosAfterSelfie.slice(0, shown);
  const remaining = photosAfterSelfie.length - shown;

  function handleSelfie(r: SelfieResult) {
    if (r.kind === "ok") {
      if (r.photoIds.length === 0) {
        setSelfieMessage("No encontramos coincidencias para esa selfie.");
        setSelfieFilter(new Set());
      } else {
        setSelfieFilter(new Set(r.photoIds));
        setSelfieMessage(
          `Encontramos ${r.photoIds.length} ${r.photoIds.length === 1 ? "foto" : "fotos"} con tu cara.`,
        );
        setShown(PAGE_SIZE);
      }
    } else if (r.kind === "no-face") {
      setSelfieMessage("No detectamos una cara clara en la foto. Probá otra.");
    } else if (r.kind === "error") {
      setSelfieMessage(r.message);
    }
  }

  function clearSelfie() {
    setSelfieFilter(null);
    setSelfieMessage(null);
  }
  const dateLabel = event.eventDate
    ? new Date(event.eventDate).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <Link
            href={`/${photographer.slug}`}
            className="back-btn"
            aria-label={`Volver a ${photographer.name}`}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
          </Link>
          <div className="nav-divider"></div>
          <Link href="/" className="logo">
            cuerv<span className="logo-dot"></span>to
          </Link>
          <span className="nav-event-name">{event.name}</span>
        </div>
        <div className="nav-right">
          <button
            type="button"
            className={`cart-btn ${items.length > 0 ? "has" : ""}`}
            onClick={openCart}
          >
            <i className="ti ti-shopping-cart" style={{ fontSize: 16 }} />
            <span>Carrito</span>
            {items.length > 0 && <span className="count">{items.length}</span>}
          </button>
        </div>
      </nav>

      <header className={`hero ${event.coverUrl ? "has-cover" : ""}`}>
        <div
          className="hero-cover"
          aria-hidden="true"
          style={
            event.coverUrl
              ? { backgroundImage: `url(${event.coverUrl})` }
              : undefined
          }
        ></div>
        <div className="hero-inner">
          <div className="photog-row">
            <div
              className="photog-avatar"
              style={
                photographer.avatarUrl
                  ? {
                      backgroundImage: `url(${photographer.avatarUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      color: "transparent",
                    }
                  : undefined
              }
            >
              {!photographer.avatarUrl && photographer.initials}
            </div>
            <div className="photog-info">
              <h1 className="photog-name">
                <span>{photographer.name}</span>
                <span className="verified">
                  <i
                    className="ti ti-rosette-discount-check-filled"
                    style={{ fontSize: 12 }}
                  />
                  Verificado
                </span>
              </h1>
              <div className="photog-meta">
                {photographer.bio && <span>{photographer.bio}</span>}
                {photographer.instagramUrl && (
                  <>
                    {photographer.bio && <span className="sep"></span>}
                    <a
                      href={`https://instagram.com/${photographer.instagramUrl.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <i className="ti ti-brand-instagram" style={{ fontSize: 16 }} />
                      <span>@{photographer.instagramUrl.replace(/^@/, "")}</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="event-strip">
            <div>
              <div className="lbl">Cobertura de</div>
              <div className="nm">{event.name}</div>
            </div>
            <div className="meta" style={{ marginLeft: 14 }}>
              {dateLabel && (
                <>
                  <span>{dateLabel}</span>
                  <span className="sep"></span>
                </>
              )}
              {event.location && (
                <>
                  <span>{event.location}</span>
                  <span className="sep"></span>
                </>
              )}
              <span>
                <strong>{event.photosCount.toLocaleString("es-AR")}</strong> fotos de este fotógrafo
              </span>
            </div>
          </div>

          <div className="search-card in-hero">
            <div className="input-with-icon">
              <i className="ti ti-search"></i>
              <input
                placeholder="Buscar por número de dorsal…"
                inputMode="numeric"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <SelfieSearchButton eventId={event.id} onResult={handleSelfie} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                // Bib filter runs as you type already; this is a no-op affordance.
              }}
            >
              <i className="ti ti-search"></i>Buscar
            </button>
          </div>
        </div>
      </header>

      <main className="main">

        {selfieMessage && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            <i className="ti ti-face-id" style={{ color: "var(--accent)" }} />
            <span style={{ flex: 1 }}>{selfieMessage}</span>
            {selfieFilter && (
              <button
                type="button"
                onClick={clearSelfie}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                Ver todas
              </button>
            )}
          </div>
        )}

        <div className="photo-grid">
          {filterByBib(visiblePhotos, query).map((p, i) => {
            const inCart = isInCart(p.id);
            return (
              <div
                key={p.id}
                className={`photo-cell ${inCart ? "in-cart" : ""}`}
                style={{
                  backgroundImage: `url(${p.previewUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                onClick={() => setLightboxIdx(i)}
              >
                <div className="watermark">cuervito</div>
                <div className="price">
                  ${event.pricePerPhoto.toLocaleString("es-AR")}
                </div>
                <button
                  type="button"
                  className="add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inCart) remove(p.id);
                    else
                      add({
                        photoId: p.id,
                        previewUrl: p.previewUrl,
                        priceCents: Math.round(event.pricePerPhoto * 100),
                      });
                  }}
                  aria-label={inCart ? "Sacar del carrito" : "Agregar al carrito"}
                >
                  <i className={`ti ${inCart ? "ti-check" : "ti-shopping-cart-plus"}`} />
                  {inCart ? "En carrito" : "Agregar"}
                </button>
              </div>
            );
          })}
        </div>

        {remaining > 0 && (
          <button
            type="button"
            className="load-more"
            onClick={() => setShown((s) => s + PAGE_SIZE)}
          >
            <i className="ti ti-chevron-down" />
            <span>Cargar más fotos</span>
            <span className="count">· quedan {remaining.toLocaleString("es-AR")}</span>
          </button>
        )}
      </main>

      <CartSheet
        eventId={event.id}
        eventName={event.name}
        pricePerPhoto={event.pricePerPhoto}
        photos={photos}
        testMode={testMode}
      />

      {lightboxIdx !== null && (
        <PublicLightbox
          photos={filterByBib(visiblePhotos, query)}
          startIndex={lightboxIdx}
          pricePerPhoto={event.pricePerPhoto}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}

function filterByBib(photos: Photo[], q: string): Photo[] {
  const term = q.trim();
  if (!term) return photos;
  return photos.filter((p) => {
    if (!p.bibNumbers) return false;
    return p.bibNumbers.split(",").some((b) => b.startsWith(term));
  });
}
