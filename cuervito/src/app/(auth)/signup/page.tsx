"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { Aviso, CampoClave, GoogleG, Marco } from "../_piezas";
import { loginWithGoogleAction } from "../login/actions";
import { signupAction, type SignupState } from "./actions";

/**
 * Crear la cuenta.
 *
 * Es la misma pantalla que entrar, con un campo más. Si se vieran distintas, el
 * que se equivoca de link sentiría que se fue a otro producto.
 *
 * Google manda a /onboarding y no al tablero: la cuenta recién creada todavía
 * no tiene perfil ni Mercado Pago, y el panel sin eso es una pantalla vacía con
 * un botón de subir fotos que no se pueden vender.
 */
export default function SignupPage() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signupAction, {
    error: null,
  });

  return (
    <Marco
      lado={{
        texto:
          "Subís las fotos del sábado y el domingo ya se están vendiendo solas, con tu marca arriba.",
        datos: [
          ["10%", "por venta"],
          ["0", "de cuota"],
        ],
      }}
    >
      <h1>
        Creá tu
        <br />
        cuenta
      </h1>
      <p className="auth-sub">Gratis y sin tarjeta. Te cobramos sólo cuando cobrás vos.</p>

      <div style={{ height: "var(--s-6)" }} />

      <form action={loginWithGoogleAction}>
        <input type="hidden" name="callbackUrl" value="/onboarding" />
        <button className="btn btn-ghost btn-lg btn-block" type="submit">
          <GoogleG />
          Registrarme con Google
        </button>
      </form>

      <div className="sep">o con tu email</div>

      {state.error && <Aviso>{state.error}</Aviso>}

      <form action={formAction} className="form">
        <div className="field">
          <div className="field-top">
            <label htmlFor="nom">Nombre y apellido</label>
          </div>
          <input
            className="inp"
            id="nom"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Germán Sosa"
            required
            autoFocus
          />
        </div>

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
          />
        </div>

        <CampoClave nombre="password" etiqueta="Contraseña" autoComplete="new-password" reglas />

        <button className="btn btn-pri btn-lg btn-block" type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear mi cuenta"}
          {!pending && <ArrowRight className="go" />}
        </button>
      </form>

      {/* Los términos van DEBAJO del botón y no arriba: arriba son un obstáculo
          antes de empezar, abajo son la letra chica de algo que ya decidiste. */}
      <p className="auth-legal">
        Al crear la cuenta aceptás los <Link href="/terminos">Términos</Link> y la{" "}
        <Link href="/privacidad">Política de privacidad</Link>.
      </p>

      <p className="auth-alt">
        ¿Ya tenés cuenta? <Link href="/login">Entrá</Link>
      </p>
    </Marco>
  );
}
