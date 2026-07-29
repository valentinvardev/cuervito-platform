"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type CollaboratorRow = {
  id: string;
  email: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  commissionScope: "NONE" | "OWN" | "ALL";
  commissionPct: number;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  invitedAt: string;
  acceptedAt: string | null;
};

export function CollaboratorsPanel({
  eventId,
  host,
  pricePerPhoto,
}: {
  eventId: string;
  host: { name: string | null; email: string | null; image: string | null };
  pricePerPhoto: number;
}) {
  const [rows, setRows] = useState<CollaboratorRow[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CollaboratorRow | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard/events/${eventId}/collaborators`);
    if (res.ok) setRows((await res.json()) as CollaboratorRow[]);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="collab-panel">
      <div className="collab-panel-head">
        <div>
          <h3>Colaboradores</h3>
          <div className="collab-panel-sub">
            Invitá a otros fotógrafos a subir fotos y compartir ventas.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setShowAdd(true)}
          data-tip="Invitar a otro fotógrafo a subir fotos en este evento"
        >
          <i className="ti ti-user-plus" />
          Agregar colaborador
        </button>
      </div>

      <ul className="collab-list">
        {/* Host siempre primero */}
        <li className="collab-row is-host">
          <div className="collab-avatar">
            {host.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={host.image} alt="" />
            ) : (
              <span>{(host.name ?? host.email ?? "?").charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="collab-info">
            <div className="collab-name">
              {host.name ?? host.email ?? "Vos"} <span className="collab-you">tú</span>
            </div>
            <div className="collab-meta">Fotógrafo host · recibe todo el neto de sus ventas</div>
          </div>
          <span className="collab-badge collab-badge-host">Host</span>
        </li>

        {rows === null ? (
          <li className="collab-row collab-row-skeleton">
            <div className="skel" style={{ width: 40, height: 40, borderRadius: "50%" }} />
            <div style={{ flex: 1 }}>
              <div className="skel bar w-40" />
              <div className="skel bar w-60" style={{ marginTop: 6 }} />
            </div>
          </li>
        ) : rows.length === 0 ? (
          <li className="collab-empty">
            Todavía no invitaste a nadie.
          </li>
        ) : (
          rows.map((c) => (
            <li key={c.id} className="collab-row">
              <div className="collab-avatar">
                {c.userImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.userImage} alt="" />
                ) : (
                  <span>{(c.userName ?? c.email).charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="collab-info">
                <div className="collab-name">{c.userName ?? c.email}</div>
                <div className="collab-meta">
                  {c.status === "PENDING"
                    ? "Esperando que acepte la invitación"
                    : `Colaborador · ${describeCommission(c, pricePerPhoto)}`}
                </div>
              </div>
              <div className="collab-actions">
                <StatusBadge status={c.status} />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => setEditing(c)}
                  aria-label="Editar comisión"
                  data-tip="Cambiar el porcentaje y alcance de su comisión"
                >
                  <i className="ti ti-adjustments-alt" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={async () => {
                    if (!confirm(`¿Sacar a ${c.userName ?? c.email} del evento? No afecta ventas pasadas.`)) return;
                    await fetch(
                      `/api/dashboard/events/${eventId}/collaborators/${c.id}`,
                      { method: "DELETE" },
                    );
                    await load();
                  }}
                  aria-label="Quitar colaborador"
                  data-tip="Sacarlo del evento (no afecta ventas ya hechas)"
                  style={{ color: "var(--error)" }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      {showAdd && (
        <AddCollaboratorModal
          eventId={eventId}
          pricePerPhoto={pricePerPhoto}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      )}
      {editing && (
        <EditCollaboratorModal
          eventId={eventId}
          collaborator={editing}
          pricePerPhoto={pricePerPhoto}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function describeCommission(c: CollaboratorRow, price: number): string {
  if (c.commissionScope === "NONE") return "sin comisión";
  const per = Math.round((price * c.commissionPct) / 100);
  if (c.commissionScope === "OWN") {
    return `${c.commissionPct}% de ventas propias · ~$${per.toLocaleString("es-AR")} por foto suya`;
  }
  return `${c.commissionPct}% de todas las ventas · ~$${per.toLocaleString("es-AR")} por foto`;
}

function StatusBadge({ status }: { status: CollaboratorRow["status"] }) {
  if (status === "ACCEPTED") {
    return (
      <span className="collab-badge collab-badge-active" title="Aceptó la invitación">
        <i className="ti ti-circle-check-filled" /> activo
      </span>
    );
  }
  if (status === "REVOKED") {
    return <span className="collab-badge collab-badge-muted">revocado</span>;
  }
  return (
    <span className="collab-badge collab-badge-pending" title="Todavía no aceptó">
      <i className="ti ti-clock" /> pendiente
    </span>
  );
}

// ─────────────────────────────── Modal ────────────────────────────────

export function AddCollaboratorModal({
  eventId,
  pricePerPhoto,
  onClose,
  onCreated,
}: {
  eventId: string;
  pricePerPhoto: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<"NONE" | "OWN" | "ALL">("NONE");
  const [pct, setPct] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/dashboard/events/${eventId}/collaborators`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          commissionScope: scope,
          commissionPct: scope === "NONE" ? 0 : pct,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No pudimos enviar la invitación.");
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="cs-modal-backdrop"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 210,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="cs-modal-panel"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 460,
          padding: 24,
        }}
      >
        <h3 className="collab-modal-title">
          <i className="ti ti-user-plus" /> Invitar colaborador
        </h3>
        <p className="collab-modal-sub">
          Va a recibir un email para aceptar. Si ya tiene cuenta, se le agrega
          directo cuando entra.
        </p>

        <div className="new-field full" style={{ marginTop: 18 }}>
          <label className="label" htmlFor="collab-email">Email del colaborador</label>
          <input
            id="collab-email"
            type="email"
            required
            className="input"
            placeholder="fotografo@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="collab-question">
          <div className="cq-label">¿Va a recibir comisión?</div>
          <div className="cq-choices">
            <ChoiceButton
              active={scope === "NONE"}
              onClick={() => setScope("NONE")}
              title="No"
            />
            <ChoiceButton
              active={scope !== "NONE"}
              onClick={() => setScope((s) => (s === "NONE" ? "OWN" : s))}
              title="Sí"
            />
          </div>
        </div>

        {scope !== "NONE" && (
          <>
            <div className="collab-question">
              <div className="cq-label">Sobre qué ventas</div>
              <div className="cq-choices">
                <ChoiceButton
                  active={scope === "OWN"}
                  onClick={() => setScope("OWN")}
                  title="Solo sus fotos"
                />
                <ChoiceButton
                  active={scope === "ALL"}
                  onClick={() => setScope("ALL")}
                  title="Todas las del evento"
                />
              </div>
            </div>

            <div className="collab-question">
              <div className="cq-label">Porcentaje</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={pct}
                  onChange={(e) => setPct(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <div
                  style={{
                    minWidth: 56,
                    padding: "6px 10px",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    textAlign: "right",
                  }}
                >
                  {pct}%
                </div>
              </div>
            </div>

            <div className="collab-preview">
              <i className="ti ti-calculator" />
              <div>
                <div className="cp-lbl">Se va a llevar por cada foto vendida</div>
                <div className="cp-val">
                  ${Math.round((pricePerPhoto * pct) / 100).toLocaleString("es-AR")}
                  {" "}<span>· precio actual ${pricePerPhoto.toLocaleString("es-AR")}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "rgba(224,85,85,0.1)",
              border: "1px solid rgba(224,85,85,0.35)",
              borderRadius: 8,
              color: "var(--error)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Enviando…" : "Enviar invitación"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function EditCollaboratorModal({
  eventId,
  collaborator,
  pricePerPhoto,
  onClose,
  onSaved,
}: {
  eventId: string;
  collaborator: CollaboratorRow;
  pricePerPhoto: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState(collaborator.commissionScope);
  const [pct, setPct] = useState(collaborator.commissionPct);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/dashboard/events/${eventId}/collaborators/${collaborator.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commissionScope: scope,
          commissionPct: scope === "NONE" ? 0 : pct,
        }),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="cs-modal-backdrop"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 210,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cs-modal-panel"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 440,
          padding: 24,
        }}
      >
        <h3 className="collab-modal-title">
          <i className="ti ti-adjustments-alt" /> Editar comisión
        </h3>
        <p className="collab-modal-sub">
          Cambia los parámetros a partir de este momento. Las ventas ya
          registradas no se recalculan.
        </p>

        <div className="collab-question">
          <div className="cq-label">Sobre qué ventas</div>
          <div className="cq-choices">
            <ChoiceButton
              active={scope === "NONE"}
              onClick={() => setScope("NONE")}
              title="Sin comisión"
            />
            <ChoiceButton
              active={scope === "OWN"}
              onClick={() => setScope("OWN")}
              title="Solo sus fotos"
            />
            <ChoiceButton
              active={scope === "ALL"}
              onClick={() => setScope("ALL")}
              title="Todas"
            />
          </div>
        </div>

        {scope !== "NONE" && (
          <>
            <div className="collab-question">
              <div className="cq-label">Porcentaje</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={pct}
                  onChange={(e) => setPct(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <div
                  style={{
                    minWidth: 56,
                    padding: "6px 10px",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    textAlign: "right",
                  }}
                >
                  {pct}%
                </div>
              </div>
            </div>
            <div className="collab-preview">
              <i className="ti ti-calculator" />
              <div>
                <div className="cp-lbl">Se va a llevar por foto</div>
                <div className="cp-val">
                  ${Math.round((pricePerPhoto * pct) / 100).toLocaleString("es-AR")}
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ChoiceButton({ active, onClick, title }: { active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      className={`cq-choice ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {title}
    </button>
  );
}
