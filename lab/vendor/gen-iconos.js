/* =============================================================================
   Genera vendor/iconos.js con SÓLO los íconos que el laboratorio usa de verdad.

   Por qué: el paquete completo de Lucide pesa 373 KB y el navegador lo tiene
   que analizar entero en cada carga de página, venga de caché o no. Con 49
   íconos en uso sobre 1861 disponibles, eso es tirar el 97% del trabajo.

   Correr después de agregar un data-lucide nuevo:

       node vendor/gen-iconos.js
   ========================================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");

// El paquete original se conserva sólo como fuente para esta generación.
const ctx = { window: {}, document: {}, console };
ctx.self = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "lucide.min.js"), "utf8"), ctx);
const L = ctx.lucide || ctx.window.lucide;

// Barrido de los data-lucide presentes en el laboratorio.
const usados = new Set();
(function rec(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "vendor" || e.name === "node_modules" || e.name === ".git") continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) rec(f);
    else if (/\.(html|js)$/.test(e.name)) {
      const txt = fs.readFileSync(f, "utf8");
      // Dos formas de nombrar un ícono, y hay que buscar las dos. La primera
      // vez esto sólo miraba data-lucide, y se comió los cinco del riel:
      // panel.js los declara como `icono: "calendar-days"` y los convierte a
      // data-lucide recién al armar el HTML, así que en el archivo nunca
      // aparecen escritos de esa forma.
      for (const m of txt.matchAll(/data-lucide="([a-z0-9-]+)"/g)) usados.add(m[1]);
      for (const m of txt.matchAll(/\bicono:\s*"([a-z0-9-]+)"/g)) usados.add(m[1]);
    }
  }
})(RAIZ);

// lucide.icons indexa en PascalCase; los atributos van en kebab.
const pascal = (s) => s.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");

const salida = {};
const faltan = [];
for (const n of [...usados].sort()) {
  const ic = L.icons[pascal(n)] || L.icons[n];
  if (!ic || !ic.length) { faltan.push(n); continue; }
  salida[n] = ic;   // ya es el arreglo de [etiqueta, atributos]
}
if (faltan.length) console.log("NO ENCONTRADOS:", faltan.join(" "));

const cuerpo = `/* =============================================================================
   encontrate · iconos
   -----------------------------------------------------------------------------
   GENERADO. No editar a mano: correr \`node vendor/gen-iconos.js\`.

   Subconjunto de Lucide 0.544.0 con los ${Object.keys(salida).length} íconos que el laboratorio usa
   de verdad, de los 1861 del paquete. El paquete entero pesa 373 KB y hay que
   analizarlo completo en cada carga de página aunque venga de caché, que era
   buena parte de lo que se sentía lento al navegar por el riel.
   ========================================================================== */
(function () {
  "use strict";

  var I = ${JSON.stringify(salida)};

  var NS = "http://www.w3.org/2000/svg";
  var BASE = {
    xmlns: NS, width: 24, height: 24, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round"
  };

  function crear(raiz) {
    var nodos = (raiz || document).querySelectorAll("[data-lucide]");
    for (var i = 0; i < nodos.length; i++) {
      var el = nodos[i];
      var nombre = el.getAttribute("data-lucide");
      var trazos = I[nombre];
      // Ruidoso a propósito. Un ícono que falta no se ve: el <i> queda ahí,
      // vacío y sin ocupar lugar, y el hueco pasa por decisión de diseño.
      // Así queda dicho en consola con el comando exacto para arreglarlo.
      if (!trazos) {
        console.warn('icono "' + nombre + '" no está en el subconjunto. Correr: node vendor/gen-iconos.js');
        continue;
      }

      var svg = document.createElementNS(NS, "svg");
      for (var k in BASE) svg.setAttribute(k, BASE[k]);

      // Las clases del <i> se copian al <svg>. El CSS apunta a cosas como .go
      // y .g-logo, y si se perdieran en el reemplazo dejarían de enganchar:
      // ese fue el bug de la animación del conmutador de tema.
      if (el.className) svg.setAttribute("class", el.className);

      for (var t = 0; t < trazos.length; t++) {
        var n = document.createElementNS(NS, trazos[t][0]);
        var a = trazos[t][1];
        for (var p in a) n.setAttribute(p, a[p]);
        svg.appendChild(n);
      }
      el.parentNode.replaceChild(svg, el);
    }
  }

  window.lucide = { createIcons: crear, icons: I };
})();
`;

fs.writeFileSync(path.join(__dirname, "iconos.js"), cuerpo);
console.log(
  "íconos:", Object.keys(salida).length,
  "· vendor/iconos.js:", fs.statSync(path.join(__dirname, "iconos.js")).size, "bytes",
  "(el paquete completo:", fs.statSync(path.join(__dirname, "lucide.min.js")).size + ")"
);
