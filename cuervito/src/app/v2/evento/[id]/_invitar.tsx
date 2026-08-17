"use client";

import { useRouter } from "next/navigation";
import { Check, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Invitar a un fotógrafo a cubrir el evento.
 *
 * Dice las condiciones ANTES de mandar el mail, no después. Quien invita
 * necesita poder contestar "¿qué va a poder ver de lo mío?" y "¿cuánto me
 * queda?" en el momento en que el otro se lo pregunta por teléfono, sin tener
 * que ir a averiguarlo a otra pantalla.
 *
 * La comisión NO se elige por colaborador. La define el evento: si usa
 * reconocimiento, todos venden al mismo porcentaje, incluido el que se sumó
 * después. Enterarse de eso al cobrar es la peor manera. Por eso el formulario
 * pide un mail y nada más, y el resto lo explica.
 */
export function Invitar({
  eventId,
  precio,
  comision,
  reconocimiento,
}: {
  eventId: string;
  precio: number;
  comision: number;
  reconocimiento: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  const neto = Math.round(precio * (1 - comision / 100));

  useEffect(() => {
    if (!abierto) return;
    setEmail("");
    setError(null);
    setListo(false);
    // Un cuadro que se abre con el foco afuera obliga a un click de más.
    setTimeout(() => campo.current?.focus(), 60);

    // El CSS del laboratorio muestra el cuadro con :root[data-modal="open"], no
    // con una clase propia. Se pone en un efecto y no al renderizar para que el
    // atributo cambie DESPUÉS del primer pintado: si el elemento aparece con el
    // valor final ya puesto, la transición de entrada no llega a correr.
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
          // Cada uno cobra lo suyo y no hay comisión entre fotógrafos: la
          // plata se reparte por autoría. Es el mismo criterio que ya explica
          // la tarjeta "Cómo se reparte" de la solapa Equipo.
          commissionScope: "OWN",
          commissionPct: 0,
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
                <div className="sub">
                  Va a poder subir sus fotos a este evento y cobrar sus propias ventas.
                </div>
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

              {/* Lo que va a poder y lo que no, en la misma lista. Sólo los
                  permisos suena a que ve todo; sólo los límites, a desconfianza. */}
              <ul className="permisos">
                <li className="si">
                  <Check /> Sube sus fotos y las ve en la grilla
                </li>
                <li className="si">
                  <Check /> Ve y cobra las ventas de sus fotos
                </li>
                <li className="no">
                  <X /> No ve tus ventas ni las de los demás
                </li>
                <li className="no">
                  <X /> No puede cambiar el precio ni borrar tus fotos
                </li>
              </ul>

              <div className="queda-inv">
                <div>
                  <span>De cada foto que venda, le quedan</span>
                  <b className="tnum">${neto.toLocaleString("es-AR")}</b>
                </div>
                <p>
                  Precio del evento ${precio.toLocaleString("es-AR")}, menos el {comision}% de
                  comisión. <b>La comisión la define este evento</b>, no cada fotógrafo:{" "}
                  {reconocimiento
                    ? `como usa reconocimiento, todos venden al ${comision}%.`
                    : `como es galería simple, todos venden al ${comision}%.`}
                </p>
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
