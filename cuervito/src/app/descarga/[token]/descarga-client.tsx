"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";


import { DescargaLightbox } from "./descarga-lightbox";

type Photo = {
  id: string;
  filename: string;
  bibNumbers: string | null;
  previewUrl: string;
};


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
 * Detect support for sharing files via the Web Share API. iOS Safari 15+
 * supports this and it's the only way to get "Guardar foto → Fotos" instead
 * of dropping the file in the Files app.
 */
function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("share" in navigator) || !("canShare" in navigator)) return false;
  try {
    const probe = new File([""], "probe.jpg", { type: "image/jpeg" });
    return (
      navigator as Navigator & { canShare: (d: ShareData) => boolean }
    ).canShare({ files: [probe] });
  } catch {
    return false;
  }
}

type ShareResult = "shared" | "long-press" | "error";

/**
 * iOS save flow ported from sinchi. Fetches the original image, wraps it
 * in a File, and opens the Web Share sheet so the user can pick
 * "Guardar imagen" (which lands in Photos, not Files).
 *
 * Returns:
 *   "shared"      — the iOS share sheet opened. We treat any rejection from
 *                   navigator.share as success because iOS has a known bug
 *                   where it throws AbortError even after "Guardar foto" is
 *                   tapped.
 *   "long-press"  — Web Share API isn't available (older iOS / non-Safari).
 *                   Caller should show the long-press instruction.
 *   "error"       — fetch failed or something else broke.
 */
async function saveViaShareSheet(
  url: string,
  filename: string,
): Promise<ShareResult> {
  if (!canShareFiles()) return "long-press";
  let sheetOpened = false;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const mime = blob.type || "image/jpeg";
    const file = new File([blob], filename, { type: mime });
    sheetOpened = true;
    await (
      navigator as Navigator & {
        share: (d: ShareData) => Promise<void>;
      }
    ).share({ files: [file] });
    return "shared";
  } catch {
    if (sheetOpened) {
      // iOS AbortError quirk — treat as success
      return "shared";
    }
    return "error";
  }
}

