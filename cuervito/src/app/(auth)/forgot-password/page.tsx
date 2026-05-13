"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordResetAction,
    { error: null },
  );

  if (state.sent) {
    return (
      <div className="auth-card">
        <Link href="/" className="logo">
          cuerv<span className="logo-dot"></span>to
        </Link>

        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(76,175,125,0.15)",
            border: "1px solid rgba(76,175,125,0.4)",
            color: "var(--success)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
            fontSize: 26,
          }}
        >
          <i className="ti ti-mail-check" />
        </div>

        <h1 style={{ textAlign: "center" }}>Revisá tu email</h1>
        <p className="sub" style={{ textAlign: "center" }}>
          Si esa dirección está registrada en cuervito, te llegó un link para
          crear una nueva contraseña. El link es válido por 1 hora.
        </p>

        <p className="auth-foot" style={{ marginTop: 24 }}>
          <Link href="/login">Volver al login</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <Link href="/" className="logo">
        cuerv<span className="logo-dot"></span>to
      </Link>

      <h1>Olvidé mi contraseña</h1>
      <p className="sub">Te mandamos un link para crear una nueva.</p>

      <form action={formAction} className="auth-form">
        <div className="auth-field">
          <label htmlFor="fp-email">Email</label>
          <input
            id="fp-email"
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="ana@ejemplo.com"
            required
            autoFocus
          />
        </div>

        {state.error && (
          <div className="auth-error">
            <i className="ti ti-alert-circle" />
            {state.error}
          </div>
        )}

        <button type="submit" className="btn btn-primary auth-submit" disabled={pending}>
          {pending ? "Mandando…" : "Mandar link"}
        </button>
      </form>

      <p className="auth-foot">
        ¿La recordaste? <Link href="/login">Volver al login</Link>
      </p>
    </div>
  );
}
