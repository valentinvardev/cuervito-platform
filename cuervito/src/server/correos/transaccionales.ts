import "server-only";

import { whatsappUrl } from "~/lib/support";
import type { SaleItemSummary } from "~/server/email";

import {
  BASE,
  D,
  SANS,
  antetitulo,
  boton,
  botonContorno,
  cuerpo,
  dorsal,
  esc,
  franjaGris,
  fuerte,
  marco,
  texto,
  titular,
} from "./diseno";
import { imagenUrl } from "./imagenes";

/* ============================================================================
 * Los mails de la cuenta, con el diseño nuevo.
 * ----------------------------------------------------------------------------
 * Uno por tablero del archivo "encontrate — mails" de Paper, en el mismo
 * orden: bienvenida, entrega, las tres de venta, contraseña e invitación. Las
 * funciones y lo que reciben son las de siempre —email-encontrate.ts las
 * reexporta con el mismo nombre—, más algunos datos opcionales que el diseño
 * necesita y que antes no llegaban: las fotos de una compra, la portada del
 * evento, el porcentaje de un colaborador como número. Sin ellos, cada mail
 * sale igual de bien, sin esa pieza.
 *
 * Las piezas (marco, titular, dorsal…) están en diseno.ts; acá sólo lo propio
 * de cada mail.
 * ========================================================================= */

const ZONA = "America/Argentina/Buenos_Aires";

function pesos(centavos: number): string {
  return `$${Math.round(centavos / 100).toLocaleString("es-AR")}`;
}

/**
 * El primer nombre, o null. "Hola" cuenta como nada: es lo que mandaban de
 * relleno los que llaman cuando no había nombre, y terminaba en "Listo, Hola".
 */
function primerNombre(n: string | null | undefined): string | null {
  const p = n?.trim().split(/\s+/)[0];
  return p && p.toLowerCase() !== "hola" ? p : null;
}

/**
 * "12 · 10 · 26", como va en la franja del dorsal. La fecha de un EVENTO va en
 * UTC: se guarda a medianoche UTC, y en la hora argentina sería el día de antes.
 */
function fechaDorsal(d: Date, zona: string = ZONA): string {
  return d
    .toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: zona })
    .replace(/\//g, " · ");
}

function hora(d: Date): string {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA });
}

function mismoDia(a: Date, b: Date): boolean {
  const f = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: ZONA });
  return f(a) === f(b);
}

function ayuda(t = "escribinos por WhatsApp"): string {
  return `<a href="${whatsappUrl()}" style="color:${D.tenue};text-decoration:underline;">${t}</a>`;
}

/** Una imagen de borde a borde arriba de la tarjeta. */
function cabecera(src: string, alt: string, alto: number): string {
  return `<img src="${src}" width="560" height="${alto}" alt="${esc(alt)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:20px 20px 0 0;" />`;
}

/* ── 1) Bienvenida ───────────────────────────────────────────────────────── */

export type WelcomeEmailInput = {
  name: string;
  hasMpConnected: boolean;
  hasFirstEvent: boolean;
};

