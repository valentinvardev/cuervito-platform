"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signupAction, type SignupState } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    { error: null },
  );

  return (
    <div className="auth-card">
      <Link href="/" className="logo">
        cuerv<span className="logo-dot"></span>to
      </Link>

      <h1>Crear cuenta</h1>
      <p className="sub">Sumate como fotógrafo y empezá a vender.</p>

      <form action={formAction} className="auth-form">
        <div className="auth-field">
          <label htmlFor="signup-name">Nombre</label>
          <input
            id="signup-name"
            className="input"
            name="name"
            autoComplete="name"
            placeholder="Ana Liotta"
            required
            autoFocus
          />
        </div>

        <div className="auth-field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="ana@ejemplo.com"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="signup-pass">Contraseña</label>
          <input
            id="signup-pass"
            className="input"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            required
          />
          <span className="hint">8 caracteres mínimo · mezclá letras y números.</span>
        </div>

        {state.error && (
          <div className="auth-error">
            <i className="ti ti-alert-circle" />
            {state.error}
          </div>
        )}

        <button type="submit" className="btn btn-primary auth-submit" disabled={pending}>
          {pending ? (
            <>
              <span
                className="up-spinner"
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  marginRight: 6,
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Creando cuenta…
            </>
          ) : (
            <>
              Crear cuenta
              <i className="ti ti-arrow-right" style={{ marginLeft: 4 }} />
            </>
          )}
        </button>
      </form>

      <p className="auth-foot">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login">Iniciar sesión</Link>
      </p>
    </div>
  );
}
