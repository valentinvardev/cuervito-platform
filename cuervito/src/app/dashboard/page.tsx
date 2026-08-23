import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ImageDown,
  ImageOff,
  Percent,
  ReceiptText,
  ScanFace,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { Grafico } from "./_components/grafico";
import { Numero } from "./_components/numero";

export const dynamic = "force-dynamic";

const DIAS = 30;

function pesos(centavos: number) {
  return "$" + Math.round(centavos / 100).toLocaleString("es-AR");
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function hace(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}

function iniciales(nombre: string) {
  return (
    nombre
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?"
  );
}

export default async function V2Page() {
  // El control se repite acá aunque el layout ya lo haga. No es de más: en el
  // App Router el layout y la página se resuelven EN PARALELO, así que confiar
  // en la redirección del padre hace que esta función igual corra con sesión
  // nula y reviente antes de que la redirección tenga efecto. El usuario
  // terminaba en /login igual, pero el servidor tiraba una excepción en cada
  // visita sin sesión.
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");
  // Sin control de admin: acá había un redirect a /dashboard que, ahora que
  // ESTA es /dashboard, apuntaba a sí mismo. Cualquiera que no fuera admin
  // habría quedado dando vueltas en un bucle de redirecciones.
  const userId = session.user.id;

  const ahora = new Date();
  const desdeMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const desdeMesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const desdeGrafico = new Date(ahora.getTime() - (DIAS - 1) * 86400000);
  desdeGrafico.setHours(0, 0, 0, 0);

  const pagada = { status: "PAID" as const, sellerId: userId };

  const [yo, mes, mesPasado, ventasGrafico, ultimas, eventos, fotosVendidas, busquedas] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { name: true, slug: true, image: true, bio: true, mpConnectedAt: true, mpOnboardingSkipped: true },
      }),
      db.sale.aggregate({ _sum: { sellerNetCents: true }, _count: true, where: { ...pagada, paidAt: { gte: desdeMes } } }),
      db.sale.aggregate({
        _sum: { sellerNetCents: true },
        where: { ...pagada, paidAt: { gte: desdeMesPasado, lt: desdeMes } },
      }),
      db.sale.findMany({
        where: { ...pagada, paidAt: { gte: desdeGrafico } },
        select: { paidAt: true, sellerNetCents: true },
      }),
      db.sale.findMany({
        where: pagada,
        orderBy: { paidAt: "desc" },
        take: 5,
        select: {
          id: true,
          buyerName: true,
          buyerEmail: true,
          sellerNetCents: true,
          paidAt: true,
          event: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      db.event.findMany({
        where: { ownerId: userId, NOT: { status: "ARCHIVED" } },
        orderBy: { eventDate: "desc" },
        take: 4,
        select: {
          id: true,
          name: true,
          eventDate: true,
          coverUrl: true,
          isPublished: true,
          status: true,
          createdAt: true,
          _count: { select: { photos: true } },
          sales: { where: { status: "PAID" }, select: { sellerNetCents: true } },
        },
      }),
      db.saleItem.count({ where: { sale: { ...pagada, paidAt: { gte: desdeMes } } } }),
      // Denominador de la conversión: búsquedas QUE ENCONTRARON algo. Ver
      // lab/AVISOS.md — las visitas empeoran el número cuando el evento se
      // difunde, y el que buscó sin aparecer nunca pudo comprar.
      db.faceSearchLog.groupBy({
        by: ["matchCount"],
        where: { event: { ownerId: userId }, createdAt: { gte: desdeMes } },
        _count: true,
      }),
    ]);

  const nombre = yo?.name ?? "fotógrafo";
  const netoMes = mes._sum.sellerNetCents ?? 0;
  const netoAnterior = mesPasado._sum.sellerNetCents ?? 0;
  const variacion = netoAnterior > 0 ? Math.round(((netoMes - netoAnterior) / netoAnterior) * 100) : null;

  const seEncontraron = busquedas.filter((b) => b.matchCount > 0).reduce((a, b) => a + b._count, 0);
  const compraron = mes._count;
  const tasa = seEncontraron > 0 ? (compraron / seEncontraron) * 100 : null;

  // Serie diaria completa: los días sin ventas tienen que valer cero, no
  // faltar. Si se saltean, la curva miente sobre la forma del mes.
  const porDia = new Map<string, number>();
  for (let i = 0; i < DIAS; i++) {
    porDia.set(iso(new Date(desdeGrafico.getTime() + i * 86400000)), 0);
  }
  for (const v of ventasGrafico) {
    if (!v.paidAt) continue;
    const k = iso(v.paidAt);
    if (porDia.has(k)) porDia.set(k, porDia.get(k)! + Math.round(v.sellerNetCents / 100));
  }
  const puntos = [...porDia.entries()].map(([dia, monto]) => ({ dia, monto }));

  // ── Avisos ────────────────────────────────────────────────────────────────
  // Las condiciones son las de lab/AVISOS.md. Entra sólo lo que es verdad, se
  // arregla en un click y cuesta plata o tiempo hoy.
  const avisos: { icono: React.ReactNode; titulo: string; detalle: string; href: string; urgente?: boolean }[] = [];

  if (!yo?.mpConnectedAt) {
    avisos.push({
      icono: <Wallet />,
      titulo: "No podés cobrar todavía",
      detalle: "Sin Mercado Pago conectado, el atleta encuentra sus fotos y no las puede comprar",
      href: "/dashboard/pagos",
      urgente: true,
    });
  }
  for (const e of eventos) {
    if (e.isPublished && !e.coverUrl) {
      avisos.push({
        icono: <ImageOff />,
        titulo: `${e.name} sin portada`,
        detalle: "Los eventos sin portada venden bastante menos",
        href: `/dashboard/events/${e.id}`,
        urgente: true,
      });
    }
  }
  for (const e of eventos) {
    const dias = Math.round((Date.now() - e.createdAt.getTime()) / 86400000);
    if (!e.isPublished && e._count.photos > 0 && dias >= 3) {
      avisos.push({
        icono: <CalendarDays />,
        titulo: `${e.name} sigue en borrador`,
        detalle: `${e._count.photos.toLocaleString("es-AR")} fotos subidas hace ${dias} días, nadie las puede ver`,
        href: `/dashboard/events/${e.id}`,
      });
    }
  }
  if (!yo?.image) {
    avisos.push({
      icono: <UserRound />,
      titulo: "Te falta la foto de perfil",
      detalle: "Tu página se ve vacía arriba de todo",
      href: "/dashboard/perfil",
    });
  }
  const visibles = avisos.slice(0, 4);

  const hora = ahora.getHours();
  const saludo = hora < 13 ? "Buen día" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <main className="canvas">
        <div className="canvas-in">
          <div className="head">
            <div>
              <h1>
                {saludo}, {nombre.split(" ")[0]}
              </h1>
              <p>
                {visibles.length > 0
                  ? `${visibles.length} ${visibles.length === 1 ? "cosa" : "cosas"} esperándote.`
                  : "No tenés nada pendiente."}{" "}
                Estás viendo la vista previa del panel nuevo.
              </p>
            </div>
          </div>

          <section className="kpis">
            <div className="card kpi">
              <div className="k-top">
                <span className="k-lab">Ventas del mes</span>
                <TrendingUp />
              </div>
              <div className="k-n tnum">
                <Numero valor={Math.round(netoMes / 100)} prefijo="$" />
              </div>
              <div className="k-sub">
                {variacion !== null ? (
                  <>
                    <span className={`delta ${variacion >= 0 ? "up" : "down"}`}>
                      <ArrowUpRight /> {Math.abs(variacion)}%
                    </span>{" "}
                    vs. el mes pasado
                  </>
                ) : (
                  <>{mes._count} ventas este mes</>
                )}
              </div>
            </div>

            <div className="card kpi">
              <div className="k-top">
                <span className="k-lab">Fotos vendidas</span>
                <ImageDown />
              </div>
              <div className="k-n tnum">
                <Numero valor={fotosVendidas} retardo={90} />
              </div>
              <div className="k-sub">En {mes._count} ventas este mes</div>
            </div>

            <div className="card kpi">
              <div className="k-top">
                <span className="k-lab">Visitas que compran</span>
                <Percent />
              </div>
              <div className="k-n tnum">
                {tasa !== null ? (
                  <>
                    <Numero valor={tasa} decimales={1} retardo={180} />
                    <small>%</small>
                  </>
                ) : (
                  <span style={{ color: "var(--ink-3)" }}>—</span>
                )}
              </div>
              <div className="k-sub razon">
                <span>
                  <ScanFace /> <b className="tnum">{seEncontraron.toLocaleString("es-AR")}</b> se encontraron
                </span>
                <span>
                  <ShoppingCart /> <b className="tnum">{compraron.toLocaleString("es-AR")}</b> compraron
                </span>
              </div>
            </div>
          </section>

          <section className="duo">
            <div className="card">
              <div className="card-h">
                <div>
                  <h2>Ventas</h2>
                  <div className="sub">Últimos {DIAS} días</div>
                </div>
              </div>
              <Grafico puntos={puntos} />
            </div>

            <div className="card">
              <div className="card-h">
                <div>
                  <h2>Necesita tu atención</h2>
                  <div className="sub">
                    {visibles.length > 0 ? `${visibles.length} pendientes` : "Nada pendiente"}
                  </div>
                </div>
              </div>

              {visibles.length > 0 ? (
                visibles.map((a) => (
                  <Link key={a.titulo} href={a.href} className="row at">
                    <span className={`at-i${a.urgente ? " warn" : ""}`}>{a.icono}</span>
                    <span className="at-t">
                      <b>{a.titulo}</b>
                      <span>{a.detalle}</span>
                    </span>
                    <ArrowRight className="go" />
                  </Link>
                ))
              ) : (
                <div className="empty" style={{ padding: "var(--s-6) var(--s-4)" }}>
                  <div
                    className="empty-i"
                    style={{
                      background: "color-mix(in srgb, var(--ok) 14%, transparent)",
                      color: "var(--ok)",
                    }}
                  >
                    <Check />
                  </div>
                  <h3>No hay nada pendiente</h3>
                  <p>Tus eventos están publicados, con portada y cobrando.</p>
                </div>
              )}
            </div>
          </section>

          <section className="duo">
            <div className="card">
              <div className="card-h">
                <div>
                  <h2>Tus eventos</h2>
                </div>
                <Link href="/dashboard/eventos" className="btn btn-ghost btn-sm">
                  Ver todos <ArrowRight className="go" />
                </Link>
              </div>

              {eventos.length > 0 ? (
                <>
                  <div className="row row-h ev">
                    <span />
                    <span>Evento</span>
                    <span className="num soft">Fotos</span>
                    <span className="num">Vendido</span>
                    <span />
                  </div>
                  {eventos.map((e) => {
                    const vendido = e.sales.reduce((a, s) => a + s.sellerNetCents, 0);
                    return (
                      <Link key={e.id} href={`/dashboard/evento/${e.id}`} className="row ev">
                        <span
                          className="ev-cv"
                          style={
                            e.coverUrl?.startsWith("http")
                              ? { backgroundImage: `url(${e.coverUrl})`, backgroundSize: "cover" }
                              : undefined
                          }
                        />
                        <span className="ev-n">
                          <b>{e.name}</b>
                          <span>
                            {e.eventDate
                              ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
                              : "Sin fecha"}
                          </span>
                        </span>
                        <span className="num soft">{e._count.photos.toLocaleString("es-AR")}</span>
                        <span className="num tnum">{vendido > 0 ? pesos(vendido) : "—"}</span>
                        {e.isPublished ? (
                          <span className="pill">
                            <i /> Publicado
                          </span>
                        ) : (
                          <span className="pill draft">
                            <i /> Borrador
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </>
              ) : (
                <div className="empty">
                  <div className="empty-i">
                    <CalendarDays />
                  </div>
                  <h3>No se encontraron eventos</h3>
                  <p>Cuando crees tu primer evento y subas fotos, van a aparecer acá.</p>
                  <Link href="/dashboard/nuevo" className="btn btn-pri">
                    Crear mi primer evento
                  </Link>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-h">
                <div>
                  <h2>Últimas ventas</h2>
                </div>
                <Link href="/dashboard/ventas" className="btn btn-ghost btn-sm">
                  Ver todas <ArrowRight className="go" />
                </Link>
              </div>

              {ultimas.length > 0 ? (
                <>
                  {ultimas.map((v) => (
                    <div key={v.id} className="row sale">
                      <span className="sale-av">{iniciales(v.buyerName ?? v.buyerEmail)}</span>
                      <span className="sale-t">
                        <b>{v.buyerName ?? v.buyerEmail}</b>
                        <span>
                          {v.event.name} · {v._count.items} fotos
                          {v.paidAt ? ` · ${hace(v.paidAt)}` : ""}
                        </span>
                      </span>
                      <span className="sale-m tnum">{pesos(v.sellerNetCents)}</span>
                    </div>
                  ))}
                  <div className="payout">
                    <span>Total del mes</span>
                    <b className="tnum">{pesos(netoMes)}</b>
                  </div>
                </>
              ) : (
                <div className="empty">
                  <div className="empty-i">
                    <ReceiptText />
                  </div>
                  <h3>No se encontraron ventas</h3>
                  <p>
                    Pasale el link de tu evento al grupo del club o al organizador: es de donde vienen
                    casi todas las primeras ventas.
                  </p>
                  <Link href="/dashboard/eventos" className="btn btn-ghost">
                    Ver mis eventos
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
  );
}
