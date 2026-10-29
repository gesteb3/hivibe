FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN DATABASE_URL="postgresql://hivibe:build-only@localhost:5432/hivibe?schema=public" npm run build
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

ENV NODE_ENV=production
ENV PORT=4300
EXPOSE 4300

RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node

CMD ["sh", "-c", "npm run db:migrate && npm run start:prod"]
