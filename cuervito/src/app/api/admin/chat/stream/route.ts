import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { suscribirAdmin, type EventoChat } from "~/server/chat-bus";
import { conversacionesPendientes } from "~/server/chat";

export const runtime = "nodejs";
export const maxDuration = 3600;

/**
 * El SSE del chat, lado admin: recibe TODO lo que pasa en todos los hilos.
 *
 * Lo abren dos lugares. La bandeja de /admin/chat, con `?presencia=1`: esa
 * conexión es la que cuenta como "hay un admin en línea" para los usuarios.
 * Y el armazón del admin en cualquier otra pantalla, sin presencia: sirve
 * para el número del riel y el aviso de mensaje nuevo, pero tener el panel
 * abierto en otra pestaña no es estar atendiendo el chat.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const presencia = req.nextUrl.searchParams.get("presencia") === "1";
  const pendientes = await conversacionesPendientes();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // cerrado del otro lado
        }
      }

      send("hello", { pendientes });

      const baja = suscribirAdmin((e: EventoChat) => send("chat", e), presencia);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          // se limpia con el abort
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        baja();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
