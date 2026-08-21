"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Suspense, useActionState } from "react";

import { Aviso, CampoClave, GoogleG, Marco } from "../_piezas";
import { loginAction, loginWithGoogleAction, type LoginState } from "./actions";

/**
 * Entrar al panel.
 *
 * Sólo cambió el dibujo: las dos acciones —credenciales y Google— son las
 * mismas de siempre, y el callbackUrl sigue viajando como campo oculto en las
 * dos, que es lo que hace que alguien que llegó desde /v2/eventos vuelva ahí y
 * no al tablero.
 */
function Formulario() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {
    error: null,
  });

  return (
    <Marco
      lado={{
        texto:
          "Cada foto que subís queda buscable por cara y por dorsal en menos de un minuto.",
        datos: [
          ["10%", "por venta"],
          ["24 hs", "de soporte"],
        ],
      }}
    >
      <h1>
        Entrá a
        <br />
        tu panel
      </h1>
      <p className="auth-sub">
        Ahí subís las fotos, seguís las ventas y cobrás en tu cuenta de Mercado Pago.
      </p>

      <div style={{ height: "var(--s-6)" }} />

      {/* Google primero: es por donde entra la mayoría, y de paso se saltea el
          campo de contraseña entero. */}
      <form action={loginWithGoogleAction}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button className="btn btn-ghost btn-lg btn-block" type="submit">
          <GoogleG />
          Continuar con Google
        </button>
      </form>

      <div className="sep">o con tu email</div>

      {state.error && <Aviso>{state.error}</Aviso>}

      <form action={formAction} className="form">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

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

        <CampoClave
          nombre="password"
          etiqueta="Contraseña"
          autoComplete="current-password"
          extra={<Link href="/forgot-password">Me la olvidé</Link>}
        />

        <button className="btn btn-pri btn-lg btn-block" type="submit" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
          {!pending && <ArrowRight className="go" />}
        </button>
      </form>

      <p className="auth-alt">
        ¿Todavía no tenés cuenta? <Link href="/signup">Creala gratis</Link>
      </p>
    </Marco>
  );
}

export default function LoginPage() {
  // useSearchParams obliga a un boundary: sin él, la ruta entera se vuelve
  // dinámica y el armazón tarda en pintar por leer un parámetro opcional.
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
