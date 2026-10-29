FROM node:24-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN DATABASE_URL="postgresql://hivibe:build-only@localhost:5432/hivibe?schema=public" npm run build

ENV NODE_ENV=production
ENV PORT=4300
EXPOSE 4300

CMD ["sh", "-c", "npm run db:migrate && npm run start:prod"]