export function DescargaClient({
  token,
  buyerEmail,
  buyerName,
  eventName,
  photos,
  fresh = false,
}: {
  token: string;
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  photos: Photo[];
  fresh?: boolean;
}) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Payment confirmation overlay state. Only runs when ?fresh=1 — i.e. the
  // buyer just came from /pago/exito or test-mode checkout. The overlay
  // sits ON TOP of the page (grid is already painted below) so when it
  // fades out the user transitions in-place, no navigation.
  //
  //   pending  → ring spins, "Confirmando pago"
  //   approved → ring closes + check, "Pago confirmado"
  //   off      → overlay fades out, hero "Gracias por tu compra" with its
  //              own green check + grid appear underneath. The check
  //              you saw centered in the overlay visually morphs into
  //              the hero check (both green, both checks) — no nav.
  type Stage = "pending" | "approved" | "off";
  const [stage, setStage] = useState<Stage>(fresh ? "pending" : "off");
  const [overlaySwap, setOverlaySwap] = useState(false);

  useEffect(() => {
    if (!fresh) return;

    // Strip ?fresh=1 from the URL so refreshing doesn't replay the
    // payment-confirmation animation.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("fresh")) {
        url.searchParams.delete("fresh");
        window.history.replaceState(null, "", url.toString());
      }
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const fadeOut = () => setOverlaySwap(true);
    const fadeIn = () => setOverlaySwap(false);

    // pending → approved (let the user read "Confirmando pago" ~1.8s)
    timers.push(setTimeout(fadeOut, 1800));
    timers.push(
      setTimeout(() => {
        setStage("approved");
        fadeIn();
      }, 2080),
    );

    // approved → fade-out the whole overlay (~2.4s of "Pago aprobado"
    // before we hand off to the page hero)
    timers.push(setTimeout(fadeOut, 4500));
    timers.push(
      setTimeout(() => {
        setStage("off");
      }, 5000),
    );

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [fresh]);


  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
    }
  }, []);

  async function downloadOne(photoId: string, filename: string) {
    setPendingId(photoId);
    setError(null);
    try {
      if (isIos) {
        // Use the Web Share API → iOS shows the share sheet with "Guardar
        // imagen" which lands in the Photos app (not Files).
        //
        // CRITICAL: we fetch from a SAME-ORIGIN endpoint (/blob streams the
        // bytes through our server) instead of the S3 presigned URL. iOS
        // Safari's fetch() on a cross-origin URL without CORS headers throws
        // a network error, and the whole share pipeline dies silently.
        const sameOriginUrl = `/api/download/${token}/${photoId}/blob`;
        const r = await saveViaShareSheet(sameOriginUrl, filename);
        if (r === "long-press") {
          setIosOpen(true);
          return;
        }
        if (r === "error") {
          setError("No pudimos preparar la foto. Probá de nuevo.");
          return;
        }
      } else {
        // Desktop: fetch the presigned URL and let the browser download it
        // directly from S3 (faster than streaming through our server).
        const { url } = await fetchDownloadUrl(token, photoId);
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

      {stage !== "off" && (
        <div
          className={`pay-overlay ${stage} ${overlaySwap ? "swap-out" : ""}`}
          role="status"
          aria-live="polite"
        >
          <div className="pay-overlay-inner">
            <div className="pay-ring">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="track" cx="60" cy="60" r="54" />
                <circle className="indeterminate" cx="60" cy="60" r="54" />
              </svg>
              <div className="check">
                <i className="ti ti-circle-check-filled" />
              </div>
            </div>
            <h1 className={`pay-title ${overlaySwap ? "swap-out" : ""}`}>
              {stage === "approved"
                ? "¡Listo! Pago aprobado."
                : "Confirmando pago…"}
            </h1>
            <p className={`pay-sub ${overlaySwap ? "swap-out" : ""}`}>
              {stage === "approved"
                ? "Preparando tus fotos."
                : "No cierres la página."}
            </p>
          </div>
        </div>
      )}

      <header className="nav">
        <Link href="/" className="logo">
          cuerv<span className="logo-dot"></span>to
        </Link>
      </header>

      <main className="wrap">
        <section className={`hero ${fresh ? "hero-enter" : ""}`}>
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
              <button className="btn btn-primary" onClick={downloadAll}>
                <i className="ti ti-download" />
                Descargar todas (.zip)
              </button>
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
          {photos.map((p, i) => {
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
                  cursor: "zoom-in",
                }}
                onClick={() => setLightboxIdx(i)}
              >
                {p.bibNumbers && <div className="ribbon">#{p.bibNumbers}</div>}
                <button
                  className="dl"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadOne(p.id, p.filename);
                  }}
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

        {isIos && (
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
        )}
      </main>

      {iosOpen && (
        <IosStepByStep
          token={token}
          photos={photos}
          onClose={() => setIosOpen(false)}
        />
      )}

      {lightboxIdx !== null && (
        <DescargaLightbox
          photos={photos}
          startIndex={lightboxIdx}
          isSaved={(id) => saved.has(id)}
          isPending={(id) => pendingId === id}
          onSave={(p) => downloadOne(p.id, p.filename)}
          onClose={() => setLightboxIdx(null)}
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
  const [useLongPress, setUseLongPress] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

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
    setErrMsg(null);
    // Same-origin proxy endpoint — needed so iOS Safari's fetch() inside
    // saveViaShareSheet doesn't fail CORS against S3.
    const sameOriginUrl = `/api/download/${token}/${current.id}/blob`;
    const result = await saveViaShareSheet(sameOriginUrl, current.filename);

    if (result === "long-press") {
      // Web Share API unavailable — show the long-press instruction instead
      // of pretending the photo was saved.
      setUseLongPress(true);
      setState("idle");
      return;
    }
    if (result === "error") {
      setErrMsg("No pudimos preparar la foto. Probá de nuevo.");
      setState("idle");
      return;
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
    if (isLast) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setUseLongPress(false);
      setErrMsg(null);
    }
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
            {useLongPress ? (
              <>
                <p className="ios-instruct" style={{ color: "var(--accent)" }}>
                  Mantené el dedo apretado sobre la foto y tocá{" "}
                  <strong>&quot;Guardar foto&quot;</strong>.
                </p>
                <button className="ios-save-btn" data-state="idle" onClick={skip}>
                  <span className="state state-idle">
                    <span>Siguiente foto</span>
                    <i className="ti ti-arrow-right" />
                  </span>
                </button>
              </>
            ) : (
              <>
                <p className={`ios-instruct ${state === "done" ? "met" : ""}`}>
                  {state === "done"
                    ? `Guardada · ${idx === photos.length - 1 ? "terminando…" : "siguiente foto…"}`
                    : errMsg ?? "Tocá el botón para guardar esta foto en tu galería."}
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
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );

  return createPortal(content, document.documentElement);
}
