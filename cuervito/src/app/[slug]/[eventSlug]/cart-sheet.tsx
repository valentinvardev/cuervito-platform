"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCart } from "./cart-context";
import type { PublicDiscount } from "./event-coverage-shell";

type Photo = {
  id: string;
  previewUrl: string;
  bibNumbers: string | null;
};

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

// Pick the best automatic discount (BUNDLE/QTYPCT) for the current cart count.
function bestAutoDiscount(
  discounts: PublicDiscount[],
  count: number,
  subtotalCents: number,
): { discount: PublicDiscount; savingsCents: number } | null {
  let best: { discount: PublicDiscount; savingsCents: number } | null = null;
  for (const d of discounts) {
    if (d.type === "BUNDLE" && d.qty !== null && count >= d.qty && d.price !== null) {
      const savings = subtotalCents - Math.round(d.price * 100) * count;
      if (savings > 0 && (!best || savings > best.savingsCents)) {
        best = { discount: d, savingsCents: savings };
      }
    } else if (d.type === "QTYPCT" && d.qty !== null && count >= d.qty && d.value !== null) {
      const savings = Math.floor((subtotalCents * d.value) / 100);
      if (savings > 0 && (!best || savings > best.savingsCents)) {
        best = { discount: d, savingsCents: savings };
      }
    }
  }
  return best;
}

// Find the closest upcoming BUNDLE or QTYPCT discount (not yet unlocked).
function nearestNudge(
  discounts: PublicDiscount[],
  count: number,
): { discount: PublicDiscount; needed: number } | null {
  let nearest: { discount: PublicDiscount; needed: number } | null = null;
  for (const d of discounts) {
    if ((d.type === "BUNDLE" || d.type === "QTYPCT") && d.qty !== null && count < d.qty) {
      const needed = d.qty - count;
      if (!nearest || needed < nearest.needed) {
        nearest = { discount: d, needed };
      }
    }
  }
  return nearest;
}

function discountNudgeLabel(d: PublicDiscount): string {
  if (d.type === "BUNDLE") return `Llevá ${d.qty} y pagás $${d.price?.toLocaleString("es-AR")} c/u`;
  return `Llevá ${d.qty}+ y obtené ${d.value}% off`;
}

