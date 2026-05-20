"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirmar",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          padding: "26px 28px",
          width: "100%", maxWidth: 420,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{
            width: 36, height: 36, borderRadius: "50%",
            background: danger ? "rgba(224,85,85,0.12)" : "var(--accent-deep)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <i className={`ti ${danger ? "ti-alert-triangle" : "ti-refresh"}`}
              style={{ fontSize: 17, color: danger ? "var(--error)" : "var(--accent)" }} />
          </span>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
            {title}
          </h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.55, marginBottom: 22 }}>
          {body}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}
            style={{ padding: "8px 16px", fontSize: 13 }}>
            Cancelar
          </button>
          <button type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            style={danger ? {
              background: "var(--error)",
              borderColor: "var(--error)",
              padding: "8px 16px", fontSize: 13,
            } : { padding: "8px 16px", fontSize: 13 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.documentElement,
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PhotographerRow = {
  id: string;
  name: string;
  hasCustomWatermark: boolean;
  photoCount: number;
};

// ── Main component ────────────────────────────────────────────────────────────

export function WatermarkAdminUI({
  currentUrl,
  totalPhotos,
  photosNeedingPreview,
  photographers,
}: {
  currentUrl: string | null;
  totalPhotos: number;
  photosNeedingPreview: number;
  photographers: PhotographerRow[];
}) {
  const router = useRouter();
  const globalInputRef = useRef<HTMLInputElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Regen state
  const [regen, setRegen] = useState<{
    running: boolean;
    processed: number;
    failed: number;
    remaining: number;
    initial: number;
    userId?: string;
  } | null>(null);

  // Modal state
  const [modal, setModal] = useState<{
    title: string;
    body: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Per-user watermark upload target
  const [pendingUserUpload, setPendingUserUpload] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function confirm(opts: typeof modal) {
    setModal(opts);
  }

  // ── Global watermark ───────────────────────────────────────────────────────

  async function onGlobalPick(file: File) {
    setError(null);
    if (file.type !== "image/png") { setError("Tiene que ser un PNG transparente."); return; }
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
      showToast("Watermark global actualizado");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setUploading(false);
    }
  }

  function onDeleteGlobal() {
    confirm({
      title: "Eliminar watermark global",
      body: "Los nuevos previews van a usar el texto de fallback «CUERVITO». Los previews existentes no cambian hasta que los regenerés.",
      confirmLabel: "Eliminar",
      danger: true,
      onConfirm: async () => {
        setModal(null);
        const res = await fetch("/api/admin/watermark", { method: "DELETE" });
        if (res.ok) { showToast("Watermark global eliminado"); router.refresh(); }
      },
    });
  }

  // ── Per-user watermark ─────────────────────────────────────────────────────

  async function onUserPick(userId: string, file: File) {
    setError(null);
    if (file.type !== "image/png") { setError("Tiene que ser un PNG transparente."); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("watermark", file);
      const res = await fetch(`/api/admin/watermark/user?userId=${userId}`, { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Subida fallida.");
        return;
      }
      showToast("Watermark actualizado");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setUploading(false);
      setPendingUserUpload(null);
    }
  }

  function onDeleteUserWatermark(userId: string, name: string) {
    confirm({
      title: `Eliminar watermark de ${name}`,
      body: `${name} va a volver a usar el watermark global de la plataforma. Los previews existentes no cambian hasta que regenerés.`,
      confirmLabel: "Eliminar",
      danger: true,
      onConfirm: async () => {
        setModal(null);
        const res = await fetch(`/api/admin/watermark/user?userId=${userId}`, { method: "DELETE" });
        if (res.ok) { showToast("Watermark eliminado"); router.refresh(); }
      },
    });
  }

  // ── Regenerate ─────────────────────────────────────────────────────────────

  async function runRegen(userId?: string) {
    const initial = userId
      ? (photographers.find((p) => p.id === userId)?.photoCount ?? 0)
      : (photosNeedingPreview || totalPhotos);
    let processed = 0;
    let failed = 0;
    let remaining = initial;
    setRegen({ running: true, processed, failed, remaining, initial, userId });

    let iters = 0;
    while (remaining > 0 && iters < 2000) {
      const res = await fetch("/api/admin/watermark/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(userId ? { userId } : {}),
      });
      if (!res.ok) { setError("Regeneración fallida."); break; }
      const data = (await res.json()) as { done: number; failed: number; remaining: number };
      processed += data.done;
      failed += data.failed;
      remaining = data.remaining;
      setRegen({ running: remaining > 0, processed, failed, remaining, initial, userId });
      iters++;
      await new Promise((r) => setTimeout(r, 80));
    }
    setRegen((prev) => prev ? { ...prev, running: false, remaining: 0 } : null);
    router.refresh();
  }

  function askRegen(userId?: string, name?: string, count?: number) {
    const isGlobal = !userId;
    confirm({
      title: isGlobal ? "Regenerar todos los previews" : `Regenerar previews de ${name}`,
      body: isGlobal
        ? `Se van a reprocesar ${totalPhotos.toLocaleString("es-AR")} fotos aplicando el watermark actual de cada fotógrafo. Puede tardar varios minutos.`
        : `Se van a reprocesar ${(count ?? 0).toLocaleString("es-AR")} fotos de ${name} con su watermark actual.`,
      confirmLabel: "Regenerar",
      onConfirm: () => { setModal(null); void runRegen(userId); },
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 84, right: 20, zIndex: 60,
          padding: "10px 14px", background: "var(--bg-surface)",
          border: "1px solid var(--success)", borderRadius: 10,
          color: "var(--success)", fontSize: 14,
          boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <i className="ti ti-circle-check-filled" />{toast}
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        open={!!modal}
        title={modal?.title ?? ""}
        body={modal?.body ?? ""}
        confirmLabel={modal?.confirmLabel}
        danger={modal?.danger}
        onConfirm={modal?.onConfirm ?? (() => setModal(null))}
        onCancel={() => setModal(null)}
      />

      {/* Hidden file inputs */}
      <input ref={globalInputRef} type="file" accept="image/png" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onGlobalPick(f); e.target.value = ""; }} />
      <input ref={userInputRef} type="file" accept="image/png" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && pendingUserUpload) void onUserPick(pendingUserUpload, f);
          e.target.value = "";
        }} />

      {/* ── Global watermark card ── */}
      <div className="form-card">
        <div className="form-row">
          <label>Watermark global</label>
          <div style={{
            padding: "20px 24px", background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: 160,
            backgroundImage: "linear-gradient(45deg,rgba(255,255,255,0.025) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,0.025) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,0.025) 75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,0.025) 75%)",
            backgroundSize: "20px 20px", backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
          }}>
            {currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt="Watermark" style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain" }} />
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 14, fontFamily: "var(--font-mono)" }}>
                Sin watermark · usando fallback "CUERVITO"
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <label>Cambiar watermark global</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary"
              onClick={() => globalInputRef.current?.click()} disabled={uploading}>
              {uploading
                ? <><span className="up-spinner" /> Subiendo…</>
                : <><i className="ti ti-upload" />{currentUrl ? "Reemplazar" : "Subir watermark"}</>}
            </button>
            {currentUrl && (
              <button type="button" className="btn btn-outline" onClick={onDeleteGlobal} disabled={uploading}
                style={{ color: "var(--error)", borderColor: "rgba(224,85,85,0.4)" }}>
                <i className="ti ti-trash" /> Eliminar
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
            PNG con transparencia, máximo 2 MB. Se aplica tileado y rotado -35° sobre cada preview.
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", border: "1px solid rgba(224,85,85,0.4)",
            background: "rgba(224,85,85,0.08)", borderRadius: 8, color: "var(--error)", fontSize: 13,
            display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ti ti-alert-circle" />{error}
          </div>
        )}
      </div>

      {/* ── Global regenerate card ── */}
      <div className="form-card" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", marginBottom: 6 }}>
              Regenerar todos los previews
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.55, maxWidth: 500 }}>
              {photosNeedingPreview > 0 ? (
                <>Hay <strong style={{ color: "var(--accent)" }}>{photosNeedingPreview.toLocaleString("es-AR")}</strong> fotos sin preview. Regenerá todo después de cambiar el watermark global.</>
              ) : (
                <>Todas las fotos tienen preview. Podés regenerar igual para forzar el watermark actual.</>
              )}
            </p>
          </div>
          <button type="button" className="btn btn-outline"
            onClick={() => askRegen()} disabled={regen?.running}>
            <i className="ti ti-refresh" />
            {regen?.running && !regen.userId ? "Procesando…" : "Regenerar todo"}
          </button>
        </div>

        {regen && !regen.userId && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
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
                <span style={{ color: "var(--success)", marginLeft: 8 }}><i className="ti ti-circle-check-filled" /> Listo</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Per-photographer card ── */}
      <div className="form-card" style={{ marginTop: 18 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", marginBottom: 14 }}>
          Por fotógrafo
        </h3>
        {photographers.length === 0 ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No hay fotógrafos activos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {photographers.map((p) => (
              <div key={p.id} style={{
                padding: "12px 14px", borderRadius: 10,
                background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
              }}>
                {/* Top row: name + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {p.photoCount.toLocaleString("es-AR")} fotos ·{" "}
                      {p.hasCustomWatermark
                        ? <span style={{ color: "var(--accent)" }}>watermark propio</span>
                        : <span>usa el global</span>}
                    </div>
                  </div>

                  {/* Regen progress for this user */}
                  {regen?.userId === p.id && (
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", textAlign: "right", minWidth: 80 }}>
                      {regen.running
                        ? `${regen.processed}/${regen.initial}…`
                        : <span style={{ color: "var(--success)" }}><i className="ti ti-check" /> Listo</span>}
                    </div>
                  )}

                  {/* Upload watermark for user */}
                  <button type="button" className="btn btn-outline"
                    style={{ flexShrink: 0, padding: "5px 11px", fontSize: 12, height: 30 }}
                    disabled={uploading || regen?.running}
                    onClick={() => { setPendingUserUpload(p.id); userInputRef.current?.click(); }}
                    title={p.hasCustomWatermark ? "Reemplazar watermark" : "Subir watermark"}>
                    <i className="ti ti-upload" style={{ fontSize: 12 }} />
                    {p.hasCustomWatermark ? "Reemplazar" : "Subir WM"}
                  </button>

                  {/* Delete custom watermark */}
                  {p.hasCustomWatermark && (
                    <button type="button" className="btn btn-outline"
                      style={{ flexShrink: 0, padding: "5px 11px", fontSize: 12, height: 30, color: "var(--error)", borderColor: "rgba(224,85,85,0.4)" }}
                      disabled={uploading || regen?.running}
                      onClick={() => onDeleteUserWatermark(p.id, p.name)}>
                      <i className="ti ti-trash" style={{ fontSize: 12 }} />
                    </button>
                  )}

                  {/* Regenerate previews for user */}
                  <button type="button" className="btn btn-outline"
                    style={{ flexShrink: 0, padding: "5px 11px", fontSize: 12, height: 30 }}
                    disabled={regen?.running}
                    onClick={() => askRegen(p.id, p.name, p.photoCount)}>
                    <i className="ti ti-refresh" style={{ fontSize: 12 }} />
                    Regenerar
                  </button>
                </div>

                {/* Per-user regen progress bar */}
                {regen?.userId === p.id && regen.initial > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.round(((regen.initial - regen.remaining) / regen.initial) * 100)}%`,
                        background: regen.running ? "var(--accent)" : "var(--success)",
                        transition: "width 320ms ease",
                      }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
