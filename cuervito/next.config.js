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

  async redirects() {
    return [
      // La landing de encontrate vivió en /nueva mientras se la revisaba, y esa
      // dirección quedó circulando en mensajes y en algún favorito. Ahora es la
      // home. Temporal (307) y no permanente: /nueva no es una dirección que
      // queramos que un navegador se acuerde para siempre.
      { source: "/nueva", destination: "/", permanent: false },
    ];
  },
};

export default config;
