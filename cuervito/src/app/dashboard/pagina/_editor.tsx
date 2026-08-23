"use client";

import { ImageOff, Pipette } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { savePerfilAction } from "~/app/dashboard/perfil/actions";
import { saveBrandColorAction, saveTemplateAction } from "~/app/dashboard/pagina/actions";

/**
 * Editor de la página pública, con la página REAL al lado.
 *
 * Lo que faltaba en la versión actual no eran las opciones, que estaban todas,
 * sino ver el resultado: para saber cómo quedaba un color había que guardar,
 * abrir la página en otra pestaña y volver. Eso convierte cada ajuste en un
 * viaje de ida y vuelta y termina en que nadie personaliza nada.
 *
 * La previa es un iframe de la página de verdad, reducido para entrar en el
 * marco, y no una maqueta dibujada. Una maqueta se desincroniza en cuanto la
 * página pública cambia y termina mintiendo justo donde más confianza hace
 * falta.
 *
 * Todas las acciones de guardado son LAS MISMAS del panel actual, importadas:
 * escribir unas nuevas dejaría dos validaciones del mismo dato listas para
 * divergir. La dirección va por savePerfilAction justamente porque ahí ya está
 * el control de que no esté tomada.
 */
const PLANTILLAS = [
  { id: "encontrate", nombre: "encontrate", muestra: "claro" },
  { id: "dark", nombre: "Oscuro", muestra: "oscuro" },
  { id: "feed", nombre: "Editorial", muestra: "editorial" },
] as const;

const COLORES = ["#F0410F", "#1E7A4D", "#1F5FBF", "#8B3FC4", "#12110F", "#C2185B"];

// Ancho con el que se renderiza la página adentro del iframe antes de reducir.
const ANCHO_ESCRITORIO = 1280;
const ANCHO_TELEFONO = 390;
const ALTO = 900;

export function Editor({
  perfil,
  colorInicial,
  plantillaInicial,
}: {
  perfil: { name: string; slug: string; bio: string; instagramUrl: string; websiteUrl: string };
  colorInicial: string;
  plantillaInicial: string;
}) {
  const [color, setColor] = useState(colorInicial);
  const [plantilla, setPlantilla] = useState(plantillaInicial);
  const [telefono, setTelefono] = useState(false);
  const [guardando, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  // La dirección va por la acción del perfil, que ya controla que no esté
  // tomada. Los demás campos viajan sin cambios en el mismo formulario: el
  // esquema los pide todos y mandarlos vacíos borraría la bio.
  const [estadoDir, guardarDir, guardandoDir] = useActionState(savePerfilAction, { error: null });
  const [slug, setSlug] = useState(perfil.slug);

  // El slug efectivo para la previa: el guardado, no el que se está tipeando.
  const [slugVivo, setSlugVivo] = useState(perfil.slug);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (estadoDir.saved) {
      setSlugVivo(slug);
      setVersion((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoDir]);

  function recargarPrevia() {
    setVersion((v) => v + 1);
  }

  function elegirColor(c: string) {
    setColor(c);
    empezar(async () => {
      const r = await saveBrandColorAction(c);
      setAviso(r.error ?? "Guardado");
      if (!r.error) recargarPrevia();
      setTimeout(() => setAviso(null), 1800);
    });
  }

  function elegirPlantilla(id: string) {
    setPlantilla(id);
    empezar(async () => {
      const r = await saveTemplateAction(id);
      setAviso(r.error ?? "Guardado");
      if (!r.error) recargarPrevia();
      setTimeout(() => setAviso(null), 1800);
    });
  }

  // La escala sale del ancho real del marco: con un número fijo, la previa se
  // desalinea en cuanto la ventana cambia de tamaño.
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.35);
  const ancho = telefono ? ANCHO_TELEFONO : ANCHO_ESCRITORIO;

  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / ancho);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ancho]);

  return (
    <div className="tienda">
      <div className="ctrl">
        <form action={guardarDir}>
          {/* Los demás campos del perfil viajan intactos: el esquema de la
              acción los exige, y mandarlos vacíos borraría la bio y las redes
              al cambiar sólo la dirección. */}
          <input type="hidden" name="name" value={perfil.name} />
          <input type="hidden" name="bio" value={perfil.bio} />
          <input type="hidden" name="instagramUrl" value={perfil.instagramUrl} />
          <input type="hidden" name="websiteUrl" value={perfil.websiteUrl} />

          <section className="card blq">
            <h2>Dirección</h2>
            <p className="ayuda">Es el link que compartís. Cambiarlo rompe los que ya repartiste.</p>
            <div className="blq-b">
              <div className="dom">
                <span className="fijo">encontrate.app/</span>
                <input
                  name="slug"
                  value={slug}
                  aria-label="Tu dirección"
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                />
              </div>

              {estadoDir.fieldErrors?.slug ? (
                <div className="pista" style={{ color: "var(--bad)" }}>
                  {estadoDir.fieldErrors.slug}
                </div>
              ) : estadoDir.error ? (
                <div className="pista" style={{ color: "var(--bad)" }}>{estadoDir.error}</div>
              ) : estadoDir.saved ? (
                <div className="dom-est">Dirección actualizada</div>
              ) : null}

              <div className="propio">
                <span>
                  {slug !== slugVivo ? "Sin guardar" : "En uso"}
                </span>
                <button
                  className="btn btn-pri btn-sm"
                  type="submit"
                  disabled={guardandoDir || slug === slugVivo || slug.length < 3}
                >
                  {guardandoDir ? "Guardando" : "Cambiar dirección"}
                </button>
              </div>
            </div>
          </section>
        </form>

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
            <span className="url">encontrate.app/{slugVivo}</span>
          </div>

          <div className="previa-real" ref={marco} style={{ height: ALTO * escala }}>
            {slugVivo ? (
              <iframe
                key={`${slugVivo}-${version}-${telefono ? "t" : "e"}`}
                src={`/${slugVivo}`}
                title="Previa de tu página"
                width={ancho}
                height={ALTO}
                style={{ transform: `scale(${escala})` }}
                loading="lazy"
              />
            ) : (
              <div className="previa-vacia">
                <ImageOff />
                <span>Elegí una dirección para ver tu página.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
