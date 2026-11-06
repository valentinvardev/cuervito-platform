"use client";

import { useRouter } from "next/navigation";
import { Check, CircleCheck, Clock, Copy, Crown, UserMinus, Users, X } from "lucide-react";
import { useState } from "react";

import { iniciales as siglas } from "../../_components/formato";
import { Invitar } from "./_invitar";

export type Alcance = "NONE" | "OWN" | "ALL";

export type Colaborador = {
  id: string;
  nombre: string;
  /** Sólo lo ve el dueño. */
  email: string | null;
  estado: "PENDING" | "ACCEPTED" | "REVOKED";
  alcance: Alcance;
  pct: number;
  /** Si esta fila es quien está mirando. */
  soyYo: boolean;
  fotos: number;
  /** Null cuando quien mira no tiene por qué verlo (un colaborador). */
  vendidas: number | null;
  /** Lo que el dueño le debe hasta hoy, ya formateado. Null: no se muestra. */
  comision: string | null;
  /** El link de la invitación mientras no la aceptó, sólo para el dueño. */
  link: string | null;
};

/** Qué cobra, en una línea: la misma que vio en el mail de invitación. */
function alcanceTexto(c: { alcance: Alcance; pct: number }, deQuien: "sus" | "tus"): string {
  if (c.alcance === "NONE" || c.pct === 0) return "Sin comisión";
  if (c.alcance === "OWN") return `${c.pct}% de ${deQuien} fotos`;
  return `${c.pct}% de todas las ventas`;
}

/**
 * Quiénes cubren el evento.
 *
 * La misma tabla la miran tres personas y no ven lo mismo. El dueño ve todo:
 * cuántas subió cada uno, cuántas vendió, cuánto le debe, y puede invitar o
 * sacar a alguien. Un colaborador ve quiénes son y cuántas fotos subió cada
 * uno, y de plata sólo lo suyo, que está arriba en las cifras. Un admin ve lo
 * del dueño pero no toca: invitar y sacar quedan a nombre de quien lo hace.
 *
 * Antes acá había un aviso de "sus fotos no se pueden comprar porque no
 * conectó Mercado Pago". Era falso: la venta entra siempre en el Mercado
 * Pago del dueño, y el párrafo de abajo lo decía. Dos frases contradictorias
 * en la misma pantalla valen menos que ninguna.
 */
