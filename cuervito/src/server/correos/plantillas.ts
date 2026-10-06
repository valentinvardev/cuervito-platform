import "server-only";

import {
  BASE,
  D,
  SANS,
  antetitulo,
  boton,
  cuerpo,
  dorsal,
  historiaConBoton,
  marco,
  pieza,
  sinLink,
  texto,
  titular,
} from "./diseno";

/**
 * Los mails de campaña, con la voz de la landing y el diseño de la página
 * "Campañas" del archivo "encontrate — mails" de Paper.
 *
 * Son cinco y están acá, en un solo archivo, para que cambiar una frase sea
 * abrir esto y no buscar por el repo. Cada uno recibe lo mismo —el nombre y el
 * link de baja— y devuelve asunto, HTML y texto plano.
 *
 * El texto plano no es decorativo: Resend lo usa para el preview, los
 * lectores que bloquean HTML lo muestran, y los filtros de spam miran que
 * exista y diga lo mismo que el HTML.
 *
 * Las piezas visuales (la selfie que encuentra sus fotos, la tienda con
 * dominio propio, la historia de ejemplo) son imágenes en public/correos,
 * exportadas de Paper: son composiciones, y un mail no sabe superponer nada.
 * Lo que se lee —título, texto, botón— va siempre en texto de verdad.
 *
 * El pie con la baja va en todos, también en "sin-mp" que es casi de cuenta:
 * un mail que la persona no pidió tiene que poder pararse desde el mail.
 */

export type Destinatario = { nombre: string | null; bajaUrl: string };
export type Mail = { asunto: string; html: string; texto: string };

function nombreDe(d: Destinatario): string | null {
  return d.nombre?.trim().split(/\s+/)[0] ?? null;
}

function saludo(d: Destinatario): string {
  const n = nombreDe(d);
  return n ? `${n}, ` : "";
}

/** El titular con el nombre adelante, o sin él con la primera en mayúscula. */
function conNombre(d: Destinatario, resto: string): string {
  const n = nombreDe(d);
  return n ? `${n}, ${resto}` : resto.charAt(0).toUpperCase() + resto.slice(1);
}

function pie(bajaUrl: string): string {
  return `Te llegó porque tenés cuenta en ${sinLink("encontrate.app")}. Si no querés recibir más mails como éste, <a href="${bajaUrl}" style="color:${D.tenue};text-decoration:underline;">date de baja acá</a>.`;
}

function pieTexto(bajaUrl: string): string {
  return `\n\n—\nTe llegó porque tenés cuenta en encontrate.app. Para no recibir más mails como éste: ${bajaUrl}`;
}

/** La nota chica de abajo del botón. */
function nota(t: string): string {
  return `<div style="font-family:${SANS};font-size:14px;line-height:20px;color:${D.tenue};padding-top:12px;">${t}</div>`;
}

const aire = `<div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>`;

/* ── 1. No conectó Mercado Pago ──────────────────────────────────────────── */

export function sinMp(d: Destinatario): Mail {
  const url = `${BASE}/dashboard/pagos`;
  return {
    asunto: "Te falta un paso para cobrar",
    html: marco({
      titulo: "Te falta un paso para cobrar",
      preheader: "Tu tienda no puede cobrar hasta que conectes Mercado Pago. Son dos minutos.",
      rotulo: "Tu cuenta",
      tarjeta: cuerpo(`
        ${antetitulo("Falta un paso")}
        ${titular(conNombre(d, "tus ventas van a tu Mercado Pago. Conectalo."))}
        ${texto("Cuando alguien compra una foto, la plata entra directo a tu cuenta de Mercado Pago. No pasa por nosotros. Para eso hace falta que la cuenta esté conectada.")}
        ${dorsal({ izq: "Falta 1 paso", der: "encontrate.app", cifra: "2", que: "minutos", detalle: "y tu tienda puede cobrar." })}
        ${aire}
        ${boton("Conectar Mercado Pago", url)}
        ${nota("Hasta que no esté conectada, tu tienda se ve pero no puede cobrar: el que quiera comprar una foto se va a encontrar con que no puede.")}
      `),
      pie: pie(d.bajaUrl),
    }),
    texto: `${saludo(d)}tus ventas van a tu Mercado Pago. Conectalo.

Cuando alguien compra una foto, la plata entra directo a tu cuenta de Mercado Pago. No pasa por nosotros. Para eso hace falta que la cuenta esté conectada, y son dos minutos.

Conectar Mercado Pago: ${url}

Hasta que no esté conectada, tu tienda se ve pero no puede cobrar.${pieTexto(d.bajaUrl)}`,
  };
}

/* ── 2. Tiene eventos, no tiene ventas: la historia ─────────────────────── */

export function historias(d: Destinatario): Mail {
  const url = `${BASE}/dashboard/historias`;
  return {
    asunto: "Que sepan que las fotos ya están",
    html: marco({
      titulo: "Que sepan que las fotos ya están",
      preheader: "Te habilitamos el estudio de historias: una foto de tu evento, lista para publicar.",
      rotulo: "Novedades",
      tarjeta: cuerpo(`
        ${antetitulo("Estudio de historias")}
        ${titular(conNombre(d, "tenés fotos publicadas. Contalo."))}
        ${texto("Casi todas las primeras ventas vienen de lo mismo: alguien vio una foto suya en una historia y fue a buscar el resto. Si nadie sabe que las fotos están, nadie las busca.")}
        ${historiaConBoton({
          img: `${BASE}/correos/historia-ejemplo.jpg`,
          alt: "Una historia de ejemplo, armada con el estudio",
          href: url,
          rotulo: "Te habilitamos el estudio",
          titulo: "Elegís una foto y te arma la historia, con tu marca y el link.",
          bajada:
            "Publicala, y mandale el link del evento al grupo del club o al organizador: es de donde salen las primeras ventas.",
          accion: "Armar mi historia",
        })}
      `),
      pie: pie(d.bajaUrl),
    }),
    texto: `${saludo(d)}tenés fotos publicadas. Contalo.

Casi todas las primeras ventas vienen de lo mismo: alguien vio una foto suya en una historia y fue a buscar el resto. Si nadie sabe que las fotos están, nadie las busca.

Te habilitamos el estudio de historias. Elegís una foto de tu evento y te arma la historia lista para publicar, con tu marca y el link a la tienda.

Armar mi primera historia: ${url}

Publicala y mandale el link del evento al grupo del club o al organizador.${pieTexto(d.bajaUrl)}`,
  };
}

