"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { useActionState } from "react";

import { Aviso, Estado, Marco } from "../_piezas";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const LADO = {
  texto:
    "Tus eventos, tus fotos y tus ventas te esperan del otro lado. Recuperar la clave son dos minutos.",
  datos: [
    ["1 h", "dura el link"],
    ["24 hs", "de soporte"],
  ] as [string, string][],
};

/**
 * Pedir el link para cambiar la contraseña.
 *
 * La pantalla de "ya salió el mail" NO dice si esa dirección tiene cuenta o no,
 * y la acción del servidor tampoco: contestar distinto según eso convierte esto
 * en un detector de qué mails están registrados, que es justo lo que quiere el
 * que está probando direcciones.
 */
export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordResetAction,
    { error: null },
  );

  if (state.sent) {
    return (
      <Marco volverA="/login" lado={LADO}>
        <Estado
          icono={<Mail />}
          titulo={
            <>
              Revisá
              <br />
              tu email
            </>
          }
          bajada="Si esa dirección tiene una cuenta, ya salió el link para crear una contraseña nueva."
        >
          {/* Contesta acá la pregunta que sigue SIEMPRE. Si no está, se
              convierte en un mensaje al WhatsApp. */}
          <div className="estado-nota">
            ¿No llegó? Mirá en <b>spam</b> o en <b>promociones</b>: es un mail automático y a veces
            cae ahí. El link vale por <b>una hora</b>.
          </div>

          <div className="estado-acc">
            <Link className="btn btn-ghost btn-lg btn-block" href="/forgot-password">
              <ArrowLeft /> Probar con otro email
            </Link>
          </div>

          <p className="auth-alt">
            <Link href="/login">Volver al ingreso</Link>
          </p>
        </Estado>
      </Marco>
    );
  }

  return (
    <Marco volverA="/login" lado={LADO}>
      <h1>
        Recuperá
        <br />
        tu cuenta
      </h1>
      <p className="auth-sub">
        Poné el email con el que te registraste y te mandamos un link para crear una contraseña
        nueva.
      </p>

      <div style={{ height: "var(--s-6)" }} />

      {state.error && <Aviso>{state.error}</Aviso>}

      <form action={formAction} className="form">
        <div className="field">
          <div className="field-top">
            <label htmlFor="mail">Email</label>
          </div>
          <input
            className="inp"
            id="mail"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vos@estudio.com"
            required
            autoFocus
          />
        </div>

        <button className="btn btn-pri btn-lg btn-block" type="submit" disabled={pending}>
          {pending ? "Mandando…" : "Mandame el link"}
          {!pending && <ArrowRight className="go" />}
        </button>
      </form>

      <p className="auth-alt">
        ¿Te acordaste? <Link href="/login">Volver al ingreso</Link>
      </p>
    </Marco>
  );
}
