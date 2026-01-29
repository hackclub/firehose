FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y openssl curl wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile

COPY . .

RUN bunx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "bun run start"]
