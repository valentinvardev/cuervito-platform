import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

import { db } from "~/server/db";

import { Estado, Marco } from "../../_piezas";
import { ResetPasswordForm } from "./reset-form";

const LADO = {
  texto:
    "Tus eventos, tus fotos y tus ventas te esperan del otro lado. Recuperar la clave son dos minutos.",
  datos: [
    ["1 h", "dura el link"],
    ["24 hs", "de soporte"],
  ] as [string, string][],
};

/**
 * Poner la contraseña nueva.
 *
 * El token se valida ACÁ, en el servidor, antes de dibujar el formulario: si
 * venció o ya se usó, no tiene sentido dejar que alguien escriba una clave para
 * después decirle que no. La validación es la misma de siempre; sólo cambió lo
 * que se ve cuando falla.
 */
export default async function ResetPasswordPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const row = await db.passwordResetToken.findUnique({
    where: { token },
    select: { expiresAt: true, usedAt: true },
  });

  const sirve = !!row && !row.usedAt && row.expiresAt > new Date();

  if (!sirve) {
    return (
      <Marco volverA="/login" lado={LADO}>
        <Estado
          icono={<Clock />}
          tono="mal"
          titulo={
            <>
              Este link
              <br />
              ya no sirve
            </>
          }
          bajada="Los links para cambiar la contraseña duran una hora, y este ya pasó —o alguien lo usó antes."
        >
          {/* No es un callejón: el botón grande pide otro. */}
          <div className="estado-nota">
            No es nada raro: si el mail quedó abierto de ayer, el link de adentro ya venció. Pedí
            uno nuevo y llega en el momento.
          </div>

          <div className="estado-acc">
            <Link className="btn btn-pri btn-lg btn-block" href="/forgot-password">
              Pedir un link nuevo <ArrowRight className="go" />
            </Link>
          </div>

          <p className="auth-alt">
            <Link href="/login">Volver al ingreso</Link>
          </p>
        </Estado>
      </Marco>
    );
  }

  return <ResetPasswordForm token={token} />;
}
