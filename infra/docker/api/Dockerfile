FROM oven/bun:1.1.38-alpine

WORKDIR /app

RUN apk add --no-cache nodejs npm

COPY package.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN bun install

EXPOSE 3000

CMD ["bun", "run", "dev"]
