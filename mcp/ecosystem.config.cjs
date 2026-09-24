/**
 * pm2, para correrlo en el mismo VPS que la aplicación.
 *
 * Puerto 8787: el 3000 y el 3005 ya están tomados por las aplicaciones que
 * corren en ese servidor. Escucha en todas las interfaces, pero sólo nginx
 * tiene que llegar a él: no abras el 8787 en el firewall.
 *
 * Las variables se leen del .env de esta carpeta (ver .env.example):
 *   pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: "encontrate-ops-mcp",
      cwd: __dirname,
      script: "dist/servidor.js",
      node_args: "--env-file=.env",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production", PORT: "8787", TRUST_PROXY: "true" },
      max_memory_restart: "200M",
      kill_timeout: 10000,
    },
  ],
};
