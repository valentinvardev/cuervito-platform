import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Arma src/styles/v2/paginas.css juntando el CSS de cada pantalla del
 * laboratorio.
 *
 * Existe como script y no como un pegote a mano por lo que pasó antes: lo venía
 * regenerando con un one-liner que leía el archivo anterior para recuperar la
 * cabecera y el bloque de arreglos. Buscaba tres saltos de línea como separador
 * y escribía dos, así que indexOf devolvía -1, el archivo entero quedaba como
 * "cabecera" y todo se volvía a agregar abajo. Se duplicaba en cada corrida:
 * llegó a 10 MB con 128 copias de todo antes de que se notara.
 *
 * Acá no puede pasar: la salida se arma SIEMPRE desde las fuentes —los archivos
 * del laboratorio más _arreglos.css— y nunca se lee la salida anterior.
 *
 * Uso: npm run css:v2
 */
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");
const lab = path.resolve(raiz, "..", "lab");
const destino = path.resolve(raiz, "src/styles/v2/paginas.css");

/**
 * OJO al agregar una pantalla nueva: hay que sumarla acá. El síntoma de
 * olvidarse es que la pantalla aparece entera pero sin ningún estilo, que no se
 * parece en nada a "falta un archivo" — ya pasó con evento.css.
 */
const PANTALLAS = [
  "eventos/eventos.css",
  "evento/evento.css",
  "nuevo/nuevo.css",
  "ventas/ventas.css",
  "pagina/pagina.css",
  "pagos/pagos.css",
  "perfil/perfil.css",
  "ayuda/ayuda.css",
  "historias/historias.css",
];

const CABECERA = `/* GENERADO por scripts/armar-paginas.mjs. No editar a mano.

   Junta el CSS de cada pantalla del laboratorio en un solo archivo, porque el
   layout de /v2 importa el de todas sus pantallas y así no hay un import por
   página.

   Para cambiar algo: se toca el archivo del laboratorio y se corre
   \`npm run css:v2\`. Editar acá se pierde en la próxima corrida.
   ========================================================================== */
`;

let salida = CABECERA;
for (const p of PANTALLAS) {
  const ruta = path.join(lab, p);
  if (!fs.existsSync(ruta)) {
    console.error(`falta ${ruta}`);
    process.exit(1);
  }
  salida += `\n/* ═══════════════ ${p} ═══════════════ */\n`;
  salida += fs.readFileSync(ruta, "utf8").trimEnd() + "\n";
}

// Los arreglos de colisiones van al final: son overrides y necesitan ganar por
// orden. Viven aparte porque no pertenecen a ninguna pantalla del laboratorio.
salida += "\n" + fs.readFileSync(path.join(raiz, "src/styles/v2/_arreglos.css"), "utf8");

// Las rutas de assets del laboratorio son relativas a su carpeta; en producción
// los archivos están en /v2/.
salida = salida.replace(/url\("assets\//g, 'url("/v2/');

fs.writeFileSync(destino, salida);

const abre = (salida.match(/{/g) ?? []).length;
const cierra = (salida.match(/}/g) ?? []).length;
console.log(
  `paginas.css · ${PANTALLAS.length} pantallas · ${Math.round(salida.length / 1024)} KB · llaves ${abre}/${cierra} ${abre === cierra ? "ok" : "MAL"}`,
);
if (abre !== cierra) process.exit(1);
