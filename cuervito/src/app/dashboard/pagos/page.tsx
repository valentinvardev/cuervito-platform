import Link from "next/link";
import { CircleCheck, Info } from "lucide-react";

import { db } from "~/server/db";

import { pesos, sesionPanel } from "../_components/sesion";

export const dynamic = "force-dynamic";

export default async function V2Pagos() {
  const { userId, yo } = await sesionPanel();

  const desdeMes = new Date();
  desdeMes.setDate(1);
  desdeMes.setHours(0, 0, 0, 0);

  const mes = await db.sale.aggregate({
    _sum: { totalCents: true, platformFeeCents: true, sellerNetCents: true },
    where: { sellerId: userId, status: "PAID", paidAt: { gte: desdeMes } },
  });

  const bruto = mes._sum.totalCents ?? 0;
  const comision = mes._sum.platformFeeCents ?? 0;
  const neto = mes._sum.sellerNetCents ?? 0;
  const conectada = !!yo?.mpConnectedAt;

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Métodos de pago</h1>
            <p>Dónde recibís la plata de tus ventas.</p>
          </div>
        </div>

        {/* La cuenta conectada abre la pantalla. Antes acá iba un "te va a
            entrar el lunes 18", que describía un saldo pendiente nuestro que
            no existe: con el reparto de Mercado Pago la plata cae en la cuenta
            del fotógrafo en el momento de la venta. */}
        <section className="metodo">
          <div className="metodo-h">
            <span className="mp-marca ancha" role="img" aria-label="Mercado Pago" />
            {conectada ? (
              <span className="pill live">
                <i /> Conectada
              </span>
            ) : (
              <span className="pill draft">
                <i /> Sin conectar
              </span>
            )}
          </div>

          <dl className="metodo-d">
            <div>
              <dt>Cuenta</dt>
              <dd>{conectada ? "Vinculada a Mercado Pago" : "Todavía no vinculaste ninguna"}</dd>
            </div>
            <div>
              <dt>Conectada</dt>
              <dd>
                {yo?.mpConnectedAt
                  ? yo.mpConnectedAt.toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Recibiste este mes</dt>
              <dd className="tnum">{pesos(neto)}</dd>
            </div>
          </dl>

          <div className="metodo-f">
            {/* Con Link, igual que en /onboarding/mp: el destino es el
                handler que arranca el OAuth de Mercado Pago. */}
            <Link href="/api/mp/oauth/start" className="btn btn-ghost btn-sm">
              {conectada ? "Cambiar cuenta" : "Conectar Mercado Pago"}
            </Link>
            {conectada && (
              <span className="mp-ok" style={{ marginLeft: "auto" }}>
                <CircleCheck /> Activo
              </span>
            )}
          </div>
        </section>

        {/* Decirlo evita que el fotógrafo busque una segunda opción que no
            existe y crea que le falta configurar algo. */}
        <div className="porque">
          <Info />
          <span>
            Hoy Mercado Pago es el único método. Es el que usa el atleta para pagar y el que te
            deposita a vos, así que no hay una segunda cuenta que conectar.
          </span>
        </div>

        <div className="duo">
          <section className="card">
            <div className="card-h">
              <div>
                <h2>Cómo se reparte cada venta</h2>
                <div className="sub">Este mes, hasta hoy</div>
              </div>
            </div>

            <dl className="desglose">
              <div>
                <dt>Precio de lista</dt>
                <dd className="tnum">{pesos(bruto)}</dd>
              </div>
              <div className="fee">
                <dt>Comisión encontrate</dt>
                <dd className="tnum">− {pesos(comision)}</dd>
              </div>
              <div className="tot">
                <dt>Recibiste</dt>
                <dd className="tnum">{pesos(neto)}</dd>
              </div>
            </dl>

            <div className="fund">
              <Info />
              <span>
                {bruto > 0 ? (
                  <>
                    Sobre {pesos(bruto)} vendidos, la comisión fue{" "}
                    <b>{((comision / bruto) * 100).toFixed(1)}%</b>.
                  </>
                ) : (
                  <>Todavía no hay ventas este mes, así que no hay nada que repartir.</>
                )}
              </span>
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <div>
                <h2>Cómo funciona</h2>
              </div>
            </div>
            <div className="pasos" style={{ gridTemplateColumns: "minmax(0,1fr)", gap: "var(--s-4)" }}>
              <div className="paso">
                <span className="paso-n">1</span>
                <b>El atleta paga en tu página</b>
                <p>Con tarjeta, débito o dinero en cuenta, todo por Mercado Pago.</p>
              </div>
              <div className="paso">
                <span className="paso-n">2</span>
                <b>La plata entra en tu cuenta, en el momento</b>
                <p>
                  Directo a tu Mercado Pago, con la comisión ya descontada. No pasa por nosotros ni
                  queda retenida acá.
                </p>
              </div>
              <div className="paso">
                <span className="paso-n">3</span>
                <b>La usás como cualquier otra venta tuya</b>
                <p>
                  Los plazos para retirarla a tu banco son los de tu cuenta de Mercado Pago, y los
                  manejás desde ahí.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
