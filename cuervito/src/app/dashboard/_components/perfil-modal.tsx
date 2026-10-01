"use client";

import { useRouter } from "next/navigation";
import { AtSign, Camera, Check, Globe, LogOut, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { savePerfilAction } from "~/app/dashboard/perfil/actions";

import { cerrarSesionAction } from "./cuenta";

export type DatosPerfil = {
  name: string;
  slug: string;
  bio: string;
  instagramUrl: string;
  websiteUrl: string;
  /** URL de la foto, o null si no subió ninguna. */
  foto: string | null;
};

/**
 * El perfil, en un diálogo que se abre desde la tarjeta del riel.
 *
 * Era una página aparte con un ítem propio en el riel, para cuatro campos que
 * se tocan una vez. Como diálogo se abre encima de donde uno está y se cierra
 * volviendo ahí, sin perder la pantalla en la que se estaba trabajando.
 *
 * La previa de "así te ven" queda arriba, en chico: la foto (que se cambia
 * tocándola), el nombre y la dirección, que es lo que el atleta ve primero.
 *
 * La acción de guardado es LA MISMA de Mi página, importada: dos validaciones
 * del mismo dato terminan divergiendo.
 */
export function PerfilModal({ perfil, onCerrar }: { perfil: DatosPerfil; onCerrar: () => void }) {
  const router = useRouter();
  const [estado, accion, enviando] = useActionState(savePerfilAction, { error: null });
  const [d, setD] = useState(perfil);
  const primero = useRef<HTMLInputElement>(null);

  const avatar = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(perfil.foto);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => primero.current?.focus(), 60);
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
  }, [onCerrar]);

  // Guardado: el riel lo arma el layout, así que se refresca para que el
  // nombre nuevo aparezca ahí. El "Guardado" se deja ver un momento antes de
  // cerrar; cerrando en el acto no hay forma de saber si se guardó.
  useEffect(() => {
    if (!estado.saved) return;
    router.refresh();
    const id = setTimeout(onCerrar, 700);
    return () => clearTimeout(id);
  }, [estado, router, onCerrar]);

  async function subirFoto(f: File) {
    setSubiendoFoto(true);
    setErrorFoto(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      // El endpoint contesta previewUrl, no url.
      const data = (await r.json().catch(() => ({}))) as { previewUrl?: string; error?: string };
      if (!r.ok || !data.previewUrl) {
        setErrorFoto(data.error ?? "No se pudo subir la foto.");
        return;
      }
      setFoto(data.previewUrl);
      // La foto también sale en el riel, que lo arma el layout.
      router.refresh();
    } catch {
      setErrorFoto("No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  const iniciales =
    d.name
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  const campo = (k: "name" | "bio" | "instagramUrl" | "websiteUrl") => ({
    value: d[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setD({ ...d, [k]: e.target.value }),
  });

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perfil-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="modal-caja pm">
        <div className="modal-h">
          <div>
            <h2 id="perfil-titulo">Tu perfil</h2>
            <div className="sub">Lo que el atleta ve de vos, en tu página y en cada evento.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onCerrar} aria-label="Cerrar">
            <X />
          </button>
        </div>

        <form id="form-perfil" action={accion} className="modal-b">
          {/* La dirección no se cambia acá: vive en Mi página, que es donde se
              ve el link. Viaja igual porque el esquema de la acción la exige,
              y mandarla vacía la borraría. */}
          <input type="hidden" name="slug" value={perfil.slug} />

          <div className="pm-cab">
            {/* La foto se cambia tocándola: es el único lugar del diálogo
                donde se ve cómo va a quedar. */}
            <button
              type="button"
              className="foto-av editable"
              onClick={() => avatar.current?.click()}
              aria-label="Cambiar tu foto"
              disabled={subiendoFoto}
            >
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" />
              ) : (
                iniciales
              )}
              <span className="foto-av-tapa">
                <Camera />
              </span>
            </button>
            <input
              ref={avatar}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void subirFoto(f);
              }}
            />
            <div className="pm-quien">
              <b>{d.name || "Tu nombre"}</b>
              <span>encontrate.app/{perfil.slug}</span>
              <span className="pm-nota">
                {subiendoFoto ? "Subiendo la foto…" : foto ? "Tocá la foto para cambiarla" : "Tocá el círculo para subir tu foto"}
              </span>
            </div>
          </div>
          {errorFoto && <div className="pista" style={{ color: "var(--bad)" }}>{errorFoto}</div>}

          <div className="campo">
            <label htmlFor="pm-nombre">Nombre</label>
            <input ref={primero} className="inp" id="pm-nombre" name="name" autoComplete="name" {...campo("name")} />
            {estado.fieldErrors?.name && <div className="pista" style={{ color: "var(--bad)" }}>{estado.fieldErrors.name}</div>}
            {estado.fieldErrors?.slug && <div className="pista" style={{ color: "var(--bad)" }}>{estado.fieldErrors.slug}</div>}
          </div>

          <div className="campo">
            <label htmlFor="pm-bio">Bio</label>
            <textarea className="ta" id="pm-bio" name="bio" maxLength={280} {...campo("bio")} />
            {/* El contador aparece recién cerca del límite: siempre visible
                convierte escribir dos líneas en un examen. */}
            <div className="cuenta-c" data-cerca={d.bio.length > 240 ? "1" : ""} data-pasado={d.bio.length >= 280 ? "1" : ""}>
              {d.bio.length} / 280
            </div>
          </div>

          <div className="campo">
            <label>Redes</label>
            <div className="redes">
              <div className="red">
                <span className="red-i">
                  <AtSign />
                </span>
                <div className="pegado" style={{ flex: 1 }}>
                  <span className="fijo">instagram.com/</span>
                  <input className="inp" name="instagramUrl" aria-label="Instagram" {...campo("instagramUrl")} />
                </div>
              </div>
              <div className="red">
                <span className="red-i">
                  <Globe />
                </span>
                <input
                  className="inp"
                  name="websiteUrl"
                  aria-label="Tu sitio"
                  placeholder="https://tusitio.com"
                  style={{ flex: 1 }}
                  {...campo("websiteUrl")}
                />
              </div>
              {estado.fieldErrors?.websiteUrl && (
                <div className="pista" style={{ color: "var(--bad)" }}>{estado.fieldErrors.websiteUrl}</div>
              )}
            </div>
            <div className="pista">Se muestran como íconos en tu página. Dejá vacío lo que no uses.</div>
          </div>

          {estado.error && !estado.fieldErrors && (
            <div className="pista" style={{ color: "var(--bad)" }}>{estado.error}</div>
          )}
        </form>

        <div className="modal-f">
          {/* Afuera del formulario del perfil: un formulario no puede ir
              adentro de otro, y el de guardar se conecta por su id. */}
          <form action={cerrarSesionAction} className="pm-salir">
            <button type="submit" className="btn btn-ghost">
              <LogOut /> Cerrar sesión
            </button>
          </form>
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" form="form-perfil" className="btn btn-pri" disabled={enviando || estado.saved}>
            {estado.saved ? (
              <>
                <Check /> Guardado
              </>
            ) : enviando ? (
              "Guardando"
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
