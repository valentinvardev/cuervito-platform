"use client";

import Link from "next/link";
import {
  Check,
  ImageOff,
  Plus,
  ScanFace,
  ScanSearch,
  ShoppingBag,
  Tag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { CartProvider, useCart } from "../cart-context";
import type { PublicDiscount } from "../event-coverage-shell";
import { useBusquedaSelfie } from "../selfie-search";
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

/**
 * La fecha como la diría una persona: 27 de julio de 2026.
 *
 * Llega como ISO desde el servidor. toLocaleDateString con la zona horaria del
 * navegador correría un día para atrás en Argentina, porque el evento se guarda
 * a medianoche UTC: se formatea en UTC, que es la fecha que el fotógrafo cargó.
 */
function fechaLarga(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

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
  /** Si el evento lee dorsales. Sale de Event.bibDetection. */
  buscaPorDorsal?: boolean;
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
  buscaPorDorsal = true,
}: {
  photographer: Photographer;
  event: EventInfo;
  photos: Photo[];
  discounts?: PublicDiscount[];
  testMode?: boolean;
  buscaPorDorsal?: boolean;
}) {
  const { items, add, remove, isInCart, open, openCart } = useCart();

  const [dorsal, setDorsal] = useState("");
  // Sólo se guarda la búsqueda que encontró algo. Las otras variantes viajan al
  // aviso de error: guardar un "no se detectó cara" acá dejaría la grilla en
  // cero sin que nadie lo haya pedido.
  const [selfie, setSelfie] = useState<string[] | null>(null);
  const [errorSelfie, setErrorSelfie] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(TANDA);
  const [viendo, setViendo] = useState<number | null>(null);

  const {
    inputRef: selfieRef,
    pending: buscandoSelfie,
    onPick: buscarSelfie,
    abrir: abrirSelfie,
  } = useBusquedaSelfie(event.id, (r) => {
    setVisibles(TANDA);
    if (r.kind === "ok") {
      setSelfie(r.photoIds);
      setDorsal("");
      setErrorSelfie(
        r.photoIds.length === 0 ? "No encontramos fotos con tu cara en este evento." : null,
      );
    } else if (r.kind === "no-face") {
      setErrorSelfie("No se ve una cara en esa foto. Probá con una de frente y con buena luz.");
    } else if (r.kind === "error") {
      setErrorSelfie(r.message);
    }
  });

  function limpiarBusqueda() {
    setSelfie(null);
    setDorsal("");
    setErrorSelfie(null);
    setVisibles(TANDA);
  }

  const precioCent = Math.round(event.pricePerPhoto * 100);
  const fecha = fechaLarga(event.eventDate);
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
        {/* Si subió su logo, va SOLO el logo. El avatar con el nombre y la
            dirección es un logo provisional —lo que ponemos mientras no tiene
            el suyo— y mostrar los dos juntos son dos marcas de la misma persona
            compitiendo, donde la de verdad pierde contra tres líneas de texto. */}
        <Link href={`/${photographer.slug}`} className="et-marca">
          {photographer.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="et-logo" src={photographer.logoUrl} alt={photographer.name} />
          ) : (
            <>
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
            </>
          )}
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
            {fecha && <span>{fecha}</span>}
            {fecha && event.location && <i />}
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

        <section className="et-buscar">
          <div className="et-buscar-tit">
            <b>Encontrá tus fotos</b>
            <span>
              {buscaPorDorsal
                ? "Poné tu número de dorsal, o sacate una selfie."
                : "Sacate una selfie y te mostramos en cuáles saliste."}
            </span>
          </div>

          {/* El dorsal es un CAMPO y va primero: es lo que prueba el que llega
              con su número en la mano. Cuando el evento no lee dorsales el
              campo no existe, porque mandarlo a escribir un número que no va a
              encontrar nada es peor que no ofrecerlo. */}
          {buscaPorDorsal && (
            <>
              <div className="et-dorsal">
                <div className="et-campo">
                  <span>#</span>
                  <input
                    inputMode="numeric"
                    placeholder="Tu dorsal"
                    aria-label="Buscar por número de dorsal"
                    value={dorsal}
                    onChange={(e) => {
                      setDorsal(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setVisibles(TANDA);
                      setSelfie(null);
                    }}
                  />
                </div>
                {dorsal && (
                  <button
                    className="et-btn et-btn-icono"
                    onClick={() => setDorsal("")}
                    aria-label="Borrar el dorsal"
                  >
                    <X />
                  </button>
                )}
              </div>

              <div className="et-o">o</div>
            </>
          )}

          <input
            ref={selfieRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void buscarSelfie(f);
            }}
          />
          <button className="et-selfie" onClick={abrirSelfie} disabled={buscandoSelfie}>
            <span className="et-selfie-i">
              <ScanFace />
            </span>
            <span className="et-selfie-t">
              <b>{buscandoSelfie ? "Buscando tu cara…" : "Buscar con una selfie"}</b>
              <span>
                {buscandoSelfie
                  ? "Puede tardar unos segundos"
                  : "Sacate una foto y encontramos todas en las que estás"}
              </span>
            </span>
          </button>

          {errorSelfie && (
            <div style={{ fontSize: 13, color: "var(--accent, #F0410F)" }}>{errorSelfie}</div>
          )}
        </section>

        {/* Qué se está filtrando ahora mismo. Sin esto, alguien que buscó su
            dorsal y encontró tres fotos cree que el evento tiene tres fotos. */}
        {buscando && (
          <div className="et-filtrando">
            <span>
              {selfie ? (
                <>
                  Mostrando <b>{filtradas.length}</b>{" "}
                  {filtradas.length === 1 ? "foto tuya" : "fotos tuyas"}
                </>
              ) : (
                <>
                  Mostrando <b>{filtradas.length}</b>{" "}
                  {filtradas.length === 1 ? "foto" : "fotos"} del dorsal <b>#{dorsal}</b>
                </>
              )}
            </span>
            <button className="et-btn et-btn-sm" onClick={limpiarBusqueda}>
              Ver todas
            </button>
          </div>
        )}

        {/* Sólo descuentos automáticos. Los de código no se anuncian acá: un
            código publicado en la misma página donde se compra no es un código,
            es un descuento con un paso de más para todos. */}
        {promo && (
          <div className="et-promo">
            <span className="et-promo-i">
              <Tag />
            </span>
            <span className="et-promo-t">
              <b>{promo.texto}</b>
              <span>
                {items.length > 0 && items.length < promo.desde
                  ? `Te faltan ${promo.desde - items.length} ${
                      promo.desde - items.length === 1 ? "foto" : "fotos"
                    } para que se aplique.`
                  : "Se aplica solo al pagar, no hace falta hacer nada."}
              </span>
            </span>
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
                  <span>{puesta ? "Agregada" : "Agregar"}</span>
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
                <button className="et-btn" onClick={limpiarBusqueda}>
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

      {viendo !== null && filtradas[viendo] && (
        <Visor
          fotos={filtradas}
          indice={viendo}
          enCarrito={isInCart}
          precio={pesos(precioCent)}
          alCerrar={() => setViendo(null)}
          alIr={setViendo}
          alAlternar={(f) => alternar(f as Photo)}
        />
      )}

      <Carrito
        eventId={event.id}
        promo={promo}
        hayCodigos={hayCodigos}
        descuentos={discounts}
        alVer={(id) => {
          // El visor trabaja sobre la página visible de la grilla, así que si la
          // foto quedó fuera de esa tanda hay que estirarla hasta alcanzarla:
          // si no, tocar una miniatura del carrito no haría nada.
          const i = filtradas.findIndex((f) => f.id === id);
          if (i < 0) return;
          if (i >= visibles) setVisibles(Math.ceil((i + 1) / TANDA) * TANDA);
          setViendo(i);
        }}
      />
    </div>
  );
}
