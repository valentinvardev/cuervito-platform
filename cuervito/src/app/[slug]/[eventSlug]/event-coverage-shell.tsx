"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

const PAGE_SIZE = 24;

export function EventCoverageShell(props: {
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
      <ShellInner {...props} />
    </CartProvider>
  );
}

function ShellInner({
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
          {photographer.logoUrl ? (
            <Link href={`/${photographer.slug}`} aria-label="Volver a la galería">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photographer.logoUrl} alt={photographer.name} className="storefront-logo" />
            </Link>
          ) : (
            <Link href="/" className="logo">
              cuerv<span className="logo-dot"></span>to
            </Link>
          )}
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

        <PromosStrip discounts={discounts} />

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
                  backgroundPosition:
                    p.height && p.width && p.height > p.width ? "top" : "center",
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

      <LiveNudge
        discounts={discounts}
        pricePerPhoto={event.pricePerPhoto}
        onOpen={openCart}
      />

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
          photos={filterByBib(visiblePhotos, query)}
          startIndex={lightboxIdx}
          pricePerPhoto={event.pricePerPhoto}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}

// ── Promos strip ─────────────────────────────────────────────────────────────
// Shows BUNDLE and QTYPCT discounts as cards below the search bar.
// CODE discounts are kept private (shared out-of-band by the photographer).

function PromosStrip({ discounts }: { discounts: PublicDiscount[] }) {
  const visible = discounts.filter((d) => d.type !== "CODE");
  if (visible.length === 0) return null;

  return (
    <section className="promos">
      <div className="promos-head">
        <span className="lbl">Promos activas</span>
        <span className="sub">se aplican automáticamente al sumar fotos</span>
      </div>
      <div className="promos-grid">
        {visible.map((d) => {
          const icon = d.type === "BUNDLE" ? "ti-package" : "ti-percentage";
          const ttl =
            d.type === "BUNDLE"
              ? `Llevá ${d.qty} y pagás $${d.price?.toLocaleString("es-AR")} c/u`
              : `Llevá ${d.qty}+ y obtené ${d.value}% off`;
          const sub =
            d.type === "BUNDLE"
              ? "Precio especial al alcanzar la cantidad"
              : "Aplicado al total automáticamente";
          return (
            <div key={d.id} className="promo-card">
              <div className="ic"><i className={`ti ${icon}`} /></div>
              <div className="body">
                <div className="ttl">{ttl}</div>
                <div className="sub">{sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Live nudge ────────────────────────────────────────────────────────────────
// Fixed floating banner at the bottom of the page. Appears when you add the
// first photo and updates in real time — green when a threshold is met.

type NudgeState = {
  icon: string;
  ttl: string;
  sub: string;
  met: boolean;
  progress: number; // 0-100
} | null;

function computeNudge(
  discounts: PublicDiscount[],
  count: number,
  pricePerPhoto: number,
): NudgeState {
  if (count === 0) return null;

  const bundle = discounts
    .filter((d) => d.type === "BUNDLE" && d.qty !== null && d.price !== null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0] ?? null;

  const qpct = discounts
    .filter((d) => d.type === "QTYPCT" && d.qty !== null && d.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] ?? null;

  if (bundle) {
    if (count >= bundle.qty!) {
      const saving = (pricePerPhoto - bundle.price!) * count;
      return {
        icon: "ti-package",
        ttl: `Estás al precio especial · $${bundle.price!.toLocaleString("es-AR")} c/u`,
        sub: `Llevás ${count} fotos · ahorrás $${saving.toLocaleString("es-AR")}`,
        met: true,
        progress: 100,
      };
    }
    const need = bundle.qty! - count;
    const saving = (pricePerPhoto - bundle.price!) * bundle.qty!;
    return {
      icon: "ti-package",
      ttl: `Sumá ${need} más y pagás $${bundle.price!.toLocaleString("es-AR")} c/u`,
      sub: `Llevando ${bundle.qty} fotos ahorrás $${saving.toLocaleString("es-AR")}`,
      met: false,
      progress: Math.round((count / bundle.qty!) * 100),
    };
  }

  if (qpct) {
    if (count >= qpct.qty!) {
      const saving = Math.round((count * pricePerPhoto * (qpct.value ?? 0)) / 100);
      return {
        icon: "ti-percentage",
        ttl: `${qpct.value}% off aplicado · ahorrás $${saving.toLocaleString("es-AR")}`,
        sub: `Por llevar ${count} fotos`,
        met: true,
        progress: 100,
      };
    }
    const need = qpct.qty! - count;
    return {
      icon: "ti-percentage",
      ttl: `Sumá ${need} más y obtené ${qpct.value}% off`,
      sub: "Aplicado automáticamente al total",
      met: false,
      progress: Math.round((count / qpct.qty!) * 100),
    };
  }

  return null;
}

function LiveNudge({
  discounts,
  pricePerPhoto,
  onOpen,
}: {
  discounts: PublicDiscount[];
  pricePerPhoto: number;
  onOpen: () => void;
}) {
  const { items } = useCart();
  const count = items.length;

  const nudge = computeNudge(discounts, count, pricePerPhoto);

  const elRef = useRef<HTMLDivElement>(null);
  const prevTtl = useRef<string>("");
  const prevMet = useRef<boolean | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    if (!nudge) {
      // Fade out
      el.classList.add("entering");
      const t = setTimeout(() => {
        el.hidden = true;
        el.classList.remove("entering");
      }, 240);
      return () => clearTimeout(t);
    }

    if (el.hidden) {
      // First appearance
      el.hidden = false;
      el.classList.add("entering");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => el.classList.remove("entering")),
      );
    } else if (nudge.ttl !== prevTtl.current || nudge.met !== prevMet.current) {
      // Content changed — quick fade swap
      el.classList.add("swap");
      const t = setTimeout(() => el.classList.remove("swap"), 180);
      return () => clearTimeout(t);
    }

    prevTtl.current = nudge.ttl;
    prevMet.current = nudge.met;
  }, [nudge]);

  return (
    <div
      ref={elRef}
      className={`live-nudge${nudge?.met ? " met" : ""}`}
      hidden={!nudge}
      onClick={onOpen}
      style={{ cursor: "pointer" }}
    >
      <div className="ic">
        <i className={`ti ${nudge?.icon ?? "ti-bolt"}`} />
      </div>
      <div className="body">
        <div className="ttl">{nudge?.ttl}</div>
        <div className="sub">{nudge?.sub}</div>
        {nudge && nudge.progress < 100 && (
          <div className="progress">
            <span style={{ width: `${nudge.progress}%` }} />
          </div>
        )}
      </div>
    </div>
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
