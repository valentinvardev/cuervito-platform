/**
 * Corrige Sale.paidAt de las ventas cobradas con Mercado Pago.
 *
 * Hasta noviembre de 2026 el webhook escribía paidAt = ahora en cada aviso
 * «approved», y Mercado Pago los repite por tandas: muchas ventas quedaron
 * fechadas días o semanas después de la compra, y los números del mes del
 * panel («Ventas del mes», el gráfico de 30 días) las cuentan en el mes
 * equivocado. Este script le pregunta a Mercado Pago cuándo se aprobó cada
 * pago (date_approved) y deja esa fecha.
 *
 * Por defecto NO escribe: muestra cuántas cambiarían y cuántas cambian de mes.
 *
 *   node scripts/corregir-fecha-pago.mjs                 mirar, todas
 *   node scripts/corregir-fecha-pago.mjs --limite 20     mirar, una muestra
 *   node scripts/corregir-fecha-pago.mjs --aplicar       corregir
 *
 * Se puede correr cuantas veces haga falta: calcula la misma fecha y sólo
 * escribe las filas que difieren. Las ventas cuyo pago no se puede consultar
 * (credencial vencida o desconectada) quedan como están y se cuentan aparte.
 * No imprime credenciales ni datos de compradores.
 */
import fs from "node:fs";
import { PrismaClient } from "../generated/prisma/index.js";

const MP_API = "https://api.mercadopago.com";
const A_LA_VEZ = 4;
/** Menos que esto de diferencia es ruido de relojes, no una fecha corrida. */
const TOLERANCIA_MS = 60_000;

const args = process.argv.slice(2);
const APLICAR = args.includes("--aplicar");
const iLim = args.indexOf("--limite");
const LIMITE = iLim > -1 ? Math.max(1, Number(args[iLim + 1])) : undefined;

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

/** Mes calendario en Argentina, que es como lo agrupa el panel. */
const mes = (d) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(d);

async function fechaDeAprobacion(paymentId, token) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) return { falla: "credencial" };
  if (res.status === 404) return { falla: "no-encontrado" };
  if (!res.ok) return { falla: `http-${res.status}` };
  const p = await res.json();
  if (p.status !== "approved" && !p.date_approved) return { falla: `estado-${p.status}` };
  const d = new Date(p.date_approved);
  if (Number.isNaN(d.getTime())) return { falla: "sin-fecha" };
  return { fecha: d };
}

const ventas = await db.sale.findMany({
  where: { status: { in: ["PAID", "REFUNDED"] }, mpPaymentId: { not: null } },
  select: { id: true, sellerId: true, mpPaymentId: true, paidAt: true, createdAt: true },
  orderBy: { createdAt: "asc" },
  ...(LIMITE ? { take: LIMITE } : {}),
});
const vendedores = await db.user.findMany({
  where: { id: { in: [...new Set(ventas.map((v) => v.sellerId))] } },
  select: { id: true, mpAccessToken: true },
});
const tokenDe = new Map(vendedores.map((u) => [u.id, u.mpAccessToken]));

const r = { revisadas: 0, bien: 0, corregir: 0, masDeUnaHora: 0, cambianDeMes: 0, escritas: 0, fallas: {} };
const porVendedor = new Map();
const fallar = (motivo) => (r.fallas[motivo] = (r.fallas[motivo] ?? 0) + 1);

console.log(`${ventas.length} ventas con pago de Mercado Pago · ${APLICAR ? "CORRIGIENDO" : "sólo mirando (--aplicar para escribir)"}`);

let i = 0;
async function trabajador() {
  while (i < ventas.length) {
    const v = ventas[i++];
    r.revisadas++;
    const token = tokenDe.get(v.sellerId);
    if (!token) {
      fallar("sin-credencial");
      continue;
    }
    let res;
    try {
      res = await fechaDeAprobacion(v.mpPaymentId, token);
    } catch {
      res = { falla: "red" };
    }
    if (res.falla) {
      fallar(res.falla);
      continue;
    }
    const antes = v.paidAt;
    if (antes && Math.abs(antes.getTime() - res.fecha.getTime()) < TOLERANCIA_MS) {
      r.bien++;
      continue;
    }
    r.corregir++;
    // Las repeticiones del aviso corren la fecha días; el resto es el minuto
    // que tarda en llegar el primero. Se cuentan aparte para no confundirlas.
    if (!antes || Math.abs(antes.getTime() - res.fecha.getTime()) > 3_600_000) r.masDeUnaHora++;
    const s = porVendedor.get(v.sellerId) ?? { corregir: 0, cambianDeMes: 0 };
    s.corregir++;
    if (!antes || mes(antes) !== mes(res.fecha)) {
      r.cambianDeMes++;
      s.cambianDeMes++;
    }
    porVendedor.set(v.sellerId, s);
    if (APLICAR) {
      await db.sale.update({ where: { id: v.id }, data: { paidAt: res.fecha } });
      r.escritas++;
    }
    if (r.revisadas % 100 === 0) console.log(`  … ${r.revisadas}/${ventas.length}`);
  }
}
await Promise.all(Array.from({ length: A_LA_VEZ }, trabajador));

console.log("");
console.log(`revisadas:        ${r.revisadas}`);
console.log(`ya estaban bien:  ${r.bien}`);
console.log(`fecha corrida:    ${r.corregir}  (${r.masDeUnaHora} por más de una hora; ${r.cambianDeMes} cambian de mes en el panel)`);
console.log(`escritas:         ${r.escritas}`);
console.log(`no consultables:  ${JSON.stringify(r.fallas)}`);
if (porVendedor.size) {
  console.log("\npor cuenta (últimos 6 del id):");
  for (const [id, s] of [...porVendedor].sort((a, b) => b[1].corregir - a[1].corregir)) {
    console.log(`  ${id.slice(-6)}  corregir ${s.corregir}  cambian de mes ${s.cambianDeMes}`);
  }
}
await db.$disconnect();
