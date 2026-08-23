"use client";

import { useRef, useState } from "react";

import { ACEPTADOS as ACCEPT, useSubida } from "~/app/dashboard/_usar-subida";

// El firmado, la cola de subida y el commit viven en useSubida: el panel nuevo
// necesita exactamente lo mismo y dos copias de eso se despegan solas. Acá
// queda el dibujo, que es lo único distinto entre los dos paneles. El tope de
// celdas visibles también se decide allá, con el campo `visible` de cada ítem.

const MAX_VISIBLE_TILES = 11;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);

  const {
    items,
    total,
    hechas: done,
    fallidas: failed,
    cerrado: settled,
    fase: phase,
    pct: aggPct,
    agregar: addFiles,
    limpiar,
  } = useSubida(eventId, { miniaturas: MAX_VISIBLE_TILES, maxBytes: maxPhotoBytes });

  const allFailed = settled && failed === total;
  const someFailed = settled && failed > 0;

  function pickFiles() {
    fileInputRef.current?.click();
  }

  function reset() {
    limpiar();
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
          <button className="btn btn-primary" type="button" onClick={pickFiles} data-tip="Seleccioná las fotos del evento desde tu computadora">
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
