/**
 * Avisa a los buscadores que hay páginas nuevas o cambiadas, por IndexNow.
 *
 * IndexNow lo usan Bing, Yandex, Seznam y Naver (Bing reparte a los demás).
 * Google no: Google no tiene forma de pedirle que indexe algo sin Search
 * Console, y para él están el sitemap y el robots.txt.
 *
 * La clave es pública a propósito: el protocolo la verifica pidiendo
 * encontrate.app/{CLAVE}.txt, que está en public/. Con ella sólo se pueden
 * avisar direcciones de este dominio, así que no hay nada que proteger.
 *
 * Uso:
 *   npm run indexnow                       todo lo del sitemap
 *   npm run indexnow -- /blog /blog/algo   sólo esas
 *
 * Correrlo DESPUÉS del deploy: si el archivo de la clave todavía no está
 * publicado, IndexNow rechaza el envío.
 */

const SITIO = "https://encontrate.app";
const CLAVE = "da9e3918fae33a35ec7d5383cb4b2ba5";
const UBICACION = `${SITIO}/${CLAVE}.txt`;

async function direccionesDelSitemap() {
  const res = await fetch(`${SITIO}/sitemap.xml`);
  if (!res.ok) throw new Error(`el sitemap respondió ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function main() {
  // Primero, que la clave esté publicada: es lo primero que va a pedir Bing,
  // y si falta el error que devuelve no dice por qué.
  const clave = await fetch(UBICACION);
  const texto = clave.ok ? (await clave.text()).trim() : "";
  if (texto !== CLAVE) {
    console.error(
      `La clave no está publicada en ${UBICACION} (respondió ${clave.status}).\n` +
        "Falta el deploy, o Cloudflare está bloqueando el pedido.",
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const urls = args.length
    ? args.map((a) => (a.startsWith("http") ? a : `${SITIO}${a.startsWith("/") ? "" : "/"}${a}`))
    : await direccionesDelSitemap();

  if (urls.length === 0) {
    console.error("No hay direcciones para mandar.");
    process.exit(1);
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITIO).host,
      key: CLAVE,
      keyLocation: UBICACION,
      urlList: urls.slice(0, 10_000),
    }),
  });

  /* Lo que contesta IndexNow:
     200  recibido
     202  recibido; la clave se verifica después (normal la primera vez)
     400  pedido mal armado
     403  la clave no coincide con el archivo
     422  hay direcciones que no son de este dominio
     429  demasiados envíos seguidos */
  const significado = {
    200: "recibido",
    202: "recibido, la clave se verifica aparte (normal la primera vez)",
    400: "pedido mal armado",
    403: "la clave no coincide con el archivo publicado",
    422: "hay direcciones que no son de encontrate.app",
    429: "demasiados envíos seguidos; probá más tarde",
  };
  console.log(`${urls.length} direcciones → ${res.status} ${significado[res.status] ?? ""}`);
  if (res.status >= 400) {
    console.error(await res.text());
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
