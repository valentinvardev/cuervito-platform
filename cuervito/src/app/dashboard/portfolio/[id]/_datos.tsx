"use client";

import { useState, useTransition } from "react";

import { guardarDatosAction } from "../acciones";

type Datos = { nombre: string; slug: string; seoTitulo: string; seoDescripcion: string };

/**
 * Nombre, dirección y lo que muestra Google. Con la vista de cómo sale en un
 * resultado de búsqueda, que es lo que hace entender para qué sirve cada campo.
 */
export function Datos({ portfolioId, slugFotografo, inicial }: { portfolioId: string; slugFotografo: string; inicial: Datos }) {
  const [d, setD] = useState(inicial);
  const [estado, setEstado] = useState<{ error: string | null; ok: boolean }>({ error: null, ok: false });
  const [pendiente, empezar] = useTransition();

  const cambiar = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEstado({ error: null, ok: false });
    setD((x) => ({ ...x, [k]: k === "slug" ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") : e.target.value }));
  };

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    empezar(async () => {
      const r = await guardarDatosAction(portfolioId, {
        nombre: d.nombre,
        slug: d.slug,
        seoTitulo: d.seoTitulo || undefined,
        seoDescripcion: d.seoDescripcion || undefined,
      });
      setEstado({ error: r.error, ok: !r.error });
    });
  }

  const tituloSerp = d.seoTitulo || `${d.nombre} · Portfolio`;
  const descSerp = d.seoDescripcion || "Si la dejás vacía usamos tu bio.";

  return (
    <form className="card pf-form" onSubmit={guardar}>
      <div className="campo">
        <label htmlFor="pf-d-nombre">Nombre</label>
        <input id="pf-d-nombre" className="inp" value={d.nombre} maxLength={80} onChange={cambiar("nombre")} />
        <span className="pista">Para vos, en el panel. No aparece en la página.</span>
      </div>

      <div className="campo">
        <label htmlFor="pf-d-slug">Dirección</label>
        <div className="pfa-dir">
          <span>encontrate.app/{slugFotografo}/p/</span>
          <input id="pf-d-slug" value={d.slug} maxLength={60} onChange={cambiar("slug")} />
        </div>
        {d.slug !== inicial.slug && (
          <span className="pista">Si ya la compartiste, la dirección vieja deja de funcionar.</span>
        )}
      </div>

      <div className="campo">
        <label htmlFor="pf-d-titulo">Título en Google</label>
        <input id="pf-d-titulo" className="inp" value={d.seoTitulo} maxLength={90} placeholder={`${d.nombre} · Portfolio`} onChange={cambiar("seoTitulo")} />
        <span className={`pf-cuenta${d.seoTitulo.length > 70 ? " pasado" : ""}`}>{d.seoTitulo.length} / 70</span>
      </div>

      <div className="campo">
        <label htmlFor="pf-d-desc">Descripción en Google</label>
        <textarea id="pf-d-desc" className="ta" rows={3} value={d.seoDescripcion} maxLength={200} placeholder="Fotografía deportiva en Córdoba: maratones, trails y ciclismo." onChange={cambiar("seoDescripcion")} />
        <span className={`pf-cuenta${d.seoDescripcion.length > 160 ? " pasado" : ""}`}>{d.seoDescripcion.length} / 160</span>
      </div>

      <div className="pf-serp" aria-label="Así se vería en Google">
        <small>encontrate.app › {slugFotografo} › p › {d.slug}</small>
        <b>{tituloSerp}</b>
        <span>{descSerp}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn btn-pri" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {estado.ok && <span className="pista">Guardado.</span>}
        {estado.error && <span className="pfa-error" role="alert">{estado.error}</span>}
      </div>
    </form>
  );
}
