import Link from "next/link";

export default function PagoPendientePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 18,
          padding: 36,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(245,182,42,0.14)",
            border: "2px solid var(--warning)",
            color: "var(--warning)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 40,
          }}
        >
          <i className="ti ti-clock" />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: "-0.025em",
            marginBottom: 8,
          }}
        >
          Pago en proceso
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 22 }}>
          Mercado Pago está procesando tu pago. En cuanto se confirme te enviamos un email con el
          link para descargar tus fotos.
        </p>
        <Link
          href="/"
          className="btn btn-outline"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
