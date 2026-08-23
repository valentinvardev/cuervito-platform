"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  getPhotographerMetrics,
  type MetricsRange,
  type PhotographerMetrics,
} from "./metrics-actions";

const RANGES: { value: MetricsRange; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "1y", label: "1 año" },
];

function ars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("es-AR")}`;
}

export function MetricsModal({ onClose }: { onClose: () => void }) {
  const [range, setRange] = useState<MetricsRange>("30d");
  const [data, setData] = useState<PhotographerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPhotographerMetrics(range).then((res) => {
      if (cancelled) return;
      setData(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="cs-modal-backdrop mx-backdrop" onClick={onClose}>
      <div
        className="cs-modal-panel mx-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Métricas de tu actividad"
      >
        {/* Header */}
        <header className="mx-head">
          <div className="mx-head-title">
            <span className="mx-head-icon">
              <i className="ti ti-chart-histogram" />
            </span>
            <div>
              <h2>Tus métricas</h2>
              <p>Cómo viene tu actividad y qué eventos rinden mejor.</p>
            </div>
          </div>
          <button
            type="button"
            className="mx-close"
            onClick={onClose}
            aria-label="Cerrar métricas"
          >
            <i className="ti ti-x" />
          </button>
        </header>

        {/* Range selector */}
        <div className="mx-ranges" role="tablist" aria-label="Período">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="tab"
              aria-selected={range === r.value}
              className={`mx-range ${range === r.value ? "active" : ""}`}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="mx-body">
          {loading || !data ? (
            <MetricsSkeleton />
          ) : (
            <MetricsContent data={data} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MetricsContent({ data }: { data: PhotographerMetrics }) {
  const hasSales = data.salesCount > 0;

  return (
    <>
      {/* Hero: neto del período */}
      <section className="mx-hero">
        <div>
          <div className="mx-hero-label">Tu neto en el período</div>
          <div className="mx-hero-value">{ars(data.netCents)}</div>
          <div className="mx-hero-meta">
            {data.deltaPct === null ? (
              <span className="mx-flat">
                <i className="ti ti-minus" />
                Sin período previo para comparar
              </span>
            ) : (
              <span className={data.deltaPct >= 0 ? "mx-up" : "mx-down"}>
                <i
                  className={
                    data.deltaPct >= 0 ? "ti ti-trending-up" : "ti ti-trending-down"
                  }
                />
                {data.deltaPct >= 0 ? "+" : ""}
                {data.deltaPct.toFixed(0)}% vs período anterior
              </span>
            )}
            <span className="mx-sep" />
            <span className="mx-muted">
              {ars(data.grossCents)} bruto · comisión ya descontada
            </span>
          </div>
        </div>
        <RevenueChart series={data.series} />
      </section>

      {/* Stats row */}
      <section className="mx-stats">
        <Stat
          icon="ti-shopping-cart"
          label="Ventas"
          value={data.salesCount.toLocaleString("es-AR")}
        />
        <Stat
          icon="ti-photo-check"
          label="Fotos vendidas"
          value={data.photosSold.toLocaleString("es-AR")}
        />
        <Stat
          icon="ti-receipt"
          label="Ticket promedio"
          value={data.avgTicketCents == null ? "—" : ars(data.avgTicketCents)}
        />
        <Stat
          icon="ti-download"
          label="Descargas"
          value={data.downloads.toLocaleString("es-AR")}
        />
      </section>

      {/* Conversión — la métrica que compara contra vos mismo y contra el resto */}
      <section className="mx-conversion">
        <div className="mx-conv-main">
          <div className="mx-conv-num">
            {data.conversionPer1000 == null
              ? "—"
              : data.conversionPer1000.toFixed(1)}
          </div>
          <div className="mx-conv-lbl">
            fotos vendidas
            <br />
            por cada 1.000 subidas
          </div>
        </div>
        <div className="mx-conv-read">
          <ConversionReading value={data.conversionPer1000} />
          <div className="mx-conv-base">
            Sobre {data.photosUploaded.toLocaleString("es-AR")} fotos publicadas
            en total.
          </div>
        </div>
      </section>

      {/* Reconocimiento facial */}
      {data.faceSearches > 0 && <FaceRecognition data={data} />}

      {/* Top eventos */}
      <section className="mx-top">
        <h3>Eventos que más recaudaron</h3>
        {!hasSales ? (
          <div className="mx-empty">
            <i className="ti ti-chart-bar-off" />
            <div>
              <strong>Todavía no hay ventas en este período.</strong>
              <span>
                Publicá tus eventos y compartí el link para empezar a vender.
              </span>
            </div>
          </div>
        ) : (
          <ul className="mx-top-list">
            {data.topEvents.map((e, i) => {
              const max = data.topEvents[0]?.netCents ?? 1;
              const pct = max > 0 ? (e.netCents / max) * 100 : 0;
              return (
                <li key={e.id} className="mx-top-row">
                  <span className="mx-rank">{i + 1}</span>
                  <div className="mx-top-info">
                    <div className="mx-top-name">{e.name}</div>
                    <div className="mx-top-meta">
                      {e.salesCount} {e.salesCount === 1 ? "venta" : "ventas"} ·{" "}
                      {e.photosSold} {e.photosSold === 1 ? "foto" : "fotos"}
                    </div>
                    <div className="mx-bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="mx-top-amt">{ars(e.netCents)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/** Lectura contextual del número de conversión, para que signifique algo. */
function ConversionReading({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <p className="mx-conv-text">
        Vamos a calcularla cuando subas fotos y entren las primeras ventas.
      </p>
    );
  }
  if (value >= 20) {
    return (
      <p className="mx-conv-text mx-good">
        <i className="ti ti-flame" />
        Conversión excelente. Tu inventario se está vendiendo muy bien —
        considerá subir el precio por foto.
      </p>
    );
  }
  if (value >= 5) {
    return (
      <p className="mx-conv-text mx-ok">
        <i className="ti ti-circle-check" />
        Conversión saludable. Estás en el rango esperado para eventos con buena
        difusión.
      </p>
    );
  }
  return (
    <p className="mx-conv-text mx-low">
      <i className="ti ti-bulb" />
      Conversión baja. Suele mejorar compartiendo el link del evento el mismo
      día y revisando que los dorsales se lean bien.
    </p>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="mx-stat">
      <span className="mx-stat-icon">
        <i className={`ti ${icon}`} />
      </span>
      <div>
        <div className="mx-stat-label">{label}</div>
        <div className="mx-stat-value">{value}</div>
      </div>
    </div>
  );
}

/**
 * Área SVG de recaudación diaria. Sin librería: el dataset es chico y
 * un path calculado a mano evita 40kB de bundle. Hover muestra el día
 * y el monto exacto.
 */
function RevenueChart({
  series,
}: {
  series: { date: string; cents: number; sales: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 460;
  const H = 120;
  const PAD_Y = 10;

  const { line, area, points, max } = useMemo(() => {
    const max = Math.max(...series.map((s) => s.cents), 1);
    const stepX = series.length > 1 ? W / (series.length - 1) : W;
    const pts = series.map((s, i) => ({
      x: i * stepX,
      y: PAD_Y + (1 - s.cents / max) * (H - PAD_Y * 2),
      ...s,
    }));
    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const last = pts[pts.length - 1];
    const first = pts[0];
    const area =
      pts.length > 0
        ? `${line} L ${last!.x.toFixed(1)} ${H} L ${first!.x.toFixed(1)} ${H} Z`
        : "";
    return { line, area, points: pts, max };
  }, [series]);

  const active = hover != null ? points[hover] : null;
  const empty = max <= 1;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, idx)));
  }

  return (
    <div className="mx-chart">
      {active && (
        <div
          className="mx-chart-tip"
          style={{ left: `${(active.x / W) * 100}%` }}
        >
          <strong>{ars(active.cents)}</strong>
          <span>
            {new Date(active.date + "T12:00:00").toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
            })}
            {active.sales > 0 &&
              ` · ${active.sales} ${active.sales === 1 ? "venta" : "ventas"}`}
          </span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Recaudación diaria del período"
      >
        <defs>
          <linearGradient id="mx-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {!empty && <path d={area} fill="url(#mx-grad)" />}
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={empty ? 0.25 : 1}
          vectorEffect="non-scaling-stroke"
        />
        {active && (
          <>
            <line
              x1={active.x}
              y1={0}
              x2={active.x}
              y2={H}
              stroke="var(--border-default)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="4"
              fill="var(--accent)"
              stroke="var(--bg-surface)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {empty && <div className="mx-chart-empty">Sin ventas en el período</div>}
    </div>
  );
}


/**
 * Embudo del reconocimiento facial. Responde dos preguntas distintas:
 *   ¿encuentra?  → búsquedas con resultado sobre el total
 *   ¿convierte?  → de las fotos que mostró, cuántas se vendieron
 * Un motor que encuentra pero no convierte es un problema de precio o de
 * calidad; uno que no encuentra es un problema de indexado.
 */
function FaceRecognition({ data }: { data: PhotographerMetrics }) {
  const withResults = data.faceSearches - data.faceSearchesEmpty;
  const hitRate = data.faceSearches > 0
    ? (withResults / data.faceSearches) * 100
    : 0;
  const buyRate = data.facePhotosShown > 0
    ? (data.facePhotosSold / data.facePhotosShown) * 100
    : 0;

  return (
    <section className="mx-face">
      <div className="mx-face-head">
        <h3>
          <i className="ti ti-scan-eye" />
          Búsquedas por selfie
        </h3>
        <span className="mx-face-count">
          {data.faceSearches.toLocaleString("es-AR")}{" "}
          {data.faceSearches === 1 ? "búsqueda" : "búsquedas"}
        </span>
      </div>

      <div className="mx-funnel">
        <FunnelStep
          label="Encontraron fotos"
          value={`${withResults.toLocaleString("es-AR")} de ${data.faceSearches.toLocaleString("es-AR")}`}
          pct={hitRate}
        />
        <FunnelStep
          label="Fotos que mostró"
          value={data.facePhotosShown.toLocaleString("es-AR")}
          pct={100}
          muted
        />
        <FunnelStep
          label="De esas, vendidas"
          value={data.facePhotosSold.toLocaleString("es-AR")}
          pct={buyRate}
          accent
        />
      </div>

      <p className="mx-face-read">
        {data.faceSearches < 10 ? (
          <>
            <i className="ti ti-info-circle" />
            Todavía son pocas búsquedas para sacar conclusiones. El número se
            vuelve confiable a partir de unas 30.
          </>
        ) : hitRate < 60 ? (
          <>
            <i className="ti ti-alert-triangle" />
            <span>
              <strong>{(100 - hitRate).toFixed(0)}% de las selfies no encontró nada.</strong>{" "}
              Suele pasar cuando la persona no salió en las fotos, o cuando
              aparece de espaldas o muy lejos.
            </span>
          </>
        ) : buyRate < 5 ? (
          <>
            <i className="ti ti-bulb" />
            <span>
              El reconocimiento encuentra bien, pero solo se vende{" "}
              <strong>{buyRate.toFixed(1)}%</strong> de lo que muestra. Cuando
              encontrar funciona y comprar no, casi siempre es el precio.
            </span>
          </>
        ) : (
          <>
            <i className="ti ti-circle-check" />
            <span>
              De cada 100 fotos que el reconocimiento le muestra a alguien,{" "}
              <strong>{buyRate.toFixed(0)}</strong> se compran.
            </span>
          </>
        )}
      </p>
    </section>
  );
}

function FunnelStep({
  label,
  value,
  pct,
  muted = false,
  accent = false,
}: {
  label: string;
  value: string;
  pct: number;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`mx-funnel-step ${muted ? "muted" : ""} ${accent ? "accent" : ""}`}>
      <div className="mx-funnel-top">
        <span className="mx-funnel-label">{label}</span>
        <span className="mx-funnel-value">{value}</span>
      </div>
      <div className="mx-funnel-bar">
        <span style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="mx-skel">
      <div className="skel" style={{ height: 128, borderRadius: 14 }} />
      <div className="mx-skel-row">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel" style={{ height: 66, borderRadius: 12 }} />
        ))}
      </div>
      <div className="skel" style={{ height: 90, borderRadius: 14 }} />
      <div className="skel" style={{ height: 140, borderRadius: 14 }} />
    </div>
  );
}
