import "server-only";

import { BASE, armar, boton, parrafo, titulo } from "~/server/email-encontrate";

/**
 * Los mails de campaña, con la voz de la landing.
 *
 * Son cinco y están acá, en un solo archivo, para que cambiar una frase sea
 * abrir esto y no buscar por el repo. Cada uno recibe lo mismo —el nombre y el
 * link de baja— y devuelve asunto, HTML y texto plano.
 *
 * El texto plano no es decorativo: Resend lo usa para el preview, los
 * lectores que bloquean HTML lo muestran, y los filtros de spam miran que
 * exista y diga lo mismo que el HTML.
 *
 * El pie con la baja va en todos, también en "sin-mp" que es casi de cuenta:
 * un mail que la persona no pidió tiene que poder pararse desde el mail.
 */

export type Destinatario = { nombre: string | null; bajaUrl: string };
export type Mail = { asunto: string; html: string; texto: string };

function saludo(d: Destinatario): string {
  const n = d.nombre?.trim().split(" ")[0];
  return n ? `${n}, ` : "";
}

function pie(bajaUrl: string): string {
  return `Te llegó porque tenés cuenta en encontrate.app. Si no querés recibir más mails como éste, <a href="${bajaUrl}" style="color:inherit;text-decoration:underline;">date de baja acá</a>.`;
}

function pieTexto(bajaUrl: string): string {
  return `\n\n—\nTe llegó porque tenés cuenta en encontrate.app. Para no recibir más mails como éste: ${bajaUrl}`;
}

/* ── 1. No conectó Mercado Pago ──────────────────────────────────────────── */

export function sinMp(d: Destinatario): Mail {
  const url = `${BASE}/dashboard/pagos`;
  return {
    asunto: "Te falta un paso para cobrar",
    html: armar({
      preheader: "Tu tienda no puede cobrar hasta que conectes Mercado Pago. Son dos minutos.",
      cuerpo: `
        ${titulo(`${saludo(d)}tus ventas van a tu Mercado Pago. Conectalo.`)}
        ${parrafo(`Cuando alguien compra una foto, la plata entra directo a tu cuenta de Mercado Pago. No pasa por nosotros. Para eso hace falta que la cuenta esté conectada, y son dos minutos.`)}
        ${boton("Conectar Mercado Pago", url)}
        ${parrafo(`Hasta que no esté conectada, tu tienda se ve pero no puede cobrar. El que quiera comprar una foto se va a encontrar con que no puede.`)}
      `,
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
    html: armar({
      preheader: "Te habilitamos el estudio de historias: una foto de tu evento, lista para publicar.",
      cuerpo: `
        ${titulo(`${saludo(d)}tenés fotos publicadas. Contalo.`)}
        ${parrafo(`Casi todas las primeras ventas vienen de lo mismo: alguien vio una foto suya en una historia y fue a buscar el resto. Si nadie sabe que las fotos están, nadie las busca.`)}
        ${parrafo(`Te habilitamos el <strong>estudio de historias</strong>. Elegís una foto de tu evento y te arma la historia lista para publicar, con tu marca y el link a la tienda.`)}
        ${boton("Armar mi primera historia", url)}
        ${parrafo(`Publicala y mandale el link del evento al grupo del club o al organizador. Es de donde salen casi todas las primeras ventas.`)}
      `,
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
    html: armar({
      preheader: "Tu atleta se saca una selfie y encuentra sus fotos. No revisa mil.",
      cuerpo: `
        ${titulo(`${saludo(d)}el que corrió no quiere revisar mil fotos.`)}
        ${parrafo(`Quiere las suyas. En tu tienda se saca una selfie o pone su número y las encuentra al instante: reconocemos caras y dorsales en cada foto que subís.`)}
        ${parrafo(`Lo único que hace falta es que sepa que las fotos están. Apenas termines de subir un evento, compartí el link: al grupo, al organizador, a tu Instagram.`)}
        ${boton("Ver mis eventos", url)}
      `,
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
    html: armar({
      preheader: "La plata va directo a tu Mercado Pago. Y con packs, se llevan más de una.",
      cuerpo: `
        ${titulo(`${saludo(d)}la plata va directo a tu Mercado Pago.`)}
        ${parrafo(`Sin mensualidad, sin mínimos: una comisión por venta, y el resto entra en tu cuenta en el momento. Vos ponés el precio.`)}
        ${parrafo(`Y un dato que se repite: el que compra una, si hay pack, compra tres. Desde tu evento podés armar <strong>descuentos por cantidad</strong> —llevá cinco y pagás cuatro— en un minuto.`)}
        ${boton("Armar un descuento", url)}
      `,
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
    html: armar({
      preheader: "La tienda lleva tu nombre, tu logo y tus colores. Publicá el próximo evento.",
      cuerpo: `
        ${titulo(`${saludo(d)}la tienda lleva tu nombre, no el nuestro.`)}
        ${parrafo(`Tu logo, tus colores, tu plantilla. Y si tenés dominio propio, tu dominio: el atleta entra a tu página y compra ahí. Todo eso se cambia desde <a href="${pagina}" style="color:inherit;">Mi página</a>.`)}
        ${parrafo(`Lo que más vende es lo más simple: publicar el evento el mismo día. Las fotos del domingo, el domingo.`)}
        ${boton("Publicar un evento", url)}
      `,
      pie: pie(d.bajaUrl),
    }),
    texto: `${saludo(d)}la tienda lleva tu nombre, no el nuestro.

Tu logo, tus colores, tu plantilla. Y si tenés dominio propio, tu dominio: el atleta entra a tu página y compra ahí. Todo eso se cambia desde Mi página: ${pagina}

Lo que más vende es lo más simple: publicar el evento el mismo día. Las fotos del domingo, el domingo.

Publicar un evento: ${url}${pieTexto(d.bajaUrl)}`,
  };
}
