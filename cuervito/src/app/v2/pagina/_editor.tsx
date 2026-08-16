"use client";

import Link from "next/link";
import { ArrowRight, Pipette, Search } from "lucide-react";
import { useState, useTransition } from "react";

import { saveBrandColorAction, saveTemplateAction } from "~/app/dashboard/tienda/actions";

/**
 * Editor de la página pública, con la previa al lado.
 *
 * Lo que faltaba en la versión actual no eran las opciones, que estaban todas,
 * sino ver el resultado: para saber cómo quedaba un color había que guardar,
 * abrir la página en otra pestaña y volver. Eso convierte cada ajuste en un
 * viaje de ida y vuelta y termina en que nadie personaliza nada.
 *
 * Las acciones de guardado son LAS MISMAS del panel actual, importadas. Escribir
 * unas nuevas acá significaría dos validaciones del mismo dato, listas para
 * divergir.
 */
const PLANTILLAS = [
  { id: "light", nombre: "Claro", muestra: "claro" },
  { id: "dark", nombre: "Oscuro", muestra: "oscuro" },
  { id: "feed", nombre: "Editorial", muestra: "editorial" },
] as const;

const COLORES = ["#F0410F", "#1E7A4D", "#1F5FBF", "#8B3FC4", "#12110F", "#C2185B"];

export function Editor({
  slug,
  nombre,
  colorInicial,
  plantillaInicial,
  fotos,
}: {
  slug: string;
  nombre: string;
  colorInicial: string;
  plantillaInicial: string;
  fotos: number;
}) {
  const [color, setColor] = useState(colorInicial);
  const [plantilla, setPlantilla] = useState(plantillaInicial);
  const [telefono, setTelefono] = useState(false);
  const [guardando, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  function elegirColor(c: string) {
    setColor(c); // la previa cambia en el acto; el guardado va detrás
    empezar(async () => {
      const r = await saveBrandColorAction(c);
      setAviso(r.error ?? "Guardado");
      setTimeout(() => setAviso(null), 1800);
    });
  }

  function elegirPlantilla(id: string) {
    setPlantilla(id);
    empezar(async () => {
      const r = await saveTemplateAction(id);
      setAviso(r.error ?? "Guardado");
      setTimeout(() => setAviso(null), 1800);
    });
  }

  const muestra = PLANTILLAS.find((p) => p.id === plantilla)?.muestra ?? "claro";

  return (
    <div className="tienda">
      <div className="ctrl">
        <section className="card blq">
          <h2>Dirección</h2>
          <p className="ayuda">Es el link que compartís. Cambiarlo rompe los que ya repartiste.</p>
          <div className="blq-b">
            <div className="dom">
              <span className="fijo">encontrate.app/</span>
              <input value={slug} readOnly aria-label="Tu dirección" />
            </div>
            <div className="propio">
              <span>La dirección se cambia desde Perfil.</span>
              <Link href="/v2/perfil" className="btn btn-ghost btn-sm">
                Ir a Perfil
              </Link>
            </div>
          </div>
        </section>

        <section className="card blq">
          <h2>Plantilla</h2>
          <p className="ayuda">Cómo se ve tu galería. Se aplica a todos tus eventos.</p>
          <div className="blq-b plt">
            {PLANTILLAS.map((p) => (
              <label className="pl" key={p.id}>
                <input
                  type="radio"
                  name="plantilla"
                  value={p.id}
                  checked={plantilla === p.id}
                  onChange={() => elegirPlantilla(p.id)}
                />
                {/* Miniaturas y no una lista de nombres: "Editorial" no le dice
                    nada a nadie hasta que lo ve. */}
                <span className="pl-v" data-t={p.muestra}>
                  <i className="barra-m" />
                  <span className="rejilla">
                    {Array.from({ length: p.muestra === "editorial" ? 4 : 6 }).map((_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                </span>
                <span className="pl-n">{p.nombre}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="card blq">
          <h2>Color</h2>
          <p className="ayuda">
            Se usa en los botones y los enlaces. Nada más: si tiñe toda la página, compite con las
            fotos.
          </p>
          <div className="blq-b cols">
            {COLORES.map((c) => (
              <button
                type="button"
                key={c}
                className="co"
                style={{ background: c }}
                aria-pressed={color.toUpperCase() === c.toUpperCase()}
                aria-label={`Color ${c}`}
                onClick={() => elegirColor(c)}
              />
            ))}
            <span className="co-libre">
              <Pipette />
              <input
                type="color"
                value={color}
                aria-label="Color a medida"
                onChange={(e) => setColor(e.target.value)}
                onBlur={(e) => elegirColor(e.target.value)}
              />
            </span>
            {(guardando || aviso) && (
              <span style={{ fontSize: 12.5, color: "var(--ink-3)", marginLeft: "auto" }}>
                {guardando ? "Guardando…" : aviso}
              </span>
            )}
          </div>
        </section>
      </div>

      <div className="previa">
        <div className="previa-h">
          <span className="label">Así se ve</span>
          <div className="seg">
            <button type="button" aria-pressed={!telefono} onClick={() => setTelefono(false)}>
              Escritorio
            </button>
            <button type="button" aria-pressed={telefono} onClick={() => setTelefono(true)}>
              Teléfono
            </button>
          </div>
        </div>

        <div className="marco" style={telefono ? { maxWidth: 330, margin: "0 auto" } : undefined}>
          <div className="crome">
            <i />
            <i />
            <i />
            <span className="url">encontrate.app/{slug}</span>
          </div>

          {/* La previa define sus propias variables de color y no hereda las
              del panel: si heredara, poner el panel en oscuro le cambiaría la
              página al fotógrafo sin que él haya tocado nada. */}
          <div className="sf" data-t={muestra} style={{ ["--sf-acc" as string]: color }}>
            <div className="sf-top">
              <div className="sf-marca">
                <span className="sf-logo">
                  {nombre.slice(0, 2).toUpperCase()}
                </span>
                <b>{nombre}</b>
              </div>
              <span className="sf-buscar">
                <Search /> Buscar mi cara
              </span>
            </div>

            <div className="sf-hero">
              <h3>Tus fotos del evento</h3>
              <p>{fotos.toLocaleString("es-AR")} fotos publicadas</p>
              <span className="sf-cta">
                Buscarme <ArrowRight />
              </span>
            </div>

            <div className="sf-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="sf-ph" key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
