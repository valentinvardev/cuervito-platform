import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Check,
  CloudUpload,
  Download,
  Globe,
  Hash,
  MessageCircle,
  ScanFace,
  ScanSearch,
  ShoppingBag,
  Zap,
} from "lucide-react";

import { whatsappUrl } from "~/lib/support";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { Encabezado, PanelVentas, Preguntas, Telefono, VerEvento } from "./_piezas";

/**
 * La landing de encontrate.app.
 *
 * Es el port de lab/landing, que es donde se decide el diseño. Desde la
 * migración vive en /, y la anterior quedó en /anterior para poder comparar.
 *
 * El buscador de eventos del atleta NO está acá: esta página es para el
 * fotógrafo de punta a punta. El atleta entra por "Buscar mis fotos" en la
 * barra, que lo lleva a /eventos.
 *
 * Todo lo que en el laboratorio es marcador —las baldosas del hero, la tira de
 * eventos, los contadores, la tarjeta del evento real— acá sale de la base. Un
 * número inventado se desmiente scrolleando hasta la grilla de eventos, y una
 * foto de relleno en una plataforma que vende fotos es la peor primera
 * impresión posible.
 */
export const metadata: Metadata = {
  title: "encontrate.app · Vendé las fotos del partido",
  description:
    "Subís las fotos y listo: reconocemos cara y número, armamos tu página de venta con tu marca, y cada compra entra directo a tu Mercado Pago.",
  // Se pisa lo del layout raíz, que todavía dice Cuervito. El resto de la
  // marca —siteName, metadataBase, el dominio— sigue siendo la vieja y se
  // cambia cuando se migre el resto, no acá.
  openGraph: {
    type: "website",
    siteName: "encontrate.app",
    title: "encontrate.app · Vendé las fotos del partido",
    description: "Cobrás en tu Mercado Pago. Nosotros nunca tocamos tu plata.",
  },
};

export const dynamic = "force-dynamic";

/**
 * Debajo de estos umbrales no se muestra el contador.
 *
 * Un número honesto pero chico convence menos que no poner número.
 */
const MIN_EVENTOS = 8;
const MIN_FOTOS = 500;

/** El evento que se ofrece para probar. Decisión editorial, no técnica. */
const EVENTO_DEMO = "duatlon-club-ciclista-chivilcoy";

const PREGUNTAS = [
  {
    p: "¿Cuándo cobro?",
    r: "En el momento de la venta. El pago del atleta entra directo a tu cuenta de Mercado Pago y nosotros retenemos el 10% en la misma operación. No hay retiros ni plazos: nunca tenemos tu plata.",
  },
  {
    p: "¿El atleta tiene que crearse una cuenta?",
    r: "No. Compra con su email y descarga con un link, sin registrarse. Cada paso que le sacás al comprador es plata que no perdés.",
  },
  {
    p: "¿Sirve si en mi deporte no hay dorsal?",
    r: "Sí. El reconocimiento facial funciona igual, y el atleta también puede recorrer la galería completa y filtrar a mano.",
  },
  {
    p: "¿Qué pasa con la selfie que sube el atleta?",
    r: "Se usa para buscar y se descarta. No la guardamos: no va a nuestro storage ni a la base de datos.",
  },
  {
    p: "¿A quién le escribo si algo falla?",
    r: "A nosotros, por WhatsApp, a la hora que sea. Las carreras arrancan a las 7 de la mañana y terminan de noche, así que el soporte atiende las 24 horas.",
  },
];

const INCLUIDO = [
  "100 GB de almacenamiento",
  "Eventos y fotos ilimitados",
  "Reconocimiento de cara y número",
  "Marca de agua automática",
  "Tu página con dominio propio",
  "Códigos de descuento",
  "Descuentos por cantidad",
  "Colaboradores con comisión propia",
  "Entrega y descarga automáticas",
  "Soporte por WhatsApp las 24 horas",
];