export function welcomeEmailHtml(i: WelcomeEmailInput): string {
  const nombre = primerNombre(i.name);
  // UN paso, el que falta primero, y el número del dorsal es ese paso. Una
  // lista de tres pendientes en el primer mail se lee como trabajo.
  const paso = !i.hasMpConnected
    ? {
        n: "01",
        que: "Conectá Mercado Pago",
        detalle: "Es lo único que falta para que puedas cobrar.",
        url: `${BASE}/onboarding/mp`,
        b: "Conectar Mercado Pago",
        nota: "Son dos minutos. Después, el paso 2: crear tu primer evento.",
      }
    : !i.hasFirstEvent
      ? {
          n: "02",
          que: "Creá tu primer evento",
          detalle: "Subís las fotos y te queda un link para repartir.",
          url: `${BASE}/dashboard/nuevo`,
          b: "Crear un evento",
          nota: "Mercado Pago ya está conectado: lo que vendas entra directo a tu cuenta.",
        }
      : null;

  const pasos = [
    ["1", "Subís el evento", "Todas las fotos, como salen de la cámara."],
    ["2", "Las reconocemos", "Caras y dorsales, foto por foto, solos."],
    ["3", "Te las compran", "Con una selfie o su número. Cobrás al instante."],
  ]
    .map(
      ([n, t, d]) => `<td width="33%" valign="top" style="padding-right:10px;">
        <div style="font-family:${SANS};font-weight:200;font-size:42px;line-height:42px;letter-spacing:-0.05em;color:${D.cono};padding-bottom:6px;">${n}</div>
        <div style="font-family:${SANS};font-weight:600;font-size:14px;line-height:19px;color:${D.tinta};padding-bottom:4px;">${t}</div>
        <div style="font-family:${SANS};font-size:13px;line-height:18px;color:${D.tenue};">${d}</div>
      </td>`,
    )
    .join("");

  return marco({
    titulo: "Bienvenida a encontrate",
    preheader: paso ? `${paso.que}: ${paso.detalle}` : "Tu cuenta está lista para vender.",
    rotulo: "Bienvenida",
    tarjeta:
      cabecera(`${BASE}/correos/bienvenida.jpg`, "Un fotógrafo en la llegada de una carrera", 315) +
      cuerpo(
        `${antetitulo("Tu cuenta está lista")}
        ${titular(nombre ? `Hola, ${nombre}. Ya tenés dónde vender tus fotos.` : "Ya tenés dónde vender tus fotos.")}
        ${texto("Subís las fotos del evento, nosotros reconocemos caras y dorsales, y cada atleta encuentra las suyas con una selfie o con su número. Vos ponés el precio; la plata entra directo a tu cuenta.")}
        ${
          paso
            ? `${dorsal({ izq: `Paso ${Number(paso.n)} de 2`, der: "encontrate.app", cifra: paso.n, que: paso.que, detalle: paso.detalle })}
               <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
               ${boton(paso.b, paso.url)}
               <div style="font-family:${SANS};font-size:14px;line-height:20px;color:${D.tenue};padding-top:12px;">${paso.nota}</div>`
            : boton("Ir a mi panel", `${BASE}/dashboard`)
        }`,
      ) +
      franjaGris(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${pasos}</tr></table>`),
    pie: `Te escribimos porque creaste tu cuenta. Si necesitás una mano, ${ayuda()}.`,
  });
}

/* ── 2) Entrega al comprador ─────────────────────────────────────────────── */

export type DeliveryEmailInput = {
  buyerName?: string | null;
  eventName: string;
  photoCount: number;
  downloadUrl: string;
  expiresAt?: Date | null;
  /** Ids de hasta tres fotos de la compra, para el mosaico de arriba. */
  fotos?: string[];
  /** La fecha del evento, para la franja del dorsal. */
  fechaEvento?: Date | null;
  /** Quién sacó las fotos, para pedir que lo etiqueten. */
  fotografo?: { nombre: string; instagram: string | null } | null;
};

/** Las fotos de la compra, en la forma que entre: una, dos lado a lado, o una
    grande y dos chicas. En porcentajes, para que se achique en el teléfono. */
function mosaico(ids: string[], evento: string): string {
  const alt = `Tu foto de ${evento}`;
  const img = (id: string, forma: "ancha" | "grande" | "media" | "par", w: number, h: number, radio: string) =>
    `<img src="${imagenUrl("foto", id, forma)}" width="${w}" height="${h}" alt="${esc(alt)}" style="display:block;width:100%;height:auto;border:0;border-radius:${radio};" />`;
  const tabla = (filas: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filas}</table>`;
  const [a, b, c] = ids;
  if (!a) return "";
  if (!b) return img(a, "ancha", 560, 315, "20px 20px 0 0");
  if (!c) {
    return tabla(
      `<tr><td width="49.6%" valign="top">${img(a, "par", 278, 278, "20px 0 0 0")}</td><td width="0.8%"></td><td width="49.6%" valign="top">${img(b, "par", 278, 278, "0 20px 0 0")}</td></tr>`,
    );
  }
  return tabla(
    `<tr><td width="59%" valign="top">${img(a, "grande", 330, 330, "20px 0 0 0")}</td><td width="1%"></td><td width="40%" valign="top">
      ${img(b, "media", 226, 163, "0 20px 0 0")}
      <div style="height:4px;line-height:4px;font-size:0;">&nbsp;</div>
      ${img(c, "media", 226, 163, "0")}
    </td></tr>`,
  );
}

function iniciales(n: string): string {
  return (
    n
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?"
  );
}

/** La pill de Instagram, con el contorno de siempre dibujado en una tabla:
    los clientes de correo no muestran SVG. */
function pillInstagram(usuario: string): string {
  return `<a href="https://instagram.com/${encodeURIComponent(usuario)}" style="display:inline-block;padding:8px 14px;border:1px solid #D9D6CF;border-radius:999px;background:#FFFFFF;font-family:${SANS};font-weight:500;font-size:13px;color:${D.tinta};text-decoration:none;white-space:nowrap;">@${esc(usuario)}</a>`;
}

export function deliveryEmailHtml(i: DeliveryEmailInput): string {
  const nombre = primerNombre(i.buyerName);
  const n = i.photoCount;
  const vence = i.expiresAt
    ? i.expiresAt.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: ZONA })
    : null;
  const fotos = i.fotos ?? [];
  const f = i.fotografo;

  const credito = f
    ? franjaGris(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="44" valign="middle" style="padding-right:14px;"><div style="width:44px;height:44px;border-radius:50%;background:${D.tinta};color:#FFFFFF;font-family:${SANS};font-weight:600;font-size:15px;line-height:44px;text-align:center;">${esc(iniciales(f.nombre))}</div></td>
        <td valign="middle">
          <div style="font-family:${SANS};font-weight:600;font-size:14px;line-height:19px;color:${D.tinta};">Fotos de ${esc(f.nombre)}</div>
          <div style="font-family:${SANS};font-size:13px;line-height:18px;color:${D.tenue};">${f.instagram ? "Si las subís a tus redes, etiquetá su cuenta." : "Gracias por comprarlas: así sigue cubriendo eventos."}</div>
        </td>
        ${f.instagram ? `<td valign="middle" align="right" style="padding-left:12px;">${pillInstagram(f.instagram)}</td>` : ""}
      </tr></table>`)
    : "";

  return marco({
    titulo: `Tus fotos de ${i.eventName}`,
    preheader: `${n} ${n === 1 ? "foto lista" : "fotos listas"} de ${i.eventName}, sin marca de agua.`,
    rotulo: n === 1 ? "Tu foto" : "Tus fotos",
    tarjeta:
      mosaico(fotos, i.eventName) +
      cuerpo(
        `${antetitulo("Listas para bajar")}
        ${titular(nombre ? `Listo, ${nombre}. ${n === 1 ? "Es tuya." : "Son tuyas."}` : n === 1 ? "Listo. Es tuya." : "Listo. Son tuyas.")}
        ${texto(`${n === 1 ? "Tu foto" : "Tus fotos"} de ${fuerte(i.eventName)}, sin marca de agua y en la calidad original de la cámara.`)}
        ${dorsal({
          izq: i.eventName,
          der: i.fechaEvento ? fechaDorsal(i.fechaEvento, "UTC") : "encontrate.app",
          cifra: String(n),
          que: n === 1 ? "foto tuya" : "fotos tuyas",
          // De a una o todas juntas: la página de descarga tiene las dos, y en
          // el teléfono lo cómodo es de a una (en iPhone el .zip va a Archivos).
          detalle: n === 1 ? "La bajás en calidad original." : "Las bajás de a una o todas juntas.",
        })}
        <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
        ${boton(n === 1 ? "Bajar mi foto" : "Bajar mis fotos", i.downloadUrl)}
        ${
          vence
            ? `<div style="font-family:${SANS};font-size:14px;line-height:20px;color:${D.tenue};padding-top:12px;">El link funciona hasta el ${esc(vence)}. Guardalo: ${n === 1 ? "la podés" : "las podés"} volver a bajar todas las veces que quieras hasta esa fecha.</div>`
            : ""
        }`,
      ) +
      credito,
    pie: `Te escribimos porque compraste fotos. ¿Algo no anda? ${ayuda("Escribinos por WhatsApp")}.`,
  });
}

/* ── 3) Aviso de venta al fotógrafo ──────────────────────────────────────── */

/** El dato de los packs, al pie de los avisos de una y de pocas ventas. */
function consejoPack(url: string): string {
  return franjaGris(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="52" valign="middle" style="padding-right:16px;"><div style="width:52px;height:44px;border-radius:8px;background:${D.tinta};color:#FFFFFF;font-family:${SANS};font-weight:600;font-size:15px;line-height:44px;text-align:center;letter-spacing:-0.02em;">5×4</div></td>
    <td valign="middle">
      <div style="font-family:${SANS};font-weight:600;font-size:14px;line-height:19px;color:${D.tinta};">El que compra una, con pack compra tres.</div>
      <div style="font-family:${SANS};font-size:13px;line-height:18px;color:${D.tenue};">Armá un descuento por cantidad desde el evento.</div>
    </td>
    <td valign="middle" align="right" style="padding-left:12px;white-space:nowrap;"><a href="${url}" style="font-family:${SANS};font-weight:600;font-size:13px;color:${D.conoOscuro};text-decoration:none;">Armar pack&nbsp;&rarr;</a></td>
  </tr></table>`);
}

const reglaVenta = "Ya están en tu Mercado Pago, con la comisión descontada.";

function rotuloChico(t: string): string {
  return `<div style="font-family:${SANS};font-weight:500;font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:${D.tenue};padding:26px 0 10px;">${esc(t)}</div>`;
}

export function saleEmailSingleHtml(i: { photographerName: string; sale: SaleItemSummary }): string {
  const nombre = primerNombre(i.photographerName);
  const s = i.sale;
  const pagada = new Date(s.paidAt);
  const cuando = mismoDia(pagada, new Date())
    ? `Hoy · ${hora(pagada)}`
    : `${pagada.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: ZONA })} · ${hora(pagada)}`;
  const n = s.itemCount;
  const miniaturas = (s.photoIds ?? []).slice(0, 3);

  return marco({
    titulo: "Vendiste",
    preheader: `Vendiste ${n} ${n === 1 ? "foto" : "fotos"} de ${s.eventName}: te quedan ${pesos(s.sellerNetCents)}.`,
    rotulo: "Nueva venta",
    tarjeta:
      cuerpo(
        `${antetitulo(cuando)}
        ${titular(nombre ? `${nombre}, vendiste.` : "Vendiste.")}
        ${texto(`${fuerte(s.buyerName ?? "Alguien")} compró ${n === 1 ? "una foto" : `${n} fotos`} de ${fuerte(s.eventName)}.`)}
        ${dorsal({ izq: `Venta · ${n} ${n === 1 ? "foto" : "fotos"}`, der: fechaDorsal(pagada), cifra: pesos(s.sellerNetCents), que: "te quedan", detalle: reglaVenta })}
        ${
          miniaturas.length
            ? `${rotuloChico(n === 1 ? "La que se llevó" : "Las que se llevó")}
               <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${miniaturas
                 .map(
                   (id) =>
                     `<td style="padding-right:8px;"><img src="${imagenUrl("foto", id, "mini")}" width="96" height="96" alt="Una foto vendida" style="display:block;width:96px;height:96px;border:0;border-radius:10px;" /></td>`,
                 )
                 .join("")}</tr></table>`
            : ""
        }
        <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
        ${botonContorno("Ver la venta", s.saleId ? `${BASE}/dashboard/ventas?venta=${encodeURIComponent(s.saleId)}` : `${BASE}/dashboard/ventas`)}`,
      ) + consejoPack(s.eventId ? `${BASE}/dashboard/evento/${encodeURIComponent(s.eventId)}` : `${BASE}/dashboard/eventos`),
    pie: "Te avisamos de cada venta en cuanto se paga.",
  });
}

export function saleEmailSmallBatchHtml(i: { photographerName: string; sales: SaleItemSummary[] }): string {
  const nombre = primerNombre(i.photographerName);
  const neto = i.sales.reduce((a, s) => a + s.sellerNetCents, 0);
  const fotos = i.sales.reduce((a, s) => a + s.itemCount, 0);
  const k = i.sales.length;
  const eventos = new Set(i.sales.map((s) => s.eventId ?? s.eventName));
  const unico = eventos.size === 1 ? i.sales[0]?.eventId : undefined;

  const filas = i.sales
    .map(
      (s) => `<tr>
        <td valign="middle" style="padding:13px 12px 13px 0;border-bottom:1px solid ${D.lineaSuave};">
          <div style="font-family:${SANS};font-weight:600;font-size:15px;line-height:20px;color:${D.tinta};">${esc(s.buyerName ?? "Alguien")}</div>
          <div style="font-family:${SANS};font-size:13px;line-height:18px;color:${D.tenue};">${esc(s.eventName)}</div>
        </td>
        <td width="64" valign="middle" align="right" style="padding:13px 0;border-bottom:1px solid ${D.lineaSuave};font-family:${SANS};font-size:14px;color:${D.cordon};white-space:nowrap;">${s.itemCount} ${s.itemCount === 1 ? "foto" : "fotos"}</td>
        <td width="86" valign="middle" align="right" style="padding:13px 0;border-bottom:1px solid ${D.lineaSuave};font-family:${SANS};font-weight:600;font-size:15px;color:${D.tinta};white-space:nowrap;">${pesos(s.sellerNetCents)}</td>
      </tr>`,
    )
    .join("");

  return marco({
    titulo: `${k} ventas nuevas`,
    preheader: `${k} ventas nuevas: te quedan ${pesos(neto)}.`,
    rotulo: "Ventas nuevas",
    tarjeta:
      cuerpo(
        `${antetitulo("Desde tu último aviso")}
        ${titular(nombre ? `${nombre}, ${k} ventas nuevas.` : `${k} ventas nuevas.`)}
        ${texto(`Se llevaron ${fotos} ${fotos === 1 ? "foto" : "fotos"} entre las ${({ 2: "dos", 3: "tres", 4: "cuatro" } as Record<number, string>)[k] ?? k}. Acá va quién compró qué.`)}
        ${dorsal({ izq: `${k} ventas · ${fotos} fotos`, der: fechaDorsal(new Date()), cifra: pesos(neto), que: "te quedan", detalle: reglaVenta })}
        ${rotuloChico("Quién compró")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${D.lineaSuave};">${filas}</table>
        <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
        ${botonContorno("Ver mis ventas", `${BASE}/dashboard/ventas`)}`,
      ) + consejoPack(unico ? `${BASE}/dashboard/evento/${encodeURIComponent(unico)}` : `${BASE}/dashboard/eventos`),
    pie: "Te avisamos de cada venta en cuanto se paga.",
  });
}

/**
 * Las ventas por hora, como barras: cuántas entraron en cada una de las
 * últimas horas, hasta dieciséis. Con celdas de tabla, que es lo que un
 * cliente de correo sabe alinear abajo.
 */
function barras(sales: SaleItemSummary[], ahora: Date): { html: string; pico: string | null } {
  const HORA = 3_600_000;
  const tiempos = sales.map((s) => new Date(s.paidAt).getTime()).filter((t) => Number.isFinite(t));
  const primera = Math.min(...tiempos, ahora.getTime());
  const cuantas = Math.max(3, Math.min(16, Math.ceil((ahora.getTime() - primera) / HORA) || 1));
  const desde = ahora.getTime() - cuantas * HORA;
  const cubetas = Array.from({ length: cuantas }, () => 0);
  for (const t of tiempos) {
    const i = Math.min(cuantas - 1, Math.max(0, Math.floor((t - desde) / HORA)));
    cubetas[i]! += 1;
  }
  const max = Math.max(...cubetas, 1);
  const iPico = cubetas.indexOf(max);
  const celdas = cubetas
    .map((v, i) => {
      const alto = v === 0 ? 3 : Math.max(8, Math.round((v / max) * 96));
      const color = i === iPico && v > 0 ? D.cono : i === cuantas - 1 ? D.tinta : "#D6D2CA";
      return `<td valign="bottom" width="${(100 / cuantas).toFixed(2)}%" style="padding:0 3px;"><div style="height:${alto}px;line-height:${alto}px;font-size:0;background:${color};border-radius:3px 3px 0 0;">&nbsp;</div></td>`;
    })
    .join("");
  const horaPico = new Date(desde + iPico * HORA);
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #D9D6CF;"><tr style="height:100px;">${celdas}</tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-top:8px;font-family:${SANS};font-size:12px;color:${D.tenue};">Hace ${cuantas} h</td>
        <td align="right" style="padding-top:8px;font-family:${SANS};font-weight:600;font-size:12px;color:${D.tinta};">Ahora</td>
      </tr></table>`,
    // "13 h", sin el cero de adelante que pone toLocaleTimeString.
    pico: max > 1 ? `${Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hourCycle: "h23", timeZone: ZONA }).format(horaPico))} h` : null,
  };
}

export function saleEmailBigBatchHtml(i: { photographerName: string; sales: SaleItemSummary[] }): string {
  const nombre = primerNombre(i.photographerName);
  const neto = i.sales.reduce((a, s) => a + s.sellerNetCents, 0);
  const fotos = i.sales.reduce((a, s) => a + s.itemCount, 0);
  const k = i.sales.length;
  const eventos = new Set(i.sales.map((s) => s.eventId ?? s.eventName));
  const primero = i.sales[0];
  const unEvento = eventos.size === 1 && primero;
  const { html: grafico, pico } = barras(i.sales, new Date());
  const linkEvento = unEvento && primero.eventId ? `${BASE}/dashboard/evento/${encodeURIComponent(primero.eventId)}` : `${BASE}/dashboard/eventos`;

  return marco({
    titulo: "Se está vendiendo",
    preheader: `${k} ventas seguidas: te quedan ${pesos(neto)}.`,
    rotulo: "Se está vendiendo",
    tarjeta:
      cuerpo(
        `${antetitulo(unEvento ? primero.eventName : "Tus eventos")}
        ${titular(nombre ? `${nombre}, se está vendiendo.` : "Se está vendiendo.")}
        ${texto(`${unEvento ? "Tu evento lleva" : "Tus eventos llevan"} ${k} ventas seguidas, y siguen entrando.`)}
        ${dorsal({ izq: `${k} ventas · ${fotos} fotos`, der: fechaDorsal(new Date()), cifra: pesos(neto), que: "te quedan", detalle: reglaVenta })}
        ${rotuloChico(pico ? `Ventas por hora · el pico, a las ${pico}` : "Ventas por hora")}
        ${grafico}
        <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
        ${botonContorno("Ver el detalle", `${BASE}/dashboard/ventas`)}`,
      ) +
      franjaGris(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle">
          <div style="font-family:${SANS};font-weight:600;font-size:14px;line-height:19px;color:${D.tinta};">Ahora es cuando más rinde compartirlo.</div>
          <div style="font-family:${SANS};font-size:13px;line-height:18px;color:${D.tenue};">El que ve las fotos de un amigo busca las suyas.</div>
        </td>
        <td valign="middle" align="right" style="padding-left:12px;white-space:nowrap;"><a href="${linkEvento}" style="font-family:${SANS};font-weight:600;font-size:13px;color:${D.conoOscuro};text-decoration:none;">Abrir el evento&nbsp;&rarr;</a></td>
      </tr></table>`),
    pie: "Te avisamos cuando un evento tiene muchas ventas seguidas.",
  });
}

