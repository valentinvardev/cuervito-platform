import { leerConfig } from "./config.js";
import { lectorCostosCompartido } from "./costos/cost-explorer.js";
import { crearLector, crearPool } from "./db.js";
import { registrarHerramientas } from "./herramientas.js";
import { crearServidorHttp } from "./http.js";
import { SERVICIO, VERSION } from "./version.js";

/** El punto de entrada. Lee la configuración, abre el pool y escucha. */

let cfg;
try {
  cfg = leerConfig();
} catch (e) {
  console.error(`[${SERVICIO}] configuración inválida: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

const pool = crearPool(cfg);
// Un error de una conexión ociosa (el pooler la cierra, se corta la red) no
// puede tumbar el proceso: el próximo pedido abre otra.
pool.on("error", () => console.error(`[${SERVICIO}] se cayó una conexión ociosa de la base; se reabre sola.`));

const lector = crearLector(pool, cfg.timeoutConsultaMs);
const config = cfg;

const servidor = crearServidorHttp({
  cfg: config,
  registrar: (server) =>
    registrarHerramientas(server, {
      lector,
      cfg: config,
      costosMedidos: lectorCostosCompartido(config.costExplorer),
      alFallar: (herramienta, codigo) => console.error(JSON.stringify({ t: new Date().toISOString(), tool: herramienta, error: codigo })),
    }),
});

servidor.listen(config.puerto, () => {
  console.log(`[${SERVICIO}] v${VERSION} escuchando en :${config.puerto} · POST /mcp · zona ${config.zona}`);
});

function cerrar(senal: string) {
  console.log(`[${SERVICIO}] ${senal}: cerrando`);
  servidor.close(() => void pool.end().finally(() => process.exit(0)));
  // Si algo queda colgado, no se espera para siempre.
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", () => cerrar("SIGTERM"));
process.on("SIGINT", () => cerrar("SIGINT"));