/** La tira de eventos publicados, con su portada. */
async function tiraDeEventos() {
  const eventos = await db.event.findMany({
    where: { isPublished: true, NOT: { status: "ARCHIVED" }, coverUrl: { not: null } },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 8,
    select: { id: true, name: true, coverUrl: true },
  });

  return Promise.all(
    eventos.map(async (e) => ({
      id: e.id,
      nombre: e.name,
      url: e.coverUrl!.startsWith("http")
        ? e.coverUrl!
        : await resolveMediaUrl(e.coverUrl!).catch(() => null),
    })),
  );
}

/**
 * Las tres miniaturas de la lista de ventas.
 *
 * Saltea los nueve eventos que ya está usando el hero: con los mismos, la
 * misma foto aparecía dos veces en la misma pantalla y la página se leía como
 * si tuviéramos nueve fotos en total.
 */
async function miniaturasDeVentas() {
  const eventos = await db.event.findMany({
    where: {
      isPublished: true,
      NOT: { status: "ARCHIVED" },
      photos: {
        some: { deletedAt: null, fileSize: { not: null }, previewKey: { not: null } },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    skip: 9,
    take: 3,
    select: {
      photos: {
        where: { deletedAt: null, fileSize: { not: null }, previewKey: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { previewKey: true },
      },
    },
  });

  const urls = await Promise.all(
    eventos.flatMap((e) => e.photos.map((f) => resolveMediaUrl(f.previewKey!).catch(() => null))),
  );
  return urls.filter((u): u is string => !!u);
}

/** El evento que se ofrece para probar, con caída si ése se despublica. */
async function eventoDemo() {
  const buscar = (slug?: string) =>
    db.event.findFirst({
      where: {
        isPublished: true,
        status: { in: ["ACTIVE", "FINISHED"] },
        owner: { slug: { not: null } },
        photos: { some: { fileSize: { not: null }, deletedAt: null } },
        ...(slug ? { slug } : {}),
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: {
        name: true,
        slug: true,
        location: true,
        coverUrl: true,
        owner: { select: { slug: true } },
        _count: { select: { photos: { where: { fileSize: { not: null }, deletedAt: null } } } },
        photos: {
          where: { previewKey: { not: null }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { previewKey: true },
        },
      },
    });

  const e = (await buscar(EVENTO_DEMO)) ?? (await buscar());
  if (!e?.owner.slug) return null;

  const clave = e.coverUrl ?? e.photos[0]?.previewKey ?? null;
  return {
    nombre: e.name,
    lugar: e.location,
    fotos: e._count.photos,
    href: `/${e.owner.slug}/${e.slug}?src=demo`,
    portada: clave
      ? clave.startsWith("http")
        ? clave
        : await resolveMediaUrl(clave).catch(() => null)
      : null,
  };
}

export default async function LandingNueva() {
  // Cada una cae por su cuenta: que no haya portadas cargadas no puede dejar
  // la landing entera en blanco.
  const [sesion, eventos, fotos, tira, demo, miniaturas] = await Promise.all([
    auth().catch(() => null),
    db.event.count({ where: { isPublished: true, NOT: { status: "ARCHIVED" } } }).catch(() => 0),
    db.photo.count({ where: { fileSize: { not: null }, deletedAt: null } }).catch(() => 0),
    tiraDeEventos().catch(() => []),
    eventoDemo().catch(() => null),
    miniaturasDeVentas().catch(() => [] as string[]),
  ]);

  const hayNumeros = eventos >= MIN_EVENTOS && fotos >= MIN_FOTOS;
  const n = (x: number) => x.toLocaleString("es-AR");


  return (
    <>
      <Encabezado logueado={!!sesion?.user} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="label eyebrow">Para fotógrafos de eventos deportivos</span>
            <h1>
              Vendé las fotos
              <br />
              del partido.
              <br />
              <em>
                Cobrás en tu
                <br />
                Mercado Pago.
              </em>
            </h1>
            <p className="lede">
              Subís las fotos y listo: reconocemos cara y número, armamos tu página de venta con tu
              marca, y cada compra entra directo a tu cuenta, menos el 10%. Nosotros nunca tocamos
              tu plata.
            </p>
            <div className="hero-cta">
              <Link href="/signup" className="btn btn-pri">
                Crear mi cuenta gratis <ArrowRight className="go" />
              </Link>
              <VerEvento href="#demo" />
            </div>
            <div className="trust">
              <span>
                <b>10%</b> sólo si vendés
              </span>
              <span>
                Soporte <b>24 hs</b>
              </span>
            </div>
          </div>

          {/* El panel de verdad, adentro del teléfono, con las ventas cayendo
              encima. El titular promete plata, así que al lado va la plata y no
              el reconocimiento.

              La captura es la pantalla real renderizada a 390px y a alto
              completo de teléfono, y va en el mismo marco que las dos demos de
              más abajo: suelta es una imagen que hay que adivinar que es una
              app, enmarcada se lee de una.

              Los números están inflados y no son de nadie. */}
          <figure className="tel tel-hero" aria-hidden="true">
            <span className="tel-b tel-b-izq tel-b-accion" />
            <span className="tel-b tel-b-izq tel-b-vol-mas" />
            <span className="tel-b tel-b-izq tel-b-vol-menos" />
            <span className="tel-b tel-b-der tel-b-bloqueo" />
            <span className="tel-b tel-b-der tel-b-camara" />
            <div className="tel-vidrio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hero/panel.webp" alt="" width={1320} height={2868} />

              <div className="avisos">
                <div className="aviso" style={{ ["--i" as string]: 0 }}>
                  <span className="aviso-i">
                    <Banknote />
                  </span>
                  <div className="aviso-txt">
                    <b>Venta acreditada</b>
                    <span>Maratón del Litoral · 4 fotos</span>
                  </div>
                  <span className="aviso-m">+$9.600</span>
                </div>
                <div className="aviso" style={{ ["--i" as string]: 1 }}>
                  <span className="aviso-i">
                    <Banknote />
                  </span>
                  <div className="aviso-txt">
                    <b>Venta acreditada</b>
                    <span>Gran Fondo Sierras · pack</span>
                  </div>
                  <span className="aviso-m">+$12.600</span>
                </div>
                <div className="aviso" style={{ ["--i" as string]: 2 }}>
                  <span className="aviso-i">
                    <Banknote />
                  </span>
                  <div className="aviso-txt">
                    <b>Venta acreditada</b>
                    <span>Copa Río Salado · 3 fotos</span>
                  </div>
                  <span className="aviso-m">+$7.200</span>
                </div>
              </div>
            </div>
          </figure>
        </div>
      </header>

      {/* ── TIRA DE PRUEBA ───────────────────────────────────────────────── */}
      {tira.length > 0 && (
        <section className="strip">
          {/* La lista va dos veces: el keyframe corre el carril un 50% y con
              una sola copia se vería el salto al reiniciar. */}
          <div className="strip-track">
            {[...tira, ...tira].map((e, i) => (
              <div className="strip-tile" key={`${e.id}-${i}`}>
                {e.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.url} alt="" loading="lazy" />
                ) : (
                  <span>{e.nombre.toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
          {hayNumeros && (
            <p className="strip-cap label">
              {n(eventos)} eventos publicados · {n(fotos)} fotos
            </p>
          )}
        </section>
      )}

      {/* ── CÓMO FUNCIONA ────────────────────────────────────────────────── */}
      <section className="pad" id="como">
        <div className="wrap">
          <div className="como-top">
            <div>
              <span className="label eyebrow">Cómo funciona</span>
              <h2>
                De la tarjeta de memoria
                <br />a tu cuenta.
              </h2>
              <p className="lede" style={{ marginTop: "var(--s-5)" }}>
                Vos cubrís el evento. Indexar, publicar, cobrar y entregar lo hace la plataforma.
              </p>
            </div>

            {/* El panel de verdad subiendo un álbum: se suelta la carpeta,
                sube, y las fotos van apareciendo reconocidas. Grabado. */}
            <Telefono nombre="subida" alt="El panel del fotógrafo subiendo un álbum de fotos" />
          </div>

          <div className="steps">
            <article className="step">
              <span className="step-n">01</span>
              <h3>Subís las fotos</h3>
              <p>
                Arrastrás la carpeta entera. La marca de agua va sólo en las previews: el original
                queda intacto para el que compra.
              </p>
              <CloudUpload className="step-i" />
            </article>
            <article className="step">
              <span className="step-n">02</span>
              <h3>Indexamos y publicamos</h3>
              <p>
                Reconocimiento de cara y de número en cada foto, y tu galería online con tu
                plantilla, tu color y tu dominio.
              </p>
              <ScanSearch className="step-i" />
            </article>
            <article className="step">
              <span className="step-n">03</span>
              <h3>El atleta compra</h3>
              <p>
                Se encuentra en segundos y paga sin crear cuenta. La plata entra a tu Mercado Pago
                en el momento, con el 10% ya descontado.
              </p>
              <ShoppingBag className="step-i" />
            </article>
          </div>
        </div>
      </section>

      {/* ── TRES RAZONES ─────────────────────────────────────────────────── */}
      <section className="pad rule">
        <div className="wrap reasons">
          <div>
            <span className="label eyebrow">Por qué encontrate</span>
            <h2>
              Tus fotos,
              <br />
              tu página,
              <br />
              tu plata.
            </h2>
            <ul className="rlist">
              <li>
                <Banknote className="r-i" />
                <div>
                  <strong>Cobrás vos, no nosotros.</strong>
                  <p>
                    La compra entra a tu cuenta de Mercado Pago en el momento, con el 10% ya
                    descontado. Sin retiros, sin mínimos y sin esperar treinta días.
                  </p>
                </div>
              </li>
              <li>
                <Globe className="r-i" />
                <div>
                  <strong>Tu marca, tu dominio.</strong>
                  <p>
                    Cuatro plantillas editables, tu color, tu logo y tu dominio propio. El atleta te
                    compra a vos, no a una galería con el logo de otro arriba.
                  </p>
                </div>
              </li>
              <li>
                <Zap className="r-i" />
                <div>
                  <strong>Se encuentra en 30 segundos.</strong>
                  <p>
                    Busca por número o sube una selfie, compra sin crear cuenta y descarga al
                    acreditarse el pago. Menos fricción, más fotos vendidas.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Los nombres de los eventos son INVENTADOS. Antes eran los de tres
              eventos reales de la base —Duatlón Chivilcoy, Colón vs Gimnasia,
              Hockey Racing— en una tarjeta rotulada Ejemplo: o el ejemplo era
              falso y usaba el evento de un cliente para inventarle ventas, o
              parecía que estábamos publicando lo que factura un cliente. Las
              fotos sí son reales, y son las previews públicas de las tiendas. */}
          <PanelVentas
            total={48200}
            comparacion="ayer $40.800"
            ventas={[
              {
                evento: "Maratón del Litoral",
                detalle: "Dorsal 4218 · 4 fotos · ahora",
                monto: "+$9.600",
                foto: miniaturas[0] ?? null,
              },
              {
                evento: "Gran Fondo Sierras",
                detalle: "Dorsal 1842 · pack · hace 2 min",
                monto: "+$12.600",
                foto: miniaturas[1] ?? null,
              },
              {
                // Ésta por selfie: las dos búsquedas conviven en el producto y
                // en una lista de tres, poner las dos cuesta cero.
                evento: "Copa Río Salado",
                detalle: "Selfie · 3 fotos · hace 14 min",
                monto: "+$7.200",
                foto: miniaturas[2] ?? null,
              },
            ]}
          />
        </div>
      </section>

      {/* ── DEMO ─────────────────────────────────────────────────────────── */}
      <section className="pad rule" id="demo">
        <div className="wrap demo-card">
          <div>
            <span className="label eyebrow">Probalo vos</span>
            <h2>
              Mirá exactamente
              <br />
              lo que ve tu cliente.
            </h2>
            <p className="lede" style={{ marginTop: "var(--s-5)" }}>
              Este es un evento real publicado. Buscá por número, probá la búsqueda por selfie, meté
              fotos al carrito. Es el mismo flujo que van a usar los atletas de tu próxima fecha.
            </p>
            <div className="demo-chips">
              <span>
                <Hash />
                Buscar por número
              </span>
              <span>
                <ScanFace />
                Buscar por selfie
              </span>
              <span>
                <Download />
                Comprar y descargar
              </span>
            </div>

            {demo && (
              <div className="ev">
                <div className="ev-cover">
                  {demo.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={demo.portada} alt="" loading="lazy" />
                  ) : (
                    <span>{demo.nombre.toUpperCase()}</span>
                  )}
                </div>
                <div className="ev-body">
                  <span className="label" style={{ color: "var(--accent)" }}>
                    Evento real
                  </span>
                  <div className="t" style={{ marginTop: 6 }}>
                    {demo.nombre}
                  </div>
                  <div className="m">
                    {[demo.lugar, `${n(demo.fotos)} fotos`].filter(Boolean).join(" · ")}
                  </div>
                  <Link href={demo.href} className="btn btn-ghost">
                    Abrir el evento <ArrowUpRight className="go" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* La compra entera, de buscar el número a que el pago se confirma.
              Es la tienda de verdad: el video no ilustra el flujo, lo muestra. */}
          <Telefono nombre="compra" alt="Un atleta buscando sus fotos y comprándolas" />
        </div>
      </section>

      {/* ── PRECIO ───────────────────────────────────────────────────────── */}
      <section className="pad rule" id="precio">
        <div className="wrap">
          <div style={{ textAlign: "center" }}>
            <span className="label eyebrow">Precio</span>
            <h2>
              Gratis. Te cobramos sólo
              <br />
              cuando <span className="u">cobrás vos</span>.
            </h2>
          </div>

          <div className="price-card">
            <div className="price-left">
              <div className="price-big">10%</div>
              <div className="price-sub">por venta, con reconocimiento</div>
              <p className="price-note">
                Sin cuota mensual, sin alta y sin permanencia. Si un mes no vendés, pagás cero.
              </p>
              <div className="founder">
                <span className="label" style={{ color: "var(--accent)" }}>
                  Sin reconocimiento, 5%
                </span>
                <p style={{ fontSize: "14.5px", color: "var(--ink-2)", marginTop: 10 }}>
                  Si sólo querés la galería y no la búsqueda por cara y número, la comisión baja a
                  la mitad. No te cobramos el trabajo que no hacemos.
                </p>
              </div>
            </div>

            <div className="price-right">
              <span className="label">Todo incluido</span>
              <ul className="incl">
                {INCLUIDO.map((i) => (
                  <li key={i}>
                    <Check />
                    {i}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="btn btn-pri" style={{ marginTop: "var(--s-6)" }}>
                Empezar gratis <ArrowRight className="go" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PREGUNTAS ────────────────────────────────────────────────────── */}
      <section className="pad" style={{ paddingTop: 0 }} id="preguntas">
        <div className="wrap">
          <div style={{ textAlign: "center" }}>
            <span className="label eyebrow">Preguntas</span>
            <h2>
              Lo que preguntan
              <br />
              antes de mudarse.
            </h2>
          </div>
          <Preguntas items={PREGUNTAS} />
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="pad rule final">
        <div className="wrap">
          <h2>Publicá tu primer evento hoy.</h2>
          <p className="lede">
            Creás la cuenta, conectás Mercado Pago y subís las fotos. El mismo día podés estar
            vendiendo.
          </p>
          <div className="final-cta">
            <Link href="/signup" className="btn btn-pri">
              Crear mi cuenta gratis <ArrowRight className="go" />
            </Link>
            <a href={whatsappUrl("Hola! Tengo una consulta sobre encontrate.app")} className="btn btn-ghost" target="_blank" rel="noopener">
              <MessageCircle /> Hablar por WhatsApp
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <span>© {new Date().getFullYear()} encontrate.app · Hecho en Argentina</span>
          <Link href="/terminos">Términos y privacidad</Link>
        </div>
      </footer>
    </>
  );
}
