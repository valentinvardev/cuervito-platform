import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { correrCorreos, estadoCorreos } from "~/server/correos/enviar";

/**
 * Mirar y empujar las campañas desde afuera.
 *
 * Como el de la cola de fotos: el remitente corre solo mientras el proceso
 * viva; esto es el respaldo y la puerta para forzar una pasada. GET devuelve
 * el estado; POST dispara una pasada y contesta enseguida con el estado —una
 * tanda son hasta veinticinco mails con 400 ms entre cada uno, más de lo que
 * nginx espera.
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
  return NextResponse.json(await estadoCorreos());
}

export async function POST(req: NextRequest) {
  const no = autorizado(req);
  if (no) return no;
  void correrCorreos().catch((e: unknown) => console.error("[cron correos]", e));
  return NextResponse.json({ disparada: true, ...(await estadoCorreos()) });
}
