"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
  logoUrl: string | null;
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

export type PublicDiscount = {
  id: string;
  type: "CODE" | "BUNDLE" | "QTYPCT";
  code: string | null;
  kind: string | null;
  value: number | null;
  qty: number | null;
  price: number | null;
  expires: string | null;
};

type Photo = {
  id: string;
  previewUrl: string;
  bibNumbers: string | null;
  width: number | null;
  height: number | null;
};

const PAGE_SIZE = 12;

export function EventFeedShell(props: {
  photographer: Photographer;
  event: EventInfo;
  photos: Photo[];
  discounts?: PublicDiscount[];
  testMode?: boolean;
}) {
  return (
    <CartProvider
      eventId={props.event.id}
      pricePerPhoto={props.event.pricePerPhoto}
      currency={props.event.currency}
    >
      <FeedInner {...props} />
    </CartProvider>
  );
}

function FeedInner({
  photographer,
  event,
  photos,
  discounts = [],
  testMode,
}: {
  photographer: Photographer;
  event: EventInfo;
  photos: Photo[];
  discounts?: PublicDiscount[];
  testMode?: boolean;
}) {
  const { items, openCart, isInCart, add, remove, subtotalCents } = useCart();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selfieFilter, setSelfieFilter] = useState<Set<string> | null>(null);
  const [selfieMessage, setSelfieMessage] = useState<string | null>(null);

  const resultsRef = useRef<HTMLElement>(null);

  // Filter pipeline: selfie → bib → pagination
  const filtered = useMemo(() => {
    const base = selfieFilter ? photos.filter((p) => selfieFilter.has(p.id)) : photos;
    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter((p) => p.bibNumbers?.toLowerCase().includes(q));
  }, [photos, query, selfieFilter]);

  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - shown;
  const hasActiveFilter = !!query.trim() || !!selfieFilter;

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
        // Scroll to results
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } else if (r.kind === "no-face") {
      setSelfieMessage("No detectamos una cara clara en la foto. Probá otra.");
    } else if (r.kind === "error") {
      setSelfieMessage(r.message);
    }
  }

  function clearFilters() {
    setSelfieFilter(null);
    setSelfieMessage(null);
    setQuery("");
  }

  // Auto-scroll to results when user types a bib query
  function handleQueryChange(v: string) {
    setQuery(v);
    if (v.trim() && !hasActiveFilter) {
      setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        200,
      );
    }
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
      {/* ── Sticky nav ────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: 56,
          padding: "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--nav-bg, rgba(11,9,8,0.92))",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Link
            href={`/${photographer.slug}`}
            aria-label={`Volver a ${photographer.name}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 18 }} />
          </Link>
          {photographer.logoUrl ? (
            <Link href={`/${photographer.slug}`} style={{ display: "inline-flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photographer.logoUrl}
                alt={photographer.name}
                style={{ height: 28, width: "auto", objectFit: "contain" }}
              />
            </Link>
          ) : (
            <Link href="/" className="logo" style={{ textDecoration: "none" }}>
              cuerv<span className="logo-dot"></span>to
            </Link>
          )}
          <span
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
            className="feed-nav-event-name"
          >
            · {event.name}
          </span>
        </div>
        <button
          type="button"
          onClick={openCart}
          aria-label="Ver carrito"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 12px",
            borderRadius: 8,
            background: items.length > 0 ? "var(--accent)" : "transparent",
            color: items.length > 0 ? "var(--text-on-accent, #1a0d00)" : "var(--text-primary)",
            border: items.length > 0 ? "none" : "1px solid var(--border-subtle)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <i className="ti ti-shopping-cart" style={{ fontSize: 16 }} />
          {items.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)" }}>{items.length}</span>
          )}
        </button>
      </nav>

      {/* ── Hero with cover backdrop ─────────────────────── */}
      <header
        style={{
          position: "relative",
          padding: "60px 22px 40px",
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        {event.coverUrl && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${event.coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.18,
              filter: "blur(8px)",
              transform: "scale(1.08)",
              zIndex: -2,
            }}
          />
        )}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 0%, var(--bg-base) 95%), radial-gradient(circle at 30% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%)",
            zIndex: -1,
          }}
        />

        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 999,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              marginBottom: 18,
            }}
          >
            <i className="ti ti-bird" style={{ fontSize: 12, color: "var(--accent)" }} />
            {event.name}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(34px, 7vw, 56px)",
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              margin: "0 0 12px",
            }}
          >
            Encontrá<br />
            <span style={{ color: "var(--accent)" }}>tus fotos.</span>
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              lineHeight: 1.55,
              maxWidth: 440,
              margin: "0 auto 28px",
            }}
          >
            Buscá por número de dorsal o subí una selfie. Te mostramos solo las
            fotos donde aparecés.
          </p>

          {/* ── Search module — THE focus of this layout ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 14,
              boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
              textAlign: "left",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                marginBottom: 10,
                transition: "border-color 150ms",
              }}
            >
              <i
                className="ti ti-search"
                style={{ fontSize: 20, color: "var(--accent)", flexShrink: 0 }}
              />
              <input
                placeholder="Número de dorsal"
                inputMode="numeric"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--text-primary)",
                  fontSize: 18,
                  fontFamily: "var(--font-mono)",
                  minWidth: 0,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    padding: 4,
                    display: "inline-flex",
                  }}
                >
                  <i className="ti ti-x" style={{ fontSize: 16 }} />
                </button>
              )}
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 4px 10px",
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
              <span>o también</span>
              <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
            </div>

            <SelfieSearchButton eventId={event.id} onResult={handleSelfie} />
          </div>

          {selfieMessage && (
            <div
              style={{
                marginTop: 18,
                padding: "12px 16px",
                borderRadius: 12,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13.5,
                color: "var(--text-secondary)",
                textAlign: "left",
              }}
            >
              <i
                className="ti ti-face-id"
                style={{ color: "var(--accent)", fontSize: 18, flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{selfieMessage}</span>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: "4px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Ver todas
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Photographer strip — moved below the search ── */}
        <div
          style={{
            maxWidth: 640,
            margin: "32px auto 0",
            padding: "14px 16px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: photographer.avatarUrl
                ? `url(${photographer.avatarUrl}) center/cover`
                : "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, white))",
              color: photographer.avatarUrl ? "transparent" : "var(--text-on-accent, #1a0d00)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {!photographer.avatarUrl && photographer.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {photographer.name}
              <i
                className="ti ti-rosette-discount-check-filled"
                style={{ fontSize: 12, color: "var(--accent)" }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {dateLabel && <span>{dateLabel}</span>}
              {event.location && (
                <>
                  <span>·</span>
                  <span>{event.location}</span>
                </>
              )}
              <span>·</span>
              <span>
                <strong style={{ color: "var(--text-secondary)" }}>
                  {event.photosCount.toLocaleString("es-AR")}
                </strong>{" "}
                fotos
              </span>
            </div>
          </div>
          {photographer.instagramUrl && (
            <a
              href={`https://instagram.com/${photographer.instagramUrl.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener"
              aria-label="Instagram"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 8,
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <i className="ti ti-brand-instagram" style={{ fontSize: 16 }} />
            </a>
          )}
        </div>
      </header>

      {/* ── Promos strip ─────────────────────────────────── */}
      <PromosStrip discounts={discounts} />

      {/* ── Vertical feed ────────────────────────────────── */}
      <main
        ref={resultsRef}
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "16px 16px 140px",
          scrollMarginTop: 60,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "16px 4px",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}
        >
          <span>
            {hasActiveFilter
              ? `${filtered.length.toLocaleString("es-AR")} ${
                  filtered.length === 1 ? "resultado" : "resultados"
                }`
              : "Todas las fotos"}
          </span>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: "inherit",
                textTransform: "inherit",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Limpiar filtro
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              background: "var(--bg-surface)",
              border: "1px dashed var(--border-default)",
              borderRadius: 14,
              color: "var(--text-tertiary)",
            }}
          >
            <i
              className="ti ti-search-off"
              style={{ fontSize: 36, color: "var(--accent)", marginBottom: 12 }}
            />
            <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>
              Sin resultados.
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Probá con otro dorsal o subí una selfie.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {visible.map((p, i) => {
              const inCart = isInCart(p.id);
              return (
                <article
                  key={p.id}
                  style={{
                    background: "var(--bg-surface)",
                    border: `1px solid ${inCart ? "var(--border-accent)" : "var(--border-subtle)"}`,
                    borderRadius: 14,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "border-color 180ms, transform 200ms",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIdx(i)}
                    aria-label="Ver foto en grande"
                    style={{
                      position: "relative",
                      aspectRatio: "4/3",
                      backgroundImage: `url(${p.previewUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition:
                        p.width && p.height && p.width > p.height ? "center" : "top",
                      border: "none",
                      padding: 0,
                      cursor: "zoom-in",
                      display: "block",
                      width: "100%",
                    }}
                  >
                    {p.bibNumbers && (
                      <span
                        style={{
                          position: "absolute",
                          top: 10,
                          left: 10,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "rgba(245,130,10,0.92)",
                          color: "var(--text-on-accent, #1a0d00)",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          fontSize: 12,
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        #{p.bibNumbers}
                      </span>
                    )}
                  </button>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "12px 14px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        color: "var(--accent)",
                        fontWeight: 600,
                      }}
                    >
                      ${event.pricePerPhoto.toLocaleString("es-AR")}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (inCart) remove(p.id);
                        else
                          add({
                            photoId: p.id,
                            previewUrl: p.previewUrl,
                            priceCents: Math.round(event.pricePerPhoto * 100),
                          });
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        height: 34,
                        padding: "0 14px",
                        borderRadius: 999,
                        background: inCart ? "var(--bg-elevated)" : "var(--accent)",
                        color: inCart ? "var(--accent)" : "var(--text-on-accent, #1a0d00)",
                        border: inCart ? "1px solid var(--border-accent)" : "none",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 150ms",
                      }}
                    >
                      <i className={`ti ${inCart ? "ti-check" : "ti-plus"}`} style={{ fontSize: 14 }} />
                      {inCart ? "En carrito" : "Agregar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setShown((s) => s + PAGE_SIZE)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              marginTop: 18,
              padding: "14px 18px",
              borderRadius: 12,
              background: "transparent",
              border: "1px dashed var(--border-default)",
              color: "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 150ms, color 150ms",
            }}
          >
            <i className="ti ti-chevron-down" />
            <span>Cargar más fotos</span>
            <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              · quedan {remaining.toLocaleString("es-AR")}
            </span>
          </button>
        )}
      </main>

      {/* ── Sticky bottom mini-cart ──────────────────────── */}
      {items.length > 0 && (
        <button
          type="button"
          onClick={openCart}
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 18px",
            borderRadius: 14,
            background: "var(--accent)",
            color: "var(--text-on-accent, #1a0d00)",
            border: "none",
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
            cursor: "pointer",
            maxWidth: 600,
            margin: "0 auto",
            fontFamily: "inherit",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <i className="ti ti-shopping-cart" style={{ fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>
              {items.length} {items.length === 1 ? "foto" : "fotos"}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, opacity: 0.85 }}>
              ${(subtotalCents / 100).toLocaleString("es-AR")}
            </span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            Continuar
            <i className="ti ti-arrow-right" />
          </span>
        </button>
      )}

      <CartSheet
        eventId={event.id}
        eventName={event.name}
        pricePerPhoto={event.pricePerPhoto}
        photos={photos}
        discounts={discounts}
        testMode={testMode}
      />

      {lightboxIdx !== null && (
        <PublicLightbox
          photos={visible}
          startIndex={lightboxIdx}
          pricePerPhoto={event.pricePerPhoto}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      <style>{`
        @media (max-width: 540px) {
          .feed-nav-event-name { display: none; }
        }
      `}</style>
    </>
  );
}

// ── Promos strip ─────────────────────────────────────────────────────────────
function PromosStrip({ discounts }: { discounts: PublicDiscount[] }) {
  const visible = discounts.filter((d) => d.type !== "CODE");
  if (visible.length === 0) return null;

  return (
    <section
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "16px 16px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {visible.map((d) => {
          const icon = d.type === "BUNDLE" ? "ti-package" : "ti-percentage";
          const ttl =
            d.type === "BUNDLE"
              ? `Llevá ${d.qty} y pagás $${d.price?.toLocaleString("es-AR")} c/u`
              : `Llevá ${d.qty}+ y obtené ${d.value}% off`;
          return (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))",
                border: "1px solid var(--border-accent)",
                borderRadius: 12,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--accent-deep, transparent)",
                  border: "1px solid var(--border-accent)",
                  color: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                <i className={`ti ${icon}`} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {ttl}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  Se aplica automáticamente al sumar fotos.
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
