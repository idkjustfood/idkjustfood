# Builds the Expo web app as static files and serves them with nginx.
# Keep this in sync with "packageManager" in package.json: a newer bun can reject bun.lock.
FROM oven/bun:1.3.8 AS build

WORKDIR /app
COPY . .
# --ignore-scripts: better-auth pulls in optional peers (better-sqlite3, @prisma/client) whose install
# scripts need a compiler that this image does not have. The web build does not need them.
RUN bun install --frozen-lockfile --ignore-scripts --filter app

# The public URL of the API is baked into the static build.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN cd apps/app && bun run build

FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/app/dist /usr/share/nginx/html
EXPOSE 80
