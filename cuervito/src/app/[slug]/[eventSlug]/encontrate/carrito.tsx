"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingBag, Tag, X } from "lucide-react";
import { useState } from "react";

import { useCart } from "../cart-context";
import type { Promo } from "./promo";

function pesos(centavos: number) {
  return "$" + Math.round(centavos / 100).toLocaleString("es-AR");
}

/**
 * El carrito: cajón al costado en escritorio, hoja desde abajo en el teléfono.
 *
 * Dos pasos y no uno. Con las fotos y el formulario de datos en la misma
 * pantalla, lo primero que ve alguien que agregó UNA foto es un formulario de
 * tres campos, y eso frena más de lo que ayuda. Primero se revisa qué se
 * lleva, y los datos aparecen cuando ya decidió.
 *
 * El precio final lo calcula el servidor en /api/mp/checkout. Lo de acá es una
 * estimación para mostrar, y está dicho así: si el navegador y el servidor no
 * coinciden, manda el servidor. Poner a decidir el precio al navegador es
 * ponerle el precio al comprador.
 */
export function Carrito({
  eventId,
  promo,
  hayCodigos,
}: {
  eventId: string;
  promo: Promo | null;
  hayCodigos: boolean;
}) {
  const router = useRouter();
  const { items, remove, closeCart, subtotalCents } = useCart();
  const [paso, setPaso] = useState<"lista" | "datos">("lista");
  const [codigo, setCodigo] = useState("");
  const [mail, setMail] = useState("");
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar() {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError("Poné un email válido: ahí te mandamos las fotos.");
      return;
    }
    if (!nombre.trim()) {
      setError("Poné tu nombre.");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/mp/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          photoIds: items.map((i) => i.photoId),
          buyerEmail: mail.trim(),
          buyerName: nombre.trim(),
          buyerPhone: tel.trim() || undefined,
          discountCode: codigo.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "No pudimos iniciar el pago.");
        setEnviando(false);
        return;
      }
      const d = (await r.json()) as { saleId: string; initPoint: string };
      if (d.initPoint.startsWith("/")) {
        router.prefetch(d.initPoint);
        router.push(d.initPoint);
      } else {
        window.location.href = d.initPoint;
      }
    } catch {
      setError("No pudimos iniciar el pago. Probá de nuevo.");
      setEnviando(false);
    }
  }

  const vacio = items.length === 0;

  return (
    <>
      <div className="et-scrim" onClick={closeCart} aria-hidden />

      <aside className="et-cajon" aria-label="Tu carrito">
        <div className="et-cajon-h">
          <div>
            <h2>{paso === "lista" ? "Tus fotos" : "Tus datos"}</h2>
            <div className="sub">
              {paso === "lista"
                ? vacio
                  ? "Todavía no elegiste ninguna"
                  : `${items.length} ${items.length === 1 ? "foto" : "fotos"}`
                : "Te las mandamos por mail al pagar"}
            </div>
          </div>
          <button className="et-btn et-btn-icono" onClick={closeCart} aria-label="Cerrar">
            <X />
          </button>
        </div>

        <div className="et-cajon-b">
          {vacio ? (
            <div className="et-cajon-vacio">
              <ShoppingBag />
              <p>Tocá una foto para verla en grande y agregarla desde ahí.</p>
            </div>
          ) : paso === "lista" ? (
            items.map((i) => (
              <div className="et-linea" key={i.photoId}>
                <div className="et-linea-mini">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.previewUrl} alt="" />
                </div>
                <div className="et-linea-t">
                  <b>Foto digital</b>
                  <span>{pesos(i.priceCents)}</span>
                </div>
                <button
                  className="et-quitar"
                  onClick={() => remove(i.photoId)}
                  aria-label="Quitar del carrito"
                >
                  <X />
                </button>
              </div>
            ))
          ) : (
            <>
              <label className="et-campo">
                <input
                  type="email"
                  placeholder="Tu email"
                  value={mail}
                  onChange={(e) => setMail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="et-campo">
                <input
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="et-campo">
                <input
                  placeholder="Teléfono (opcional)"
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  autoComplete="tel"
                />
              </label>
              {/* El campo del código aparece sólo si el evento tiene alguno.
                  Un campo de cupón vacío en una tienda sin cupones sólo logra
                  que la gente se vaya a buscar uno que no existe. */}
              {hayCodigos && (
                <label className="et-campo">
                  <span>
                    <Tag style={{ width: 15, height: 15, verticalAlign: -2 }} />
                  </span>
                  <input
                    placeholder="Código de descuento"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  />
                </label>
              )}
              {error && (
                <div style={{ fontSize: 13, color: "var(--accent, #F0410F)" }}>{error}</div>
              )}
            </>
          )}
        </div>

        {!vacio && (
          <div className="et-cajon-f">
            {/* Falta poco para la promoción: es el momento en que el descuento
                de verdad mueve la aguja. Antes de elegir la primera foto el
                mismo cartel es información; acá es una decisión. */}
            {paso === "lista" && promo?.desde && items.length < promo.desde && (
              <div style={{ fontSize: 13, color: "var(--accent, #F0410F)" }}>
                Agregá {promo.desde - items.length}{" "}
                {promo.desde - items.length === 1 ? "foto más" : "fotos más"} y {promo.texto
                  .charAt(0)
                  .toLowerCase() + promo.texto.slice(1)}
              </div>
            )}

            <div className="et-cuenta">
              <div>
                <span>
                  {items.length} {items.length === 1 ? "foto" : "fotos"}
                </span>
                <span className="tnum">{pesos(subtotalCents)}</span>
              </div>
              <div className="et-total">
                <span>Total</span>
                <b className="tnum">{pesos(subtotalCents)}</b>
              </div>
            </div>

            {/* Se dice ANTES de pagar y no en la pantalla de pago: enterarse
                del descuento después de haber decidido el monto es la clase de
                sorpresa que hace desconfiar aunque sea a favor. */}
            <div style={{ fontSize: 11.5, color: "var(--et-tenue)", lineHeight: 1.4 }}>
              Los descuentos se aplican al pagar. El total final lo confirma Mercado Pago.
            </div>

            {paso === "lista" ? (
              <button className="et-btn et-btn-lleno" onClick={() => setPaso("datos")}>
                Continuar <ArrowRight />
              </button>
            ) : (
              <>
                <button className="et-btn et-btn-lleno" onClick={pagar} disabled={enviando}>
                  {enviando ? "Un momento" : "Pagar con Mercado Pago"}
                </button>
                <button className="et-btn" onClick={() => setPaso("lista")} disabled={enviando}>
                  Volver a las fotos
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
