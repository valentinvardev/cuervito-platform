import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { enviarAlertaDePrueba } from "~/server/alertas";
import { estadoVigia, renovarCredenciales } from "~/server/vigia-pagos";

/**
 * Mirar y empujar el vigía de pagos desde afuera.
 *
 * Como los otros dos cron: el vigía corre solo mientras el proceso viva; esto
 * es la mirilla (GET: cada credencial de Mercado Pago y cuándo vence) y la
 * puerta para forzar una pasada (POST). `POST ?accion=prueba` manda un aviso
 * de prueba a ALERTAS_EMAIL, para saber que los avisos llegan antes de
 * necesitarlos.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function autorizado(req: NextRequest): NextResponse | null {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const no = autorizado(req);
  if (no) return no;
  return NextResponse.json(await estadoVigia());
}

export async function POST(req: NextRequest) {
  const no = autorizado(req);
  if (no) return no;
  const accion = new URL(req.url).searchParams.get("accion") ?? "renovar";

  if (accion === "prueba") {
    const r = await enviarAlertaDePrueba();
    if (!r.destino) {
      return NextResponse.json({ enviada: false, error: "ALERTAS_EMAIL no está configurado" }, { status: 503 });
    }
    return NextResponse.json({ enviada: !!r.resendId, ...r });
  }
  if (accion !== "renovar") {
    return NextResponse.json({ error: `acción desconocida: ${accion}` }, { status: 400 });
  }

  // Dispara y contesta: una pasada puede hablar con Mercado Pago varias veces.
  void renovarCredenciales().catch((e: unknown) => console.error("[cron pagos]", e));
  return NextResponse.json({ disparada: true, ...(await estadoVigia()) });
}
