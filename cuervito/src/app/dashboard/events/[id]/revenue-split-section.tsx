"use client";

import { useCallback, useEffect, useState } from "react";

type Seller = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  photosSold: number;
  grossCents: number;
  isOwner: boolean;
  commissionCents: number;
};

type Split = {
  totalNetCents: number;
  totalCommissionCents: number;
  ownerKeepsCents: number;
  unattributedCents: number;
  sellers: Seller[];
};

function ars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("es-AR")}`;
}

export function RevenueSplitSection({ eventId }: { eventId: string }) {
  const [data, setData] = useState<Split | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/events/${eventId}/revenue-split`);
      if (res.ok) setData((await res.json()) as Split);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sin colaboradores que cobren comisión no hay nada que repartir: la
  // sección solo aporta ruido, así que no se muestra.
  const hasSplit =
    !!data && (data.totalCommissionCents > 0 || data.sellers.length > 1);
  if (!loading && !hasSplit) return null;

  return (
    <section className="rs-section">
      <div className="rs-head">
        <h3>Ventas por vendedor</h3>
        <p>Quién subió las fotos que se vendieron y cuánto le corresponde.</p>
      </div>

      {loading || !data ? (
        <div className="rs-list">
          {[0, 1].map((i) => (
            <div key={i} className="rs-row">
              <span className="skel" style={{ width: 36, height: 36, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <span className="skel bar w-40" />
                <span className="skel bar w-60" style={{ marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="rs-list">
            {data.sellers.map((s) => (
              <div key={s.userId} className="rs-row">
                <div className="rs-avatar">
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt="" />
                  ) : (
                    <span>{(s.name ?? s.email ?? "?").charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="rs-info">
                  <div className="rs-name">
                    {s.name ?? s.email ?? "—"}
                    {s.isOwner && <span className="rs-tag">host</span>}
                  </div>
                  <div className="rs-meta">
                    {s.photosSold > 0
                      ? `${s.photosSold} ${s.photosSold === 1 ? "foto vendida" : "fotos vendidas"} · ${ars(s.grossCents)} generados`
                      : "Todavía no vendió fotos suyas"}
                  </div>
                </div>
                <div className="rs-amt">
                  {s.commissionCents > 0 ? (
                    <>
                      <span className="rs-amt-val">{ars(s.commissionCents)}</span>
                      <span className="rs-amt-lbl">a pagarle</span>
                    </>
                  ) : (
                    <span className="rs-amt-lbl">sin comisión</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rs-totals">
            <div className="rs-total-row">
              <span>Neto del evento</span>
              <span className="mono">{ars(data.totalNetCents)}</span>
            </div>
            {data.totalCommissionCents > 0 && (
              <div className="rs-total-row muted">
                <span>Comisiones a colaboradores</span>
                <span className="mono">−{ars(data.totalCommissionCents)}</span>
              </div>
            )}
            <div className="rs-total-row strong">
              <span>Te queda</span>
              <span className="mono">{ars(data.ownerKeepsCents)}</span>
            </div>
          </div>

          <div className="rs-note">
            <i className="ti ti-info-circle" />
            <span>
              Mercado Pago acredita la venta completa en tu cuenta. Las
              comisiones quedan registradas acá para que las liquides vos con
              cada colaborador — la plataforma no las transfiere.
            </span>
          </div>

          {data.unattributedCents > 0 && (
            <div className="rs-note warn">
              <i className="ti ti-alert-triangle" />
              <span>
                {ars(data.unattributedCents)} corresponden a fotos subidas antes
                de que existiera el registro de colaboradores, así que no se le
                atribuyen a nadie.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