export function Equipo({
  eventoId,
  precio,
  comision,
  modo,
  duenio,
  colaboradores,
  deudaTotal,
}: {
  eventoId: string;
  precio: number;
  comision: number;
  modo: "duenio" | "admin" | "colaborador";
  duenio: { nombre: string; fotos: number; vendidas: number | null };
  colaboradores: Colaborador[];
  /** Lo que el dueño debe entre todos, ya formateado. Null si nada. */
  deudaTotal: string | null;
}) {
  const router = useRouter();
  const [quitando, setQuitando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const conPlata = modo !== "colaborador";
  const puedeTocar = modo === "duenio";

  async function quitar(c: Colaborador) {
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch(`/api/dashboard/events/${eventoId}/collaborators/${c.id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error();
      setQuitando(null);
      router.refresh();
    } catch {
      setError(`No se pudo quitar a ${c.nombre}. Probá de nuevo.`);
    } finally {
      setOcupado(false);
    }
  }

  function copiar(c: Colaborador) {
    if (!c.link) return;
    void navigator.clipboard.writeText(`${location.origin}${c.link}`);
    setCopiado(c.id);
    setTimeout(() => setCopiado(null), 1800);
  }

  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h2>Quiénes cubren este evento</h2>
          <div className="sub">{colaboradores.length + 1} fotógrafos</div>
        </div>
        {puedeTocar && <Invitar eventId={eventoId} precio={precio} comision={comision} />}
      </div>

      {/* Los títulos de las columnas, sólo cuando hay números que leer:
          tres cifras sin rótulo en una fila son tres adivinanzas. */}
      {/* Siempre, con las mismas columnas que las filas: la fila del dueño ya
          trae cifras aunque no haya nadie más, y una cifra sin rótulo es una
          adivinanza. */}
      <div className="row row-h col-f" data-plata={conPlata ? "1" : undefined}>
        <span />
        <span>Fotógrafo</span>
        <span className="num soft c-fotos">Fotos</span>
        {conPlata && (
          <>
            <span className="num soft c-vend">Vendidas</span>
            <span className="num soft c-debe">Le debés</span>
          </>
        )}
        <span />
      </div>

      {/* El dueño va en la tabla y no sólo en la cuenta del encabezado.
          Decía "4 fotógrafos" y listaba tres, porque el cuarto era el que
          estaba mirando. */}
      <div className="row col-f" data-plata={conPlata ? "1" : undefined}>
        <span className={`col-av ${modo === "duenio" ? "yo" : ""}`}>{siglas(duenio.nombre)}</span>
        <span className="col-t">
          <b>{duenio.nombre}</b>
          <span>{modo === "duenio" ? "Vos, dueño del evento" : "Dueño del evento"}</span>
        </span>
        <span className="num soft c-fotos tnum">
          {duenio.fotos > 0 ? duenio.fotos.toLocaleString("es-AR") : "—"}
        </span>
        {conPlata && (
          <>
            <span className="num soft c-vend tnum">
              {duenio.vendidas ? duenio.vendidas.toLocaleString("es-AR") : "—"}
            </span>
            <span className="num soft c-debe">—</span>
          </>
        )}
        <span className="col-acc">
          <Rol clase="duenio" icono={<Crown />} texto="Dueño" />
        </span>
      </div>

      {colaboradores.map((c) => (
        <div
          className={`row col-f ${c.estado === "PENDING" ? "espera" : ""}`}
          key={c.id}
          data-plata={conPlata ? "1" : undefined}
        >
          <span className={`col-av ${c.soyYo ? "yo" : ""}`}>{siglas(c.nombre)}</span>
          <span className="col-t">
            <b>
              {c.nombre}
              {c.soyYo && <span className="vos"> · vos</span>}
            </b>
            {/* Cuánto cobra lo ve el dueño, y cada uno lo suyo. Lo que
                pactó el dueño con otro no es de nadie más. */}
            <span>
              {conPlata || c.soyYo ? alcanceTexto(c, c.soyYo ? "tus" : "sus") : "Colaborador"}
              {c.email && ` · ${c.email}`}
            </span>
          </span>
          <span className="num soft c-fotos tnum">
            {c.fotos > 0 ? c.fotos.toLocaleString("es-AR") : "—"}
          </span>
          {conPlata && (
            <>
              <span className="num soft c-vend tnum">
                {c.vendidas ? c.vendidas.toLocaleString("es-AR") : "—"}
              </span>
              <span className={`num c-debe tnum ${c.comision && c.comision !== "$0" ? "debe" : "soft"}`}>
                {c.comision && c.comision !== "$0" ? c.comision : "—"}
              </span>
            </>
          )}
          <span className="col-acc">
            {quitando === c.id ? (
              <>
                <span className="col-q">¿Quitar a {c.nombre.split(" ")[0]}?</span>
                <button
                  type="button"
                  className="btn btn-peligro btn-sm"
                  disabled={ocupado}
                  onClick={() => void quitar(c)}
                >
                  {ocupado ? "Quitando" : "Quitar"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={ocupado}
                  onClick={() => setQuitando(null)}
                >
                  No
                </button>
              </>
            ) : (
              <>
                {c.estado === "PENDING" ? (
                  <Rol clase="espera" icono={<Clock />} texto="Invitado" />
                ) : (
                  <Rol clase="activo" icono={<CircleCheck />} texto="Activo" />
                )}
                {/* El mail de invitación es "si llega": el link se puede
                    pasar a mano, por WhatsApp, que es por donde se habla
                    con un compañero de todos modos. */}
                {c.link && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => copiar(c)}
                    aria-label="Copiar el link de la invitación"
                    data-tip={copiado === c.id ? "Copiado" : "Copiar link de la invitación"}
                  >
                    {copiado === c.id ? <Check /> : <Copy />}
                  </button>
                )}
                {puedeTocar && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setQuitando(c.id)}
                    aria-label={`Quitar a ${c.nombre}`}
                    data-tip={c.estado === "PENDING" ? "Cancelar la invitación" : "Quitar del evento"}
                  >
                    <UserMinus />
                  </button>
                )}
              </>
            )}
          </span>
        </div>
      ))}

      {error && (
        <div className="porque">
          <X />
          <span>{error}</span>
        </div>
      )}

      {colaboradores.length === 0 && (
        <div className="empty" style={{ padding: "var(--s-6) var(--s-4)" }}>
          <div className="empty-i">
            <Users />
          </div>
          <p>
            {modo === "duenio"
              ? "Todavía no invitaste a nadie más a cubrir este evento."
              : "Nadie más cubre este evento."}
          </p>
        </div>
      )}

      {/* Lo que pasa de verdad con la plata, dicho acá y no descubierto al
          cobrar: la venta entra entera en el Mercado Pago del dueño; la
          comisión del colaborador queda anotada como deuda y se la pasa él. */}
      <div className="reparto">
        {modo === "colaborador" ? (
          <>
            Las ventas entran en el Mercado Pago de <b>{duenio.nombre}</b>, también las de tus
            fotos. Lo que te corresponde queda registrado acá y te lo pasa {duenio.nombre.split(" ")[0]}.
          </>
        ) : modo === "admin" ? (
          <>
            Todas las ventas entran en el Mercado Pago de <b>{duenio.nombre}</b>. Lo que le toca a
            cada colaborador queda registrado como lo que les debe.
          </>
        ) : (
          <>
            Todas las ventas entran en <b>tu</b> Mercado Pago, también las de las fotos que suban
            ellos. Lo que le toca a cada uno queda registrado como lo que les debés, y se lo pasás
            vos.
            {deudaTotal && (
              <>
                {" "}
                Hasta hoy, <b>{deudaTotal}</b> entre todos.
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * El rol de cada fotógrafo, como texto.
 *
 * Antes eran píldoras. Una píldora es una caja con fondo, y cuatro cajas de
 * colores distintos en una columna angosta compiten con los nombres y los
 * números, que es lo que la tabla vino a mostrar. Como texto con ícono, el rol
 * se reconoce igual de rápido y deja de pelear por atención.
 */
function Rol({ clase, icono, texto }: { clase: string; icono: React.ReactNode; texto: string }) {
  return (
    <span className={`rol ${clase}`}>
      {icono} <span>{texto}</span>
    </span>
  );
}
