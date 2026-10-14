import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { adminsEnLinea, suscribirUsuario, type EventoChat } from "~/server/chat-bus";
import { noLeidosDeUsuario } from "~/server/chat";

export const runtime = "nodejs";
// Una respuesta larga. Se corta a la hora y EventSource vuelve a conectar.
export const maxDuration = 3600;

/**
 * El SSE del chat, lado usuario: la burbuja del panel escucha acá.
 *
 * Es el mismo patrón de /api/dashboard/sales-stream: el bus avisa, y lo que
 * hay que mostrar lo decide el cliente pidiéndoselo a la base (hiloAction).
 * El `hello` lleva lo que la burbuja necesita al montarse —cuántos sin leer y
 * si hay un admin— así no hace una consulta aparte en cada pantalla.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = session.user.id;
  const noLeidos = await noLeidosDeUsuario(userId);

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

      send("hello", { noLeidos, adminsEnLinea: adminsEnLinea() });

      const baja = suscribirUsuario(userId, (e: EventoChat) => send("chat", e));

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
