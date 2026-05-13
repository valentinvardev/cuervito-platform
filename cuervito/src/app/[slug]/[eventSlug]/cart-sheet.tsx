"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCart } from "./cart-context";
import {
  PaymentProcessingOverlay,
  type PaymentOverlayState,
} from "./payment-overlay";

type Photo = {
  id: string;
  previewUrl: string;
  bibNumbers: string | null;
};

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

export function CartSheet({
  eventId,
  eventName,
  pricePerPhoto,
  photos,
  testMode = false,
}: {
  eventId: string;
  eventName: string;
  pricePerPhoto: number;
  photos: Photo[];
  testMode?: boolean;
}) {
  const router = useRouter();
  const { items, open, closeCart, remove, clear, subtotalCents } = useCart();
  const photoById = new Map(photos.map((p) => [p.id, p]));

  const [view, setView] = useState<"cart" | "checkout">("cart");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayState, setOverlayState] =
    useState<PaymentOverlayState | null>(null);

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
    setOverlayState("processing");
    const startedAt = Date.now();
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
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No pudimos iniciar el pago.");
        setOverlayState(null);
        setPending(false);
        return;
      }
      const data = (await res.json()) as { saleId: string; initPoint: string };
      const isInternal = data.initPoint.startsWith("/");

      // Ensure the "processing" frame is visible for a beat, even on fast LAN.
      const minProcessingMs = 900;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minProcessingMs) {
        await new Promise((r) => setTimeout(r, minProcessingMs - elapsed));
      }

      if (isInternal) {
        // Test mode / internal: show "approved" beat, then soft-nav so React
        // tree (and overlay) survive the transition until /descarga mounts.
        setOverlayState("approved");
        router.prefetch(data.initPoint);
        await new Promise((r) => setTimeout(r, 700));
        router.push(data.initPoint);
      } else {
        // External (real MP) — hard nav. Keep the processing state visible
        // until the browser actually unloads.
        window.location.href = data.initPoint;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
      setOverlayState(null);
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
                  <span className="accent">{formatARS(subtotalCents)}</span>
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
              pricePerPhoto={pricePerPhoto}
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
              pending={pending}
              error={error}
              subtotalCents={subtotalCents}
              count={items.length}
              testMode={testMode}
              onBack={() => setView("cart")}
              onPay={goCheckout}
            />
          )}
        </div>
      </aside>
      {overlayState && (
        <PaymentProcessingOverlay state={overlayState} testMode={testMode} />
      )}
    </>
  );
}

function CartView({
  items,
  photoById,
  remove,
  eventName,
  subtotalCents,
  pricePerPhoto,
  onClear,
  onContinue,
}: {
  items: ReturnType<typeof useCart>["items"];
  photoById: Map<string, Photo>;
  remove: (id: string) => void;
  eventName: string;
  subtotalCents: number;
  pricePerPhoto: number;
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
            {items.map((it) => {
              const p = photoById.get(it.photoId);
              return (
                <div
                  key={it.photoId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr auto",
                    gap: 12,
                    padding: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 56,
                      borderRadius: 6,
                      background: p
                        ? `url(${p.previewUrl}) center/cover`
                        : "var(--bg-elevated)",
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: 13,
                        letterSpacing: "-0.01em",
                        marginBottom: 3,
                      }}
                    >
                      Foto {it.photoId.slice(0, 6)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {p?.bibNumbers ? `Dorsal #${p.bibNumbers}` : "Foto del evento"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--accent)",
                      }}
                    >
                      {(it.priceCents / 100).toLocaleString("es-AR", {
                        style: "currency",
                        currency: "ARS",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(it.photoId)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-tertiary)",
                        cursor: "pointer",
                        padding: 4,
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "10px 0",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: 12,
            }}
          >
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Subtotal · {items.length} {items.length === 1 ? "foto" : "fotos"}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 26,
                color: "var(--accent)",
                letterSpacing: "-0.02em",
              }}
            >
              ${(subtotalCents / 100).toLocaleString("es-AR")}
            </span>
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

          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              marginTop: 10,
              textAlign: "center",
            }}
          >
            ${pricePerPhoto.toLocaleString("es-AR")} por foto · pago seguro · descarga en alta resolución
          </div>
        </div>
      )}
    </>
  );
}

function CheckoutView({
  email,
  setEmail,
  name,
  setName,
  phone,
  setPhone,
  pending,
  error,
  subtotalCents,
  count,
  testMode = false,
  onBack,
  onPay,
}: {
  email: string;
  setEmail: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  pending: boolean;
  error: string | null;
  subtotalCents: number;
  count: number;
  testMode?: boolean;
  onBack: () => void;
  onPay: () => void;
}) {
  return (
    <>
      <div className="sheet-body">
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
            Volver al carrito
          </button>

          {testMode && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(245, 182, 42, 0.10)",
                border: "1px solid rgba(245, 182, 42, 0.45)",
                borderRadius: 10,
                color: "var(--warning)",
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
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

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(224,85,85,0.08)",
                border: "1px solid rgba(224,85,85,0.4)",
                borderRadius: 8,
                color: "var(--error)",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="ti ti-alert-circle" />
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="sheet-foot">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "10px 0",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: 12,
          }}
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Total · {count} {count === 1 ? "foto" : "fotos"}
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 26,
              color: "var(--accent)",
              letterSpacing: "-0.02em",
            }}
          >
            ${(subtotalCents / 100).toLocaleString("es-AR")}
          </span>
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
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.9s linear infinite",
                  }}
                />
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
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{hint}</span>
      )}
    </label>
  );
}
