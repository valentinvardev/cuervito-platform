"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { fireConfetti } from "~/lib/confetti";

type Photo = {
  id: string;
  filename: string;
  bibNumbers: string | null;
  previewUrl: string;
};

// fireConfetti is shared with /pago/procesando — see ~/lib/confetti.

async function fetchDownloadUrl(token: string, photoId: string): Promise<{ url: string; filename: string }> {
  const res = await fetch(`/api/download/${token}/${photoId}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "No pudimos generar el link de descarga");
  }
  return (await res.json()) as { url: string; filename: string };
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * iOS Safari ignores the `download` attribute and sends every download to
 * the Files app. To get the iOS share sheet (with "Save Image" → Photos),
 * we open the image inline in a new tab so the user can long-press → save.
 *
 * Caveat: the user has to do one extra tap, but it lands in Photos instead
 * of Files. This matches the iOS-by-iOS flow in the step-by-step modal.
 */
function openInlineForIos(url: string) {
  // Need a user-gesture initiated window.open with noopener so Safari
  // shows the image directly (and not as a download).
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Pop-up blocked — fall back to navigating the current tab.
    window.location.href = url;
  }
}

export function DescargaClient({
  token,
  buyerEmail,
  buyerName,
  eventName,
  photos,
}: {
  token: string;
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  photos: Photo[];
}) {
  const confettiRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // The full payment confirmation animation now lives in /pago/procesando.
    // Here we just fire the celebratory confetti once the page mounts.
    if (confettiRef.current) fireConfetti(confettiRef.current);
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
    }
  }, []);

  async function downloadOne(photoId: string, filename: string) {
    setPendingId(photoId);
    setError(null);
    try {
      const { url } = await fetchDownloadUrl(token, photoId);
      if (isIos) {
        // iOS: open inline so the user can long-press → "Save to Photos"
        openInlineForIos(url);
      } else {
        triggerDownload(url, filename);
      }
      setSaved((prev) => new Set(prev).add(photoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setPendingId(null);
    }
  }

  function downloadAll() {
    // Browser native ZIP download via the streaming endpoint
    const url = `/api/download/${token}/zip`;
    triggerDownload(url, `${eventName}-fotos.zip`);
    setSaved(new Set(photos.map((p) => p.id)));
  }

  return (
    <>
      <div className="confetti-container" ref={confettiRef} aria-hidden="true" />

      <header className="nav">
        <Link href="/" className="logo">
          cuerv<span className="logo-dot"></span>to
        </Link>
      </header>

      <main className="wrap">
        <section className="hero">
          <div className="check-circle">
            <i className="ti ti-check" />
          </div>
          <div className="eyebrow-success">Pago aprobado · Compra confirmada</div>
          <h1>
            Gracias por<br />tu compra.
          </h1>
          <p className="lede">
            Tus fotos están listas para descargar. También te las enviamos por email a{" "}
            <strong>{buyerEmail}</strong>.
          </p>
          <div className="cta-row">
            {isIos ? (
              <>
                <button className="btn btn-primary" onClick={() => setIosOpen(true)}>
                  <i className="ti ti-device-mobile" />
                  Guardar en iPhone (paso a paso)
                </button>
                <button className="btn btn-outline" onClick={downloadAll}>
                  <i className="ti ti-download" />
                  Descargar todas
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={downloadAll}>
                  <i className="ti ti-download" />
                  Descargar todas (.zip)
                </button>
                <button className="btn btn-outline" onClick={() => setIosOpen(true)}>
                  <i className="ti ti-device-mobile" />
                  Guardar en iPhone (paso a paso)
                </button>
              </>
            )}
          </div>
        </section>

        <div className="summary-card">
          <div className="meta">
            <div className="item">
              <div className="lab">Comprador</div>
              <div className="val">{buyerName}</div>
            </div>
            <div className="item">
              <div className="lab">Email</div>
              <div className="val mono">{buyerEmail}</div>
            </div>
            <div className="item">
              <div className="lab">Fotos</div>
              <div className="val mono">{photos.length.toLocaleString("es-AR")}</div>
            </div>
            <div className="item">
              <div className="lab">Evento</div>
              <div className="val">{eventName}</div>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(224,85,85,0.08)",
              border: "1px solid rgba(224,85,85,0.4)",
              borderRadius: 10,
              color: "var(--error)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <i className="ti ti-alert-circle" />
            {error}
          </div>
        )}

        <div className="section-h">
          <h2>Tus fotos</h2>
          <span className="sub">
            tocá <i className="ti ti-download" style={{ fontSize: 13 }} /> en cada foto para
            guardarla
          </span>
        </div>

        <div className="photo-grid">
          {photos.map((p) => {
            const isSaved = saved.has(p.id);
            const isPending = pendingId === p.id;
            return (
              <div
                key={p.id}
                className={`photo-cell ${isSaved ? "saved" : ""}`}
                style={{
                  backgroundImage: `url(${p.previewUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {p.bibNumbers && <div className="ribbon">#{p.bibNumbers}</div>}
                <button
                  className="dl"
                  onClick={() => downloadOne(p.id, p.filename)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="spinner-mini" />
                      Preparando
                    </>
                  ) : isSaved ? (
                    <>
                      <i className="ti ti-check" style={{ fontSize: 14 }} />
                      Guardada
                    </>
                  ) : (
                    <>
                      <i className="ti ti-download" style={{ fontSize: 14 }} />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="footer-help">
          <div className="ic">
            <i className="ti ti-device-mobile" />
          </div>
          <div className="body">
            <strong>¿Estás en iPhone?</strong> Te recomendamos usar{" "}
            <button
              type="button"
              onClick={() => setIosOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                cursor: "pointer",
                font: "inherit",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              &quot;Guardar en iPhone (paso a paso)&quot;
            </button>{" "}
            — vas foto por foto y cada una se guarda con el tap &quot;Guardar foto&quot; de iOS,
            que es el único método confiable.
          </div>
        </div>
      </main>

      {iosOpen && (
        <IosStepByStep
          token={token}
          photos={photos}
          onClose={() => setIosOpen(false)}
        />
      )}
    </>
  );
}

function IosStepByStep({
  token,
  photos,
  onClose,
}: {
  token: string;
  photos: Photo[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = photos.length;
  const current = photos[idx];

  async function save() {
    if (state !== "idle" || !current) return;
    setState("loading");
    try {
      const { url } = await fetchDownloadUrl(token, current.id);
      // Always inline here: this whole flow exists for iOS-style saving.
      openInlineForIos(url);
    } catch {
      // ignore — UI still advances so the user can keep going
    }
    setState("done");
    setTimeout(() => {
      const isLast = idx === photos.length - 1;
      if (isLast) {
        setDone(true);
      } else {
        setIdx((i) => i + 1);
        setState("idle");
      }
    }, 1100);
  }

  function skip() {
    if (state !== "idle") return;
    const isLast = idx === photos.length - 1;
    if (isLast) setDone(true);
    else setIdx((i) => i + 1);
  }

  if (!current || !mounted) return null;

  const content = (
    <aside className="ios-screen open" aria-hidden="false">
      {done ? (
        <div className="ios-done" style={{ display: "flex" }}>
          <div className="check-circle">
            <i className="ti ti-check" />
          </div>
          <h2>¡Listo!</h2>
          <div className="desc">
            Tus{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {photos.length} {photos.length === 1 ? "foto" : "fotos"}
            </strong>{" "}
            están guardadas en tu galería.
            <br />
            Abrí la app Fotos para verlas.
          </div>
          <button className="btn btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </div>
      ) : (
        <div>
          <div className="ios-head">
            <span className="logo">
              cuerv<span className="logo-dot"></span>to
            </span>
            <span className="pos">
              {idx + 1} / {total}
            </span>
          </div>
          <div className="ios-progress">
            <span style={{ width: `${(idx / total) * 100}%` }} />
          </div>
          <div className="ios-photo-area">
            <div
              className={`ios-photo ${state === "done" ? "dimmed" : ""}`}
              style={{
                backgroundImage: `url(${current.previewUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className={`ios-checkmark ${state === "done" ? "show" : ""}`}>
              <i className="ti ti-check" />
            </div>
          </div>
          <div className="ios-bottom">
            <p className={`ios-instruct ${state === "done" ? "met" : ""}`}>
              {state === "done"
                ? `Guardada · ${idx === photos.length - 1 ? "terminando…" : "siguiente foto…"}`
                : "Tocá el botón para guardar esta foto en tu galería."}
            </p>
            <button className="ios-save-btn" data-state={state} onClick={save}>
              <span className="state state-idle">
                <span>Guardar foto</span>
                <i className="ti ti-download" />
              </span>
              <span className="state state-loading">
                <span>Preparando…</span>
                <span className="spinner-mini" />
              </span>
              <span className="state state-done">
                <span>Guardada</span>
                <i className="ti ti-check" />
              </span>
            </button>
            <button className="ios-skip" onClick={skip}>
              Saltar esta foto →
            </button>
          </div>
        </div>
      )}
    </aside>
  );

  return createPortal(content, document.documentElement);
}
