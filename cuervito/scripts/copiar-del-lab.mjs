/**
 * Copia las hojas del laboratorio a src/styles/v2/.
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
 *   node scripts/copiar-del-lab.mjs            copia todas
 *   node scripts/copiar-del-lab.mjs panel base copia sólo esas
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const LAB = join(aqui, "../../lab");
const DESTINO = join(aqui, "../src/styles/v2");

const HOJAS = ["tokens", "base", "panel"];

const CABECERA = `/* COPIADO DE lab/.. No editar acá: los cambios se hacen en el laboratorio
   y se vuelven a copiar, si no las dos versiones divergen y la del
   laboratorio deja de servir para decidir. */
`;

/** lab/assets/x.png se sirve desde /marca/x.png en la app. */
function rutas(css) {
  return css.replace(/url\((['"]?)(?:\.\/)?assets\//g, "url($1/marca/");
}

const pedidas = process.argv.slice(2);
const hojas = pedidas.length ? pedidas : HOJAS;

for (const nombre of hojas) {
  const origen = join(LAB, `${nombre}.css`);
  if (!existsSync(origen)) {
    console.error(`no existe lab/${nombre}.css`);
    process.exitCode = 1;
    continue;
  }
  const css = rutas(readFileSync(origen, "utf8"));
  writeFileSync(join(DESTINO, `${nombre}.css`), CABECERA + css);

  // Que quede dicho en la salida: si esto no baja a cero, el build se cae.
  const sueltas = (css.match(/url\((['"]?)(?:\.\/)?assets\//g) ?? []).length;
  console.log(`${nombre}.css copiada  ·  rutas relativas sin reescribir: ${sueltas}`);
}
