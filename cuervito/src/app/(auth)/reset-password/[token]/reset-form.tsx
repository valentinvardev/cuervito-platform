"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useActionState } from "react";

import { Aviso, CampoClave, Estado, Marco } from "../../_piezas";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const LADO = {
  texto:
    "Tus eventos, tus fotos y tus ventas te esperan del otro lado. Recuperar la clave son dos minutos.",
  datos: [
    ["1 h", "dura el link"],
    ["24 hs", "de soporte"],
  ] as [string, string][],
};

/**
 * El formulario de la contraseña nueva.
 *
 * Va aparte de la página porque la página valida el token en el servidor y esto
 * necesita estado del navegador. El token viaja como campo oculto: la acción lo
 * vuelve a validar antes de guardar nada, así que no alcanza con editarlo acá.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    { error: null },
  );

  if (state.done) {
    return (
      <Marco volverA="/login" lado={LADO}>
        <Estado
          icono={<Check />}
          titulo={
            <>
              Contraseña
              <br />
              cambiada
            </>
          }
          bajada="Ya podés entrar con la nueva. Si no fuiste vos quien la cambió, escribinos ahora."
        >
          <div className="estado-acc">
            <Link className="btn btn-pri btn-lg btn-block" href="/login">
              Entrar al panel <ArrowRight className="go" />
            </Link>
          </div>
        </Estado>
      </Marco>
    );
  }

  return (
    <Marco volverA="/login" lado={LADO}>
      <h1>
        Elegí una
        <br />
        contraseña
      </h1>
      <p className="auth-sub">
        Es la última vez que la escribís por hoy. Después entrás derecho al panel.
      </p>

      <div style={{ height: "var(--s-6)" }} />

      {state.error && <Aviso>{state.error}</Aviso>}

      <form action={formAction} className="form">
        <input type="hidden" name="token" value={token} />

        <CampoClave
          nombre="password"
          etiqueta="Nueva contraseña"
          autoComplete="new-password"
          reglas
        />

        <button className="btn btn-pri btn-lg btn-block" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar y entrar"}
          {!pending && <ArrowRight className="go" />}
        </button>
      </form>
    </Marco>
  );
}
