import "server-only";

import { env } from "~/env";
import { alertar, alertasConfiguradas } from "~/server/alertas";
import { BASE } from "~/server/correos/diseno";
import { db } from "~/server/db";
import { RENOVAR_ANTES_DIAS, renovarCredencial, type Renovacion } from "~/server/mp-token";

/**
 * El vigía de los pagos: renueva las credenciales de Mercado Pago antes de
 * que venzan y avisa cuando no puede.
 *
 * Corre solo, en el proceso, con el mismo idioma que la cola de fotos y el
 * remitente de correos: arranca desde instrumentation.ts, su estado vive en
 * globalThis y cada vuelta va en su try/catch. Cada seis horas alcanza de
 * sobra: la ventana de renovación es de quince días, y lo que se renueva acá
 * es lo que el checkout no tuvo que renovar él solo (mp-token.ts).
 *
 * /api/cron/pagos es la mirilla y el empujón desde afuera.
 */

const TICK_MS = 6 * 60 * 60_000;
/** La primera pasada espera a que el proceso termine de levantar. */
const PRIMER_TICK_MS = 60_000;
/** Mientras falten más días que éstos, un refresh que falla no es noticia:
 *  el vigía lo vuelve a intentar cada seis horas. */
const AVISAR_SI_FALTAN_DIAS = 7;
const ZONA = "America/Argentina/Buenos_Aires";

export type ResumenVigia = {
  corridaAt: string;
  revisadas: number;
  renovadas: string[];
  fallidas: { userId: string; estado: string; detalle: string }[];
};

declare global {
  var __cuervito_vigia_pagos__:
    | { arrancado: boolean; corriendo: boolean; ultimoResumen: ResumenVigia | null }
    | undefined;
}
const estado = (globalThis.__cuervito_vigia_pagos__ ??= {
  arrancado: false,
  corriendo: false,
  ultimoResumen: null,
});

const dias = (d: Date | null) => (d ? Math.ceil((d.getTime() - Date.now()) / 86_400_000) : null);
const fecha = (d: Date) =>
  d.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: ZONA });

type Fallida = Extract<Renovacion, { estado: "vencida" | "no-renovada" }>;

async function avisar(
  v: { id: string; name: string | null; email: string | null },
  r: Fallida,
): Promise<void> {
  const quien = `${v.name ?? "Un fotógrafo sin nombre"}${v.email ? ` (${v.email})` : ""}`;
  const ventas = await db.sale.count({
    where: { sellerId: v.id, status: "PAID", createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
  });
  const vencio = r.estado === "vencida";
  const cuando = r.venceAt ? ` el ${fecha(r.venceAt)}` : "";
  await alertar({
    clave: `mp-credencial:${v.id}`,
    cadaMin: 24 * 60,
    asunto: vencio
      ? "Un fotógrafo ya no puede cobrar: hay que volver a conectar Mercado Pago"
      : "No se pudo renovar la credencial de Mercado Pago de un fotógrafo",
    lineas: [
      vencio
        ? `La credencial de Mercado Pago de ${quien} venció${cuando} y el intento de renovarla falló. Desde entonces, cada compra en su tienda falla al iniciar el pago.`
        : `La credencial de Mercado Pago de ${quien} vence${cuando} (en ${dias(r.venceAt) ?? "?"} días) y el intento de renovarla falló. El vigía sigue intentando cada seis horas; si llega a vencer, su tienda deja de cobrar.`,
      `Tuvo ${ventas} ventas en los últimos 90 días.`,
      "Lo arregla el fotógrafo desde Métodos de pago → «Volver a conectar»: Mercado Pago le pide autorizar de nuevo y la credencial nueva dura otros 180 días.",
    ],
    detalle: r.detalle,
    link: { texto: "Ver usuarios", url: `${BASE}/admin/users` },
  });
}

/** Una pasada: renovar lo que vence pronto, avisar lo que no se pudo. */
export async function renovarCredenciales(): Promise<ResumenVigia> {
  if (estado.corriendo && estado.ultimoResumen) return estado.ultimoResumen;
  estado.corriendo = true;
  const resumen: ResumenVigia = {
    corridaAt: new Date().toISOString(),
    revisadas: 0,
    renovadas: [],
    fallidas: [],
  };
  try {
    const limite = new Date(Date.now() + RENOVAR_ANTES_DIAS * 86_400_000);
    const vendedores = await db.user.findMany({
      where: { mpAccessToken: { not: null }, mpTokenExpiresAt: { lt: limite } },
      select: { id: true, name: true, email: true, role: true, testModeEnabled: true },
      orderBy: { mpTokenExpiresAt: "asc" },
    });
    resumen.revisadas = vendedores.length;

    for (const v of vendedores) {
      const r = await renovarCredencial(v.id);
      if (r.estado === "renovada") {
        resumen.renovadas.push(v.id);
        continue;
      }
      if (r.estado !== "vencida" && r.estado !== "no-renovada") continue;
      resumen.fallidas.push({ userId: v.id, estado: r.estado, detalle: r.detalle });

      /* Un admin en modo de prueba cobra sin Mercado Pago: su credencial
         vencida no deja a nadie sin pagar. Se intenta renovar igual, pero no
         es una alerta. */
      if (v.role === "ADMIN" && v.testModeEnabled) continue;
      const faltan = dias(r.venceAt);
      if (r.estado === "vencida" || (faltan !== null && faltan <= AVISAR_SI_FALTAN_DIAS)) {
        await avisar(v, r);
      }
    }
    console.log(
      `[vigía pagos] ${resumen.revisadas} revisadas, ${resumen.renovadas.length} renovadas, ${resumen.fallidas.length} sin renovar`,
    );
  } finally {
    estado.corriendo = false;
    estado.ultimoResumen = resumen;
  }
  return resumen;
}

/** Para la mirilla: cada credencial conectada y cuándo vence. */
export async function estadoVigia() {
  const vendedores = await db.user.findMany({
    where: { mpAccessToken: { not: null } },
    select: { id: true, name: true, mpTokenExpiresAt: true, mpConnectedAt: true },
    orderBy: { mpTokenExpiresAt: "asc" },
  });
  return {
    arrancado: estado.arrancado,
    corriendo: estado.corriendo,
    cadaHoras: TICK_MS / 3_600_000,
    renovarAntesDias: RENOVAR_ANTES_DIAS,
    avisosConfigurados: alertasConfiguradas(),
    ultimoResumen: estado.ultimoResumen,
    credenciales: vendedores.map((v) => {
      const d = dias(v.mpTokenExpiresAt);
      return {
        userId: v.id,
        nombre: v.name,
        conectadaAt: v.mpConnectedAt?.toISOString() ?? null,
        venceAt: v.mpTokenExpiresAt?.toISOString() ?? null,
        dias: d,
        estado:
          d === null ? "sin-fecha" : d <= 0 ? "vencida" : d <= RENOVAR_ANTES_DIAS ? "por-vencer" : "vigente",
      };
    }),
  };
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

export function arrancarVigiaPagos(): void {
  if (estado.arrancado) return;
  if (!env.PROCESADOR_ACTIVO) return;
  estado.arrancado = true;
  console.log(
    `[vigía pagos] arranca · cada ${TICK_MS / 3_600_000} h, renueva lo que vence en menos de ${RENOVAR_ANTES_DIAS} días`,
  );

  const tick = () => {
    renovarCredenciales().catch((e: unknown) => console.error("[vigía pagos] tick falló:", e));
  };
  const primero = setTimeout(tick, PRIMER_TICK_MS);
  primero.unref?.();
  const cada = setInterval(tick, TICK_MS);
  cada.unref?.();
}
