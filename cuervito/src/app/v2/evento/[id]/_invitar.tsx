"use client";

import { useRouter } from "next/navigation";
import { Check, Info, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Alcance = "NONE" | "OWN" | "ALL";

/**
 * Invitar a un fotógrafo a cubrir el evento.
 *
 * Dice las condiciones ANTES de mandar el mail. Quien invita necesita poder
 * contestar "¿qué va a poder ver de lo mío?" y "¿cuánto le queda?" en el
 * momento en que el otro se lo pregunta por teléfono.
 *
 * Sobre la comisión, y esto importa porque es plata de otro: la venta entra
 * entera en el Mercado Pago del DUEÑO del evento, no en el del colaborador. Lo
 * que se elige acá es qué porcentaje le queda al invitado, y el sistema lo deja
 * registrado como una deuda del dueño hacia él. No lo transfiere: eso se
 * arregla entre ellos.
 *
 * La primera versión de esta pantalla decía "cobra sus propias ventas, directo
 * a su Mercado Pago" y mandaba la comisión en cero. Era el modelo del
 * laboratorio, no el que está programado: le habría prometido a un tercero una
 * plata que el sistema no le iba a devengar nunca.
 */
export function Invitar({
  eventId,
  precio,
}: {
  eventId: string;
  precio: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [alcance, setAlcance] = useState<Alcance>("OWN");
  const [pct, setPct] = useState(70);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  const porFoto = Math.round((precio * pct) / 100);

  useEffect(() => {
    if (!abierto) return;
    setEmail("");
    setError(null);
    setListo(false);
    setTimeout(() => campo.current?.focus(), 60);
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
  }, [abierto]);

  async function invitar() {
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      setError("Escribí un email válido.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/dashboard/events/${eventId}/collaborators`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: mail,
          commissionScope: alcance,
          commissionPct: alcance === "NONE" ? 0 : pct,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(d.error ?? "No se pudo invitar.");
        return;
      }
      setListo(true);
      router.refresh();
      setTimeout(() => setAbierto(false), 1200);
    } catch {
      setError("No se pudo invitar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-pri btn-sm" onClick={() => setAbierto(true)}>
        <UserPlus /> Invitar
      </button>

      {abierto && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Invitar a un fotógrafo"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
        >
          <div className="modal-caja">
            <div className="modal-h">
              <div>
                <h2>Invitar a un fotógrafo</h2>
                <div className="sub">Va a poder subir sus fotos a este evento.</div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                <X />
              </button>
            </div>

            <div className="modal-b">
              <div className="campo">
                <label htmlFor="mail-inv">Email</label>
                <input
                  ref={campo}
                  className="inp"
                  id="mail-inv"
                  type="email"
                  placeholder="companero@gmail.com"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void invitar();
                    }
                  }}
                />
                <div className="pista" style={error ? { color: "var(--bad)" } : undefined}>
                  {error ?? "Si no tiene cuenta en encontrate, se la crea al aceptar."}
                </div>
              </div>

              {/* Qué le queda. Es la pregunta que el otro va a hacer primero y
                  la que decide si acepta, así que va en la misma pantalla y no
                  en un ajuste posterior. */}
              <div className="campo">
                <label>Qué le queda de cada venta</label>
                <div className="opc-com">
                  {(
                    [
                      ["OWN", "De sus fotos", "Cobra por las fotos que suba él"],
                      ["ALL", "De todas", "Cobra por toda venta del evento"],
                      ["NONE", "Nada", "Sube fotos, no cobra comisión"],
                    ] as const
                  ).map(([v, t, d]) => (
                    <button
                      type="button"
                      key={v}
                      className="opc-c"
                      aria-pressed={alcance === v}
                      onClick={() => setAlcance(v)}
                    >
                      <b>{t}</b>
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
              </div>

              {alcance !== "NONE" && (
                <div className="campo">
                  <label htmlFor="pct-inv">Porcentaje</label>
                  <div className="pct-fila">
                    <input
                      id="pct-inv"
                      type="range"
                      min={5}
                      max={95}
                      step={5}
                      value={pct}
                      onChange={(e) => setPct(Number(e.target.value))}
                    />
                    <b className="tnum">{pct}%</b>
                  </div>
                  {/* El porcentaje traducido a pesos por foto. Nadie decide
                      bien entre 60% y 70% mirando dos números abstractos. */}
                  <div className="pista">
                    Sobre una foto de ${precio.toLocaleString("es-AR")}, le quedan{" "}
                    <b>${porFoto.toLocaleString("es-AR")}</b>. Se calcula sobre lo que te queda a
                    vos, después de la comisión de encontrate.
                  </div>
                </div>
              )}

              <ul className="permisos">
                <li className="si">
                  <Check /> Sube sus fotos y las ve en la grilla
                </li>
                <li className="si">
                  <Check /> Ve cuánto vendieron sus fotos
                </li>
                <li className="no">
                  <X /> No ve tus ventas ni las de los demás
                </li>
                <li className="no">
                  <X /> No puede cambiar el precio ni borrar tus fotos
                </li>
              </ul>

              {/* Lo que el sistema NO hace, dicho acá y no descubierto al
                  cobrar: la plata entra toda en TU Mercado Pago. Lo de arriba
                  queda anotado como lo que le debés. */}
              <div className="porque">
                <Info />
                <span>
                  Las ventas entran en <b>tu</b> Mercado Pago, también las de sus fotos. Lo que le
                  corresponde queda registrado como lo que le debés, y se lo pasás vos.
                </span>
              </div>
            </div>

            <div className="modal-f">
              <button className="btn btn-ghost" onClick={() => setAbierto(false)}>
                Cancelar
              </button>
              <button className="btn btn-pri" onClick={invitar} disabled={enviando || listo}>
                {listo ? (
                  <>
                    <Check /> Invitación enviada
                  </>
                ) : enviando ? (
                  "Enviando"
                ) : (
                  <>
                    <UserPlus /> Mandar invitación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
