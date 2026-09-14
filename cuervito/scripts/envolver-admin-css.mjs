/**
 * Envuelve las hojas del prototipo del admin adentro de `.adm { … }`.
 *
 * El panel de administración pasó a dibujarse con el MISMO armazón que el
 * panel del fotógrafo (riel, barra, buscador, tema), que trae su propio CSS.
 * Pero las páginas del admin siguen escritas con las clases del prototipo de
 * cuervito, y las dos hojas definen las mismas ocho clases —.btn, .card, .head,
 * .top, .empty, .lede…— con distinto significado. Cargadas juntas, la que
 * gana depende del orden, y el riel termina con los botones del prototipo o
 * el prototipo con los del riel.
 *
 * La salida es cada hoja del prototipo anidada bajo `.adm` con anidamiento
 * nativo de CSS, así sus reglas sólo alcanzan al contenido de las páginas —que
 * va adentro de ese contenedor— y el armazón, que queda afuera, no las ve.
 *
 * Tres arreglos que el anidamiento necesita, y por qué:
 *
 *   :root { … }       → & { … }   Las variables tienen que caer sobre .adm y
 *                                  no sobre `.adm :root`, que no existe.
 *   html, body { … }  → & { … }   Lo mismo: son las reglas base del documento
 *                                  y ahora son las del contenedor.
 *   * { … }           → * { … }   Se deja: anidado es `.adm *`, que es lo que
 *                                  se quiere.
 *
 * NO se hace prefijando cada selector a mano con una expresión regular: los
 * selectores de un CSS de 100 KB tienen comas, pseudoclases con paréntesis,
 * @media con bloques adentro y @keyframes que no deben prefijarse, y una regex
 * que los recorra bien es un parser de CSS. El anidamiento nativo lo hace el
 * navegador, y lo hace bien.
 *
 * La salida se versiona (src/styles/v2/admin-cuerpo.css) para que el build no
 * dependa de correr esto. Uso: npm run css:admin
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");

// admin-nav.css NO va: eran la barra y las pestañas del armazón viejo, que ya
// no existen. Sus reglas para .adm-top y .admin-tabs no tendrían a quién
// vestir, y las genéricas competirían con el riel.
const FUENTES = ["styles.css", "panel-anim.css", "dashboard.css"];

const partes = FUENTES.map((f) => {
  const ruta = path.join(raiz, "src/styles/prototype", f);
  let css = fs.readFileSync(ruta, "utf8");

  css = css
    .replace(/^\s*:root\s*\{/gm, "& {")
    .replace(/^\s*html\s*,\s*body\s*\{/gm, "& {")
    .replace(/^\s*body\s*\{/gm, "& {")
    .replace(/^\s*html\s*\{/gm, "& {");

  return `/* ── ${f} ${"─".repeat(Math.max(0, 66 - f.length))} */\n${css}`;
});

const salida = `/* GENERADO por scripts/envolver-admin-css.mjs — NO EDITAR A MANO.
   Fuente: src/styles/prototype/{${FUENTES.join(",")}}
   Regenerar: npm run css:admin

   Las hojas del prototipo del admin, anidadas bajo .adm para que no toquen el
   armazón compartido del panel. Ver el script para el porqué. */

.adm {
${partes.join("\n\n")}
}
`;

const destino = path.join(raiz, "src/styles/v2/admin-cuerpo.css");
fs.writeFileSync(destino, salida);
console.log(
  `admin-cuerpo.css: ${(salida.length / 1024).toFixed(0)} KB desde ${FUENTES.length} hojas`,
);
