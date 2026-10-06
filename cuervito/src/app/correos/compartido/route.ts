import { type NextRequest } from "next/server";

import { CANALES, verificar, type Canal } from "~/server/correos/compartir";
import { db } from "~/server/db";

/**
 * La respuesta a "¿ya lo compartiste?", desde el mail.
 *
 * El GET no anota nada: muestra la página y es ella la que anota, con un POST
 * apenas carga. Los filtros de los proveedores de correo —el de Outlook, los
 * antivirus— abren cada link de un mail antes que la persona para ver si es
 * peligroso, y un GET que anotara contaría como "compartido" cada mail que
 * pasó por un filtro. Esos filtros piden la página, no ejecutan lo que trae.
 * Sin JavaScript, la página muestra un botón que hace el mismo POST.
 *
 * Se anota en AnalyticsEvent (EVENT_SHARED) una vez por evento y canal: tocar
 * dos veces el mismo no cuenta doble.
 */

export const dynamic = "force-dynamic";

const DONDE: Record<Canal, string> = {
  historia: "en tus historias",
  estado: "en tu estado de WhatsApp",
  whatsapp: "por WhatsApp",
};

function pagina(titulo: string, cuerpo: string, extra = "", status = 200): Response {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${titulo} · encontrate.app</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#efeee9;color:#12110f;font-family:Outfit,system-ui,sans-serif;padding:16px;box-sizing:border-box}main{max-width:420px;padding:36px 28px;background:#fff;border-radius:20px;text-align:center}h1{font-size:22px;margin:0 0 10px;letter-spacing:-.02em}p{margin:0;font-size:15px;line-height:1.55;color:#57534c}a,button{display:inline-block;margin-top:22px;padding:14px 22px;border:0;border-radius:12px;background:#c7330b;color:#fff;font:600 15px Outfit,system-ui,sans-serif;text-decoration:none;cursor:pointer}</style></head>
<body><main><h1>${titulo}</h1><p>${cuerpo}</p>${extra}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

function leer(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const e = q.get("e") ?? "";
  const c = q.get("c") ?? "";
  const t = q.get("t") ?? "";
  const canal = (Object.keys(CANALES) as Canal[]).find((x) => x === c) ?? null;
  return { e, canal, valido: !!e && !!canal && verificar("compartido", e, t), prueba: q.get("prueba") === "1" };
}

const invalido = () =>
  pagina("Este link no es válido", "Puede que esté cortado. Igual, gracias por compartir.", "", 400);

export function GET(req: NextRequest) {
  const { canal, valido, prueba } = leer(req);
  if (!valido || !canal) return invalido();
  if (prueba) {
    return pagina("Es un mail de prueba", "En un envío real, este link anota dónde compartió el evento quien lo recibió.");
  }
  return pagina(
    "Gracias por contarnos",
    `Anotamos que lo compartiste ${DONDE[canal]}. Las primeras ventas suelen llegar en las horas que siguen.`,
    `<form method="post"><noscript><button type="submit">Confirmar</button></noscript></form>
<script>fetch(location.href,{method:"POST"}).catch(function(){});</script>
<div><a href="/dashboard">Ir a mi panel</a></div>`,
  );
}

export async function POST(req: NextRequest) {
  const { e, canal, valido, prueba } = leer(req);
  if (!valido || !canal) return invalido();
  if (prueba) return new Response(null, { status: 204 });

  const ev = await db.event.findUnique({ where: { id: e }, select: { ownerId: true } });
  if (ev) {
    const ya = await db.analyticsEvent.findFirst({
      where: { type: "EVENT_SHARED", eventId: e, metadata: { path: ["canal"], equals: canal } },
      select: { id: true },
    });
    if (!ya) {
      await db.analyticsEvent.create({
        data: { type: "EVENT_SHARED", eventId: e, userId: ev.ownerId, metadata: { canal, via: "mail" } },
      });
    }
  }

  // El POST de la página va por fetch y no mira la respuesta; el del botón sin
  // JavaScript sí, y le corresponde la misma página de gracias.
  return req.headers.get("accept")?.includes("text/html")
    ? pagina("Gracias por contarnos", `Anotamos que lo compartiste ${DONDE[canal]}.`, `<div><a href="/dashboard">Ir a mi panel</a></div>`)
    : new Response(null, { status: 204 });
}
