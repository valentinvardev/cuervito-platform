"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginWithGoogleAction } from "../login/actions";
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

      <form action={loginWithGoogleAction} className="auth-google-form">
        <input type="hidden" name="callbackUrl" value="/onboarding" />
        <button type="submit" className="btn btn-google">
          <GoogleG />
          Continuar con Google
        </button>
      </form>

      <div className="auth-divider">
        <span>o con email</span>
      </div>

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

      <p
        className="auth-foot"
        style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 12 }}
      >
        Al crear una cuenta aceptás nuestros{" "}
        <Link href="/terminos">Términos</Link> y la{" "}
        <Link href="/privacidad">Política de Privacidad</Link>.
      </p>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 009 18z" fill="#34A853" />
      <path d="M3.96 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3-2.33z" fill="#FBBC05" />
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
