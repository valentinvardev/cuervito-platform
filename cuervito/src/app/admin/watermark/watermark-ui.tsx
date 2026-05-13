"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function WatermarkAdminUI({
  currentUrl,
  totalPhotos,
  photosNeedingPreview,
}: {
  currentUrl: string | null;
  totalPhotos: number;
  photosNeedingPreview: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Regenerate progress
  const [regen, setRegen] = useState<{
    running: boolean;
    processed: number;
    failed: number;
    remaining: number;
    initial: number;
  } | null>(null);

  async function onPick(file: File) {
    setError(null);
    if (file.type !== "image/png") {
      setError("Tiene que ser un PNG (idealmente con transparencia).");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("watermark", file);
      const res = await fetch("/api/admin/watermark", { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Subida fallida.");
        return;
      }
      setSavedToast("Watermark actualizado");
      setTimeout(() => setSavedToast(null), 2500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete() {
    if (!confirm("¿Eliminar el watermark global? Los previews nuevos van a usar el texto de fallback.")) return;
    setError(null);
    const res = await fetch("/api/admin/watermark", { method: "DELETE" });
    if (res.ok) {
      setSavedToast("Watermark eliminado");
      setTimeout(() => setSavedToast(null), 2500);
      router.refresh();
    }
  }

  async function regenerateAll() {
    if (!confirm(`Regenerar previews para ${totalPhotos.toLocaleString("es-AR")} fotos. Esto puede tardar varios minutos.`)) return;

    let processed = 0;
    let failed = 0;
    let remaining = photosNeedingPreview;
    const initial = photosNeedingPreview;
    setRegen({ running: true, processed, failed, remaining, initial });

    // We hit the endpoint in a loop until remaining = 0
    // (each call processes up to 25 photos).
    let iters = 0;
    const MAX_ITERS = 2000; // safety cap: 50 000 photos
    while (remaining > 0 && iters < MAX_ITERS) {
      const res = await fetch("/api/admin/watermark/regenerate", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Regeneración fallida.");
        break;
      }
      const data = (await res.json()) as {
        processed: number;
        done: number;
        failed: number;
        remaining: number;
      };
      processed += data.done;
      failed += data.failed;
      remaining = data.remaining;
      setRegen({ running: remaining > 0, processed, failed, remaining, initial });
      iters++;
      // small breather between batches so the UI updates and we don't slam S3
      await new Promise((r) => setTimeout(r, 80));
    }

    setRegen({ running: false, processed, failed, remaining, initial });
    router.refresh();
  }

  return (
    <>
      {savedToast && (
        <div
          style={{
            position: "fixed",
            top: 84,
            right: 20,
            zIndex: 60,
            padding: "10px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--success)",
            borderRadius: 10,
            color: "var(--success)",
            fontSize: 14,
            boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="ti ti-circle-check-filled" />
          {savedToast}
        </div>
      )}

      <div className="form-card">
        <div className="form-row">
          <label>Watermark actual</label>
          <div
            style={{
              padding: "20px 24px",
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 160,
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.025) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.025) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.025) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.025) 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
            }}
          >
            {currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUrl}
                alt="Watermark"
                style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 14,
                  fontFamily: "var(--font-mono)",
                }}
              >
                Sin watermark · usando fallback "CUERVITO"
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <label>Cambiar watermark</label>
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
              e.target.value = "";
            }}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="up-spinner" /> Subiendo…
                </>
              ) : (
                <>
                  <i className="ti ti-upload" />
                  {currentUrl ? "Reemplazar" : "Subir watermark"}
                </>
              )}
            </button>
            {currentUrl && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onDelete}
                disabled={uploading}
                style={{ color: "var(--error)", borderColor: "rgba(224,85,85,0.4)" }}
              >
                <i className="ti ti-trash" /> Eliminar
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
            PNG con transparencia, máximo 2 MB. Se aplica tileado y rotado -35° al 40% del lado menor de cada foto.
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              border: "1px solid rgba(224,85,85,0.4)",
              background: "rgba(224,85,85,0.08)",
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

      {/* Regenerate */}
      <div className="form-card" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "-0.02em",
                marginBottom: 6,
              }}
            >
              Regenerar previews
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.55, maxWidth: 500 }}>
              {photosNeedingPreview > 0 ? (
                <>
                  Hay <strong style={{ color: "var(--accent)" }}>{photosNeedingPreview.toLocaleString("es-AR")}</strong>{" "}
                  fotos sin preview. Si cambiaste el watermark y querés reaplicar a todo, usá este botón.
                </>
              ) : (
                <>Todas las fotos ya tienen su preview generado.</>
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={regenerateAll}
            disabled={regen?.running || photosNeedingPreview === 0}
          >
            <i className="ti ti-refresh" />
            {regen?.running ? "Procesando…" : "Regenerar"}
          </button>
        </div>

        {regen && (
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                height: 6,
                background: "var(--bg-elevated)",
                borderRadius: 999,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${regen.initial > 0 ? Math.round(((regen.initial - regen.remaining) / regen.initial) * 100) : 100}%`,
                  background: regen.running ? "var(--accent)" : "var(--success)",
                  transition: "width 320ms ease",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {regen.processed.toLocaleString("es-AR")} procesadas
              {regen.failed > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--error)" }}>{regen.failed} fallaron</span>
                </>
              )}
              {regen.remaining > 0 && <> · {regen.remaining.toLocaleString("es-AR")} restantes</>}
              {!regen.running && regen.remaining === 0 && (
                <span style={{ color: "var(--success)", marginLeft: 8 }}>
                  <i className="ti ti-circle-check-filled" /> Listo
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