/* ── 4) Recuperar la contraseña ──────────────────────────────────────────── */

export type PasswordResetEmailInput = { name: string; resetUrl: string };

export function passwordResetEmailHtml(i: PasswordResetEmailInput): string {
  return marco({
    titulo: "Cambiá tu contraseña",
    preheader: "Cambiá tu contraseña. El link dura una hora.",
    rotulo: "Tu cuenta",
    tarjeta: cuerpo(
      `${antetitulo("Recuperar el acceso")}
      ${titular("Cambiá tu contraseña.")}
      ${texto("Pediste recuperar el acceso a tu cuenta. Tocá el botón y elegí una contraseña nueva.")}
      ${dorsal({ izq: "Link de un solo uso", der: "encontrate.app", cifra: "60", que: "minutos", detalle: "es lo que dura el link. Después, pedí uno nuevo." })}
      <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
      ${boton("Elegir una contraseña nueva", i.resetUrl)}
      <div style="font-family:${SANS};font-size:14px;line-height:20px;color:${D.tenue};padding-top:12px;">Si no pediste esto, ignorá el mail: tu contraseña sigue siendo la misma y nadie entró a tu cuenta.</div>`,
    ),
    pie: "Nunca te vamos a pedir tu contraseña por mail ni por WhatsApp.",
  });
}

