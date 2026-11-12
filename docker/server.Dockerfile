# One image for the API and the worker (same code, two processes).
# The compose file picks the process with `command`.
# Keep this in sync with "packageManager" in package.json: a newer bun can reject bun.lock.
FROM oven/bun:1.3.8

WORKDIR /app
COPY . .
# --ignore-scripts: better-auth pulls in optional peers (better-sqlite3, @prisma/client) whose install
# scripts need a compiler that this image does not have. We only use Postgres, so skip them.
RUN bun install --frozen-lockfile --production --ignore-scripts --filter api --filter worker --filter @workspace/database --filter @workspace/schemas

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["bun", "apps/api/src/index.ts"]
