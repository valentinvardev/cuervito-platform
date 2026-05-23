"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

type DiscountType = "CODE" | "BUNDLE" | "QTYPCT";

type Discount = {
  id: string;
  type: DiscountType;
  code: string | null;
  kind: string | null;
  value: number | null;
  qty: number | null;
  price: number | null;
  expires: string | null;
  maxUses: number | null;
  usageCount: number;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function discountLabel(d: Discount): string {
  if (d.type === "CODE") {
    const amount =
      d.kind === "pct" ? `${d.value}% off` : `$${d.value?.toLocaleString("es-AR")} off`;
    return `${amount} con código`;
  }
  if (d.type === "BUNDLE") {
    return `Lleva ${d.qty} y pagás $${d.price?.toLocaleString("es-AR")} c/u`;
  }
  return `Llevá ${d.qty}+ y obtené ${d.value}% off`;
}

function discountMeta(d: Discount): string {
  const parts: string[] = [];
  if (d.type === "CODE" && d.code) parts.push(d.code);
  if (d.expires) parts.push(`Vence ${new Date(d.expires).toLocaleDateString("es-AR")}`);
  if (d.type === "CODE") {
    parts.push(d.maxUses ? `${d.usageCount} / ${d.maxUses} usos` : `${d.usageCount} usos`);
  }
  return parts.join(" · ");
}

function discountIcon(type: DiscountType): string {
  if (type === "CODE") return "ti-ticket";
  if (type === "BUNDLE") return "ti-package";
  return "ti-percentage";
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteConfirm({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "24px 24px 20px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(224,85,85,0.12)",
            border: "1px solid rgba(224,85,85,0.3)",
            color: "var(--error)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <i className="ti ti-trash" style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              ¿Eliminar descuento?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Se va a eliminar <strong>{label}</strong>. Esta acción no se puede deshacer.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            className="btn"
            style={{ background: "var(--error)", color: "#fff", border: "none" }}
            onClick={onConfirm}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Create discount modal ─────────────────────────────────────────────────────

type DiscountStep = 1 | 2;

function CreateDiscountModal({
  onSave,
  onClose,
}: {
  onSave: (d: Discount) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<DiscountStep>(1);
  const [type, setType] = useState<DiscountType>("CODE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  // Resolve eventId from URL on mount
  useEffect(() => {
    const match = /\/dashboard\/events\/([^/]+)/.exec(window.location.pathname);
    if (match?.[1]) setEventId(match[1]);
  }, []);

  // CODE fields
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"pct" | "fixed">("pct");
  const [value, setValue] = useState("");
  const [expires, setExpires] = useState("");
  const [maxUses, setMaxUses] = useState("");

  // BUNDLE fields
  const [bQty, setBQty] = useState("");
  const [bPrice, setBPrice] = useState("");
  const [bExpires, setBExpires] = useState("");

  // QTYPCT fields
  const [qQty, setQQty] = useState("");
  const [qPct, setQPct] = useState("");
  const [qExpires, setQExpires] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!eventId) return;
    setError(null);
    setSaving(true);

    let body: Record<string, unknown>;
    if (type === "CODE") {
      body = {
        type,
        code: code.toUpperCase(),
        kind,
        value: Number(value),
        expires: expires ? new Date(expires).toISOString() : null,
        maxUses: maxUses ? Number(maxUses) : null,
      };
    } else if (type === "BUNDLE") {
      body = {
        type,
        qty: Number(bQty),
        price: Number(bPrice),
        expires: bExpires ? new Date(bExpires).toISOString() : null,
      };
    } else {
      body = {
        type,
        qty: Number(qQty),
        value: Number(qPct),
        expires: qExpires ? new Date(qExpires).toISOString() : null,
      };
    }

    try {
      const res = await fetch(`/api/dashboard/events/${eventId}/discounts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Discount & { error?: string };
      if (!res.ok) { setError(data.error ?? "Error al guardar."); setSaving(false); return; }
      onSave(data);
    } catch {
      setError("Error de red.");
      setSaving(false);
    }
  }

  const typeCards: { type: DiscountType; icon: string; title: string; desc: string }[] = [
    {
      type: "CODE",
      icon: "ti-ticket",
      title: "Código de descuento",
      desc: "Porcentaje o monto fijo. El comprador ingresa el código en el checkout.",
    },
    {
      type: "BUNDLE",
      icon: "ti-package",
      title: "Lleva X y pagás Y por unidad",
      desc: "Precio especial cuando se llevan exactamente X fotos.",
    },
    {
      type: "QTYPCT",
      icon: "ti-percentage",
      title: "Llevás X y % de descuento",
      desc: "Por ejemplo: llevá 3 fotos o más y obtené 20% off sobre el total.",
    },
  ];

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 18,
          width: "100%", maxWidth: 520,
          maxHeight: "calc(100vh - 48px)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}>
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                color: "var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <i className="ti ti-arrow-left" />
            </button>
          )}
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: "16.5px",
              letterSpacing: "-0.02em", margin: 0,
            }}>
              {step === 1 ? "Crear descuento" : typeCards.find((t) => t.type === type)?.title}
            </h3>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              {step === 1 ? "Elegí el tipo de descuento." : "Configurá los parámetros."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 8,
              color: "var(--text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", cursor: "pointer", fontSize: 18,
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {step === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {typeCards.map((tc) => (
                <button
                  key={tc.type}
                  type="button"
                  onClick={() => { setType(tc.type); setStep(2); }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr auto",
                    gap: 14, padding: "14px 16px",
                    background: "var(--bg-base)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    textAlign: "left", cursor: "pointer",
                    alignItems: "center",
                    width: "100%", color: "inherit", font: "inherit",
                    transition: "all 180ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-accent)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-base)";
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 11,
                    background: "var(--accent-deep)", color: "var(--accent)",
                    border: "1px solid var(--border-accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>
                    <i className={`ti ${tc.icon}`} />
                  </div>
                  <div>
                    <div style={{
                      fontFamily: "var(--font-display)", fontWeight: 700,
                      fontSize: "14.5px", letterSpacing: "-0.015em", marginBottom: 3,
                    }}>{tc.title}</div>
                    <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                      {tc.desc}
                    </div>
                  </div>
                  <i className="ti ti-chevron-right" style={{ color: "var(--text-tertiary)" }} />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {type === "CODE" && (
                <>
                  <ModalField label="Código">
                    <input
                      className="input"
                      placeholder="Ej: VERANO20"
                      style={{ textTransform: "uppercase" }}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </ModalField>
                  <ModalField label="Tipo de descuento">
                    <div style={{ display: "flex", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: 9, padding: 3, gap: 2 }}>
                      {(["pct", "fixed"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setKind(k)}
                          style={{
                            flex: 1, padding: "8px 10px", borderRadius: 7,
                            fontSize: 13, fontWeight: 500,
                            background: kind === k ? "var(--bg-elevated)" : "transparent",
                            color: kind === k ? "var(--accent)" : "var(--text-secondary)",
                            border: "none", cursor: "pointer",
                          }}
                        >
                          {k === "pct" ? "Porcentaje" : "Monto fijo"}
                        </button>
                      ))}
                    </div>
                  </ModalField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <ModalField label={kind === "pct" ? "Porcentaje" : "Monto ($)"}>
                      <div style={{ position: "relative" }}>
                        {kind === "fixed" && (
                          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>$</span>
                        )}
                        <input
                          type="number"
                          className="input"
                          style={kind === "fixed" ? { paddingLeft: 26 } : { paddingRight: 38 }}
                          placeholder={kind === "pct" ? "20" : "500"}
                          min={1}
                          max={kind === "pct" ? 99 : undefined}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                        />
                        {kind === "pct" && (
                          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>%</span>
                        )}
                      </div>
                    </ModalField>
                    <ModalField label="Vence (opcional)">
                      <input type="date" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} />
                    </ModalField>
                  </div>
                  <ModalField label="Usos máximos (opcional)">
                    <input type="number" className="input" placeholder="Sin límite" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
                  </ModalField>
                </>
              )}

              {type === "BUNDLE" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <ModalField label="Cantidad mínima">
                      <div style={{ position: "relative" }}>
                        <input type="number" className="input" style={{ paddingRight: 60 }} placeholder="5" min={2} value={bQty} onChange={(e) => setBQty(e.target.value)} />
                        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontSize: 12 }}>fotos</span>
                      </div>
                    </ModalField>
                    <ModalField label="Precio por foto ($)">
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>$</span>
                        <input type="number" className="input" style={{ paddingLeft: 26 }} placeholder="1500" min={1} value={bPrice} onChange={(e) => setBPrice(e.target.value)} />
                      </div>
                    </ModalField>
                  </div>
                  <ModalField label="Vence (opcional)">
                    <input type="date" className="input" value={bExpires} onChange={(e) => setBExpires(e.target.value)} />
                  </ModalField>
                </>
              )}

              {type === "QTYPCT" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <ModalField label="A partir de (fotos)">
                      <div style={{ position: "relative" }}>
                        <input type="number" className="input" style={{ paddingRight: 60 }} placeholder="3" min={2} value={qQty} onChange={(e) => setQQty(e.target.value)} />
                        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontSize: 12 }}>fotos</span>
                      </div>
                    </ModalField>
                    <ModalField label="Descuento (%)">
                      <div style={{ position: "relative" }}>
                        <input type="number" className="input" style={{ paddingRight: 38 }} placeholder="20" min={1} max={99} value={qPct} onChange={(e) => setQPct(e.target.value)} />
                        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>%</span>
                      </div>
                    </ModalField>
                  </div>
                  <ModalField label="Vence (opcional)">
                    <input type="date" className="input" value={qExpires} onChange={(e) => setQExpires(e.target.value)} />
                  </ModalField>
                </>
              )}

              {error && (
                <div style={{
                  padding: "10px 14px",
                  background: "rgba(224,85,85,0.08)",
                  border: "1px solid rgba(224,85,85,0.4)",
                  borderRadius: 8, color: "var(--error)", fontSize: 13,
                }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer (step 2 only) */}
        {step === 2 && (
          <div style={{
            padding: "14px 18px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex", gap: 10, justifyContent: "flex-end",
            flexShrink: 0,
          }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Crear descuento"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
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
    </label>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function EventMonetizationSection({
  eventId,
  revenue,
  photosSold,
  conversion,
  pricePerPhoto,
}: {
  eventId: string;
  revenue: number;
  photosSold: number;
  conversion: number | null;
  pricePerPhoto: number;
}) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchDiscounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/events/${eventId}/discounts`);
      if (res.ok) setDiscounts((await res.json()) as Discount[]);
    } finally {
      setLoadingDiscounts(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      void fetchDiscounts();
    }
  }, [fetchDiscounts]);

  async function handleDelete(d: Discount) {
    setDeleting(d.id);
    setDeleteTarget(null);
    try {
      await fetch(`/api/dashboard/events/${eventId}/discounts/${d.id}`, { method: "DELETE" });
      setDiscounts((prev) => prev.filter((x) => x.id !== d.id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <div className="label">Recaudado</div>
          <div className="value accent">${revenue.toLocaleString("es-AR")}</div>
          <div className="delta">
            <i className="ti ti-minus" style={{ fontSize: 12, color: "var(--text-tertiary)" }} />
            <span style={{ color: "var(--text-tertiary)" }}>Sin ventas todavía</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Fotos vendidas</div>
          <div className="value mono">{photosSold.toLocaleString("es-AR")}</div>
        </div>
        <div className="stat">
          <div className="label">Precio por foto</div>
          <div className="value mono">${pricePerPhoto.toLocaleString("es-AR")}</div>
        </div>
      </div>

      <div className="insight">
        <i className="ti ti-info-circle" />
        <div>
          <strong>Conversión:</strong>{" "}
          {conversion === null
            ? "Vamos a calcularla cuando empiecen a entrar ventas."
            : `${conversion.toFixed(1)}%`}
        </div>
      </div>

      {/* ── Discounts ── */}
      <div style={{ marginTop: 28 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          gap: 12, flexWrap: "wrap", marginBottom: 14,
        }}>
          <div>
            <h3 style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 22, letterSpacing: "-0.02em", margin: 0,
            }}>
              Descuentos
            </h3>
            <div style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 2 }}>
              Códigos y promos aplicables a este evento.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <i className="ti ti-plus" />
            Crear descuento
          </button>
        </div>

        {loadingDiscounts ? (
          <div style={{ padding: "20px 0", color: "var(--text-tertiary)", fontSize: 13 }}>
            Cargando…
          </div>
        ) : discounts.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "30px 20px",
            background: "var(--bg-surface)",
            border: "1px dashed var(--border-default)",
            borderRadius: 14, color: "var(--text-tertiary)", fontSize: "13.5px",
          }}>
            Todavía no creaste descuentos para este evento.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {discounts.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr auto auto",
                  gap: 14, padding: "14px 16px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12, alignItems: "center",
                  opacity: deleting === d.id ? 0.5 : 1,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "var(--accent-deep)", color: "var(--accent)",
                  border: "1px solid var(--border-accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  <i className={`ti ${discountIcon(d.type)}`} />
                </div>
                <div>
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    fontSize: "14.5px", letterSpacing: "-0.015em", marginBottom: 3,
                  }}>
                    {discountLabel(d)}
                  </div>
                  <div style={{
                    fontSize: "12.5px", color: "var(--text-tertiary)",
                    display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                  }}>
                    {d.type === "CODE" && d.code && (
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        background: "var(--bg-elevated)",
                        padding: "1px 7px", borderRadius: 5,
                        fontSize: "11.5px",
                        border: "1px solid var(--border-subtle)",
                      }}>
                        {d.code}
                      </span>
                    )}
                    <span>{discountMeta(d)}</span>
                  </div>
                </div>
                <span
                  className="badge badge-success badge-dot"
                  style={{ fontSize: 11 }}
                >
                  Activo
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(d)}
                  disabled={deleting === d.id}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    color: "var(--text-tertiary)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", border: "none", cursor: "pointer",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  title="Eliminar"
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateDiscountModal
          onSave={(d) => { setDiscounts((prev) => [...prev, d]); setShowCreate(false); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          label={discountLabel(deleteTarget)}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