/* ── 3, 4, 5. Promocionales, una idea por mail ───────────────────────────── */

export function promo1(d: Destinatario): Mail {
  const url = `${BASE}/dashboard/eventos`;
  return {
    asunto: "Se encuentra al instante",
    html: marco({
      titulo: "Se encuentra al instante",
      preheader: "Tu atleta se saca una selfie y encuentra sus fotos. No revisa mil.",
      rotulo: "Novedades",
      tarjeta: cuerpo(`
        ${antetitulo("Caras y dorsales")}
        ${titular(conNombre(d, "el que corrió no quiere revisar mil fotos."))}
        ${texto("Quiere las suyas. En tu tienda se saca una selfie o pone su número y las encuentra al instante: reconocemos caras y dorsales en cada foto que subís.")}
        ${pieza(`${BASE}/correos/selfie.jpg`, "Una selfie que encuentra, al instante, las tres fotos de esa persona", 488, 166)}
        ${aire}
        ${boton("Ver mis eventos", url)}
        ${nota("Lo único que hace falta es que sepa que las fotos están. Apenas termines de subir un evento, compartí el link: al grupo, al organizador, a tu Instagram.")}
      `),
      pie: pie(d.bajaUrl),
    }),
    texto: `${saludo(d)}el que corrió no quiere revisar mil fotos.

Quiere las suyas. En tu tienda se saca una selfie o pone su número y las encuentra al instante: reconocemos caras y dorsales en cada foto que subís.

Lo único que hace falta es que sepa que las fotos están. Apenas termines de subir un evento, compartí el link: al grupo, al organizador, a tu Instagram.

Ver mis eventos: ${url}${pieTexto(d.bajaUrl)}`,
  };
}

export function promo2(d: Destinatario): Mail {
  const url = `${BASE}/dashboard/eventos`;
  return {
    asunto: "Cobrás vos, no nosotros",
    html: marco({
      titulo: "Cobrás vos, no nosotros",
      preheader: "La plata va directo a tu Mercado Pago. Y con packs, se llevan más de una.",
      rotulo: "Novedades",
      tarjeta: cuerpo(`
        ${antetitulo("Sin mensualidad, sin mínimos")}
        ${titular(conNombre(d, "la plata va directo a tu Mercado Pago."))}
        ${texto("Una comisión por venta, y el resto entra en tu cuenta en el momento. Vos ponés el precio. Y un dato que se repite: el que compra una, si hay pack, compra tres.")}
        ${dorsal({ izq: "Descuento por cantidad", der: "encontrate.app", cifra: "5×4", que: "llevá cinco, pagás cuatro", detalle: "Lo armás desde tu evento en un minuto." })}
        ${aire}
        ${boton("Armar un descuento", url)}
      `),
      pie: pie(d.bajaUrl),
    }),
    texto: `${saludo(d)}la plata va directo a tu Mercado Pago.

Sin mensualidad, sin mínimos: una comisión por venta, y el resto entra en tu cuenta en el momento. Vos ponés el precio.

Y un dato que se repite: el que compra una, si hay pack, compra tres. Desde tu evento podés armar descuentos por cantidad en un minuto.

Armar un descuento: ${url}${pieTexto(d.bajaUrl)}`,
  };
}

export function promo3(d: Destinatario): Mail {
  const url = `${BASE}/dashboard/nuevo`;
  const pagina = `${BASE}/dashboard/pagina`;
  return {
    asunto: "Tu marca, tu dominio",
    html: marco({
      titulo: "Tu marca, tu dominio",
      preheader: "La tienda lleva tu nombre, tu logo y tus colores. Publicá el próximo evento.",
      rotulo: "Novedades",
      tarjeta: cuerpo(`
        ${antetitulo("Tu página")}
        ${titular(conNombre(d, "la tienda lleva tu nombre, no el nuestro."))}
        ${texto(`Tu logo, tus colores, tu plantilla. Y si tenés dominio propio, tu dominio: el atleta entra a tu página y compra ahí. Todo eso se cambia desde <a href="${pagina}" style="color:${D.tinta};">Mi página</a>.`)}
        ${pieza(`${BASE}/correos/dominio.jpg`, "La tienda de un fotógrafo en su propio dominio", 488, 284)}
        ${aire}
        ${boton("Publicar un evento", url)}
        ${nota("Lo que más vende es lo más simple: publicar el evento el mismo día. Las fotos del domingo, el domingo.")}
      `),
      pie: pie(d.bajaUrl),
    }),
    texto: `${saludo(d)}la tienda lleva tu nombre, no el nuestro.

Tu logo, tus colores, tu plantilla. Y si tenés dominio propio, tu dominio: el atleta entra a tu página y compra ahí. Todo eso se cambia desde Mi página: ${pagina}

Lo que más vende es lo más simple: publicar el evento el mismo día. Las fotos del domingo, el domingo.

Publicar un evento: ${url}${pieTexto(d.bajaUrl)}`,
  };
}
