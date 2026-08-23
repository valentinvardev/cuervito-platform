"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { BotonTema } from "~/app/_components/boton-tema";

/**
 * Lo que comparten las cuatro pantallas de autenticación.
 *
 * Entrar, crear la cuenta, pedir el link y poner la nueva son la MISMA pantalla
 * con distinto contenido en el medio. Si cada una armara su propio armazón, al
 * tercer cambio de copy en el encabezado habría cuatro encabezados distintos.
 */

/**
 * El armazón: barra, columna del formulario, carril del atleta y la foto.
 *
 * La foto de la derecha va con aria-hidden y sin texto alternativo a propósito:
 * es ambientación, no información. Un lector de pantalla que la anuncie sólo
 * agrega ruido entre el título y el primer campo.
 */
export function Marco({
  volverA = "/",
  children,
  lado,
}: {
  /** Adónde lleva "Volver". Cambia según de dónde se llega. */
  volverA?: string;
  children: React.ReactNode;
  /** El texto de la columna de la foto, que sí cambia por pantalla. */
  lado: { texto: string; datos: [string, string][] };
}) {
  return (
    <>
      <div className="auth-col">
        <div className="auth-top">
          <Link href="/" className="mark">
            Cuervito<i></i>.app
          </Link>
          <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
            <Link href={volverA} className="volver">
              <ArrowLeft /> Volver
            </Link>
            <BotonTema />
          </div>
        </div>

        <div className="auth-mid">
          <div className="auth-box">{children}</div>
        </div>

        {/* El que compró fotos NO tiene cuenta: compra buscándose por cara o
            dorsal y recibe el link por mail. Si esta pantalla no lo dice, se
            crea una cuenta vacía, no encuentra nada adentro y termina
            escribiendo al WhatsApp. */}
        <div className="auth-bot">
          <div className="auth-box">
            <div className="atleta">
              <p>¿Compraste fotos y las querés bajar de nuevo?</p>
              <Link href="/eventos">
                No hace falta cuenta, buscá tu evento <ArrowRight className="go" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <aside className="auth-side" aria-hidden="true">
        <div className="shot">
          <i className="sil" />
          <div className="sweep" />
          <div className="lock">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="chip">DORSAL 1247</div>
        </div>
        <div className="side-txt">
          <p>{lado.texto}</p>
          <div className="side-num">
            {lado.datos.map(([n, q]) => (
              <span key={q}>
                <b>{n}</b> {q}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

/** El aviso de arriba del formulario. Sólo aparece cuando hay algo que decir. */
export function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="alert" data-on="1" role="alert">
      <CircleAlert />
      <span>{children}</span>
    </div>
  );
}

/**
 * Campo de contraseña con el ojo para revelarla.
 *
 * El ojo no es un adorno: en un teléfono, escribir ocho caracteres a ciegas con
 * autocorrector es la razón número uno por la que alguien "no se acuerda" de
 * una contraseña que acaba de elegir.
 */
export function CampoClave({
  nombre,
  etiqueta,
  autoComplete,
  reglas = false,
  extra,
}: {
  nombre: string;
  etiqueta: string;
  autoComplete: "current-password" | "new-password";
  /** Muestra las reglas y las va marcando mientras se escribe. */
  reglas?: boolean;
  /** Lo que va a la derecha de la etiqueta, como "Me la olvidé". */
  extra?: React.ReactNode;
}) {
  const id = useId();
  const [ver, setVer] = useState(false);
  const [valor, setValor] = useState("");

  return (
    <div className="field">
      <div className="field-top">
        <label htmlFor={id}>{etiqueta}</label>
        {extra}
      </div>

      <div className="pw" data-ver={ver ? "1" : ""}>
        <input
          className="inp"
          id={id}
          name={nombre}
          type={ver ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <button
          className="pw-eye"
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          <span className="ico ico-on">
            <Eye />
          </span>
          <span className="ico ico-off">
            <EyeOff />
          </span>
        </button>
      </div>

      {/* Las reglas se ven desde el principio y se marcan solas. Un mínimo que
          aparece recién al fallar es el que hace que alguien pruebe tres veces
          la misma clave. */}
      {reglas && (
        <div className="reglas">
          <div className="regla" data-ok={valor.length >= 8 ? "1" : ""}>
            <i /> Ocho caracteres o más
          </div>
          <div className="regla" data-ok={/\d/.test(valor) ? "1" : ""}>
            <i /> Al menos un número
          </div>
        </div>
      )}
    </div>
  );
}

/** El logotipo de Google, para el botón que entra sin contraseña. */
export function GoogleG() {
  return (
    <svg className="g-logo" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15.6z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10z"
      />
      <path
        fill="#EA4335"
        d="M24 10.6c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.4 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14l7.1 5.5c1.8-5.3 6.7-8.9 12.5-8.9z"
      />
    </svg>
  );
}

/**
 * El bloque de estado: lo que se ve cuando la pantalla ya no es un formulario.
 *
 * "Revisá tu email", "listo", "este link ya no sirve". El color del ícono dice
 * si salió bien o mal antes de que se lea una palabra.
 */
export function Estado({
  icono,
  tono = "bien",
  titulo,
  bajada,
  children,
}: {
  icono: React.ReactNode;
  tono?: "bien" | "mal";
  titulo: React.ReactNode;
  bajada: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="estado-i" data-tono={tono === "mal" ? "mal" : undefined}>
        {icono}
      </div>
      <h1>{titulo}</h1>
      <p className="auth-sub">{bajada}</p>
      {children}
    </>
  );
}
