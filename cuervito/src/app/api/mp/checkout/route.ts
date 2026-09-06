import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { env } from "~/env";
import { calcular } from "~/lib/descuentos";
import { db } from "~/server/db";
import { accrueCommissionsForSale } from "~/server/commissions";
import { sendEmail } from "~/server/email";
import { mailsDe } from "~/server/email-marca";
import { createPreference, isMpConfigured } from "~/server/mp";
import { recordPendingAndMaybeNotify } from "~/server/sale-notifier";
import { publishSale } from "~/server/sales-bus";
import { getMpTestMode } from "~/server/settings";
import { SOURCE_COOKIE, parseTrafficSource } from "~/lib/visitor";

const checkoutSchema = z.object({
  eventId: z.string(),
  photoIds: z.array(z.string()).min(1).max(200),
  buyerEmail: z.string().email(),
  buyerName: z.string().trim().min(1).max(80).optional(),
  buyerPhone: z.string().trim().max(40).optional(),
  discountCode: z.string().trim().max(30).optional(),
});

export async function POST(req: NextRequest) {
  const globalTestMode = await getMpTestMode();

  /* Acá arriba estaba el control de "¿Mercado Pago está configurado?", y
     bajarlo no es orden: era un 503 en la puerta para TODA compra, también
     para las que no hay que cobrar. Un evento regalado en una cuenta que nunca
     conectó Mercado Pago —que es exactamente el caso de uso— moría antes de
     que nadie mirara el precio. La pregunta "¿podemos cobrar?" ahora se hace
     donde se cobra, que es el único lugar donde la respuesta cambia algo. */

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = await db.event.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      name: true,
      isPublished: true,
      pricePerPhoto: true,
      platformFeePct: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          mpAccessToken: true,
          mpConnectedAt: true,
          storefrontTemplate: true,
          status: true,
          role: true,
          testModeEnabled: true,
          giftEnabled: true,
        },
      },
    },
  });

  if (!event || !event.isPublished) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.owner.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "La cuenta del fotógrafo no está activa." },
      { status: 403 },
    );
  }

  // Test mode efectivo: el switch global de plataforma, o el switch
  // por vendedor. El segundo exige role=ADMIN verificado ACÁ y no solo
  // el flag — si a un admin le sacan el rol, el bypass muere aunque la
  // columna siga en true.
  const sellerTestMode =
    event.owner.role === "ADMIN" && event.owner.testModeEnabled;
  const testMode = globalTestMode || sellerTestMode;

  // Defensive: confirm all photoIds belong to this event, are uploaded, and
  // not soft-deleted (a buyer can't pay for a photo the photographer removed).
  const photos = await db.photo.findMany({
    where: {
      id: { in: parsed.data.photoIds },
      eventId: event.id,
      fileSize: { not: null },
      deletedAt: null,
    },
    select: { id: true, priceOverride: true },
  });
  if (photos.length === 0) {
    return NextResponse.json({ error: "Fotos inválidas" }, { status: 400 });
  }

  // Compute totals
  const eventPriceCents = Math.round(Number(event.pricePerPhoto) * 100);
  let subtotalCents = 0;
  const items = photos.map((p) => {
    const priceCents = p.priceOverride
      ? Math.round(Number(p.priceOverride) * 100)
      : eventPriceCents;
    subtotalCents += priceCents;
    return { photoId: p.id, priceCents };
  });

  // Apply discount
  const now = new Date();
  const activeDiscounts = await db.discount.findMany({
    where: {
      eventId: event.id,
      OR: [{ expires: null }, { expires: { gt: now } }],
    },
  });

  // La cuenta vive en ~/lib/descuentos y la comparte con el carrito y con
  // /api/mp/descuento. Estaba sólo acá, así que el carrito no podía mostrar el
  // precio con descuento sin copiar la fórmula, y mostraba el subtotal como
  // total: el que sumaba cinco fotos esperando la promoción veía el precio
  // entero y concluía que no funcionaba.
  const { aplicado, totalCentavos } = calcular({
    descuentos: activeDiscounts.map((d) => ({
      ...d,
      value: d.value === null ? null : Number(d.value),
      price: d.price === null ? null : Number(d.price),
    })),
    subtotalCentavos: subtotalCents,
    cantidad: photos.length,
    codigo: parsed.data.discountCode,
  });

  // Un código que no sirve se avisa; que no haya automático aplicable, no.
  if (parsed.data.discountCode?.trim() && !aplicado) {
    return NextResponse.json(
      { error: "Código de descuento inválido o vencido." },
      { status: 400 },
    );
  }

  const discountCents = aplicado?.centavos ?? 0;
  const appliedDiscountId = aplicado?.id ?? null;
  // Origen del comprador, congelado en la venta. Viene de la cookie de
  // primer contacto que escribe VisitorTracker en el storefront.
  const trafficSource = parseTrafficSource(
    req.cookies.get(SOURCE_COOKIE)?.value,
  );

  const totalCents = totalCentavos;
  // La comisión la define el EVENTO, no una constante global: un evento sin
  // reconocimiento paga menos porque no nos cuesta procesarlo. Los eventos
  // creados antes de que existiera la columna la tienen en null y siguen con
  // PLATFORM_FEE_PERCENT — cambiarles el porcentaje de golpe sería modificar el
  // trato de ventas ya en curso.
  const feePct =
    event.platformFeePct !== null ? Number(event.platformFeePct) : env.PLATFORM_FEE_PERCENT;
  const platformFeeCents = Math.round((totalCents * feePct) / 100);
  const sellerNetCents = totalCents - platformFeeCents;

  /* Dos copias sin nulos, para poder usarlas adentro de entregarSinCobrar.

     El estrechamiento de tipos que hicieron los `if` de arriba —el evento
     existe, los datos parsearon— no cruza la frontera de una función anidada:
     TypeScript no puede saber cuándo se la va a llamar, así que adentro
     vuelven a ser "posiblemente nulo". Las copias son const y se toman después
     de los controles, que es lo que hace que el compilador las acepte. */
  const evento = event;
  const datos = parsed.data;

  /* ── Entregar sin cobrar ──────────────────────────────────────────────────
     Dos caminos distintos terminan en lo mismo: la venta nace ya entregada,
     con su token de descarga, sin pasar por Mercado Pago. El modo de prueba,
     que ya existía, y el regalo, que es lo nuevo.

     Está compartido y no copiado porque lo de adentro —el token, cuánto dura,
     el descuento que se marca como usado, el mail que recibe el comprador— es
     el contrato de entrega de la plataforma. Dos copias de eso se desincronizan
     el día que alguien toca una sola: la que quedó vieja sigue entregando con
     un vencimiento que ya no es el que rige, y nadie se entera hasta que
     escribe un comprador.

     Lo que NO tienen en común va por parámetro, y esa lista es exactamente lo
     que separa un regalo de una venta. */
  async function entregarSinCobrar({
    estado,
    notas,
    comoVenta,
    etiqueta,
  }: {
    estado: "PAID" | "GIFT";
    notas: string;
    /** Si cuenta como venta: devenga comisiones, suena la campanita del panel
     *  y le llega el aviso al fotógrafo. Un regalo no hace nada de eso —son
     *  cero pesos, y una caja registradora sonando por cero pesos es ruido. */
    comoVenta: boolean;
    /** Para los console.error, así se sabe cuál de los dos caminos falló. */
    etiqueta: string;
  }): Promise<{ saleId: string; token: string }> {
    const downloadToken = randomBytes(24).toString("hex");
    const tokenExpiresAt = new Date(
      Date.now() + env.DOWNLOAD_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const [sale] = await db.$transaction([
      db.sale.create({
        data: {
          sellerId: evento.ownerId,
          eventId: evento.id,
          buyerEmail: datos.buyerEmail,
          buyerName: datos.buyerName ?? null,
          buyerPhone: datos.buyerPhone ?? null,
          subtotalCents,
          discountCents,
          totalCents,
          platformFeeCents,
          sellerNetCents,
          status: estado,
          // paidAt es CUÁNDO ENTRÓ LA PLATA, no cuándo se entregó. En un
          // regalo no entró ninguna, así que queda en null: las pantallas que
          // muestran fecha ya caen a createdAt, y las cuentas de plata filtran
          // por paidAt sin tener que acordarse de descontar los regalos.
          paidAt: estado === "PAID" ? new Date() : null,
          trafficSource,
          downloadToken,
          downloadTokenExpires: tokenExpiresAt,
          notes: notas,
          items: {
            create: items.map((i) => ({ photoId: i.photoId, priceCents: i.priceCents })),
          },
        },
        select: { id: true },
      }),
      ...(appliedDiscountId
        ? [db.discount.update({ where: { id: appliedDiscountId }, data: { usageCount: { increment: 1 } } })]
        : []),
    ]);

    if (comoVenta) {
      // Mismo flujo que el webhook real, comisiones incluidas.
      void accrueCommissionsForSale(sale.id).catch((err: unknown) =>
        console.error(`[checkout ${etiqueta}] accrueCommissions failed:`, err),
      );

      publishSale(evento.ownerId, {
        saleId: sale.id,
        amount: totalCents,
        itemCount: items.length,
        eventName: evento.name,
        buyerName: datos.buyerName ?? null,
        paidAt: new Date().toISOString(),
      });
      revalidateTag(`user:${evento.ownerId}:dashboard`);

      void recordPendingAndMaybeNotify(sale.id).catch((err: unknown) =>
        console.error(`[checkout ${etiqueta}] seller notify failed:`, err),
      );
    }

    // El mail al comprador SÍ va siempre: es la entrega. Que no se haya
    // cobrado no cambia que del otro lado hay alguien esperando sus fotos.
    const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    void sendEmail({
      to: datos.buyerEmail,
      subject: `Tus fotos · ${evento.name}`,
      html: mailsDe(evento.owner.storefrontTemplate).deliveryEmailHtml({
        buyerName: datos.buyerName ?? "Hola",
        eventName: evento.name,
        photoCount: items.length,
        downloadUrl: `${baseUrl}/descarga/${downloadToken}`,
      }),
    }).catch((err: unknown) =>
      console.error(`[checkout ${etiqueta}] delivery email failed:`, err),
    );

    return { saleId: sale.id, token: downloadToken };
  }

  /* ── No hay nada que cobrar ───────────────────────────────────────────────
     El total dio cero. Puede ser porque el evento está a precio cero —que es
     como se regala una galería entera— o porque un descuento se comió el
     total.

     Los dos casos tenían el mismo final hasta hoy, y era malo: se armaba una
     preferencia de cero pesos, Mercado Pago la rechazaba, el comprador veía un
     502 y quedaba una venta en FAILED. Un pago de cero no existe; el error era
     pedirlo.

     Quién puede hacerlo es un permiso por cuenta y no una opción del evento:
     poner el precio en cero siempre se pudo, así que si el cero por sí solo
     repartiera fotos gratis, cualquiera lo descubriría sin querer. */
  if (totalCents === 0) {
    if (event.owner.giftEnabled) {
      const { saleId, token } = await entregarSinCobrar({
        estado: "GIFT",
        comoVenta: false,
        etiqueta: "regalo",
        notas:
          subtotalCents === 0
            ? "REGALO — el evento está a precio cero"
            : `REGALO — el descuento cubrió el total (${aplicado?.texto ?? "sin detalle"})`,
      });
      return NextResponse.json({
        saleId,
        initPoint: `/descarga/${token}?fresh=1`,
        regalo: true,
      });
    }
    if (!testMode) {
      return NextResponse.json(
        {
          error:
            "Estas fotos no tienen precio cargado, así que no hay nada que cobrar. Avisale al fotógrafo.",
        },
        { status: 409 },
      );
    }
    // Con el modo de prueba prendido sigue de largo al camino de abajo, que es
    // lo que hacía antes de que el regalo existiera.
  }

  // === TEST MODE ===
  // Skip MP entirely: create the Sale already PAID with a downloadToken so
  // we can validate the post-payment UX locally without going through MP.
  if (testMode) {
    const { saleId, token } = await entregarSinCobrar({
      estado: "PAID",
      comoVenta: true,
      etiqueta: "test-mode",
      notas: sellerTestMode
        ? "TEST MODE (vendedor admin) — pago no verificado"
        : "TEST MODE (global) — pago no verificado",
    });

    return NextResponse.json({
      saleId,
      // Send the buyer straight to /descarga with ?fresh=1 — the page renders
      // the photo grid AND runs the in-place "Confirmando pago → Pago
      // confirmado → Gracias por tu compra" overlay on top. No intermediate
      // navigation, no loading wheel between states.
      initPoint: `/descarga/${token}?fresh=1`,
      testMode: true,
    });
  }

  /* Recién acá se pregunta si podemos cobrar, porque recién acá se cobra.
     Antes las dos preguntas estaban en la puerta de entrada y le cerraban el
     paso a compras que no había que cobrar.

     Van ANTES de crear la venta y no después: contestarlas con la fila ya
     creada deja, en cada intento sin Mercado Pago, una venta PENDING colgada
     que no se va a completar nunca. */
  if (!isMpConfigured()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado." },
      { status: 503 },
    );
  }
  if (!event.owner.mpAccessToken) {
    return NextResponse.json(
      { error: "El fotógrafo aún no conectó Mercado Pago." },
      { status: 409 },
    );
  }

  // === REAL MP FLOW ===
  // Create the Sale first (PENDING) — we'll update status from the webhook
  const [sale] = await db.$transaction([
    db.sale.create({
      data: {
        sellerId: event.ownerId,
        eventId: event.id,
        buyerEmail: parsed.data.buyerEmail,
        buyerName: parsed.data.buyerName ?? null,
        buyerPhone: parsed.data.buyerPhone ?? null,
        subtotalCents,
        discountCents,
        totalCents,
        platformFeeCents,
        sellerNetCents,
        status: "PENDING",
        trafficSource,
        items: {
          create: items.map((i) => ({ photoId: i.photoId, priceCents: i.priceCents })),
        },
      },
      select: { id: true },
    }),
    ...(appliedDiscountId
      ? [db.discount.update({ where: { id: appliedDiscountId }, data: { usageCount: { increment: 1 } } })]
      : []),
  ]);

  // Build URLs
  const base =
    env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  const successUrl = `${base}/pago/exito?sale=${sale.id}`;
  const failureUrl = `${base}/pago/error?sale=${sale.id}`;
  const pendingUrl = `${base}/pago/pendiente?sale=${sale.id}`;
  const notificationUrl = `${base}/api/mp/webhook`;

  try {
    const pref = await createPreference({
      sellerAccessToken: event.owner.mpAccessToken!,
      items: [
        {
          title: `${photos.length} ${photos.length === 1 ? "foto" : "fotos"} · ${event.name}`,
          quantity: 1,
          unitPriceCents: totalCents,
        },
      ],
      marketplaceFeeCents: platformFeeCents,
      buyerEmail: parsed.data.buyerEmail,
      externalReference: sale.id,
      successUrl,
      failureUrl,
      pendingUrl,
      notificationUrl,
    });

    await db.sale.update({
      where: { id: sale.id },
      data: { mpPreferenceId: pref.id },
    });

    // In sandbox, MP exposes a distinct init_point; in production they're the same.
    const initPoint =
      env.MP_ENVIRONMENT === "sandbox" ? pref.sandboxInitPoint : pref.initPoint;

    return NextResponse.json({ saleId: sale.id, initPoint });
  } catch (err) {
    // Mark sale as failed so we don't leave it dangling
    await db.sale
      .update({ where: { id: sale.id }, data: { status: "FAILED" } })
      .catch(() => undefined);
    console.error("[mp checkout] preference failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout falló" },
      { status: 502 },
    );
  }
}
