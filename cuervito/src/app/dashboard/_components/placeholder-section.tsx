import Link from "next/link";

export function PlaceholderSection({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>{title}</h1>
          <div className="sub">{description}</div>
        </div>
      </div>

      <div className="empty-state">
        <div className="ic">
          <i className={`ti ${icon}`} />
        </div>
        <h3>Próximamente</h3>
        <p>
          Esta sección se va a habilitar en una próxima fase del desarrollo.
          Por ahora estamos terminando lo básico para que puedas crear eventos.
        </p>
        <Link href="/dashboard" className="btn btn-outline">
          <i className="ti ti-arrow-left" />
          Volver al panel
        </Link>
      </div>
    </main>
  );
}
