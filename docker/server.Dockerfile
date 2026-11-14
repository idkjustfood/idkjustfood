# One image for the API and the worker (same code, two processes).
# The compose file picks the process with `command`.
# Keep this in sync with "packageManager" in package.json: a newer bun can reject bun.lock.
FROM oven/bun:1.3.8

# The worker downloads videos with yt-dlp and cuts them up with ffmpeg.
# yt-dlp breaks whenever a platform changes, so it is pinned here and easy to update:
#   docker compose build --build-arg YT_DLP_VERSION=<new release> worker api
# or change the default below. Releases: https://github.com/yt-dlp/yt-dlp/releases
ARG YT_DLP_VERSION=2026.10.26
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && case "${TARGETARCH:-amd64}" in \
       amd64) asset=yt-dlp_linux ;; \
       arm64) asset=yt-dlp_linux_aarch64 ;; \
       *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
     esac \
  && base="https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}" \
  && curl -fsSL -o "/tmp/${asset}" "${base}/${asset}" \
  && curl -fsSL -o /tmp/SHA2-256SUMS "${base}/SHA2-256SUMS" \
  && (cd /tmp && grep " ${asset}\$" SHA2-256SUMS | sha256sum -c -) \
  && install -m 0755 "/tmp/${asset}" /usr/local/bin/yt-dlp \
  && yt-dlp --version \
  && ffmpeg -version | head -1 \
  && apt-get purge -y curl && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/* /tmp/*

WORKDIR /app
COPY . .
# --ignore-scripts: better-auth pulls in optional peers (better-sqlite3, @prisma/client) whose install
# scripts need a compiler that this image does not have. We only use Postgres, so skip them.
RUN bun install --frozen-lockfile --production --ignore-scripts --filter api --filter worker --filter @workspace/database --filter @workspace/schemas --filter @workspace/extraction --filter @workspace/logger

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["bun", "apps/api/src/index.ts"]
