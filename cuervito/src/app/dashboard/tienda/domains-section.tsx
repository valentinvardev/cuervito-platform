"use client";

import { useActionState, useState, useTransition } from "react";

import {
  addCustomDomainAction,
  refreshDomainStatusAction,
  removeCustomDomainAction,
  retryDomainAction,
  type AddDomainState,
} from "./domain-actions";

export type DomainRow = {
  id: string;
  hostname: string;
  status: string;
  errorMessage: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export function DomainsSection({
  domains: initialDomains,
  cfEnabled,
}: {
  domains: DomainRow[];
  cfEnabled: boolean;
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [state, formAction, pending] = useActionState<AddDomainState, FormData>(
    addCustomDomainAction,
    { error: null },
  );

  return (
    <section className="section">
      <div className="section-head">
        <h2>Dominio propio</h2>
        <span className="sub">
          Conectá un dominio que ya tenés (ej. tu-marca.com)
        </span>
      </div>

      {!cfEnabled && (
        <div className="domain-callout warning">
          <i className="ti ti-alert-triangle" />
          <div>
            La conexión de dominios no está habilitada en este servidor.
            Si querés conectar uno, escribinos a{" "}
            <a href="mailto:hola@cuervito.app">hola@cuervito.app</a>.
          </div>
        </div>
      )}

      {cfEnabled && (
        <>
          {domains.length === 0 && (
            <p
              style={{
                fontSize: 13.5,
                color: "var(--text-secondary)",
                marginBottom: 14,
                lineHeight: 1.55,
              }}
            >
              Conectá un dominio que tengas en tu registrador (Namecheap, GoDaddy,
              etc.). Te pedimos crear unos registros DNS, verificamos que apunten
              acá y emitimos el certificado SSL automáticamente. Tarda 5–10
              minutos típicamente.
            </p>
          )}

          {domains.map((d) => (
            <DomainCard key={d.id} domain={d} onRemove={(id) => setDomains((ds) => ds.filter((x) => x.id !== id))} />
          ))}

          {state.dnsRecords && state.hostname && (
            <DnsInstructions hostname={state.hostname} records={state.dnsRecords} />
          )}

          <form action={formAction} className="domain-add-form">
            <input
              type="text"
              name="hostname"
              className="input"
              placeholder="tu-marca.com"
              autoComplete="off"
              autoCapitalize="off"
              required
              disabled={pending}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending}
            >
              {pending ? "Conectando…" : "Conectar dominio"}
            </button>
          </form>

          {state.error && (
            <div className="domain-callout error">
              <i className="ti ti-alert-circle" />
              {state.error}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function statusLabel(status: string): { label: string; color: string; hint?: string } {
  switch (status) {
    case "ACTIVE":
      return { label: "Activo", color: "var(--success)" };
    case "PENDING_DNS":
      return {
        label: "Esperando DNS",
        color: "var(--warning)",
        hint: "Configurá los DNS records en tu registrador y dale a 'Refrescar'.",
      };
    case "PENDING_SSL":
      return {
        label: "Emitiendo certificado",
        color: "var(--accent)",
        hint: "Cloudflare está emitiendo el cert SSL. Tarda 2–10 minutos.",
      };
    case "FAILED":
      return { label: "Falló", color: "var(--error)" };
    default:
      return { label: status, color: "var(--text-tertiary)" };
  }
}

function DomainCard({
  domain,
  onRemove,
}: {
  domain: DomainRow;
  onRemove: (id: string) => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status = statusLabel(domain.status);

  return (
    <div className="domain-row" style={{ flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span className="url" style={{ fontWeight: 500 }}>
            {domain.hostname}
          </span>
          <span
            className="badge-cuervito"
            style={{
              color: status.color,
              borderColor: status.color,
            }}
          >
            {status.label}
          </span>
        </div>
        {status.hint && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{status.hint}</div>
        )}
        {domain.errorMessage && (
          <div style={{ fontSize: 12, color: "var(--error)" }}>
            <i className="ti ti-alert-circle" /> {domain.errorMessage}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {domain.status !== "ACTIVE" && (
          <button
            type="button"
            className="copy"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await refreshDomainStatusAction(domain.id);
                if (r.error) setError(r.error);
              })
            }
          >
            {busy ? "…" : "Refrescar"}
          </button>
        )}
        {domain.status === "FAILED" && (
          <button
            type="button"
            className="copy"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await retryDomainAction(domain.id);
                if (r.error) setError(r.error);
              })
            }
          >
            Reintentar
          </button>
        )}
        <button
          type="button"
          className="copy"
          style={{ color: "var(--error)" }}
          disabled={busy}
          onClick={() => {
            if (!confirm(`¿Desconectar ${domain.hostname}?`)) return;
            startTransition(async () => {
              const r = await removeCustomDomainAction(domain.id);
              if (r.error) setError(r.error);
              else onRemove(domain.id);
            });
          }}
        >
          Quitar
        </button>
      </div>
      {error && (
        <div className="domain-callout error" style={{ width: "100%", marginTop: 8 }}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}
    </div>
  );
}

function DnsInstructions({
  hostname,
  records,
}: {
  hostname: string;
  records: { type: string; name: string; value: string }[];
}) {
  return (
    <div className="dns-instructions">
      <div className="ttl">
        <i className="ti ti-bulb" /> Configurá estos DNS en tu registrador
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        En el panel de control de <strong>{hostname}</strong> (Namecheap, GoDaddy,
        Cloudflare, etc.), agregá estos registros DNS. Cuando los tengas, volvé
        acá y tocá <strong>Refrescar</strong>. Tarda 5–15 minutos en propagar.
      </p>
      <div className="dns-table">
        <div className="dns-row dns-head">
          <span>Tipo</span>
          <span>Nombre</span>
          <span>Valor</span>
        </div>
        {records.map((r, i) => (
          <div key={i} className="dns-row">
            <span className="mono">{r.type}</span>
            <span className="mono" style={{ wordBreak: "break-all" }}>
              {r.name}
            </span>
            <span className="mono" style={{ wordBreak: "break-all" }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
