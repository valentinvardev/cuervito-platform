"use client";

export function EventMonetizationSection({
  revenue,
  photosSold,
  conversion,
  pricePerPhoto,
}: {
  revenue: number;
  photosSold: number;
  conversion: number | null;
  pricePerPhoto: number;
}) {
  return (
    <>
      <div className="stats-grid">
        <div className="stat">
          <div className="label">Recaudado</div>
          <div className="value accent">
            ${revenue.toLocaleString("es-AR")}
          </div>
          <div className="delta">
            <i className="ti ti-minus" style={{ fontSize: 12, color: "var(--text-tertiary)" }} />
            <span style={{ color: "var(--text-tertiary)" }}>Sin ventas todavía</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Fotos vendidas</div>
          <div className="value mono">{photosSold.toLocaleString("es-AR")}</div>
        </div>
        <div className="stat">
          <div className="label">Precio por foto</div>
          <div className="value mono">${pricePerPhoto.toLocaleString("es-AR")}</div>
        </div>
      </div>

      <div className="insight">
        <i className="ti ti-info-circle" />
        <div>
          <strong>Conversión:</strong>{" "}
          {conversion === null
            ? "Vamos a calcularla cuando empiecen a entrar ventas."
            : `${conversion.toFixed(1)}%`}
          {" "}· La gestión de descuentos y reportes detallados se habilita en una fase posterior.
        </div>
      </div>
    </>
  );
}
