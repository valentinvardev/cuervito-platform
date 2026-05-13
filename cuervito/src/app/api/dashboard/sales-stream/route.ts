import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { subscribeSales, type SalePayload } from "~/server/sales-bus";

export const runtime = "nodejs";
// SSE wants a long-lived response. We cap at 1h to recycle.
export const maxDuration = 3600;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sellerId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller closed (client disconnected)
        }
      }

      send("hello", { ok: true });

      const unsubscribe = subscribeSales(sellerId, (sale: SalePayload) => {
        send("sale", sale);
      });

      // Heartbeat every 25s so proxies (nginx default proxy_read_timeout)
      // don't kill the connection mid-stream.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          // client gone — cleanup will happen via abort signal
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Tell nginx not to buffer this stream.
      "x-accel-buffering": "no",
    },
  });
}
