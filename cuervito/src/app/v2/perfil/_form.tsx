"use client";

import { AtSign, Globe } from "lucide-react";
import { useActionState, useState } from "react";

import { savePerfilAction } from "~/app/dashboard/perfil/actions";

/**
 * Perfil, con la previa de lo que ve el atleta al lado.
 *
 * La versión actual mezclaba en una sola lista de campos lo que se publica y
 * lo que es de la cuenta, y el resultado es que nadie sabe cuál de los datos
 * que está escribiendo va a aparecer en su página. Acá van separados y la
 * parte pública se rotula como tal.
 *
 * La acción de guardado es LA MISMA del panel actual, importada: dos
 * validaciones del mismo dato terminan divergiendo.
 */
export function FormPerfil({
  inicial,
}: {
  inicial: { name: string; slug: string; bio: string; instagramUrl: string; websiteUrl: string };
}) {
  const [estado, accion, enviando] = useActionState(savePerfilAction, { error: null });
  const [d, setD] = useState(inicial);

  const iniciales =
    d.name
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  const campo = (k: keyof typeof d) => ({
    value: d[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setD({ ...d, [k]: e.target.value }),
  });

  return (
    <form action={accion} className="perfil">
      <div className="pcol">
        <section className="card blq">
          <h2>Tu perfil público</h2>
          <p className="ayuda">Aparece en tu página y en cada evento que publicás.</p>

          <div className="blq-b">
            <div className="par">
              <div className="campo">
                <label htmlFor="name">Nombre</label>
                <input className="inp" id="name" name="name" autoComplete="name" {...campo("name")} />
                {estado.fieldErrors?.name && <div className="pista">{estado.fieldErrors.name}</div>}
              </div>

              <div className="campo">
                <label htmlFor="slug">Tu dirección</label>
                <div className="pegado">
                  <span className="fijo">/</span>
                  <input className="inp" id="slug" name="slug" {...campo("slug")} />
                </div>
                {estado.fieldErrors?.slug && <div className="pista">{estado.fieldErrors.slug}</div>}
              </div>
            </div>
            <div className="pista">Cambiar la dirección rompe los links que ya repartiste.</div>

            <div className="campo">
              <label htmlFor="bio">Bio</label>
              <textarea className="ta" id="bio" name="bio" maxLength={280} {...campo("bio")} />
              {/* El contador aparece recién cerca del límite: siempre visible
                  convierte escribir dos líneas en un examen. */}
              <div
                className="cuenta-c"
                data-cerca={d.bio.length > 240 ? "1" : ""}
                data-pasado={d.bio.length >= 280 ? "1" : ""}
              >
                {d.bio.length} / 280
              </div>
            </div>
          </div>
        </section>

        <section className="card blq">
          <h2>Redes</h2>
          <p className="ayuda">Se muestran como íconos en tu página. Dejá vacío lo que no uses.</p>
          <div className="blq-b redes">
            <div className="red">
              <span className="red-i">
                <AtSign />
              </span>
              <div className="pegado" style={{ flex: 1 }}>
                <span className="fijo">instagram.com/</span>
                <input className="inp" name="instagramUrl" {...campo("instagramUrl")} />
              </div>
            </div>
            <div className="red">
              <span className="red-i">
                <Globe />
              </span>
              <input
                className="inp"
                name="websiteUrl"
                placeholder="https://tusitio.com"
                style={{ flex: 1 }}
                {...campo("websiteUrl")}
              />
            </div>
            {estado.fieldErrors?.websiteUrl && (
              <div className="pista">{estado.fieldErrors.websiteUrl}</div>
            )}
          </div>
        </section>

        <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
          <button className="btn btn-pri btn-lg" type="submit" disabled={enviando}>
            {enviando ? "Guardando" : "Guardar cambios"}
          </button>
          {estado.error && <span style={{ color: "var(--bad)", fontSize: 13 }}>{estado.error}</span>}
          {!estado.error && estado.saved && (
            <span style={{ color: "var(--ok)", fontSize: 13 }}>Guardado</span>
          )}
        </div>
      </div>

      <aside className="lado">
        <div className="card">
          <div className="card-h">
            <div>
              <h2>Así te ven</h2>
            </div>
          </div>
          <div className="tarjeta-pub">
            <span className="foto-av">{iniciales}</span>
            <b>{d.name || "Tu nombre"}</b>
            <div className="bio">{d.bio}</div>
            <span className="link">encontrate.app/{d.slug || "tu-usuario"}</span>
            <div className="iconos">
              {d.instagramUrl && <AtSign />}
              {d.websiteUrl && <Globe />}
              {!d.instagramUrl && !d.websiteUrl && <AtSign style={{ opacity: 0.25 }} />}
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
