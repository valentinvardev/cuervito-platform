"use client";

import { useRouter } from "next/navigation";
import { AtSign, Camera, Globe } from "lucide-react";
import { useActionState, useRef, useState } from "react";

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
  fotoInicial,
}: {
  inicial: { name: string; slug: string; bio: string; instagramUrl: string; websiteUrl: string };
  fotoInicial: string | null;
}) {
  const router = useRouter();
  const [estado, accion, enviando] = useActionState(savePerfilAction, { error: null });
  const [d, setD] = useState(inicial);

  const avatar = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(fotoInicial);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

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
      // La foto también sale en el riel, que lo arma el layout: sin esto sigue
      // mostrando las iniciales hasta la próxima navegación completa.
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
            {/* La dirección NO se pide acá. Se genera sola a partir del
                nombre al crear la cuenta, y si estaba tomada se le agrega un
                sufijo. Pedirla en el alta del perfil es hacerle inventar un
                identificador a alguien que sólo quería escribir su nombre.

                Viaja igual como campo oculto porque el esquema de la acción la
                exige: mandarla vacía la borraría. Cambiarla es una decisión
                aparte y vive en Mi página, que es donde se ve el link. */}
            <input type="hidden" name="slug" value={inicial.slug} />

            <div className="campo">
              <label htmlFor="name">Nombre</label>
              <input className="inp" id="name" name="name" autoComplete="name" {...campo("name")} />
              {estado.fieldErrors?.name && <div className="pista">{estado.fieldErrors.name}</div>}
              {estado.fieldErrors?.slug && (
                <div className="pista" style={{ color: "var(--bad)" }}>{estado.fieldErrors.slug}</div>
              )}
            </div>

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
            {/* La foto se cambia desde la previa y no desde un campo aparte:
                es el único lugar de la pantalla donde se ve cómo va a quedar,
                así que es donde tiene sentido tocarla. */}
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
            {errorFoto && (
              <div className="pista" style={{ color: "var(--bad)", textAlign: "center" }}>
                {errorFoto}
              </div>
            )}
            <b>{d.name || "Tu nombre"}</b>
            <div className="bio">{d.bio}</div>
            <span className="link">encontrate.app/{inicial.slug || "tu-usuario"}</span>
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
