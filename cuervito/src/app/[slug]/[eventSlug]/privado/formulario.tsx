"use client";

import { Bell, Check, RefreshCw } from "lucide-react";
import { useActionState } from "react";

import { pedirPublicacionAction, type PedidoEstado } from "./acciones";

/**
 * El botón de «avisarle» con el mail opcional.
 *
 * El mail no es obligatorio a propósito: pedirlo para poder avisarle al
 * fotógrafo sería cobrar un dato por un favor. Quien lo deja, además, se
 * entera cuando salga.
 */
export function FormularioPedido({ eventId, nombre }: { eventId: string; nombre: string }) {
  const [estado, enviar, enviando] = useActionState<PedidoEstado, FormData>(pedirPublicacionAction, {
    estado: "inicial",
  });

  if (estado.estado === "listo") {
    return (
      <div className="ep-listo" role="status">
        <span className="ep-listo-i">
          <Check />
        </span>
        <div>
          <b>Listo, le avisamos a {nombre}.</b>
          <span>
            {estado.email
              ? `Te escribimos a ${estado.email} apenas se publique. Una sola vez.`
              : "Si querés enterarte cuando salga, volvé a esta página en unos días."}
          </span>
        </div>
      </div>
    );
  }

  if (estado.estado === "publicado") {
    return (
      <div className="ep-listo" role="status">
        <span className="ep-listo-i">
          <Check />
        </span>
        <div>
          <b>Se acaba de publicar.</b>
          <button type="button" className="ep-btn ep-btn-lleno" onClick={() => window.location.reload()}>
            <RefreshCw /> Ver las fotos
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={enviar} className="ep-form" noValidate>
      <input type="hidden" name="eventId" value={eventId} />
      {/* La trampa para bots: fuera de la vista y del orden de tabulación. */}
      <input type="text" name="web" tabIndex={-1} autoComplete="off" className="ep-trampa" aria-hidden="true" />

      <label htmlFor="ep-email">
        Tu mail <span>(opcional, para avisarte cuando salga)</span>
      </label>
      <div className="ep-fila">
        <input
          id="ep-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nombre@mail.com"
          aria-invalid={estado.estado === "error" || undefined}
          aria-describedby={estado.estado === "error" ? "ep-error" : undefined}
        />
        <button type="submit" className="ep-btn ep-btn-lleno" disabled={enviando}>
          <Bell /> {enviando ? "Avisando…" : `Avisarle a ${nombre}`}
        </button>
      </div>
      {estado.estado === "error" && (
        <p id="ep-error" className="ep-error" role="alert">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
