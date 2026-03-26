FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY shared/ ./shared/
COPY services/auth-service/ ./services/auth-service/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @shared/logger build &&     pnpm --filter @shared/observability build &&     pnpm --filter @shared/idempotency build

RUN pnpm --filter @services/auth-service build

EXPOSE 3009

CMD ["node", "services/auth-service/dist/main.js"]
