FROM oven/bun:1.1.38-alpine

WORKDIR /app

COPY package.json tsconfig.json vite.config.ts index.html ./ 
COPY src ./src

RUN bun install

EXPOSE 5173

CMD ["bun", "run", "dev"]
