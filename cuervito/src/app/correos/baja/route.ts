import { type NextRequest } from "next/server";

import { db } from "~/server/db";
import { verificarBaja } from "~/server/correos/enviar";

/**
 * El link de baja de los mails de campaña.
 *
 * Un GET, sin sesión, sin confirmación: el que hizo click ya decidió, y
 * pedirle que inicie sesión para dejar de recibir mails es la manera de que
 * marque el mail como spam en vez de bajarse. La firma en la URL es lo que
 * impide que alguien dé de baja a otro.
 *
 * Sólo toca `emailsPromocionales`: los mails de cuenta —ventas, entregas,
 * contraseña— siguen llegando, porque ésos no son opcionales.
 */

export const dynamic = "force-dynamic";

function pagina(titulo: string, cuerpo: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${titulo} · encontrate.app</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f5f4ef;color:#1a1916;font-family:Outfit,system-ui,sans-serif}main{max-width:420px;padding:36px 28px;background:#fff;border:1px solid #e6e4dc;border-radius:16px;text-align:center}h1{font-size:20px;margin:0 0 10px;letter-spacing:-.02em}p{margin:0;font-size:15px;line-height:1.5;color:#5a5750}a{color:#f0410f}</style></head>
<body><main><h1>${titulo}</h1><p>${cuerpo}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  const t = req.nextUrl.searchParams.get("t");

  // El link de los mails de prueba no apunta a nadie.
  if (req.nextUrl.searchParams.get("prueba") === "1") {
    return pagina("Es un mail de prueba", "En un envío real, este link da de baja a la persona que lo recibió.");
  }

  if (!u || !t || !verificarBaja(u, t)) {
    return pagina(
      "Este link no es válido",
      `Puede que esté cortado. Si querés dejar de recibir mails, escribinos a <a href="mailto:hola@encontrate.app">hola@encontrate.app</a>.`,
      400,
    );
  }

  await db.user
    .updateMany({ where: { id: u }, data: { emailsPromocionales: false } })
    .catch(() => undefined);

  return pagina(
    "Listo, no te escribimos más",
    "Te sacamos de los mails de novedades. Los de tu cuenta —ventas, entregas— siguen llegando, porque ésos sí importan.",
  );
}
