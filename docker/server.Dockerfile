# One image for the API and the worker (same code, two processes).
# The compose file picks the process with `command`.
# Keep this in sync with "packageManager" in package.json: a newer bun can reject bun.lock.
FROM oven/bun:1.3.8

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --production --filter api --filter worker --filter @workspace/database --filter @workspace/schemas

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["bun", "apps/api/src/index.ts"]
