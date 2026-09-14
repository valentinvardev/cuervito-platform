import "~/styles/prototype/styles.css";
import "~/styles/prototype/legal.css";

import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />

      <header className="legal-nav">
        <Link href="/" className="logo">
          cuerv<span className="logo-dot"></span>to
        </Link>
        <nav className="legal-nav-links">
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
        </nav>
      </header>

      <main className="legal-wrap">{children}</main>

      <footer className="legal-foot">
        <div>
          © {new Date().getFullYear()} cuervito · Plataforma de fotos
          deportivas
        </div>
        <div>
          <Link href="/">Inicio</Link>
          {" · "}
          <Link href="/login">Iniciar sesión</Link>
        </div>
      </footer>
    </>
  );
}