export function CartSheet({
  eventId,
  eventName,
  pricePerPhoto,
  photos,
  discounts = [],
  testMode = false,
}: {
  eventId: string;
  eventName: string;
  pricePerPhoto: number;
  photos: Photo[];
  discounts?: PublicDiscount[];
  testMode?: boolean;
}) {
  const router = useRouter();
  const { items, open, closeCart, remove, clear, subtotalCents } = useCart();
  const photoById = new Map(photos.map((p) => [p.id, p]));

  const [view, setView] = useState<"cart" | "checkout">("cart");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute discount preview (client-side mirror of server logic)
  const autoDiscount = bestAutoDiscount(discounts, items.length, subtotalCents);
  const codeDiscount = discounts.find(
    (d) => d.type === "CODE" && d.code === codeInput.toUpperCase().trim(),
  );
  // Code takes priority if entered
  const appliedDiscount: { discount: PublicDiscount; savingsCents: number } | null =
    codeInput.trim() && codeDiscount
      ? {
          discount: codeDiscount,
          savingsCents:
            codeDiscount.kind === "pct"
              ? Math.floor((subtotalCents * (codeDiscount.value ?? 0)) / 100)
              : Math.min(Math.round((codeDiscount.value ?? 0) * 100), subtotalCents - 1),
        }
      : autoDiscount;

  const discountCents = appliedDiscount?.savingsCents ?? 0;
  const totalCents = Math.max(subtotalCents - discountCents, 0);

  const nudge = nearestNudge(discounts, items.length);
  const hasCodeDiscounts = discounts.some((d) => d.type === "CODE");

  async function goCheckout() {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingresá un email válido.");
      return;
    }
    if (!name.trim()) {
      setError("Ingresá tu nombre.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/mp/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          photoIds: items.map((i) => i.photoId),
          buyerEmail: email.trim(),
          buyerName: name.trim(),
          buyerPhone: phone.trim() || undefined,
          discountCode: codeInput.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No pudimos iniciar el pago.");
        setPending(false);
        return;
      }
      const data = (await res.json()) as { saleId: string; initPoint: string };
      const isInternal = data.initPoint.startsWith("/");
      if (isInternal) {
        router.prefetch(data.initPoint);
        router.push(data.initPoint);
      } else {
        window.location.href = data.initPoint;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
      setPending(false);
    }
  }

  return (
    <>
      <div
        className={`sheet-backdrop ${open ? "open" : ""}`}
        onClick={closeCart}
        aria-hidden={!open}
      />
      <aside
        className={`sheet ${open ? "open" : ""}`}
        data-view={view}
        aria-hidden={!open}
      >
        <div className="sheet-head">
          <div>
            <span className="eyebrow">
              {view === "cart" ? "· Carrito" : "· Tus datos"}
            </span>
            <h2>{view === "cart" ? "Tu selección." : "Casi listo."}</h2>
            <div className="meta">
              <span>{items.length.toString().padStart(2, "0")} fotos</span>
              {items.length > 0 && (
                <>
                  <span> · </span>
                  <span className="accent">{formatARS(totalCents)}</span>
                  {discountCents > 0 && (
                    <span style={{ color: "var(--success)", fontSize: 12, marginLeft: 4 }}>
                      (-{formatARS(discountCents)})
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <button className="sheet-close" onClick={closeCart} aria-label="Cerrar">
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {view === "cart" ? (
            <CartView
              items={items}
              photoById={photoById}
              remove={remove}
              eventName={eventName}
              subtotalCents={subtotalCents}
              discountCents={discountCents}
              totalCents={totalCents}
              pricePerPhoto={pricePerPhoto}
              nudge={nudge}
              appliedDiscount={appliedDiscount}
              onClear={clear}
              onContinue={() => {
                setError(null);
                setView("checkout");
              }}
            />
          ) : (
            <CheckoutView
              email={email}
              setEmail={setEmail}
              name={name}
              setName={setName}
              phone={phone}
              setPhone={setPhone}
              codeInput={codeInput}
              setCodeInput={setCodeInput}
              hasCodeDiscounts={hasCodeDiscounts}
              appliedDiscount={appliedDiscount}
              subtotalCents={subtotalCents}
              discountCents={discountCents}
              totalCents={totalCents}
              count={items.length}
              testMode={testMode}
              pending={pending}
              error={error}
              onBack={() => setView("cart")}
              onPay={goCheckout}
            />
          )}
        </div>
      </aside>
    </>
  );
}

function CartView({
  items,
  photoById,
  remove,
  eventName,
  subtotalCents,
  discountCents,
  totalCents,
  pricePerPhoto,
  nudge,
  appliedDiscount,
  onClear,
  onContinue,
}: {
  items: ReturnType<typeof useCart>["items"];
  photoById: Map<string, Photo>;
  remove: (id: string) => void;
  eventName: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  pricePerPhoto: number;
  nudge: { discount: PublicDiscount; needed: number } | null;
  appliedDiscount: { discount: PublicDiscount; savingsCents: number } | null;
  onClear: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="sheet-body">
        {items.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--text-tertiary)",
              fontSize: 14,
            }}
          >
            Tu carrito está vacío. Agregá fotos del evento{" "}
            <strong style={{ color: "var(--text-primary)" }}>{eventName}</strong>.
          </div>
        ) : (
          <div
            style={{
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Nudge banner — approaching a threshold */}
            {nudge && !appliedDiscount && (
              <div style={{
                padding: "14px 16px",
                background: "linear-gradient(135deg, rgba(245,130,10,0.10) 0%, rgba(245,130,10,0.04) 100%)",
                border: "1px solid var(--border-accent)",
                borderRadius: 12,
                display: "grid",
                gridTemplateColumns: "36px 1fr",
                gap: 12,
                alignItems: "start",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: "var(--accent-deep)", color: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>
                  <i className="ti ti-bolt" />
                </div>
                <div>
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    fontSize: 14, letterSpacing: "-0.015em", marginBottom: 4,
                  }}>
                    {discountNudgeLabel(nudge.discount)}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    Agregá {nudge.needed} foto{nudge.needed > 1 ? "s" : ""} más para activar este descuento.
                  </div>
                  {/* Progress bar */}
                  <div style={{
                    marginTop: 8, height: 4,
                    background: "var(--bg-base)", borderRadius: 999, overflow: "hidden",
                  }}>
                    <span style={{
                      display: "block", height: "100%",
                      background: "var(--accent)", borderRadius: 999,
                      transition: "width 320ms cubic-bezier(.2,.7,.2,1)",
                      width: `${Math.round((items.length / (nudge.discount.qty ?? 1)) * 100)}%`,
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* Applied discount banner */}
            {appliedDiscount && (
              <div style={{
                padding: "14px 16px",
                background: "linear-gradient(135deg, rgba(76,175,125,0.10) 0%, rgba(76,175,125,0.04) 100%)",
                border: "1px solid rgba(76,175,125,0.35)",
                borderRadius: 12,
                display: "grid",
                gridTemplateColumns: "36px 1fr",
                gap: 12,
                alignItems: "start",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: "rgba(76,175,125,0.15)", color: "var(--success)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>
                  <i className="ti ti-discount-check" />
                </div>
                <div>
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    fontSize: 14, letterSpacing: "-0.015em", marginBottom: 2,
                  }}>
                    ¡Descuento aplicado!
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                    Ahorrás{" "}
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--success)" }}>
                      {formatARS(appliedDiscount.savingsCents)}
                    </span>
                    {" "}en esta compra.
                  </div>
                </div>
              </div>
            )}

            {items.map((it) => {
              const p = photoById.get(it.photoId);
              return (
                <div
                  key={it.photoId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr auto",
                    gap: 12, padding: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 10, alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 72, height: 56, borderRadius: 6,
                      background: p ? `url(${p.previewUrl}) center/cover` : "var(--bg-elevated)",
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-display)", fontWeight: 600,
                      fontSize: 13, letterSpacing: "-0.01em", marginBottom: 3,
                    }}>
                      Foto {it.photoId.slice(0, 6)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {p?.bibNumbers ? `Dorsal #${p.bibNumbers}` : "Foto del evento"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)",
                    }}>
                      {(it.priceCents / 100).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(it.photoId)}
                      style={{
                        background: "transparent", border: "none",
                        color: "var(--text-tertiary)", cursor: "pointer", padding: 4,
                      }}
                      aria-label="Sacar"
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="sheet-foot">
          {/* Totals */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              fontSize: "13.5px", color: "var(--text-secondary)", padding: "4px 0",
            }}>
              <span>Subtotal · {items.length} {items.length === 1 ? "foto" : "fotos"}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatARS(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                fontSize: "13.5px", color: "var(--success)", padding: "4px 0",
              }}>
                <span>Descuento</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>−{formatARS(discountCents)}</span>
              </div>
            )}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              borderTop: "1px solid var(--border-subtle)",
              padding: "10px 0 0",
              marginTop: 6,
            }}>
              <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>Total</span>
              <span style={{
                fontFamily: "var(--font-display)", fontWeight: 800,
                fontSize: 26, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1,
              }}>
                {formatARS(totalCents)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-outline" onClick={onClear}>
              Vaciar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={onContinue}
            >
              <span>Continuar</span>
              <i className="ti ti-arrow-right" />
            </button>
          </div>

          <div style={{
            fontSize: 11, color: "var(--text-tertiary)", marginTop: 10, textAlign: "center",
          }}>
            ${pricePerPhoto.toLocaleString("es-AR")} por foto · pago seguro · descarga en alta resolución
          </div>
        </div>
      )}
    </>
  );
}

