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
};

export default config;
