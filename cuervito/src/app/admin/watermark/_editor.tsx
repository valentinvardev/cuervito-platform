"use client";

import { useRouter } from "next/navigation";
import { ImageOff, RotateCcw, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  CONFIG_POR_DEFECTO,
  PATRONES_LISTA,
  type ConfigMarca,
} from "~/server/marca-agua-config";

import { Confirmar } from "~/app/admin/_components/confirmar";

import { guardarConfigMarcaAction, restablecerConfigMarcaAction } from "./actions";

type FotoMuestra = {
  id: string;
  url: string;
  evento: string;
  fotografo: string;
  vertical: boolean;
};

/**
 * El editor de la marca de agua.
 *
 * Cada control cambia `cfg`; un efecto con un pequeño retardo pide al
 * servidor la foto elegida con esa marca puesta, y otro pide la unidad sola.
 * No se dibuja nada en el navegador: lo que se ve es lo que va a salir, con
 * el mismo código que estampa el procesador. Guardar es aparte del probar,
 * así que se puede mover todo sin miedo y volver atrás.
 */
export function Editor({
  inicial,
  pngUrl,
  fotos,
}: {
  inicial: ConfigMarca;
  pngUrl: string | null;
  fotos: FotoMuestra[];
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState<ConfigMarca>(inicial);
  const [guardada, setGuardada] = useState<ConfigMarca>(inicial);
  const [fotoId, setFotoId] = useState<string | null>(fotos[0]?.id ?? null);
  // Sube cada vez que cambia el PNG subido: los efectos lo tienen como
  // dependencia para volver a pedir la vista previa con la imagen nueva.
  const [version, setVersion] = useState(0);

  const [salida, setSalida] = useState<string | null>(null);
  const [unidad, setUnidad] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "mal"; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [confirmar, setConfirmar] = useState<"quitar-png" | "restablecer" | null>(null);
  const [pendiente, empezar] = useTransition();

  const turnoFoto = useRef(0);
  const turnoUnidad = useRef(0);
  const blobFoto = useRef<string | null>(null);
  const blobUnidad = useRef<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const sucia = JSON.stringify(cfg) !== JSON.stringify(guardada);
  const set = <K extends keyof ConfigMarca>(k: K, v: ConfigMarca[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  // ── La foto con la marca ──────────────────────────────────────────────────
  const pedirFoto = useCallback(async () => {
    if (!fotoId) return;
    const mio = ++turnoFoto.current;
    setGenerando(true);
    try {
      const r = await fetch("/api/admin/watermark/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modo: "foto", photoId: fotoId, cfg }),
      });
      if (turnoFoto.current !== mio) return;
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? "No pudimos armar la vista previa.");
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      if (turnoFoto.current !== mio) {
        URL.revokeObjectURL(url);
        return;
      }
      if (blobFoto.current) URL.revokeObjectURL(blobFoto.current);
      blobFoto.current = url;
      setSalida(url);
      setError(null);
    } catch {
      if (turnoFoto.current === mio) setError("No pudimos armar la vista previa.");
    } finally {
      if (turnoFoto.current === mio) setGenerando(false);
    }
  }, [fotoId, cfg]);

  // Con retardo: un deslizador dispara decenas de cambios por segundo y cada
  // uno sería un render de sharp en el servidor.
  useEffect(() => {
    const t = setTimeout(() => void pedirFoto(), 220);
    return () => clearTimeout(t);
    // `version` no la usa pedirFoto, pero cambia cuando cambia el PNG.
  }, [pedirFoto, version]);

  // ── La unidad sola ────────────────────────────────────────────────────────
  const { fuente, texto, textoEscala, color } = cfg;
  useEffect(() => {
    const mio = ++turnoUnidad.current;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch("/api/admin/watermark/preview", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ modo: "unidad", cfg: { ...cfg, fuente, texto, textoEscala, color } }),
          });
          if (turnoUnidad.current !== mio || !r.ok) return;
          const url = URL.createObjectURL(await r.blob());
          if (turnoUnidad.current !== mio) {
            URL.revokeObjectURL(url);
            return;
          }
          if (blobUnidad.current) URL.revokeObjectURL(blobUnidad.current);
          blobUnidad.current = url;
          setUnidad(url);
        } catch {
          /* la foto grande ya muestra el error */
        }
      })();
    }, 220);
    return () => clearTimeout(t);
    // Sólo lo que cambia la unidad; el patrón no la toca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, texto, textoEscala, color, version]);

  useEffect(() => {
    return () => {
      if (blobFoto.current) URL.revokeObjectURL(blobFoto.current);
      if (blobUnidad.current) URL.revokeObjectURL(blobUnidad.current);
    };
  }, []);

  // ── Guardar ───────────────────────────────────────────────────────────────
  function guardar() {
    setAviso(null);
    empezar(async () => {
      const r = await guardarConfigMarcaAction(cfg);
      if (r.ok) {
        setGuardada(cfg);
        setAviso({ tipo: "ok", texto: "Guardado. Vale para lo que se procese de ahora en más." });
      } else {
        setAviso({ tipo: "mal", texto: r.error ?? "No se pudo guardar." });
      }
    });
  }

  function restablecer() {
    setConfirmar(null);
    empezar(async () => {
      await restablecerConfigMarcaAction();
      setCfg(CONFIG_POR_DEFECTO);
      setGuardada(CONFIG_POR_DEFECTO);
      setAviso({ tipo: "ok", texto: "Valores de fábrica." });
    });
  }

  // ── El PNG subido ─────────────────────────────────────────────────────────
  async function subirPng(archivo: File) {
    setAviso(null);
    if (archivo.type !== "image/png") {
      setAviso({ tipo: "mal", texto: "Tiene que ser un PNG con transparencia." });
      return;
    }
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("watermark", archivo);
      const r = await fetch("/api/admin/watermark", { method: "POST", body: form });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setAviso({ tipo: "mal", texto: d.error ?? "No se pudo subir." });
        return;
      }
      set("fuente", "subida");
      setVersion((v) => v + 1);
      router.refresh();
    } catch {
      setAviso({ tipo: "mal", texto: "Se cortó la conexión." });
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarPng() {
    setConfirmar(null);
    setSubiendo(true);
    try {
      await fetch("/api/admin/watermark", { method: "DELETE" });
      set("fuente", "logo");
      setVersion((v) => v + 1);
      router.refresh();
    } finally {
      setSubiendo(false);
    }
  }

  const pct = (n: number) => `${Math.round(n * 100)} %`;
  const unica = cfg.patron === "centro" || cfg.patron === "esquina";
  const fotoSel = fotos.find((f) => f.id === fotoId);

  return (
    <>
      <input
        ref={archivoRef}
        type="file"
        accept="image/png"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void subirPng(f);
          e.target.value = "";
        }}
      />

      <div className="ma">
        <div className="ma-op">
          {/* ── La unidad ── */}
          <section className="card">
            <div className="hist-tit">
              <b>La unidad</b>
              <span>Lo que se repite sobre la foto</span>
            </div>

            <div className="seg" role="group" aria-label="Imagen de la unidad">
              <button
                type="button"
                aria-pressed={cfg.fuente === "logo"}
                onClick={() => set("fuente", "logo")}
              >
                Logo de encontrate
              </button>
              <button
                type="button"
                aria-pressed={cfg.fuente === "subida"}
                onClick={() => set("fuente", "subida")}
                disabled={!pngUrl}
                data-tip={pngUrl ? undefined : "Subí un PNG para usarlo"}
              >
                PNG subido
              </button>
            </div>

            <div className="ma-png">
              <div className="caja">
                {pngUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pngUrl} alt="PNG subido" />
                ) : (
                  <ImageOff style={{ width: 18, height: 18, color: "rgba(255,255,255,.6)" }} />
                )}
              </div>
              <div className="t">
                <b>{pngUrl ? "Hay un PNG subido" : "Sin PNG subido"}</b>
                {pngUrl
                  ? "Se usa cuando la unidad es «PNG subido». Los fotógrafos con marca propia no lo ven."
                  : "Con transparencia, hasta 2 MB. Mientras no haya uno, va el logo de encontrate."}
              </div>
              <div className="acc">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => archivoRef.current?.click()}
                  disabled={subiendo}
                >
                  <Upload /> {subiendo ? "Subiendo…" : pngUrl ? "Reemplazar" : "Subir"}
                </button>
                {pngUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label="Quitar el PNG"
                    data-tip="Quitar el PNG"
                    onClick={() => setConfirmar("quitar-png")}
                    disabled={subiendo}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            </div>

            <div className="ma-campo">
              <label htmlFor="ma-texto">Texto debajo de la imagen</label>
              <input
                id="ma-texto"
                className="inp"
                value={cfg.texto}
                maxLength={60}
                placeholder="Vacío = sin texto"
                onChange={(e) => set("texto", e.target.value)}
              />
            </div>

            <div className="ma-r" data-off={cfg.texto.trim() ? undefined : "1"} style={{ marginTop: 6 }}>
              <span>Tamaño del texto</span>
              <input
                type="range"
                min={5}
                max={50}
                value={Math.round(cfg.textoEscala * 100)}
                onChange={(e) => set("textoEscala", Number(e.target.value) / 100)}
                aria-label="Tamaño del texto"
              />
              <b>{pct(cfg.textoEscala)}</b>
            </div>

            <div className="ma-r">
              <span>Tinta</span>
              <div className="seg" role="group" aria-label="Color" style={{ justifySelf: "start" }}>
                <button type="button" aria-pressed={cfg.color === "blanco"} onClick={() => set("color", "blanco")}>
                  Blanca
                </button>
                <button type="button" aria-pressed={cfg.color === "tinta"} onClick={() => set("color", "tinta")}>
                  Oscura
                </button>
              </div>
              <b />
            </div>

            <div className="ma-unidad" data-fondo={cfg.color === "tinta" ? "claro" : undefined}>
              {unidad ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={unidad} alt="La unidad de la marca de agua" />
              ) : (
                <div className="hist-vacio">Armando la unidad…</div>
              )}
            </div>
          </section>

          {/* ── El patrón ── */}
          <section className="card">
            <div className="hist-tit">
              <b>El patrón</b>
              <span>Cómo se reparte</span>
            </div>
            <div className="hist-ops">
              {PATRONES_LISTA.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="hist-o"
                  aria-pressed={cfg.patron === p.id}
                  onClick={() => set("patron", p.id)}
                >
                  <b>{p.nombre}</b>
                  <span>{p.descripcion}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: "var(--s-3)" }}>
              <div className="ma-r">
                <span>Escala</span>
                <input
                  type="range"
                  min={5}
                  max={70}
                  value={Math.round(cfg.escala * 100)}
                  onChange={(e) => set("escala", Number(e.target.value) / 100)}
                  aria-label="Escala de la unidad"
                />
                <b>{pct(cfg.escala)}</b>
              </div>
              <div className="ma-r">
                <span>Opacidad</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(cfg.opacidad * 100)}
                  onChange={(e) => set("opacidad", Number(e.target.value) / 100)}
                  aria-label="Opacidad"
                />
                <b>{pct(cfg.opacidad)}</b>
              </div>
              <div className="ma-r" data-off={cfg.patron === "esquina" ? "1" : undefined}>
                <span>Rotación</span>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={cfg.rotacion}
                  onChange={(e) => set("rotacion", Number(e.target.value))}
                  aria-label="Rotación"
                />
                <b>{cfg.rotacion}°</b>
              </div>
              <div className="ma-r" data-off={unica ? "1" : undefined}>
                <span>Separación</span>
                <input
                  type="range"
                  min={0}
                  max={400}
                  step={5}
                  value={Math.round(cfg.separacion * 100)}
                  onChange={(e) => set("separacion", Number(e.target.value) / 100)}
                  aria-label="Separación entre unidades"
                />
                <b>{pct(cfg.separacion)}</b>
              </div>
              <div className="ma-r" data-off={cfg.patron === "esquina" ? undefined : "1"}>
                <span>Margen</span>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={Math.round(cfg.margen * 100)}
                  onChange={(e) => set("margen", Number(e.target.value) / 100)}
                  aria-label="Margen al borde"
                />
                <b>{pct(cfg.margen)}</b>
              </div>
            </div>
          </section>

          {/* ── Guardar ── */}
          <section className="card ma-guardar">
            {aviso ? (
              <span className="aviso" data-tipo={aviso.tipo}>
                {aviso.texto}
              </span>
            ) : (
              <span className="aviso">
                {sucia ? "Hay cambios sin guardar." : "Esto es lo que se está usando."}
              </span>
            )}
            <div className="sp">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmar("restablecer")}
                disabled={pendiente}
                data-tip="Vuelve a los valores de fábrica y los guarda"
              >
                <RotateCcw /> Restablecer
              </button>
              <button type="button" className="btn btn-pri" onClick={guardar} disabled={pendiente || !sucia}>
                {pendiente ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </section>
        </div>

        {/* ── La vista previa ── */}
        <div className="ma-pv">
          <div className="ma-lienzo" data-cargando={generando ? "1" : undefined}>
            {salida ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={salida} alt="Una foto con la marca de agua puesta" />
            ) : (
              <div className="hist-vacio">
                {error ??
                  (fotos.length === 0
                    ? "Todavía no hay fotos procesadas para probar."
                    : "Armando la vista previa…")}
              </div>
            )}
            {error && salida && (
              <div className="hist-pista" aria-live="polite">
                {error}
              </div>
            )}
          </div>

          {fotos.length > 0 && (
            <>
              <div className="ma-fotos">
                {fotos.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="ft"
                    data-sel={fotoId === f.id ? "1" : undefined}
                    aria-pressed={fotoId === f.id}
                    onClick={() => setFotoId(f.id)}
                    aria-label={`Probar sobre una foto de ${f.fotografo}`}
                    data-tip={f.evento || undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
              <div className="ma-nota">
                Fotos reales de los fotógrafos, sin marca.
                {fotoSel && (
                  <>
                    {" "}
                    Esta es de <b style={{ color: "var(--ink)", fontWeight: 500 }}>{fotoSel.fotografo}</b>
                    {fotoSel.evento && <> · {fotoSel.evento}</>}.
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {confirmar === "quitar-png" && (
        <Confirmar
          titulo="Quitar el PNG subido"
          cuerpo="La unidad pasa a usar el logo de encontrate. Lo ya procesado no cambia hasta que regeneres."
          accion="Quitar"
          peligro
          ocupado={subiendo}
          alConfirmar={() => void quitarPng()}
          alCerrar={() => setConfirmar(null)}
        />
      )}
      {confirmar === "restablecer" && (
        <Confirmar
          titulo="Volver a los valores de fábrica"
          cuerpo="Se guardan los valores por defecto en lugar de los actuales. Lo ya procesado no cambia hasta que regeneres."
          accion="Restablecer"
          ocupado={pendiente}
          alConfirmar={restablecer}
          alCerrar={() => setConfirmar(null)}
        />
      )}
    </>
  );
}
