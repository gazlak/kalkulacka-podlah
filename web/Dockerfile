# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API=http
ENV NEXT_PUBLIC_API=$NEXT_PUBLIC_API NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime s Chromiumem pro serverové PDF (verze musí odpovídat balíčku playwright).
FROM mcr.microsoft.com/playwright:v1.64.0-noble AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
USER pwuser
EXPOSE 3000
CMD ["node", "server.js"]
