"use client";

import Link from "next/link";
import { Check, Hash, ImageOff, Plus, ScanSearch, ShoppingBag, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";

import { CartProvider, useCart } from "../cart-context";
import type { PublicDiscount } from "../event-coverage-shell";
import { SelfieSearchButton } from "../selfie-search";
import { Carrito } from "./carrito";
import { elegirPromo } from "./promo";
import { Visor } from "./visor";

// Las mismas formas que arma page.tsx y consumen las otras plantillas. Definir
// unas propias acá haría que agregar un campo allá compile igual y llegue
// undefined.
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
type Photo = {
  id: string;
  previewUrl: string;
  bibNumbers: string | null;
  width: number | null;
  height: number | null;
};

/** Cuántas fotos se dibujan por tanda. */
const TANDA = 24;

function pesos(centavos: number) {
  return "$" + Math.round(centavos / 100).toLocaleString("es-AR");
}

/**
 * La página de venta de encontrate.
 *
 * Es la plantilla que traen de fábrica las cuentas nuevas. A quien ya eligió
 * otra no se le cambia nada: el catálogo sigue devolviendo la suya, y las
 * cuentas viejas —que tienen la columna en null— siguen viendo la oscura.
 *
 * Tres decisiones que la separan de las que había:
 *
 * · La foto es lo único con color. Una galería deportiva ya trae dorsales
 *   fluorescentes y remeras de sponsors; si la página encima pone gradientes,
 *   compite con lo que vino a vender.
 *
 * · Las dos formas de buscarse van al mismo nivel y arriba de la grilla. La
 *   selfie escondida atrás de un botón chico es esconder lo único que
 *   distingue esto de una carpeta compartida.
 *
 * · El descuento se anuncia ANTES de elegir. Enterarse de que llevando cinco
 *   salen más baratas después de haber elegido tres no sirve de nada.
 */
export function EncontrateShell(props: {
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
      <Adentro {...props} />
    </CartProvider>
  );
}

function Adentro({
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
  const { items, add, remove, isInCart, open, openCart } = useCart();

  const [via, setVia] = useState<"nada" | "dorsal">("nada");
  const [dorsal, setDorsal] = useState("");
  // Sólo se guarda la búsqueda que encontró algo. Las otras variantes
  // (sin cara, error, cancelada) las informa el propio botón; guardarlas acá
  // dejaría la grilla filtrada a cero sin que nadie lo haya pedido.
  const [selfie, setSelfie] = useState<string[] | null>(null);
  const [visibles, setVisibles] = useState(TANDA);
  const [viendo, setViendo] = useState<number | null>(null);

  const precioCent = Math.round(event.pricePerPhoto * 100);
  const promo = useMemo(
    () => elegirPromo(discounts, event.pricePerPhoto),
    [discounts, event.pricePerPhoto],
  );
  const hayCodigos = discounts.some((d) => d.type === "CODE");

  const filtradas = useMemo(() => {
    // La selfie manda sobre el dorsal: si el atleta se sacó una foto, ya dijo
    // quién es, y filtrar eso además por un número que quedó escrito sería
    // esconderle sus propias fotos.
    if (selfie?.length) {
      const suyas = new Set(selfie);
      return photos.filter((p) => suyas.has(p.id));
    }
    if (dorsal.trim()) {
      return photos.filter((p) =>
        (p.bibNumbers ?? "")
          .split(",")
          .some((b) => b.trim().startsWith(dorsal.trim())),
      );
    }
    return photos;
  }, [photos, selfie, dorsal]);

  const trozo = filtradas.slice(0, visibles);
  const buscando = !!selfie || !!dorsal.trim();

  function alternar(f: Photo) {
    if (isInCart(f.id)) remove(f.id);
    else add({ photoId: f.id, previewUrl: f.previewUrl, priceCents: precioCent });
  }

  return (
    <div className="et" data-carrito={open ? "1" : ""}>
      <header className="et-top">
        <Link href={`/${photographer.slug}`} className="et-marca">
          <span className="et-av">
            {photographer.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photographer.avatarUrl} alt="" />
            ) : (
              photographer.initials
            )}
          </span>
          <span className="et-quien">
            <b>{photographer.name}</b>
            <span>encontrate.app/{photographer.slug}</span>
          </span>
        </Link>

        <div className="et-carrito">
          <button
            className="et-btn et-btn-icono"
            onClick={openCart}
            aria-label={`Carrito, ${items.length} fotos`}
          >
            <ShoppingBag />
          </button>
          {items.length > 0 && (
            <span className="et-carrito-n" key={items.length}>
              {items.length}
            </span>
          )}
        </div>
      </header>

      <div className="et-in">
        <section className="et-hero">
          <div className="et-hero-meta">
            {event.eventDate && <span>{event.eventDate}</span>}
            {event.eventDate && event.location && <i />}
            {event.location && <span>{event.location}</span>}
            {testMode && (
              <>
                <i />
                <span>Modo de prueba</span>
              </>
            )}
          </div>
          <h1>{event.name}</h1>
          <div className="et-hero-pie">
            <b>{event.photosCount.toLocaleString("es-AR")}</b>
            <span>fotos</span>
            <i style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor" }} />
            <b>{pesos(precioCent)}</b>
            <span>cada una</span>
          </div>
        </section>

        {/* Las dos vías, al mismo nivel. */}
        <section className="et-buscar">
          <SelfieSearchButton
            eventId={event.id}
            onResult={(r) => {
              setSelfie(r.kind === "ok" ? r.photoIds : null);
              setVisibles(TANDA);
              setVia("nada");
              setDorsal("");
            }}
          />

          {via === "dorsal" ? (
            <div className="et-dorsal">
              <div className="et-campo">
                <span>#</span>
                <input
                  autoFocus
                  inputMode="numeric"
                  placeholder="Tu dorsal"
                  value={dorsal}
                  onChange={(e) => {
                    setDorsal(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setVisibles(TANDA);
                    setSelfie(null);
                  }}
                />
              </div>
              <button
                className="et-btn et-btn-icono"
                onClick={() => {
                  setVia("nada");
                  setDorsal("");
                }}
                aria-label="Cancelar"
              >
                <X />
              </button>
            </div>
          ) : (
            <button className="et-buscar-op" onClick={() => setVia("dorsal")}>
              <span className="et-buscar-i">
                <Hash />
              </span>
              <span>
                <b>Buscar por dorsal</b>
                <span>Escribí tu número y aparecen las tuyas</span>
              </span>
            </button>
          )}
        </section>

        {promo && (
          <div className="et-promo">
            <Tag />
            <span>
              <b>{promo.texto}</b>
            </span>
            {promo.codigo && <span className="et-promo-cod">{promo.codigo}</span>}
          </div>
        )}

        <section className="et-grilla">
          {trozo.map((f, i) => {
            const puesta = isInCart(f.id);
            return (
              <div
                className={`et-foto ${puesta ? "et-elegida" : ""}`}
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => setViendo(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setViendo(i);
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.previewUrl} alt="" loading="lazy" />
                {f.bibNumbers && (
                  <span className="et-foto-dorsal">#{f.bibNumbers.split(",")[0]}</span>
                )}
                <button
                  className="et-mas"
                  onClick={(e) => {
                    // Sin esto, agregar al carrito abre además la foto grande.
                    e.stopPropagation();
                    alternar(f);
                  }}
                  aria-label={puesta ? "Quitar del carrito" : "Agregar al carrito"}
                >
                  {puesta ? <Check /> : <Plus />}
                </button>
              </div>
            );
          })}

          {filtradas.length === 0 && (
            <div className="et-vacio">
              <div className="et-vacio-i">{buscando ? <ScanSearch /> : <ImageOff />}</div>
              <h3>
                {selfie
                  ? "No encontramos fotos tuyas"
                  : buscando
                    ? "Ninguna foto con ese dorsal"
                    : "Todavía no hay fotos"}
              </h3>
              <p>
                {selfie ? (
                  <>
                    Puede que estés de espaldas o muy lejos en las que hay. Probá buscando por tu
                    número de dorsal.
                  </>
                ) : buscando ? (
                  <>
                    Puede que el número no se haya leído bien en ninguna. Probá con la selfie, que
                    no depende del dorsal.
                  </>
                ) : (
                  <>El fotógrafo las está subiendo. Volvé en un rato.</>
                )}
              </p>
              {buscando && (
                <button
                  className="et-btn"
                  onClick={() => {
                    setSelfie(null);
                    setDorsal("");
                    setVia("nada");
                  }}
                >
                  Ver todas las fotos
                </button>
              )}
            </div>
          )}
        </section>

        {visibles < filtradas.length && (
          <div className="et-mas-fotos">
            <button className="et-btn" onClick={() => setVisibles((v) => v + TANDA)}>
              Ver más fotos ({(filtradas.length - visibles).toLocaleString("es-AR")})
            </button>
          </div>
        )}
      </div>

      <footer className="et-pie">
        <span>
          Fotos de {photographer.name}. Las comprás y te las llevás sin marca
          de agua.
        </span>
        <a href="https://encontrate.app" target="_blank" rel="noopener">
          Hecho con encontrate.app
        </a>
      </footer>

      {viendo !== null && trozo[viendo] && (
        <Visor
          fotos={trozo}
          indice={viendo}
          enCarrito={isInCart}
          precio={pesos(precioCent)}
          alCerrar={() => setViendo(null)}
          alIr={setViendo}
          alAlternar={(f) => alternar(f as Photo)}
        />
      )}

      <Carrito eventId={event.id} promo={promo} hayCodigos={hayCodigos} />
    </div>
  );
}
