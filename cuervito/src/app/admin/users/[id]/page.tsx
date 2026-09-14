import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  Hash,
  ScanFace,
  ShoppingCart,
} from "lucide-react";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { formatBytes, getQuotaUsage } from "~/server/quotas";

import { hace } from "~/app/dashboard/_components/formato";

import {
  reactivateUserAction,
  setUserRoleAction,
  suspendUserAction,
  toggleGiftAction,
  toggleHistoriasAction,
} from "../actions";
import { QuotaOverrideForm } from "./quota-override-form";
import { SuspendDialog } from "./suspend-dialog";

export const dynamic = "force-dynamic";

/**
 * La ficha de un usuario.
 *
 * Arriba lo que es: rol, estado, MP, y las cuatro cifras. Después lo que se
 * puede hacer con la cuenta, en una sola tarjeta de renglones —rol, regalos,
 * historias, acceso—: cada uno con su explicación y su botón, porque los
 * cuatro son decisiones que se toman de a una y con contexto. Abajo, lo que
 * pasó: uso de reconocimiento, descargas, actividad en la tienda y el
 * registro de lo que hicimos nosotros.
 */
export default async function AdminUserDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  const soyYo = session?.user?.id === id;

  const [user, quota, acciones, reconocimiento, descargas, eventos, eventosGratis, regalados] =
    await Promise.all([
      db.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          slug: true,
          role: true,
          status: true,
          createdAt: true,
          suspendedAt: true,
          suspendedReason: true,
          mpConnectedAt: true,
          lastLoginAt: true,
          storageQuotaBytes: true,
          recognitionQuotaMonthly: true,
          giftEnabled: true,
          historiasEnabled: true,
          emailsPromocionales: true,
          _count: { select: { eventsOwned: true, sales: true, photosOwned: true } },
        },
      }),
      getQuotaUsage(id).catch(() => null),
      db.adminAction.findMany({
        where: { targetType: "User", targetId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { name: true, email: true } } },
      }),
      db.recognitionUsage.findMany({
        where: { userId: id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 6,
      }),
      db.downloadLog.findMany({
        where: { sale: { sellerId: id } },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          sale: { select: { id: true, buyerEmail: true, event: { select: { name: true, slug: true } } } },
        },
      }),
      db.event.findMany({ where: { ownerId: id }, select: { id: true, name: true, slug: true } }),
      // Cuántos eventos suyos están hoy a precio cero. Es el número que hace
      // falta para decidir: prender el permiso no elige eventos, habilita
      // todos los que ya tengan el precio en cero, y sin este dato se prende
      // a ciegas.
      db.event.count({ where: { ownerId: id, pricePerPhoto: 0 } }),
      db.sale.count({ where: { sellerId: id, status: "GIFT" } }),
    ]);

  if (!user) notFound();

  // AnalyticsEvent no tiene FK a Event (es un eventId suelto), así que se
  // filtra por los eventos del fotógrafo.
  const nombreEvento = new Map(eventos.map((e) => [e.id, e.name]));
  const actividad = eventos.length
    ? await db.analyticsEvent.findMany({
        where: { eventId: { in: eventos.map((e) => e.id) } },
        orderBy: { createdAt: "desc" },
        take: 15,
      })
    : [];

  const n = (x: number) => x.toLocaleString("es-AR");
  const cuando = (d: Date) => d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  const esAdmin = user.role === "ADMIN";
  const suspendido = user.status === "SUSPENDED";

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <span className={`pill ${esAdmin ? "draft" : ""}`}>
                <i /> {esAdmin ? "Admin" : "Fotógrafo"}
              </span>
              <span className={`pill ${suspendido ? "bad" : user.status === "DELETED" ? "" : "live"}`}>
                <i /> {suspendido ? "Suspendido" : user.status === "DELETED" ? "Eliminado" : "Activo"}
              </span>
              {user.mpConnectedAt ? (
                <span className="pill live">
                  <i /> Mercado Pago
                </span>
              ) : (
                <span className="pill">
                  <i /> Sin Mercado Pago
                </span>
              )}
            </div>
            <h1>{user.name ?? "(sin nombre)"}</h1>
            <p>
              {user.email ?? "—"}
              {user.slug && <> · @{user.slug}</>}
              {" · "}
              {user.lastLoginAt ? `último ingreso ${hace(user.lastLoginAt)}` : "nunca inició sesión"}
              {" · "}alta {hace(user.createdAt)}
            </p>
          </div>
          <div className="head-r">
            <Link href="/admin/users" className="btn btn-ghost">
              <ArrowLeft /> Usuarios
            </Link>
            {user.slug && (
              <a href={`/${user.slug}`} target="_blank" rel="noopener" className="btn btn-ghost">
                <ExternalLink /> Ver su tienda
              </a>
            )}
          </div>
        </div>

        <section className="sum k4">
          <div className="card">
            <div className="k-lab">Eventos</div>
            <div className="k-n tnum">{n(user._count.eventsOwned)}</div>
          </div>
          <div className="card">
            <div className="k-lab">Fotos</div>
            <div className="k-n tnum">{n(user._count.photosOwned)}</div>
          </div>
          <div className="card">
            <div className="k-lab">Ventas</div>
            <div className="k-n tnum">{n(user._count.sales)}</div>
            {regalados > 0 && <div className="k-sub">{n(regalados)} regaladas</div>}
          </div>
          <div className="card">
            <div className="k-lab">Almacenamiento</div>
            <div className="k-n tnum">{quota ? formatBytes(quota.storage.usedBytes) : "—"}</div>
            {quota && (
              <div className="k-sub">
                {quota.storage.pct} % de {formatBytes(quota.storage.limitBytes)}
              </div>
            )}
          </div>
        </section>

        {/* ── Permisos ── */}
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Permisos y acceso</h2>
              <div className="sub">Lo que esta cuenta puede hacer. Cada cambio queda en el registro de abajo.</div>
            </div>
          </div>

          <div className="aj">
            <div className="aj-t">
              <b>{esAdmin ? "Administrador" : "Fotógrafo"}</b>
              <span>
                {esAdmin
                  ? "Tiene el panel de administración entero."
                  : "Acceso de fotógrafo, que es el de todos."}
              </span>
            </div>
            {soyYo ? (
              <span className="ec-nota">No podés cambiar tu propio rol.</span>
            ) : (
              <form action={setUserRoleAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="role" value={esAdmin ? "PHOTOGRAPHER" : "ADMIN"} />
                <button
                  type="submit"
                  className="btn btn-ghost btn-sm"
                  data-tip={
                    esAdmin
                      ? "Le saca el panel de administración"
                      : "Le da el panel de administración entero"
                  }
                >
                  {esAdmin ? "Pasar a fotógrafo" : "Hacer admin"}
                </button>
              </form>
            )}
          </div>

          <div className="aj">
            <div className="aj-t">
              <b>{user.giftEnabled ? "Puede regalar fotos" : "No puede regalar fotos"}</b>
              <span>
                {user.giftEnabled
                  ? "Cualquier compra suya que dé $0 se entrega sin Mercado Pago y queda como regalo, fuera de la facturación."
                  : "Con el permiso, sus eventos a $0 entregan las fotos directo. Sin él, un evento en $0 no se puede comprar."}
                {eventosGratis > 0 && (
                  <>
                    {" "}
                    <b style={{ color: "var(--acento-txt)", fontWeight: 500 }}>
                      Tiene {n(eventosGratis)} {eventosGratis === 1 ? "evento" : "eventos"} a $0
                      {user.giftEnabled ? " que ya se regalan." : "; al prender esto pasan a ser gratis."}
                    </b>
                  </>
                )}
              </span>
            </div>
            <form action={toggleGiftAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="enabled" value={user.giftEnabled ? "0" : "1"} />
              <button
                type="submit"
                className={user.giftEnabled ? "btn btn-ghost btn-sm" : "btn btn-pri btn-sm"}
                data-tip={
                  user.giftEnabled
                    ? "Sus eventos en $0 vuelven a no poder comprarse"
                    : "Sus eventos en $0 pasan a entregarse gratis"
                }
              >
                {user.giftEnabled ? "Sacar el permiso" : "Habilitar regalos"}
              </button>
            </form>
          </div>

          <div className="aj">
            <div className="aj-t">
              <b>
                {esAdmin
                  ? "Estudio de historias, por ser admin"
                  : user.historiasEnabled
                    ? "Estudio de historias habilitado en su ficha"
                    : "Estudio de historias, el de todos"}
              </b>
              <span>
                Historias está abierta para todas las cuentas. Este permiso sólo cuenta si un día se cierra
                la llave global en Configuración.
                {" "}
                {user.emailsPromocionales ? "Recibe los mails de campaña." : "Se dio de baja de los mails de campaña."}
              </span>
            </div>
            {!esAdmin && (
              <form action={toggleHistoriasAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="enabled" value={user.historiasEnabled ? "0" : "1"} />
                <button type="submit" className="btn btn-ghost btn-sm">
                  {user.historiasEnabled ? "Sacar de la ficha" : "Fijar en la ficha"}
                </button>
              </form>
            )}
          </div>

          <div className="aj">
            {suspendido ? (
              <>
                <div className="aj-t">
                  <b style={{ color: "var(--bad-txt)" }}>Cuenta suspendida</b>
                  <span>
                    {user.suspendedReason ?? "Sin motivo registrado."}
                    {user.suspendedAt && <> · desde {user.suspendedAt.toLocaleDateString("es-AR")}</>}
                  </span>
                </div>
                <form action={reactivateUserAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className="btn btn-pri btn-sm"
                    data-tip="Vuelve a poder iniciar sesión y operar"
                  >
                    Reactivar
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="aj-t">
                  <b>Cuenta activa</b>
                  <span>Puede iniciar sesión y operar normalmente.</span>
                </div>
                {soyYo ? (
                  <span className="ec-nota">No podés suspender tu propia cuenta.</span>
                ) : (
                  <SuspendDialog
                    userId={user.id}
                    userName={user.name ?? user.email ?? "este usuario"}
                    action={suspendUserAction}
                  />
                )}
              </>
            )}
          </div>
        </section>

        <QuotaOverrideForm
          userId={user.id}
          currentStorageBytes={user.storageQuotaBytes?.toString() ?? null}
          currentRecognitionMonthly={user.recognitionQuotaMonthly}
          usage={quota}
        />

        {/* ── Reconocimiento ── */}
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Uso de reconocimiento</h2>
              <div className="sub">
                Cuota mensual: {user.recognitionQuotaMonthly ? n(user.recognitionQuotaMonthly) : "la de todos"}.
              </div>
            </div>
          </div>
          {reconocimiento.length === 0 ? (
            <div className="ec-nota">Nunca corrió reconocimiento.</div>
          ) : (
            <>
              <div className="row row-h rt">
                <span>Mes</span>
                <span className="num">Caras indexadas</span>
                <span className="num oc">Búsquedas</span>
                <span className="num oc">OCR</span>
              </div>
              {reconocimiento.map((u) => (
                <div key={u.id} className="row rt">
                  <span className="tnum">
                    {u.year}-{String(u.month).padStart(2, "0")}
                  </span>
                  <span className="num tnum">{n(u.indexedFaces)}</span>
                  <span className="num soft tnum oc">{n(u.searchedFaces)}</span>
                  <span className="num soft tnum oc">{n(u.ocrCalls)}</span>
                </div>
              ))}
            </>
          )}
        </section>

        {/* ── Descargas ── */}
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Descargas recientes</h2>
              <div className="sub">Compradores bajando fotos que vendió.</div>
            </div>
          </div>
          {descargas.length === 0 ? (
            <div className="ec-nota">Sin descargas registradas.</div>
          ) : (
            <>
              <div className="row row-h dt">
                <span>Comprador</span>
                <span className="oc">Evento</span>
                <span className="num">Cuándo</span>
              </div>
              {descargas.map((d) => (
                <div key={d.id} className="row dt">
                  <span className="v-who">
                    <b>{d.sale.buyerEmail}</b>
                    {d.photoId && <span>foto …{d.photoId.slice(-8)}</span>}
                  </span>
                  <span className="v-ev oc">{d.sale.event?.name ?? "—"}</span>
                  <span className="num soft">{cuando(d.createdAt)}</span>
                </div>
              ))}
            </>
          )}
        </section>

        {/* ── Actividad en la tienda ── */}
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Actividad en su tienda</h2>
              <div className="sub">Lo que hizo la gente en sus páginas públicas.</div>
            </div>
          </div>
          {actividad.length === 0 ? (
            <div className="ec-nota">Sin actividad registrada.</div>
          ) : (
            <>
              <div className="row row-h dt">
                <span>Qué</span>
                <span className="oc">Evento</span>
                <span className="num">Cuándo</span>
              </div>
              {actividad.map((a) => {
                const t = ACTIVIDAD[a.type] ?? { icono: Eye, texto: a.type, cls: "" };
                return (
                  <div key={a.id} className="row dt">
                    <span>
                      <span className={`pill ${t.cls}`}>
                        <t.icono style={{ width: 12, height: 12 }} /> {t.texto}
                      </span>
                    </span>
                    <span className="v-ev oc">{a.eventId ? (nombreEvento.get(a.eventId) ?? "—") : "—"}</span>
                    <span className="num soft">{cuando(a.createdAt)}</span>
                  </div>
                );
              })}
            </>
          )}
        </section>

        {/* ── Registro ── */}
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Lo que hicimos con esta cuenta</h2>
              <div className="sub">Las últimas diez acciones de administración.</div>
            </div>
          </div>
          {acciones.length === 0 ? (
            <div className="ec-nota">Sin acciones registradas.</div>
          ) : (
            <>
              <div className="row row-h lt">
                <span>Acción</span>
                <span className="oc">Quién</span>
                <span className="num">Cuándo</span>
              </div>
              {acciones.map((a) => (
                <div key={a.id} className="row lt">
                  <span>
                    <span className="pill">
                      <i /> {ACCION[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </span>
                  <span className="v-ev oc">{a.actor.name ?? a.actor.email}</span>
                  <span className="num soft">{cuando(a.createdAt)}</span>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

const ACTIVIDAD: Record<string, { icono: typeof Eye; texto: string; cls: string }> = {
  VISIT: { icono: Eye, texto: "Visita", cls: "" },
  SEARCH_BIB: { icono: Hash, texto: "Buscó un dorsal", cls: "draft" },
  SEARCH_FACE: { icono: ScanFace, texto: "Buscó una cara", cls: "draft" },
  CART_ADD: { icono: ShoppingCart, texto: "Agregó al carrito", cls: "draft" },
  CHECKOUT_START: { icono: CreditCard, texto: "Empezó a pagar", cls: "draft" },
  PURCHASE: { icono: Banknote, texto: "Compró", cls: "live" },
  DOWNLOAD: { icono: Download, texto: "Descargó", cls: "live" },
};

const ACCION: Record<string, string> = {
  SUSPEND_USER: "suspendida",
  REACTIVATE_USER: "reactivada",
  SET_ROLE: "cambio de rol",
  OVERRIDE_QUOTA: "cuotas cambiadas",
  ENABLE_GIFT: "regalos habilitados",
  DISABLE_GIFT: "regalos quitados",
  ENABLE_HISTORIAS: "historias habilitadas",
  DISABLE_HISTORIAS: "historias quitadas",
};