/* ── 5) Invitación a cubrir un evento ────────────────────────────────────── */

export type CollaboratorInviteInput = {
  inviterName: string;
  eventName: string;
  acceptUrl: string;
  /** "70% de las ventas de tus fotos", ya redactado. Lo usa la versión vieja;
      acá manda `pct` + `alcance` cuando vienen. */
  commissionLine?: string;
  pct?: number;
  alcance?: "OWN" | "ALL" | "NONE";
  /** Para la portada de arriba, si el evento tiene. */
  eventId?: string;
  conPortada?: boolean;
  fechaEvento?: Date | null;
};

export function collaboratorInviteHtml(i: CollaboratorInviteInput): string {
  const fecha = i.fechaEvento
    ? i.fechaEvento.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "UTC" })
    : null;
  const cobra = i.alcance && i.alcance !== "NONE" && typeof i.pct === "number";

  const permiso = (si: boolean, t: string) =>
    `<tr><td width="22" valign="top" style="padding:0 0 10px;font-family:${SANS};font-weight:700;font-size:14px;line-height:20px;color:${si ? D.ok : "#8C877E"};">${si ? "&#10003;" : "&times;"}</td><td valign="top" style="padding:0 0 10px;font-family:${SANS};font-size:14px;line-height:20px;color:${si ? D.tinta : D.cordon};">${t}</td></tr>`;
  const columna = (titulo: string, color: string, filas: string) =>
    `<td width="50%" valign="top" style="padding-right:12px;"><div style="font-family:${SANS};font-weight:500;font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:${color};padding-bottom:12px;">${titulo}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0">${filas}</table></td>`;

  return marco({
    titulo: `${i.inviterName} te invita a cubrir ${i.eventName}`,
    preheader: `${i.inviterName} te invita a subir tus fotos a ${i.eventName}.`,
    rotulo: "Invitación",
    tarjeta:
      (i.conPortada && i.eventId ? cabecera(imagenUrl("portada", i.eventId, "portada"), `La portada de ${i.eventName}`, 280) : "") +
      cuerpo(
        `${antetitulo(fecha ? `${i.eventName} · ${fecha}` : i.eventName)}
        ${titular(`${i.inviterName} te invita a cubrir su evento.`)}
        ${texto("Subís tus fotos al mismo evento y a la misma tienda. El atleta encuentra las de todo el equipo y compra todas juntas.")}
        ${
          cobra
            ? `${dorsal({
                izq: "Equipo de fotos",
                der: i.eventName,
                cifra: `${i.pct}%`,
                que: i.alcance === "OWN" ? "de lo que vendan tus fotos" : "de todas las ventas del evento",
                detalle: "Después de la comisión de encontrate, venta por venta.",
              })}<div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>`
            : i.alcance === "NONE"
              ? texto("Colaborás subiendo fotos al evento, sin comisión.")
              : i.commissionLine
                ? texto(esc(i.commissionLine))
                : ""
        }
        ${boton("Aceptar la invitación", i.acceptUrl)}
        <div style="font-family:${SANS};font-size:14px;line-height:20px;color:${D.tenue};padding-top:12px;">Las ventas entran en el Mercado Pago de quien organiza. Lo tuyo queda anotado y te lo pasa esa persona.</div>`,
      ) +
      franjaGris(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${columna("Vas a poder", D.ok, permiso(true, "Subir tus fotos al evento") + permiso(true, "Ver cuánto vendieron las tuyas"))}
        ${columna("No vas a poder", D.tenue, permiso(false, "Ver las ventas de los demás") + permiso(false, "Cambiar el precio del evento"))}
      </tr></table>`),
    pie: "Si no conocés a quien te invita, ignorá este mail: no se crea nada.",
  });
}

/* ── Muestras ─────────────────────────────────────────────────────────────
   Cada mail con datos de ejemplo, para verlos sin mandar nada
   (npm run mails:preview). Los nombres son inventados: el repo es público.
   Las fotos de ejemplo no existen, así que en la vista previa esas imágenes
   salen vacías; con un envío de prueba desde /admin/correos se ven las de
   verdad. */

const VENTA_EJEMPLO: SaleItemSummary = {
  saleId: "venta-ejemplo",
  eventId: "evento-ejemplo",
  photoIds: ["foto-1", "foto-2", "foto-3"],
  eventName: "Medio Maratón de las Sierras",
  itemCount: 3,
  totalCents: 540000,
  sellerNetCents: 486000,
  buyerName: "Tomás Ibarra",
  paidAt: new Date().toISOString(),
};

export const MUESTRAS = {
  bienvenida: () => welcomeEmailHtml({ name: "Martina Gómez", hasMpConnected: false, hasFirstEvent: false }),
  entrega: () =>
    deliveryEmailHtml({
      buyerName: "Lucía Fernández",
      eventName: "Medio Maratón de las Sierras",
      photoCount: 7,
      downloadUrl: `${BASE}/descarga/demo`,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      fotos: ["foto-1", "foto-2", "foto-3"],
      fechaEvento: new Date(Date.UTC(2026, 9, 12)),
      fotografo: { nombre: "Sofía Ríos", instagram: "sofiarios.foto" },
    }),
  venta: () => saleEmailSingleHtml({ photographerName: "Martina Gómez", sale: VENTA_EJEMPLO }),
  ventas: () =>
    saleEmailSmallBatchHtml({
      photographerName: "Martina Gómez",
      sales: [
        VENTA_EJEMPLO,
        { ...VENTA_EJEMPLO, saleId: "b", buyerName: "Valentina Sosa", itemCount: 1, sellerNetCents: 162000 },
        { ...VENTA_EJEMPLO, saleId: "c", buyerName: "Joaquín Pereyra", itemCount: 5, sellerNetCents: 648000 },
        { ...VENTA_EJEMPLO, saleId: "d", buyerName: "Camila Duarte", itemCount: 2, sellerNetCents: 324000, eventName: "Duatlón del Lago", eventId: "otro" },
      ],
    }),
  "se-vende": () =>
    saleEmailBigBatchHtml({
      photographerName: "Martina Gómez",
      sales: [0, 1, 1, 2, 2, 2, 2, 3, 3, 4, 7, 9, 10, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15].map((h, k) => ({
        ...VENTA_EJEMPLO,
        saleId: `v${k}`,
        itemCount: 2 + (k % 3),
        sellerNetCents: 324000 + (k % 4) * 162000,
        paidAt: new Date(Date.now() - (15.5 - h) * 3600 * 1000).toISOString(),
      })),
    }),
  contrasena: () => passwordResetEmailHtml({ name: "Martina", resetUrl: `${BASE}/reset/demo` }),
  invitacion: () =>
    collaboratorInviteHtml({
      inviterName: "Martín Gil",
      eventName: "Duatlón del Lago",
      acceptUrl: `${BASE}/invitacion/demo`,
      pct: 70,
      alcance: "OWN",
      eventId: "evento-ejemplo",
      conPortada: true,
      fechaEvento: new Date(Date.UTC(2026, 10, 2)),
    }),
} as const;
