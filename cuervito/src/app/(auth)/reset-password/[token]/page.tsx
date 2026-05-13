import Link from "next/link";

import { db } from "~/server/db";

import { ResetPasswordForm } from "./reset-form";

export default async function ResetPasswordPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const row = await db.passwordResetToken.findUnique({
    where: { token },
    select: { expiresAt: true, usedAt: true },
  });

  const isValid = !!row && !row.usedAt && row.expiresAt > new Date();

  if (!isValid) {
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
            background: "rgba(224,85,85,0.12)",
            border: "1px solid rgba(224,85,85,0.4)",
            color: "var(--error)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
            fontSize: 26,
          }}
        >
          <i className="ti ti-alert-circle" />
        </div>

        <h1 style={{ textAlign: "center" }}>Link inválido</h1>
        <p className="sub" style={{ textAlign: "center" }}>
          Este link de reset venció o ya fue usado. Pedí uno nuevo y revisá tu
          correo.
        </p>

        <Link
          href="/forgot-password"
          className="btn btn-primary auth-submit"
          style={{ marginTop: 22 }}
        >
          Pedir nuevo link
        </Link>

        <p className="auth-foot">
          <Link href="/login">Volver al login</Link>
        </p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
