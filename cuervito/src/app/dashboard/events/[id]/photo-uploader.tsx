"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UpItem = {
  localId: string;
  file: File;
  thumbDataUrl?: string;
  photoId?: string;
  state: "pending" | "uploading" | "complete" | "failed";
  pct: number;
  error?: string;
  visible: boolean; // shown as a tile in the grid (not in the "+X" overflow)
};

// Browsers cap concurrent connections to the same origin (~6 in Chrome,
// Firefox). S3 is a different host, so PUTs to S3 don't share that budget
// with our own /api requests — 6 in parallel is the sweet spot.
const MAX_PARALLEL = 6;
const MAX_VISIBLE_TILES = 11; // grid shows up to 11 tiles + 1 "+X" tile
const ACCEPT = "image/jpeg,image/png,image/webp";

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PhotoUploader({
  eventId,
  maxPhotoBytes,
}: {
  eventId: string;
  maxPhotoBytes: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [items, setItems] = useState<UpItem[]>([]);
  const [filesModalOpen, setFilesModalOpen] = useState(false);

  const total = items.length;
  const done = items.filter((i) => i.state === "complete").length;
  const failed = items.filter((i) => i.state === "failed").length;
  const settled = total > 0 && done + failed === total;
  const phase: "idle" | "uploading" | "done" =
    total === 0 ? "idle" : settled ? "done" : "uploading";
  const aggPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allFailed = settled && failed === total;
  const someFailed = settled && failed > 0;

  function pickFiles() {
    fileInputRef.current?.click();
  }

  async function readThumb(f: File): Promise<string | undefined> {
    if (!f.type.startsWith("image/")) return undefined;
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(f);
    });
  }

  async function addFiles(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => ACCEPT.split(",").includes(f.type));
    if (arr.length === 0) return;

    // Generate thumbnails up-front (small files, ~ms)
    const fresh: UpItem[] = await Promise.all(
      arr.map(async (file, idx) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        file,
        thumbDataUrl: await readThumb(file),
        state: "pending" as const,
        pct: 0,
        visible: items.length + idx < MAX_VISIBLE_TILES,
      })),
    );

    setItems((prev) => {
      const next = [...prev, ...fresh];
      // Recompute visibility cap across the whole list
      return next.map((it, i) => ({ ...it, visible: i < MAX_VISIBLE_TILES }));
    });

    void processBatches(fresh);
  }

  function setOne(localId: string, patch: Partial<UpItem>) {
    setItems((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p)));
  }

  async function processBatches(toProcess: UpItem[]) {
    // Presign in a single round-trip (cheap, just creates Photo rows). This
    // hands us a signed S3 URL per file so we can fire all uploads in parallel
    // without a round-trip per file.
    let presigned:
      | Array<{ photoId: string; uploadUrl: string; contentType: string }>
      | null = null;
    try {
      const res = await fetch(`/api/dashboard/events/${eventId}/photos/presign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: toProcess.map((b) => ({
            name: b.file.name,
            size: b.file.size,
            mimeType: b.file.type,
          })),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = data.error ?? "Error al iniciar la subida";
        toProcess.forEach((b) => setOne(b.localId, { state: "failed", error: msg }));
        return;
      }
      const data = (await res.json()) as {
        items: Array<{ photoId: string; uploadUrl: string; contentType: string }>;
      };
      presigned = data.items;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Red caída";
      toProcess.forEach((b) => setOne(b.localId, { state: "failed", error: msg }));
      return;
    }

    // Worker pool: kick off MAX_PARALLEL uploads, and as each finishes, pull
    // the next one. A slow upload doesn't stall the rest — every worker
    // independently drains the queue. Net effect: ~Nx faster on large batches
    // with mixed file sizes.
    const queue = toProcess.map((b, i) => ({ b, p: presigned![i]! }));
    let cursor = 0;
    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= queue.length) return;
        const { b, p } = queue[idx]!;
        if (!p) {
          setOne(b.localId, { state: "failed", error: "Sin URL" });
          continue;
        }
        setOne(b.localId, { state: "uploading", photoId: p.photoId, pct: 0 });
        try {
          await putWithProgress({
            url: p.uploadUrl,
            file: b.file,
            contentType: p.contentType,
            onProgress: (pct) => setOne(b.localId, { pct: Math.min(99, pct) }),
          });
          const cm = await fetch(
            `/api/dashboard/events/${eventId}/photos/${p.photoId}/commit`,
            { method: "POST" },
          );
          if (!cm.ok) {
            const data = (await cm.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? "Commit falló");
          }
          setOne(b.localId, { state: "complete", pct: 100 });
        } catch (err) {
          setOne(b.localId, {
            state: "failed",
            error: err instanceof Error ? err.message : "Error",
          });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, () => worker()),
    );

    // Refresh server-rendered grid so the photos appear below
    router.refresh();
  }

  function putWithProgress(opts: {
    url: string;
    file: File;
    contentType: string;
    onProgress: (pct: number) => void;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          opts.onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.ontimeout = () => reject(new Error("Timeout"));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`S3 PUT failed (${xhr.status})`));
      };
      xhr.open("PUT", opts.url);
      xhr.setRequestHeader("Content-Type", opts.contentType);
      xhr.send(opts.file);
    });
  }

  function reset() {
    setItems([]);
    setFilesModalOpen(false);
  }

  const visibleItems = items.filter((i) => i.visible);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <>
      <div
        className={`upload-zone ${phase} ${drag ? "drag" : ""} ${allFailed ? "all-failed" : ""}`}
        onClick={(e) => {
          if (phase !== "idle") return;
          if ((e.target as HTMLElement).closest("button")) return;
          pickFiles();
        }}
        onDragOver={(e) => {
          if (phase !== "idle") return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (phase !== "idle") return;
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
        }}
        role={phase === "idle" ? "button" : undefined}
        tabIndex={phase === "idle" ? 0 : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* IDLE */}
        <div className="idle-view">
          <div className="icon">
            <i className="ti ti-cloud-upload" />
          </div>
          <h4>Arrastrá fotos acá</h4>
          <p>O hacé click para elegir. Procesamos las fotos en segundo plano.</p>
          <button className="btn btn-primary" type="button" onClick={pickFiles}>
            <i className="ti ti-folder" />
            Elegir archivos
          </button>
          <div className="upload-meta" style={{ marginTop: 16 }}>
            <span>
              <i className="ti ti-photo" style={{ fontSize: 13 }} />
              JPG · PNG · WebP
            </span>
            <span>
              <i className="ti ti-database" style={{ fontSize: 13 }} />
              Hasta {(maxPhotoBytes / 1024 / 1024).toFixed(0)} MB por foto
            </span>
            <span>
              <i className="ti ti-shield-check" style={{ fontSize: 13 }} />
              Watermark automático
            </span>
          </div>
        </div>

        {/* UPLOADING + DONE share the same DOM (CSS toggles visibility) */}
        <div className="upload-progress">
          <div className="up-head">
            <div className="title">
              <span className="ic">
                {phase === "done" ? (
                  allFailed ? (
                    <i className="ti ti-x" style={{ fontSize: 16 }} />
                  ) : someFailed ? (
                    <i className="ti ti-alert-triangle" style={{ fontSize: 16 }} />
                  ) : (
                    <i className="ti ti-check" style={{ fontSize: 16 }} />
                  )
                ) : (
                  <span className="up-spinner" />
                )}
              </span>
              <span>
                {phase === "done"
                  ? allFailed
                    ? "No pudimos subir las fotos"
                    : someFailed
                      ? `${done} de ${total} cargadas`
                      : "Fotos cargadas"
                  : "Subiendo fotos…"}
              </span>
            </div>
            <div className="stats">
              <span className="accent">{done}</span> / <span>{total}</span>
              <span> · {aggPct}%</span>
            </div>
          </div>

          <div className="up-bar">
            <span style={{ width: `${aggPct}%` }} />
          </div>

          <div className="up-list">
            {visibleItems.map((it, idx) => (
              <div
                key={it.localId}
                className={`up-item ${
                  it.state === "complete"
                    ? "complete"
                    : it.state === "failed"
                      ? "failed"
                      : "loading"
                }`}
                style={{ animationDelay: `${idx * 30}ms` }}
                title={it.error ?? it.file.name}
              >
                {it.thumbDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.thumbDataUrl} alt="" />
                ) : null}
                <span className="badge-progress">
                  {it.state === "failed" ? "✕" : `${it.pct}%`}
                </span>
                <span className="check-overlay">
                  <i className="ti ti-check" />
                </span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                className="up-item more"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilesModalOpen(true);
                }}
              >
                <span className="lab-num">+{hiddenCount}</span>
                <span className="lab-text">ver lista</span>
              </button>
            )}
          </div>

          <div className="up-foot">
            {phase === "uploading" ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  // Soft cancel — XHRs in flight will still finish, but UI resets
                  reset();
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>

          {/* Celebration (or failure state) */}
          <div className="up-celebration">
            <div className={`cel-circle ${allFailed ? "error" : ""}`}>
              <i className={`ti ${allFailed ? "ti-x" : "ti-check"}`} />
            </div>
            <div className="cel-title">
              {allFailed
                ? "No pudimos subir las fotos"
                : someFailed
                  ? "Subida parcial"
                  : "¡Listo!"}
            </div>
            <div className="cel-sub">
              {allFailed ? (
                <span style={{ color: "var(--error)" }}>
                  {total} {total === 1 ? "foto falló" : "fotos fallaron"}. Mirá la lista para
                  ver el detalle.
                </span>
              ) : someFailed ? (
                <>
                  <strong>{done}</strong> cargadas ·{" "}
                  <span style={{ color: "var(--error)" }}>{failed} con error</span>
                </>
              ) : (
                <>
                  <strong>{done}</strong> fotos cargadas con watermark automático
                </>
              )}
            </div>
            <div className="cel-actions">
              {!allFailed && (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                    setTimeout(() => pickFiles(), 50);
                  }}
                >
                  <i className="ti ti-cloud-upload" />
                  Subir más fotos
                </button>
              )}
              {allFailed && (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                    setTimeout(() => pickFiles(), 50);
                  }}
                >
                  <i className="ti ti-refresh" />
                  Reintentar
                </button>
              )}
              <button
                className="btn btn-outline"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
              >
                <i className="ti ti-x" />
                Cerrar
              </button>
            </div>
            <button
              type="button"
              className="cel-link"
              onClick={(e) => {
                e.stopPropagation();
                setFilesModalOpen(true);
              }}
            >
              Ver lista completa
              <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Files modal (full list) */}
      {filesModalOpen && (
        <div className="fb open" onClick={() => setFilesModalOpen(false)}>
          <div className={`files-modal ${phase === "done" ? "done" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="files-head">
              <h3>{phase === "done" ? "Archivos cargados" : "Archivos en cola"}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setFilesModalOpen(false)}
                aria-label="Cerrar"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="files-summary">
              <span className="accent">{done}</span>
              <strong>/ {total}</strong>
              <div className="bar">
                <span style={{ width: `${aggPct}%` }} />
              </div>
              <span>{aggPct}%</span>
            </div>
            <div className="files-list">
              {items.map((it) => (
                <div
                  key={it.localId}
                  className={`file-row ${it.state === "complete" ? "complete" : ""}`}
                >
                  <div className="thumb">
                    {it.thumbDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.thumbDataUrl} alt="" />
                    ) : null}
                  </div>
                  <div>
                    <div className="name">{it.file.name}</div>
                    <div className="size">
                      {fmtSize(it.file.size)}
                      {it.error ? ` · ${it.error}` : ""}
                    </div>
                  </div>
                  <span className="pct">
                    {it.state === "failed" ? "Error" : `${it.pct}%`}
                  </span>
                  <span className="status-ic">
                    {it.state === "complete" ? (
                      <i className="ti ti-circle-check-filled" style={{ fontSize: 16 }} />
                    ) : it.state === "failed" ? (
                      <i
                        className="ti ti-alert-circle"
                        style={{ fontSize: 16, color: "var(--error)" }}
                      />
                    ) : (
                      <span className="up-spinner" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
