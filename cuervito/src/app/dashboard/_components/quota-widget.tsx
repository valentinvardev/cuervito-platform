import { type QuotaUsage, formatBytes } from "~/server/quotas";

export function QuotaWidget({ quota }: { quota: QuotaUsage }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 28,
        display: "grid",
        gap: 14,
      }}
    >
      <QuotaBar
        label="Almacenamiento"
        used={formatBytes(quota.storage.usedBytes)}
        limit={formatBytes(quota.storage.limitBytes)}
        pct={quota.storage.pct}
        icon="ti-database"
      />
      <QuotaBar
        label="Reconocimientos este mes"
        used={quota.recognitions.used.toLocaleString("es-AR")}
        limit={quota.recognitions.limit.toLocaleString("es-AR")}
        pct={quota.recognitions.pct}
        icon="ti-scan-eye"
      />
    </section>
  );
}

function QuotaBar({
  label,
  used,
  limit,
  pct,
  icon,
}: {
  label: string;
  used: string;
  limit: string;
  pct: number;
  icon: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    clamped >= 90 ? "var(--error)" : clamped >= 70 ? "var(--warning)" : "var(--accent)";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
          gap: 12,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 14, color: "var(--text-tertiary)" }} />
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-tertiary)",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>{used}</span> / {limit}
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--bg-elevated)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: color,
            borderRadius: 999,
            transition: "width 240ms ease",
          }}
        />
      </div>
    </div>
  );
}
