/**
 * Copia las hojas del laboratorio a src/styles/.
 *
 * Existe porque copiarlas a mano ya rompió un build. El laboratorio es un
 * montón de archivos sueltos que se abren con file://, así que sus URLs son
 * RELATIVAS a la carpeta: url("assets/logo-cuervito.png"). En Next esa misma
 * línea no es una URL, es un import: webpack la resuelve como módulo desde la
 * carpeta de la hoja, no encuentra src/styles/v2/assets/ y el build se cae
 * entero con "Cannot find module './assets/logo-cuervito.png'".
 *
 * En la app los mismos archivos viven en public/marca/, que se sirve desde la
 * raíz. Así que la copia no es un cp: hay que reescribir las rutas. Es la
 * única diferencia entre las dos versiones, y es exactamente la que se olvida
 * cuando uno copia a mano.
 *
 *   node scripts/copiar-del-lab.mjs                todas
 *   node scripts/copiar-del-lab.mjs panel landing  sólo esas
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const LAB = join(aqui, "../../lab");
const STYLES = join(aqui, "../src/styles");

/** Cada hoja del lab con su nombre en la app: no coinciden y nunca coincidieron. */
const HOJAS = {
  tokens:  { origen: "tokens.css",          destino: "v2/tokens.css" },
  base:    { origen: "base.css",            destino: "v2/base.css" },
  panel:   { origen: "panel.css",           destino: "v2/panel.css" },
  dashboard: { origen: "dashboard/dashboard.css", destino: "v2/dashboard.css" },
  landing: { origen: "landing/landing.css", destino: "landing-encontrate.css" },
  tienda:  { origen: "tienda/tienda.css",   destino: "tienda-encontrate.css" },
};

const cabecera = (origen) =>
  `/* COPIADO DE lab/${origen}. No editar acá: los cambios se hacen en el
   laboratorio y se vuelven a copiar, si no las dos versiones divergen y la
   del laboratorio deja de servir para decidir. */
`;

/** lab/assets/x.png se sirve desde /marca/x.png en la app. */
const rutas = (css) => css.replace(/url\((['"]?)(?:\.\/)?assets\//g, "url($1/marca/");

const pedidas = process.argv.slice(2);
const nombres = pedidas.length ? pedidas : Object.keys(HOJAS);

for (const nombre of nombres) {
  const hoja = HOJAS[nombre];
  if (!hoja) {
    console.error(`no conozco "${nombre}". Hay: ${Object.keys(HOJAS).join(", ")}`);
    process.exitCode = 1;
    continue;
  }
  const origen = join(LAB, hoja.origen);
  if (!existsSync(origen)) {
    console.error(`no existe lab/${hoja.origen}`);
    process.exitCode = 1;
    continue;
  }

  const css = rutas(readFileSync(origen, "utf8"));
  writeFileSync(join(STYLES, hoja.destino), cabecera(hoja.origen) + css);

  // Que quede dicho en la salida: si esto no baja a cero, el build se cae.
  const sueltas = (css.match(/url\((['"]?)(?:\.\/)?assets\//g) ?? []).length;
  console.log(`${hoja.origen}  →  styles/${hoja.destino}   ·  rutas sin reescribir: ${sueltas}`);
}