function CheckoutView({
  email, setEmail,
  name, setName,
  phone, setPhone,
  codeInput, setCodeInput,
  hasCodeDiscounts,
  appliedDiscount,
  subtotalCents,
  discountCents,
  totalCents,
  count,
  testMode = false,
  pending,
  error,
  onBack,
  onPay,
}: {
  email: string; setEmail: (v: string) => void;
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  codeInput: string; setCodeInput: (v: string) => void;
  hasCodeDiscounts: boolean;
  appliedDiscount: { discount: PublicDiscount; savingsCents: number } | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  count: number;
  testMode?: boolean;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onPay: () => void;
}) {
  const codeApplied =
    appliedDiscount?.discount.type === "CODE" && codeInput.trim().length > 0;

  return (
    <>
      <div className="sheet-body">
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              alignSelf: "flex-start", background: "transparent", border: "none",
              color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
              padding: 0, display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
            Volver al carrito
          </button>

          {testMode && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(245, 182, 42, 0.10)",
              border: "1px solid rgba(245, 182, 42, 0.45)",
              borderRadius: 10, color: "var(--warning)", fontSize: 12.5,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ti ti-flask" style={{ fontSize: 14 }} />
              <span>
                <strong>Modo test:</strong> no se va a cobrar nada. Al confirmar, te
                lleva directo a la pantalla de descarga.
              </span>
            </div>
          )}

          <Field label="Email *" hint="Te llega el comprobante y el link de descarga.">
            <input
              type="email"
              className="input"
              placeholder="vos@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field label="Nombre *">
            <input
              type="text"
              className="input"
              placeholder="Ana"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field label="Teléfono (opcional)">
            <input
              type="tel"
              className="input"
              placeholder="+54 9 11 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          {/* Code input — only shown when the event has CODE discounts */}
          {hasCodeDiscounts && (
            <Field label="Código de descuento (opcional)">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  style={{
                    flex: 1, fontFamily: "var(--font-mono)",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    borderColor: codeApplied ? "var(--success)" : undefined,
                  }}
                  placeholder="VERANO20"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                />
                {codeApplied && (
                  <div style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "0 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                    border: "1px solid var(--success)", color: "var(--success)",
                    whiteSpace: "nowrap",
                  }}>
                    <i className="ti ti-check" style={{ marginRight: 4 }} />
                    Aplicado
                  </div>
                )}
              </div>
              {codeApplied && (
                <span style={{ fontSize: 12, color: "var(--success)" }}>
                  Ahorrás {formatARS(appliedDiscount!.savingsCents)} con este código.
                </span>
              )}
            </Field>
          )}

          {error && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(224,85,85,0.08)",
              border: "1px solid rgba(224,85,85,0.4)",
              borderRadius: 8, color: "var(--error)", fontSize: 13,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="ti ti-alert-circle" />
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="sheet-foot">
        {/* Totals */}
        <div style={{ marginBottom: 12 }}>
          {discountCents > 0 && (
            <>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                fontSize: "13.5px", color: "var(--text-secondary)", padding: "4px 0",
              }}>
                <span>Subtotal · {count} {count === 1 ? "foto" : "fotos"}</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatARS(subtotalCents)}</span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                fontSize: "13.5px", color: "var(--success)", padding: "4px 0",
              }}>
                <span>Descuento</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>−{formatARS(discountCents)}</span>
              </div>
            </>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            borderTop: discountCents > 0 ? "1px solid var(--border-subtle)" : undefined,
            padding: discountCents > 0 ? "10px 0 0" : "10px 0",
            marginTop: discountCents > 0 ? 6 : 0,
          }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {discountCents > 0 ? "Total" : `Total · ${count} ${count === 1 ? "foto" : "fotos"}`}
            </span>
            <span style={{
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: 26, color: "var(--accent)", letterSpacing: "-0.02em",
            }}>
              {formatARS(totalCents)}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onBack}>
            Volver
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={onPay}
            disabled={pending}
          >
            {pending ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.9s linear infinite",
                }} />
                {testMode ? "Confirmando…" : "Redirigiendo…"}
              </>
            ) : (
              <>
                <span>{testMode ? "Confirmar compra (test)" : "Pagar con Mercado Pago"}</span>
                <i className="ti ti-arrow-right" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--text-tertiary)",
      }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{hint}</span>}
    </label>
  );
}
