# Imagen para Railway, Fly, Render o cualquier lugar que corra Docker.
# Dos etapas: la primera compila con las dependencias de desarrollo, la
# segunda sólo lleva lo que hace falta para correr.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Sin root: si alguien encontrara una forma de ejecutar algo, no sería como root.
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT:-8787}/healthz || exit 1
CMD ["node", "dist/servidor.js"]
