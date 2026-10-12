"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { eventosParaElegirAction, fotosDeEventoAction, type FotoParaElegir, guardarFotosAction } from "../acciones";

export type FotoPanel = { photoId: string; src: string; lista: boolean };
export type GrupoPanel = { nombre: string; fotos: FotoPanel[] };

/**
 * Las fotos del portfolio por grupo (serie). Cada cambio se guarda al toque,
 * con la lista entera: el orden de las fotos es el orden en la página.
 *
 * Se ordena arrastrando (con mouse) o con las flechas: arrastrar en un
 * teléfono pelea con el scroll, y ahí las flechas hacen lo mismo con un
 * toque. Las dos cosas terminan en `guardar` con la lista entera.
 */
export function Fotos({ portfolioId, grupos: iniciales }: { portfolioId: string; grupos: GrupoPanel[] }) {
  const [grupos, setGrupos] = useState(iniciales);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const [agregando, setAgregando] = useState(false);
  /* El arrastre: qué foto se lleva, y dónde caería (la foto bajo el puntero y
     de qué lado, o el final de un grupo cuando fi es su largo). */
  const [arrastre, setArrastre] = useState<{ gi: number; fi: number } | null>(null);
  const [sobre, setSobre] = useState<{ gi: number; fi: number; lado: "antes" | "despues" } | null>(null);

  // Lo que manda el servidor después de guardar (versiones nuevas listas).
  useEffect(() => setGrupos(iniciales), [iniciales]);

  const total = grupos.reduce((a, g) => a + g.fotos.length, 0);
  const sinVersion = grupos.reduce((a, g) => a + g.fotos.filter((f) => !f.lista).length, 0);

  function guardar(nuevos: GrupoPanel[]) {
    const limpios = nuevos.filter((g) => g.fotos.length > 0);
    setGrupos(limpios);
    setError(null);
    empezar(async () => {
      const r = await guardarFotosAction(
        portfolioId,
        limpios.flatMap((g) => g.fotos.map((f) => ({ photoId: f.photoId, grupo: g.nombre }))),
      );
      if (r.error) setError(r.error);
    });
  }

  const editar = (gi: number, fn: (g: GrupoPanel) => GrupoPanel) =>
    guardar(grupos.map((g, i) => (i === gi ? fn(g) : g)));

  function mover<T>(xs: T[], i: number, d: number): T[] {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const c = [...xs];
    [c[i], c[j]] = [c[j]!, c[i]!];
    return c;
  }

  function renombrar(gi: number, nombre: string) {
    const n = nombre.trim();
    if (!n || n === grupos[gi]?.nombre) return;
    // Si ya hay un grupo con ese nombre, se juntan.
    const destino = grupos.findIndex((g, i) => i !== gi && g.nombre === n);
    if (destino >= 0) {
      const juntos = grupos.map((g, i) => (i === destino ? { ...g, fotos: [...g.fotos, ...grupos[gi]!.fotos] } : g));
      guardar(juntos.filter((_, i) => i !== gi));
    } else {
      editar(gi, (g) => ({ ...g, nombre: n }));
    }
  }

  function portada(gi: number, fi: number) {
    // La portada es la primera foto del portfolio: su grupo pasa adelante y
    // ella primera dentro de él.
    const g = grupos[gi]!;
    const f = g.fotos[fi]!;
    const grupo = { ...g, fotos: [f, ...g.fotos.filter((_, i) => i !== fi)] };
    guardar([grupo, ...grupos.filter((_, i) => i !== gi)]);
  }

  function agregar(nuevas: { photoId: string; src: string; grupo: string }[]) {
    const ya = new Set(grupos.flatMap((g) => g.fotos.map((f) => f.photoId)));
    let copia = grupos.map((g) => ({ ...g, fotos: [...g.fotos] }));
    for (const n of nuevas) {
      if (ya.has(n.photoId)) continue;
      let g = copia.find((x) => x.nombre === n.grupo);
      if (!g) {
        g = { nombre: n.grupo, fotos: [] };
        copia = [...copia, g];
      }
      g.fotos.push({ photoId: n.photoId, src: n.src, lista: false });
    }
    guardar(copia);
    setAgregando(false);
  }

  /** Suelta la foto arrastrada donde está el puntero, también en otro grupo. */
  function soltar() {
    const de = arrastre;
    const a = sobre;
    setArrastre(null);
    setSobre(null);
    if (!de || !a) return;
    const copia = grupos.map((g) => ({ ...g, fotos: [...g.fotos] }));
    const [foto] = copia[de.gi]!.fotos.splice(de.fi, 1);
    if (!foto) return;
    let destino = a.lado === "antes" ? a.fi : a.fi + 1;
    // Sacarla de antes corre un lugar a las que venían después.
    if (a.gi === de.gi && de.fi < destino) destino--;
    if (a.gi === de.gi && destino === de.fi) return;
    copia[a.gi]!.fotos.splice(destino, 0, foto);
    guardar(copia);
  }

  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>
            {total} {total === 1 ? "foto" : "fotos"} en {grupos.length} {grupos.length === 1 ? "grupo" : "grupos"}
          </h2>
          <div className="sub">Cada grupo es una serie en la página. El nombre del grupo se ve: cambialo si querés.</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAgregando(true)}>
          <Plus /> Agregar fotos
        </button>
      </div>

      {sinVersion > 0 && (
        <p className="pista" style={{ marginBottom: 8 }}>
          Preparando {sinVersion} {sinVersion === 1 ? "foto" : "fotos"} sin marca de agua. Mientras tanto no aparecen en la página.
        </p>
      )}
      {error && <p className="pfa-error" role="alert">{error}</p>}

      {grupos.map((g, gi) => (
        <div key={g.nombre} className="pf-grupo">
          <div className="pf-grupo-h">
            <input
              defaultValue={g.nombre}
              aria-label="Nombre del grupo"
              maxLength={80}
              size={Math.max(8, g.nombre.length)}
              onBlur={(e) => renombrar(gi, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <small>{g.fotos.length} {g.fotos.length === 1 ? "foto" : "fotos"}</small>
            <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
              <button type="button" className="btn btn-icon btn-sm btn-quiet" aria-label="Subir el grupo" disabled={gi === 0} onClick={() => guardar(mover(grupos, gi, -1))}>
                <ArrowUp />
              </button>
              <button type="button" className="btn btn-icon btn-sm btn-quiet" aria-label="Bajar el grupo" disabled={gi === grupos.length - 1} onClick={() => guardar(mover(grupos, gi, 1))}>
                <ArrowDown />
              </button>
            </span>
          </div>
          <div
            className="pf-tira"
            onDragOver={(e) => {
              // Sobre el espacio del grupo, y no sobre una foto: va al final.
              if (!arrastre) return;
              e.preventDefault();
              setSobre((s) => (s?.gi === gi && s.fi === g.fotos.length ? s : { gi, fi: g.fotos.length, lado: "antes" }));
            }}
            onDrop={(e) => {
              e.preventDefault();
              soltar();
            }}
          >
            {g.fotos.map((f, fi) => (
              <div
                key={f.photoId}
                className="pf-mini"
                draggable
                data-arrastrando={arrastre?.gi === gi && arrastre.fi === fi ? "" : undefined}
                data-sobre={sobre?.gi === gi && sobre.fi === fi ? sobre.lado : undefined}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", f.photoId);
                  setArrastre({ gi, fi });
                }}
                onDragEnd={() => {
                  setArrastre(null);
                  setSobre(null);
                }}
                onDragOver={(e) => {
                  if (!arrastre) return;
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "move";
                  const r = e.currentTarget.getBoundingClientRect();
                  const lado = e.clientX < r.left + r.width / 2 ? "antes" : "despues";
                  setSobre((s) => (s?.gi === gi && s.fi === fi && s.lado === lado ? s : { gi, fi, lado }));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  soltar();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.src} alt="" loading="lazy" />
                {gi === 0 && fi === 0 && <span className="tag">Portada</span>}
                {!f.lista && !(gi === 0 && fi === 0) && <span className="esperando">Preparando</span>}
                <div className="acc">
                  <button type="button" aria-label="Mover a la izquierda" onClick={() => editar(gi, (x) => ({ ...x, fotos: mover(x.fotos, fi, -1) }))}>
                    <ArrowLeft />
                  </button>
                  <button type="button" aria-label="Mover a la derecha" onClick={() => editar(gi, (x) => ({ ...x, fotos: mover(x.fotos, fi, 1) }))}>
                    <ArrowRight />
                  </button>
                  <button type="button" aria-label="Usar de portada" onClick={() => portada(gi, fi)}>
                    <Star />
                  </button>
                  <button type="button" aria-label="Sacar del portfolio" onClick={() => editar(gi, (x) => ({ ...x, fotos: x.fotos.filter((_, i) => i !== fi) }))}>
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
            {arrastre && (
              <div className="pf-tira-fin" aria-hidden="true" data-sobre={sobre?.gi === gi && sobre.fi === g.fotos.length ? "" : undefined} />
            )}
          </div>
        </div>
      ))}

      {agregando && <Agregar onCerrar={() => setAgregando(false)} onAgregar={agregar} yaEstan={new Set(grupos.flatMap((g) => g.fotos.map((f) => f.photoId)))} />}
    </section>
  );
}

/** Un diálogo para sumar fotos de cualquier evento. */
function Agregar({
  onCerrar,
  onAgregar,
  yaEstan,
}: {
  onCerrar: () => void;
  onAgregar: (fotos: { photoId: string; src: string; grupo: string }[]) => void;
  yaEstan: Set<string>;
}) {
  const [eventos, setEventos] = useState<{ id: string; nombre: string; fotos: number }[] | null>(null);
  const [evento, setEvento] = useState<string | null>(null);
  const [fotos, setFotos] = useState<FotoParaElegir[] | null>(null);
  const [elegidas, setElegidas] = useState<Map<string, { photoId: string; src: string; grupo: string }>>(new Map());

  useEffect(() => {
    void eventosParaElegirAction().then((e) => {
      setEventos(e);
      setEvento(e[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!evento) return;
    setFotos(null);
    void fotosDeEventoAction(evento, "vendidas").then((r) => setFotos(r.fotos));
  }, [evento]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  const nombreEvento = eventos?.find((e) => e.id === evento)?.nombre ?? "";

  return (
    <div className="pfa" role="dialog" aria-modal="true" aria-label="Agregar fotos" style={{ zIndex: 80 }}>
      <header className="pfa-barra">
        <span className="volver" style={{ fontWeight: 500, color: "var(--ink)" }}>Agregar fotos</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={onCerrar}>
          <X />
        </button>
      </header>
      <div className="pfa-cuerpo">
        <aside className="pfa-eventos">
          <span className="cap">Tus eventos</span>
          {eventos?.map((e) => (
            <button key={e.id} type="button" className="pfa-evento" aria-current={e.id === evento} onClick={() => setEvento(e.id)}>
              <div>
                <b>{e.nombre}</b>
                <small>{e.fotos.toLocaleString("es-AR")} fotos</small>
              </div>
            </button>
          ))}
        </aside>
        <section className="pfa-fotos">
          <div className="pfa-grilla">
            {fotos?.map((f) => {
              const esta = yaEstan.has(f.id);
              const elegida = elegidas.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className="pfa-foto"
                  aria-pressed={elegida || esta}
                  disabled={esta}
                  title={esta ? "Ya está en el portfolio" : undefined}
                  onClick={() =>
                    setElegidas((m) => {
                      const c = new Map(m);
                      if (c.has(f.id)) c.delete(f.id);
                      else c.set(f.id, { photoId: f.id, src: f.src, grupo: nombreEvento });
                      return c;
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.src} alt="" loading="lazy" />
                  <span className="marca">{elegida || esta ? "✓" : ""}</span>
                  {f.ventas > 0 && <span className="ventas">{f.ventas} {f.ventas === 1 ? "venta" : "ventas"}</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <footer className="pfa-pie">
        <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
        <div className="medio">
          {elegidas.size > 0 && <b>{elegidas.size} {elegidas.size === 1 ? "elegida" : "elegidas"}</b>}
        </div>
        <button type="button" className="btn btn-pri" disabled={elegidas.size === 0} onClick={() => onAgregar([...elegidas.values()])}>
          Agregar
        </button>
      </footer>
    </div>
  );
}
