"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordAction, type ResetPasswordState } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    { error: null },
  );

  if (state.done) {
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
          <i className="ti ti-check" />
        </div>

        <h1 style={{ textAlign: "center" }}>Listo</h1>
        <p className="sub" style={{ textAlign: "center" }}>
          Tu contraseña fue actualizada. Ya podés iniciar sesión.
        </p>

        <Link
          href="/login"
          className="btn btn-primary auth-submit"
          style={{ marginTop: 22 }}
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <Link href="/" className="logo">
        cuerv<span className="logo-dot"></span>to
      </Link>

      <h1>Nueva contraseña</h1>
      <p className="sub">Elegí una contraseña nueva para tu cuenta.</p>

      <form action={formAction} className="auth-form">
        <input type="hidden" name="token" value={token} />

        <div className="auth-field">
          <label htmlFor="rp-pass">Nueva contraseña</label>
          <input
            id="rp-pass"
            className="input"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={8}
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
          {pending ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>

      <p className="auth-foot">
        <Link href="/login">Volver al login</Link>
      </p>
    </div>
  );
}
