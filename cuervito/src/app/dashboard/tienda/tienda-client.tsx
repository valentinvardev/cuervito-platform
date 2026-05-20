"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveBrandColorAction } from "./actions";
import { DomainsSection, type DomainRow } from "./domains-section";

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
  watermarkUrl: initialWatermarkUrl,
  totalPhotos,
  domains,
  cfEnabled,
}: {
  slug: string;
  brandColor: string;
  watermarkUrl: string | null;
  totalPhotos: number;
  domains: DomainRow[];
  cfEnabled: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(brandColor.toUpperCase());
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Watermark state ────────────────────────────────────────────────────────
  const wmInputRef = useRef<HTMLInputElement>(null);
  const [wmUrl, setWmUrl] = useState<string | null>(initialWatermarkUrl);
  const [wmUploading, setWmUploading] = useState(false);
  const [wmError, setWmError] = useState<string | null>(null);
  const [wmToast, setWmToast] = useState<string | null>(null);
  const [regen, setRegen] = useState<{
    running: boolean;
    processed: number;
    failed: number;
    remaining: number;
    initial: number;
  } | null>(null);

  function showToast(msg: string) {
    setWmToast(msg);
    setTimeout(() => setWmToast(null), 2500);
  }

  async function onWmPick(file: File) {
    setWmError(null);
    if (file.type !== "image/png") { setWmError("Tiene que ser un PNG con transparencia."); return; }
    if (file.size > 2 * 1024 * 1024) { setWmError("Máximo 2 MB."); return; }
    setWmUploading(true);
    try {
      const form = new FormData();
      form.append("watermark", file);
      const res = await fetch("/api/dashboard/watermark", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setWmError(data.error ?? "Subida fallida."); return; }
      // Show optimistic local preview
      setWmUrl(URL.createObjectURL(file));
      showToast("Watermark guardado");
      router.refresh();
    } catch (err) {
      setWmError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setWmUploading(false);
    }
  }

  async function onWmDelete() {
    setWmError(null);
    const res = await fetch("/api/dashboard/watermark", { method: "DELETE" });
    if (res.ok) { setWmUrl(null); showToast("Watermark eliminado"); router.refresh(); }
  }

  async function regenerateAll() {
    let processed = 0;
    let failed = 0;
    let remaining = totalPhotos;
    const initial = totalPhotos;
    setRegen({ running: true, processed, failed, remaining, initial });
    let iters = 0;
    while (remaining > 0 && iters < 2000) {
      const res = await fetch("/api/dashboard/watermark/regenerate", { method: "POST" });
      if (!res.ok) { setWmError("Regeneración fallida."); break; }
      const data = (await res.json()) as { done: number; failed: number; remaining: number };
      processed += data.done;
      failed += data.failed;
      remaining = data.remaining;
      setRegen({ running: remaining > 0, processed, failed, remaining, initial });
      iters++;
      await new Promise((r) => setTimeout(r, 80));
    }
    setRegen((prev) => prev ? { ...prev, running: false } : null);
    router.refresh();
  }

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
        </div>
      </section>

      <DomainsSection domains={domains} cfEnabled={cfEnabled} />

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

      {/* Watermark toast */}
      {wmToast && (
        <div style={{
          position: "fixed", top: 84, right: 20, zIndex: 60,
          padding: "10px 14px", background: "var(--bg-surface)",
          border: "1px solid var(--success)", borderRadius: 10,
          color: "var(--success)", fontSize: 14,
          boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <i className="ti ti-circle-check-filled" />{wmToast}
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Marca de agua</h2>
          <span className="sub">Se aplica a los previews de tus fotos. Si no subís una, se usa la marca de Cuervito.</span>
        </div>

        {/* Preview panel */}
        <div style={{
          padding: "20px 24px", background: "var(--bg-base)",
          border: "1px solid var(--border-subtle)", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 140, marginBottom: 14,
          backgroundImage: "linear-gradient(45deg,rgba(255,255,255,0.025) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,0.025) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,0.025) 75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,0.025) 75%)",
          backgroundSize: "20px 20px", backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
        }}>
          {wmUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wmUrl} alt="Watermark" style={{ maxWidth: "100%", maxHeight: 180, objectFit: "contain" }} />
          ) : (
            <div style={{ color: "var(--text-tertiary)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
              Sin watermark propio · se usa el de Cuervito
            </div>
          )}
        </div>

        <input ref={wmInputRef} type="file" accept="image/png" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onWmPick(f); e.target.value = ""; }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <button type="button" className="btn btn-primary"
            onClick={() => wmInputRef.current?.click()} disabled={wmUploading}>
            {wmUploading
              ? <><span className="up-spinner" /> Subiendo…</>
              : <><i className="ti ti-upload" />{wmUrl ? "Reemplazar" : "Subir watermark"}</>}
          </button>
          {wmUrl && (
            <button type="button" className="btn btn-outline"
              onClick={onWmDelete} disabled={wmUploading}
              style={{ color: "var(--error)", borderColor: "rgba(224,85,85,0.4)" }}>
              <i className="ti ti-trash" /> Eliminar
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: wmError ? 8 : 0 }}>
          PNG con transparencia, máximo 2 MB. Se tilea y rota -35° sobre tus previews.
        </div>
        {wmError && (
          <div style={{ padding: "8px 12px", fontSize: 12.5, color: "var(--error)",
            background: "rgba(224,85,85,0.08)", border: "1px solid rgba(224,85,85,0.4)", borderRadius: 8 }}>
            <i className="ti ti-alert-circle" /> {wmError}
          </div>
        )}

        {/* Regenerate */}
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--border-subtle)",
          display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Regenerar previews</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
              Reaplicá el watermark a todas tus fotos ({totalPhotos.toLocaleString("es-AR")} en total).
              Hacelo cada vez que cambies o elimines tu marca de agua.
            </div>
          </div>
          <button type="button" className="btn btn-outline"
            onClick={regenerateAll} disabled={regen?.running || totalPhotos === 0}>
            <i className="ti ti-refresh" />
            {regen?.running ? "Procesando…" : "Regenerar todo"}
          </button>
        </div>
        {regen && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div style={{
                height: "100%",
                width: `${regen.initial > 0 ? Math.round(((regen.initial - regen.remaining) / regen.initial) * 100) : 100}%`,
                background: regen.running ? "var(--accent)" : "var(--success)",
                transition: "width 320ms ease",
              }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {regen.processed.toLocaleString("es-AR")} procesadas
              {regen.failed > 0 && <> · <span style={{ color: "var(--error)" }}>{regen.failed} fallaron</span></>}
              {regen.remaining > 0 && <> · {regen.remaining.toLocaleString("es-AR")} restantes</>}
              {!regen.running && regen.remaining === 0 && (
                <span style={{ color: "var(--success)", marginLeft: 8 }}>
                  <i className="ti ti-circle-check-filled" /> Listo
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="edit-cta">
        <div className="info">
          <div className="ttl">Más opciones de personalización</div>
          <div className="sub">Plantillas y hero personalizado — próximamente.</div>
        </div>
      </div>
    </main>
  );
}
