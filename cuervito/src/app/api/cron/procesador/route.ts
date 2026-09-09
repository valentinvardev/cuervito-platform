import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import {
  barrerHuerfanas,
  despertar,
  estadoCola,
  reconocerEvento,
  reintentarVenenosas,
} from "~/server/cola-fotos";

/**
 * Mirar y empujar la cola de fotos desde afuera.
 *
 * El cron de cada cinco minutos NO es el mecanismo: la cola trabaja sola
 * mientras el proceso viva. Esto es el respaldo —si el bucle murió por algo que
 * no previmos, el próximo pedido lo despierta— y la puerta para las acciones
 * que se hacen a mano: adoptar las filas a medias, reintentar lo que quedó
 * bloqueado por cuota, o pedir el reconocimiento de un evento viejo.
 *
 * NINGUNA acción hace el trabajo adentro del request: dispara y contesta con el
 * último resumen. Una barrida de doscientas filas contra S3 tarda más que los
 * sesenta segundos que nginx espera, y un 504 haría que el cron la reintente en
 * loop.
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
  return NextResponse.json(await estadoCola());
}

export async function POST(req: NextRequest) {
  const no = autorizado(req);
  if (no) return no;

  const body = (await req.json().catch(() => ({}))) as {
    accion?: string;
    eventId?: string;
    clase?: string;
  };
  const accion = body.accion ?? "despertar";

  switch (accion) {
    case "despertar":
      despertar();
      break;

    case "barrer-huerfanas":
      // Sin await: la barrida hace HEAD contra S3 sobre hasta doscientas filas
      // y no entra en el tiempo de una request.
      void barrerHuerfanas().catch((e: unknown) =>
        console.error("[cron procesador] barrer huérfanas:", e),
      );
      break;

    case "reintentar-venenosas": {
      const n = await reintentarVenenosas({ eventId: body.eventId, clase: body.clase });
      return NextResponse.json({ accion, devueltas: n, ...(await estadoCola()) });
    }

    case "reconocer-evento": {
      if (!body.eventId) {
        return NextResponse.json({ error: "Falta eventId" }, { status: 400 });
      }
      const n = await reconocerEvento(body.eventId);
      return NextResponse.json({ accion, devueltas: n, ...(await estadoCola()) });
    }

    default:
      return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });
  }

  return NextResponse.json({ accion, ...(await estadoCola()) });
}
