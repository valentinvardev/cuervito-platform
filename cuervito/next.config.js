/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Lint is run separately (`npm run lint`) — don't fail prod builds on style violations.
  eslint: { ignoreDuringBuilds: true },
  // Silence the "multiple lockfiles" warning by pinning the workspace root.
  outputFileTracingRoot: process.cwd(),
  // satori afuera del empaquetado.
  //
  // Para maquetar el texto usa dos módulos WebAssembly —yoga para el flexbox y
  // harfbuzz para el shaping—. webpack se lleva el JavaScript al chunk de la
  // ruta pero deja los .wasm donde estaban, así que en ejecución busca hb.wasm
  // al lado del route.js y ahí no existe:
  //
  //   ENOENT ... .next/server/app/api/dashboard/historias/hb.wasm
  //
  // Marcándolo externo, Next lo resuelve desde node_modules, que es donde sus
  // .wasm sí están. Es lo mismo que hace falta para sharp, y por lo mismo.
  serverExternalPackages: ["satori", "sharp"],

  async redirects() {
    return [
      // La landing de encontrate vivió en /nueva mientras se la revisaba, y esa
      // dirección quedó circulando en mensajes y en algún favorito. Ahora es la
      // home. Temporal (307) y no permanente: /nueva no es una dirección que
      // queramos que un navegador se acuerde para siempre.
      { source: "/nueva", destination: "/", permanent: false },

      // El panel rediseñado vivió en /v2 mientras era vista previa. Ahora es
      // el panel.
      { source: "/v2", destination: "/dashboard", permanent: false },
      { source: "/v2/:resto*", destination: "/dashboard/:resto*", permanent: false },

      // Tres pantallas cambiaron de nombre al migrar. Estas direcciones
      // estuvieron en producción, así que están en favoritos y en el historial
      // de gente que entra todos los días. El orden importa: /events/new tiene
      // que resolverse ANTES que /events/:id, si no "new" se toma por un id.
      { source: "/dashboard/events/new", destination: "/dashboard/nuevo", permanent: false },
      { source: "/dashboard/events/:id/edit", destination: "/dashboard/evento/:id", permanent: false },
      { source: "/dashboard/events/:id", destination: "/dashboard/evento/:id", permanent: false },
      { source: "/dashboard/events", destination: "/dashboard/eventos", permanent: false },
      { source: "/dashboard/cobros", destination: "/dashboard/pagos", permanent: false },
      { source: "/dashboard/tienda", destination: "/dashboard/pagina", permanent: false },
    ];
  },
};

export default config;
