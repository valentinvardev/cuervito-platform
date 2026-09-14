/**
 * Renderiza las plantillas de mail a HTML para mirarlas sin mandar nada.
 *
 * Existe porque un mail no se puede ver en el navegador como una página: hay
 * que armar el HTML con datos de ejemplo y abrirlo. Escribe un archivo por
 * plantilla en la carpeta que se le pase.
 *
 *   npm run mails:preview -- C:/tmp/mails
 *
 * Corre con tsx (por los alias ~/) y con --conditions=react-server, que es lo
 * que hace que `import "server-only"` no tire fuera de Next. Las variables de
 * entorno salen de .env, que ~/env valida al importarse.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { PLANTILLAS_ENCONTRATE } from "../src/server/email-encontrate";
import { historias, promo1, promo2, promo3, sinMp } from "../src/server/correos/plantillas";

const out = process.argv[2];
if (!out) {
  console.error("Uso: npm run mails:preview -- <carpeta de salida>");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const d = { nombre: "Germán Sosa", bajaUrl: "https://encontrate.app/correos/baja?prueba=1" };
const mails: Record<string, string> = {
  bienvenida: PLANTILLAS_ENCONTRATE.bienvenida(),
  entrega: PLANTILLAS_ENCONTRATE.entrega(),
  venta: PLANTILLAS_ENCONTRATE.venta(),
  contrasena: PLANTILLAS_ENCONTRATE.contrasena(),
  invitacion: PLANTILLAS_ENCONTRATE.invitacion(),
  "campana-sin-mp": sinMp(d).html,
  "campana-historias": historias(d).html,
  "campana-promo-1": promo1(d).html,
  "campana-promo-2": promo2(d).html,
  "campana-promo-3": promo3(d).html,
};
for (const [nombre, html] of Object.entries(mails)) writeFileSync(`${out}/${nombre}.html`, html);
console.log(`${Object.keys(mails).length} mails en ${out}`);
