"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    { error: null },
  );

  return (
    <div className="auth-card">
      <Link href="/" className="logo">
        cuerv<span className="logo-dot"></span>to
      </Link>

      <h1>Iniciar sesión</h1>
      <p className="sub">Bienvenido de nuevo.</p>

      <form action={formAction} className="auth-form">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="ana@ejemplo.com"
            required
            autoFocus
          />
        </div>

        <div className="auth-field">
          <label htmlFor="login-pass">Contraseña</label>
          <input
            id="login-pass"
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
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
              Ingresando…
            </>
          ) : (
            <>
              Ingresar
              <i className="ti ti-arrow-right" style={{ marginLeft: 4 }} />
            </>
          )}
        </button>
      </form>

      <p className="auth-foot">
        ¿No tenés cuenta?{" "}
        <Link href="/signup">Crear cuenta</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
