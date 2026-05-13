"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { saveBrandColorAction } from "./actions";

const PRESETS: { name: string; hex: string }[] = [
  { name: "Cuervito Orange", hex: "#F5820A" },
  { name: "Coral", hex: "#E04545" },
  { name: "Amber", hex: "#F5C842" },
  { name: "Forest", hex: "#4CAF7D" },
  { name: "Sky", hex: "#009EE5" },
  { name: "Violet", hex: "#7B61FF" },
  { name: "Rose", hex: "#F083A5" },
  { name: "Bone", hex: "#F0EBE3" },
];

export function TiendaClient({
  slug,
  brandColor,
}: {
  slug: string;
  brandColor: string;
}) {
  const [selected, setSelected] = useState(brandColor.toUpperCase());
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const url = `cuervito.app/${slug}`;
  const matchedName = PRESETS.find((p) => p.hex === selected)?.name;

  function copy() {
    if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(`https://${url}`).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function pickColor(hex: string) {
    setError(null);
    setSelected(hex);
    startTransition(async () => {
      const res = await saveBrandColorAction(hex);
      if (res.error) setError(res.error);
    });
  }

  return (
    <main className="wrap-tienda">
      <div className="head">
        <h1>Página de venta</h1>
        <div className="sub">Personalizá cómo te ven tus clientes.</div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Dominio</h2>
          <span className="sub">Donde tus clientes ven tu galería</span>
        </div>

        <div className="domain-row">
          <span className="url">
            <span className="accent">cuervito.app/</span>
            <span>{slug}</span>
          </span>
          <span className="badge-cuervito">
            <i
              className="ti ti-circle-check-filled"
              style={{ color: "var(--success)", fontSize: 11 }}
            />
            Activo
          </span>
          <button
            type="button"
            className="copy"
            onClick={copy}
            style={copied ? { color: "var(--success)" } : undefined}
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>

        <div className="domain-actions">
          <Link
            href={`/${slug}`}
            target="_blank"
            rel="noopener"
            className="btn btn-outline"
          >
            <i className="ti ti-external-link" />
            Ver mi página
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            disabled
            title="Próximamente"
            style={{ opacity: 0.5, cursor: "not-allowed" }}
          >
            <i className="ti ti-world" />
            Conectar mi dominio
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Color principal</h2>
          <span className="sub">Se aplica a botones, links y acentos</span>
        </div>

        <div className="color-grid">
          {PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              className={`color-tile ${selected === p.hex ? "active" : ""}`}
              style={{ background: p.hex }}
              onClick={() => pickColor(p.hex)}
              title={p.name}
              aria-label={p.name}
              disabled={pending}
            />
          ))}
        </div>
        <div className="color-hint">
          Color actual:{" "}
          <span className="accent mono">{selected}</span>
          {matchedName && <> · {matchedName}</>}
          {pending && <> · Guardando…</>}
        </div>
        {error && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              fontSize: 12.5,
              color: "var(--error)",
              background: "rgba(224,85,85,0.08)",
              border: "1px solid rgba(224,85,85,0.4)",
              borderRadius: 8,
            }}
          >
            <i className="ti ti-alert-circle" /> {error}
          </div>
        )}
      </section>

      <div className="edit-cta">
        <div className="info">
          <div className="ttl">Más opciones de personalización</div>
          <div className="sub">
            Plantillas, hero personalizado y dominios propios — próximamente.
          </div>
        </div>
      </div>
    </main>
  );
}
