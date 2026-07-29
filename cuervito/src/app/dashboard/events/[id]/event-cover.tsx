"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { Tooltip } from "~/app/_components/tooltip";

export function EventCover({
  eventId,
  title,
  date,
  location,
  discipline,
  status,
  coverUrl,
  publicPath,
}: {
  eventId: string;
  title: string;
  date: string;
  location: string | null;
  discipline: string | null;
  status: string;
  coverUrl: string | null;
  publicPath: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const shareBtnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCoachHint, setShowCoachHint] = useState(false);
  const uploadBtnRef = useRef<HTMLButtonElement>(null);
  const [coachPos, setCoachPos] = useState<{ top: number; left: number } | null>(null);

  // Coach popup para primera vez: si nunca hay portada y el usuario
  // no la descartó antes, mostramos un callout apuntando al CTA.
  useEffect(() => {
    if (coverUrl) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem("cuervito.event-cover.hint-dismissed") === "1") return;
    const id = setTimeout(() => setShowCoachHint(true), 600);
    return () => clearTimeout(id);
  }, [coverUrl]);

  // El popup se portaliza al body porque .ev-cover tiene overflow:hidden
  // y lo recortaba. Posición fija calculada desde el botón de portada.
  useEffect(() => {
    if (!showCoachHint || !uploadBtnRef.current) return;
    const compute = () => {
      const r = uploadBtnRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 300;
      let left = r.left;
      if (left + W > window.innerWidth - 12) left = window.innerWidth - W - 12;
      setCoachPos({ top: r.bottom + 10, left: Math.max(12, left) });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [showCoachHint]);

  function dismissCoachHint() {
    setShowCoachHint(false);
    try {
      localStorage.setItem("cuervito.event-cover.hint-dismissed", "1");
    } catch {
      // noop
    }
  }

  const fullUrl =
    typeof window !== "undefined" && publicPath
      ? `${window.location.origin}${publicPath}`
      : publicPath ?? "";

  useEffect(() => {
    if (!shareOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (!popRef.current?.contains(e.target as Node) && !shareBtnRef.current?.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShareOpen(false);
    }
    document.addEventListener("click", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [shareOpen]);

  useEffect(() => {
    if (!shareOpen || !shareBtnRef.current) return;
    const rect = shareBtnRef.current.getBoundingClientRect();
    const W = 320;
    let left = rect.right - W;
    left = Math.max(12, Math.min(left, window.innerWidth - W - 12));
    setPopPos({ top: rect.bottom + 8, left });
  }, [shareOpen]);

  function toggleShare(e: React.MouseEvent) {
    e.stopPropagation();
    if (!publicPath) {
      alert("Publicá el evento desde la sección Info para compartir el link.");
      return;
    }
    setShareOpen((o) => !o);
  }

  function copy() {
    if (!fullUrl) return;
    void navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  async function uploadCover(file: File) {
    setUploadError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Solo JPG, PNG o WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Máximo 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("cover", file);
      const res = await fetch(`/api/dashboard/events/${eventId}/cover`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setUploadError(data.error ?? "No pudimos subir la portada.");
        return;
      }
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div
        className={`ev-cover ${drag ? "drag-over" : ""} ${!coverUrl ? "is-empty" : ""}`}
        style={
          coverUrl
            ? {
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void uploadCover(f);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadCover(f);
            e.target.value = "";
          }}
        />

        {/* Empty state grande cuando no hay portada — click abre el
           file picker igual que el botón de arriba a la derecha. */}
        {!coverUrl && (
          <button
            type="button"
            className="ev-cover-empty"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Subir portada"
          >
            <span className="ec-icon">
              <i className="ti ti-photo-plus" />
            </span>
            <span className="ec-title">Subí una portada</span>
            <span className="ec-sub">
              Arrastrá una imagen acá o hacé click. JPG, PNG o WebP · hasta 10 MB.
            </span>
          </button>
        )}

        <div className="cover-actions">
          <div className="cover-upload-wrap">
            <Tooltip
              content={coverUrl ? "Cambiá la portada del evento" : "Elegí una foto para el banner"}
              side="bottom"
              align="start"
            >
              <button
                ref={uploadBtnRef}
                className="cover-btn"
                type="button"
                onClick={() => {
                  dismissCoachHint();
                  fileInputRef.current?.click();
                }}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <span className="up-spinner" />
                    Subiendo…
                  </>
                ) : (
                  <>
                    <i className="ti ti-photo-edit" />
                    {coverUrl ? "Cambiar portada" : "Subir portada"}
                  </>
                )}
              </button>
            </Tooltip>

            {/* Coach callout: portalizado al body porque .ev-cover tiene
               overflow:hidden y lo recortaba contra el borde del banner. */}
            {showCoachHint && !coverUrl && coachPos &&
              createPortal(
                <div
                  className="cover-coach"
                  role="status"
                  style={{ top: coachPos.top, left: coachPos.left }}
                >
                  <span className="cc-arrow" aria-hidden />
                  <div className="cc-body">
                    <i className="ti ti-bulb-filled" />
                    <div>
                      <div className="cc-title">Empezá por la portada</div>
                      <div className="cc-desc">
                        Los eventos con portada se ven mejor en el buscador y venden más.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cc-dismiss"
                      onClick={dismissCoachHint}
                      aria-label="Cerrar sugerencia"
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                </div>,
                document.body,
              )}
          </div>

          <Tooltip
            content={publicPath ? "Copiá el link público del evento" : "Publicá el evento primero desde Info"}
            side="bottom"
            align="end"
          >
            <button
              ref={shareBtnRef}
              className="cover-btn primary"
              type="button"
              onClick={toggleShare}
            >
              <i className="ti ti-share-3" />
              Compartir
            </button>
          </Tooltip>
        </div>

        {coverUrl && <div className="overlay" />}
        <div className="meta">
          <div>
            <div className="ev-status-row" style={{ marginBottom: 10 }}>
              <StatusBadge status={status} />
            </div>
            <h1>{title}</h1>
            <div className="sub">
              <span>{date}</span>
              {location && (
                <>
                  <span className="sep" />
                  <span>{location}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {uploadError && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 14px",
            background: "rgba(224,85,85,0.12)",
            border: "1px solid rgba(224,85,85,0.4)",
            borderRadius: 10,
            color: "var(--error)",
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="ti ti-alert-circle" />
          {uploadError}
        </div>
      )}

      {shareOpen && popPos && (
        <div
          ref={popRef}
          className="share-pop open"
          style={{ top: popPos.top, left: popPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="label-mono">Tu link público para este evento</div>
          <div className="url-row">
            <input value={fullUrl} readOnly />
            <button className="copy" onClick={copy}>
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
          </div>
          <div className="qrow">
            <a
              className="qbtn"
              target="_blank"
              rel="noopener"
              href={`https://wa.me/?text=${encodeURIComponent(fullUrl)}`}
            >
              <i className="ti ti-brand-whatsapp" />
              WhatsApp
            </a>
            <a
              className="qbtn"
              target="_blank"
              rel="noopener"
              href="https://www.instagram.com/"
            >
              <i className="ti ti-brand-instagram" />
              Historia
            </a>
            <a className="qbtn" target="_blank" rel="noopener" href={publicPath ?? "#"}>
              <i className="ti ti-external-link" />
              Ver
            </a>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PROCESSING") {
    return (
      <span className="status-pill processing">
        <span className="spin-ring" />
        Procesando
      </span>
    );
  }
  if (status === "ACTIVE" || status === "FINISHED") {
    return (
      <span className="status-pill uploaded">
        <i className="ti ti-circle-check-filled" />
        Activo
      </span>
    );
  }
  if (status === "ARCHIVED") {
    return (
      <span className="status-pill draft">
        <i className="ti ti-archive" />
        Archivado
      </span>
    );
  }
  return (
    <span className="status-pill draft">
      <i className="ti ti-pencil" />
      Borrador
    </span>
  );
}
