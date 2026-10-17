"use client";

import { ImageOff, Monitor, Pipette, Smartphone, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { savePerfilAction } from "~/app/dashboard/perfil/actions";
import { saveBrandColorAction, saveTemplateAction } from "~/app/dashboard/pagina/actions";
import { acento2De, acentoDe, getTemplate } from "~/lib/storefront-templates";

import { Dominio } from "./_dominio";
import { COLORES, Plantillas, type Colores } from "./_plantillas";

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
 *
 * La plantilla tiene su propia pieza (_plantillas.tsx): la tarjeta muestra la
 * que está en uso y el diálogo deja mirar las demás con la página de verdad,
 * cambiando los colores sobre la marcha.
 */

// Ancho con el que se renderiza la página adentro del iframe antes de reducir.
const ANCHO_ESCRITORIO = 1280;
const ANCHO_TELEFONO = 390;
const ALTO = 900;

const igual = (a: string | null, b: string) => (a ?? "").toUpperCase() === b.toUpperCase();

export function Editor({
  perfil,
  colorInicial,
  color2Inicial,
  plantillaInicial,
  logoInicial,
}: {
  perfil: { name: string; slug: string; bio: string; instagramUrl: string; websiteUrl: string };
  /** El color de marca guardado. Null si nunca eligió: la página lleva el
   *  acento de fábrica de su plantilla. */
  colorInicial: string | null;
  /** El secundario guardado, para las plantillas de dos colores. */
  color2Inicial: string | null;
  plantillaInicial: string;
  /** El logo que ya subió, resuelto a URL. Null si no tiene. */
  logoInicial: string | null;
}) {
  const [color, setColor] = useState<string | null>(colorInicial);
  const [color2, setColor2] = useState<string | null>(color2Inicial);
  const [plantilla, setPlantilla] = useState(plantillaInicial);
  const router = useRouter();
  const [telefono, setTelefono] = useState(false);

  const archivoLogo = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(logoInicial);
  const [tocandoLogo, setTocandoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  async function subirLogo(f: File) {
    // El archivo se ve en la caja apenas se elige, antes de que termine de
    // subir: la subida tarda y mientras tanto el fotógrafo tiene que ver que
    // eligió bien. Si falla, vuelve el anterior.
    const anterior = logo;
    const local = URL.createObjectURL(f);
    setLogo(local);
    setTocandoLogo(true);
    setErrorLogo(null);
    try {
      const fd = new FormData();
      // El endpoint espera el campo "logo", no "file": no es el de la foto
      // de perfil aunque se le parezca.
      fd.append("logo", f);
      const r = await fetch("/api/dashboard/logo", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !d.url) {
        setLogo(anterior);
        setErrorLogo(d.error ?? "No se pudo subir el logo.");
        return;
      }
      // La URL de verdad, que cambia con cada subida (la clave de S3 lleva
      // versión). Con la misma URL de siempre, el navegador seguía mostrando
      // el logo anterior desde su caché: "subí otro logo y no cambió".
      setLogo(d.url);
      // La previa lo lleva en la barra: se recarga para que lo muestre.
      recargarPrevia();
      router.refresh();
    } catch {
      setLogo(anterior);
      setErrorLogo("No se pudo subir el logo.");
    } finally {
      URL.revokeObjectURL(local);
      setTocandoLogo(false);
    }
  }

  async function quitarLogo() {
    setTocandoLogo(true);
    setErrorLogo(null);
    try {
      const r = await fetch("/api/dashboard/logo", { method: "DELETE" });
      if (!r.ok) {
        setErrorLogo("No se pudo quitar el logo.");
        return;
      }
      setLogo(null);
      recargarPrevia();
      router.refresh();
    } catch {
      setErrorLogo("No se pudo quitar el logo.");
    } finally {
      setTocandoLogo(false);
    }
  }
  const [guardando, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  function avisar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 1800);
  }

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

  function elegirColor(c: string, cual: 1 | 2 = 1) {
    if (cual === 2) setColor2(c);
    else setColor(c);
    empezar(async () => {
      const r = await saveBrandColorAction(c, cual);
      avisar(r.error ?? "Guardado");
      if (!r.error) recargarPrevia();
    });
  }

  // La elige el diálogo de plantillas, que espera la respuesta para cerrarse.
  // La tarjeta cambia en el acto y vuelve atrás si no se pudo guardar. Los
  // colores viajan con ella: son los que el fotógrafo vio al elegirla.
  async function elegirPlantilla(id: string, colores: Colores | null): Promise<boolean> {
    const anterior = { plantilla, color, color2 };
    setPlantilla(id);
    if (colores) {
      setColor(colores.color);
      if (colores.color2) setColor2(colores.color2);
    }
    const r = await saveTemplateAction(
      id,
      colores ? { color: colores.color, ...(colores.color2 ? { color2: colores.color2 } : {}) } : undefined,
    );
    if (r.error) {
      setPlantilla(anterior.plantilla);
      setColor(anterior.color);
      setColor2(anterior.color2);
      avisar(r.error);
      return false;
    }
    avisar("Guardado");
    recargarPrevia();
    return true;
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

  // Lo que la página dibuja hoy: el color elegido, o el de fábrica de la
  // plantilla si nunca eligió uno.
  const tpl = getTemplate(plantilla);
  const colorVivo = color ?? acentoDe(tpl);
  const color2Vivo = tpl.tema?.dosColores ? (color2 ?? acento2De(tpl)) : null;

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

              <Dominio slug={slugVivo} />
            </div>
          </section>
        </form>

        <section className="card blq">
          <h2>Plantilla</h2>
          <p className="ayuda">
            Cómo se ve tu página y cada uno de tus eventos. Miralas con tus fotos antes de
            cambiar.
          </p>
          <div className="blq-b">
            <Plantillas actual={plantilla} color={color} color2={color2} onElegir={elegirPlantilla} />
          </div>
        </section>

        <section className="card blq">
          <h2>Tu logo</h2>
          <p className="ayuda">
            Reemplaza tu nombre arriba de la página. Si no subís ninguno, va tu nombre y la
            dirección, que es un logo provisional: sirve hasta que tengas el tuyo.
          </p>
          <div className="blq-b">
            <div className="logo-fila">
              {/* Sobre tinta y no sobre papel: la mayoría de los logos vienen en
                  blanco o con el fondo transparente, y sobre claro no se ven. */}
              <div className="logo-caja" data-vacia={logo ? undefined : "1"}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="Tu logo" />
                ) : (
                  <ImageOff />
                )}
              </div>

              <div className="logo-acc">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => archivoLogo.current?.click()}
                  disabled={tocandoLogo}
                >
                  <Upload /> {logo ? "Cambiar" : "Subir logo"}
                </button>
                {logo && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void quitarLogo()}
                    disabled={tocandoLogo}
                  >
                    <Trash2 /> Quitar
                  </button>
                )}
                <span className="logo-nota">PNG, JPG o WebP · hasta 3 MB</span>
              </div>
            </div>

            <input
              ref={archivoLogo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Se limpia el input para que elegir el MISMO archivo otra vez
                // vuelva a disparar el change.
                e.target.value = "";
                if (f) void subirLogo(f);
              }}
            />

            {errorLogo && (
              <div className="pista" style={{ color: "var(--bad)" }}>
                {errorLogo}
              </div>
            )}
          </div>
        </section>

        <section className="card blq">
          <h2>Color</h2>
          <p className="ayuda">
            {tpl.tema?.dosColores
              ? "El principal va en la banda y el carrito; el secundario, en todo lo que se compra."
              : "Se usa en los botones y los enlaces. Nada más: si tiñe toda la página, compite con las fotos."}
          </p>
          <div className="blq-b cols">
            {COLORES.map((c) => (
              <button
                type="button"
                key={c}
                className="co"
                style={{ background: c }}
                aria-pressed={igual(colorVivo, c)}
                aria-label={`Color ${c}`}
                onClick={() => elegirColor(c)}
              />
            ))}
            <span className="co-libre">
              <Pipette />
              <input
                type="color"
                value={colorVivo}
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
          {/* El secundario, sólo cuando la plantilla lo dibuja: un segundo
              color en una plantilla de uno es un control que no hace nada. */}
          {tpl.tema?.dosColores && color2Vivo && (
            <div className="blq-b cols">
              <span className="co-etq">Secundario</span>
              {COLORES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className="co"
                  style={{ background: c }}
                  aria-pressed={igual(color2Vivo, c)}
                  aria-label={`Color secundario ${c}`}
                  onClick={() => elegirColor(c, 2)}
                />
              ))}
              <span className="co-libre">
                <Pipette />
                <input
                  type="color"
                  value={color2Vivo}
                  aria-label="Color secundario a medida"
                  onChange={(e) => setColor2(e.target.value)}
                  onBlur={(e) => elegirColor(e.target.value, 2)}
                />
              </span>
            </div>
          )}
        </section>
      </div>

      <div className="previa">
        <div className="previa-h">
          <span className="label">Así se ve</span>
          <div className="seg seg-ico">
            <button
              type="button"
              aria-pressed={!telefono}
              aria-label="Escritorio"
              title="Escritorio"
              onClick={() => setTelefono(false)}
            >
              <Monitor />
            </button>
            <button
              type="button"
              aria-pressed={telefono}
              aria-label="Teléfono"
              title="Teléfono"
              onClick={() => setTelefono(true)}
            >
              <Smartphone />
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
