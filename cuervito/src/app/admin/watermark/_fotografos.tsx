"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, Upload, Users } from "lucide-react";
import { useRef, useState } from "react";

import { Confirmar } from "~/app/admin/_components/confirmar";

type Fotografo = { id: string; nombre: string; propia: boolean; fotos: number };

type Corrida = {
  clave: string;
  corriendo: boolean;
  hechas: number;
  fallas: number;
  total: number;
  error: string | null;
};

/**
 * Lo ya procesado, y la marca propia de cada fotógrafo.
 *
 * Regenerar es un bucle desde acá: cada pedido procesa una tanda y devuelve
 * el cursor de la siguiente. Corre mientras la pestaña esté abierta; si se
 * cierra, lo hecho queda hecho y se puede volver a empezar sin repetir daño,
 * porque regenerar una foto ya regenerada da lo mismo.
 */
export function Fotografos({
  totalFotos,
  sinPreview,
  fotografos,
}: {
  totalFotos: number;
  sinPreview: number;
  fotografos: Fotografo[];
}) {
  const router = useRouter();
  const [corrida, setCorrida] = useState<Corrida | null>(null);
  const [confirmar, setConfirmar] = useState<
    | { tipo: "todas" }
    | { tipo: "fotografo"; id: string; nombre: string; fotos: number }
    | { tipo: "quitar"; id: string; nombre: string }
    | null
  >(null);
  const [subiendoA, setSubiendoA] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const destino = useRef<string | null>(null);

  const n = (x: number) => x.toLocaleString("es-AR");

  async function correr(clave: string, opts: { userId?: string; force: boolean }) {
    setConfirmar(null);
    let cursor: string | null = null;
    let hechas = 0;
    let fallas = 0;
    let total = 0;
    setCorrida({ clave, corriendo: true, hechas, fallas, total, error: null });
    try {
      do {
        const r: Response = await fetch("/api/admin/watermark/regenerate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...opts, cursor }),
        });
        if (!r.ok) {
          setCorrida({ clave, corriendo: false, hechas, fallas, total, error: "Se cortó la regeneración." });
          return;
        }
        const d = (await r.json()) as {
          done: number;
          failed: number;
          cursor: string | null;
          total: number | null;
        };
        if (d.total != null) total = d.total;
        hechas += d.done;
        fallas += d.failed;
        cursor = d.cursor;
        setCorrida({ clave, corriendo: cursor !== null, hechas, fallas, total, error: null });
      } while (cursor);
    } catch {
      setCorrida({ clave, corriendo: false, hechas, fallas, total, error: "Se cortó la conexión." });
      return;
    }
    router.refresh();
  }

  async function subir(userId: string, archivo: File) {
    setAviso(null);
    if (archivo.type !== "image/png") {
      setAviso("Tiene que ser un PNG con transparencia.");
      return;
    }
    setSubiendoA(userId);
    try {
      const form = new FormData();
      form.append("watermark", archivo);
      const r = await fetch(`/api/admin/watermark/user?userId=${userId}`, { method: "POST", body: form });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setAviso(d.error ?? "No se pudo subir.");
        return;
      }
      router.refresh();
    } catch {
      setAviso("Se cortó la conexión.");
    } finally {
      setSubiendoA(null);
    }
  }

  async function quitar(userId: string) {
    setConfirmar(null);
    setSubiendoA(userId);
    try {
      await fetch(`/api/admin/watermark/user?userId=${userId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setSubiendoA(null);
    }
  }

  const barra = (c: Corrida) => (
    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
      <div className="barra-p">
        <i style={{ width: `${c.total > 0 ? Math.min(100, Math.round(((c.hechas + c.fallas) / c.total) * 100)) : c.corriendo ? 5 : 100}%` }} />
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
        <b className="tnum" style={{ fontWeight: 500, color: "var(--ink)" }}>{n(c.hechas)}</b>
        {c.total > 0 && <> de {n(c.total)}</>} regeneradas
        {c.fallas > 0 && (
          <>
            {" "}· <span style={{ color: "var(--bad-txt)" }}>{n(c.fallas)} fallaron</span>
          </>
        )}
        {c.error && <> · <span style={{ color: "var(--bad-txt)" }}>{c.error}</span></>}
        {!c.corriendo && !c.error && <> · <span style={{ color: "var(--ok-txt)" }}>listo</span></>}
      </div>
    </div>
  );

  const ocupado = !!corrida?.corriendo;

  return (
    <>
      <input
        ref={archivoRef}
        type="file"
        accept="image/png"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && destino.current) void subir(destino.current, f);
          e.target.value = "";
        }}
      />

      {/* ── Regenerar ── */}
      <section className="card">
        <div className="aj" style={{ padding: 0 }}>
          <div className="aj-t">
            <b>Lo ya procesado</b>
            <span>
              {sinPreview > 0 ? (
                <>
                  Hay{" "}
                  <b className="tnum" style={{ fontWeight: 500, color: "var(--acento-txt)" }}>{n(sinPreview)}</b>{" "}
                  fotos sin vista previa.{" "}
                </>
              ) : (
                <>Todas las fotos tienen vista previa. </>
              )}
              Después de cambiar la marca, regenerá todas para que la tienda la muestre: son{" "}
              {n(totalFotos)} fotos y tarda varios minutos con la pestaña abierta.
            </span>
            {corrida?.clave === "todas" && barra(corrida)}
          </div>
          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {sinPreview > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={ocupado}
                onClick={() => void correr("todas", { force: false })}
                data-tip="Sólo las que no tienen vista previa"
              >
                <RefreshCw /> Rellenar las que faltan
              </button>
            )}
            <button
              type="button"
              className="btn btn-pri"
              disabled={ocupado}
              onClick={() => setConfirmar({ tipo: "todas" })}
            >
              <RefreshCw /> {ocupado && corrida?.clave === "todas" ? "Regenerando…" : "Regenerar todas"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Por fotógrafo ── */}
      <section className="card">
        <div className="card-h">
          <div>
            <h2>Por fotógrafo</h2>
            <div className="sub">
              Quien sube su propio PNG lo lleva solo, sin el texto de la plataforma. Los demás llevan la marca
              de arriba.
            </div>
          </div>
        </div>
        {aviso && (
          <div style={{ fontSize: 12.5, color: "var(--bad-txt)", marginBottom: "var(--s-3)" }}>{aviso}</div>
        )}
        {fotografos.length === 0 ? (
          <div className="empty" style={{ padding: "var(--s-5) var(--s-4)" }}>
            <div className="empty-i">
              <Users />
            </div>
            <h3>No hay fotógrafos activos</h3>
          </div>
        ) : (
          fotografos.map((p) => (
            <div key={p.id} className="aj">
              <div className="aj-t">
                <b>
                  {p.nombre}{" "}
                  <span className={`pill ${p.propia ? "draft" : ""}`} style={{ marginLeft: 6, verticalAlign: 1 }}>
                    <i /> {p.propia ? "marca propia" : "marca de la plataforma"}
                  </span>
                </b>
                <span>{n(p.fotos)} fotos</span>
                {corrida?.clave === p.id && barra(corrida)}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={subiendoA === p.id || ocupado}
                  onClick={() => {
                    destino.current = p.id;
                    archivoRef.current?.click();
                  }}
                  data-tip={p.propia ? "Reemplazar su PNG" : "Subirle un PNG propio"}
                >
                  <Upload /> {subiendoA === p.id ? "Subiendo…" : p.propia ? "Reemplazar" : "PNG propio"}
                </button>
                {p.propia && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label="Quitar su marca"
                    data-tip="Quitar su marca: vuelve a la de la plataforma"
                    disabled={subiendoA === p.id || ocupado}
                    onClick={() => setConfirmar({ tipo: "quitar", id: p.id, nombre: p.nombre })}
                  >
                    <Trash2 />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={ocupado || p.fotos === 0}
                  onClick={() => setConfirmar({ tipo: "fotografo", id: p.id, nombre: p.nombre, fotos: p.fotos })}
                  data-tip="Regenerar sólo sus fotos"
                >
                  <RefreshCw /> Regenerar
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {confirmar?.tipo === "todas" && (
        <Confirmar
          titulo="Regenerar todas las vistas previas"
          cuerpo={
            <>
              Se vuelven a procesar {n(totalFotos)} fotos con la marca actual de cada fotógrafo. Tarda varios
              minutos y hay que dejar la pestaña abierta. Al terminar se limpia la caché de CloudFront.
            </>
          }
          accion="Regenerar"
          alConfirmar={() => void correr("todas", { force: true })}
          alCerrar={() => setConfirmar(null)}
        />
      )}
      {confirmar?.tipo === "fotografo" && (
        <Confirmar
          titulo={`Regenerar las de ${confirmar.nombre}`}
          cuerpo={<>Se vuelven a procesar {n(confirmar.fotos)} fotos con su marca actual.</>}
          accion="Regenerar"
          alConfirmar={() => void correr(confirmar.id, { userId: confirmar.id, force: true })}
          alCerrar={() => setConfirmar(null)}
        />
      )}
      {confirmar?.tipo === "quitar" && (
        <Confirmar
          titulo={`Quitar la marca de ${confirmar.nombre}`}
          cuerpo="Vuelve a la marca de la plataforma. Lo ya procesado no cambia hasta que regeneres sus fotos."
          accion="Quitar"
          peligro
          ocupado={subiendoA === confirmar.id}
          alConfirmar={() => void quitar(confirmar.id)}
          alCerrar={() => setConfirmar(null)}
        />
      )}
    </>
  );
}
