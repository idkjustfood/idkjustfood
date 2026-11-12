# idkjustfood

Turns recipe videos into clean written recipes. See `AGENTS.md` for the idea and the plan.

## Layout

```text
apps/
  api/      Hono on Bun. Health check at GET /health, nothing else yet.
  worker/   Bun process for background jobs. Starts and logs, no jobs yet.
  app/      Expo (React Native) app for iOS, Android and web, styled with NativeWind (Tailwind) and
            shadcn-style components. Mobile first.
packages/
  schemas/           Shared Zod schemas (empty for now).
  eslint-config/     Shared ESLint configs.
  typescript-config/ Shared tsconfig bases.
```

## Commands

Run from the repo root:

```bash
bun install
bun run dev        # api, worker and the app (Expo)
bun run typecheck
bun run lint
```

Web preview: press `w` in the Expo terminal, or `bun run build` in `apps/app` for a static web build.
Copy `apps/api/.env.example` to `apps/api/.env` to change the api port (default 3001).

## Self-hosting

One Compose file (`docker-compose.yml`) runs everything: `postgres`, `api`, `worker` and `web` (the
app as a static build). It publishes no host ports, so put a reverse proxy in front. Route your API
domain to `api` (port 3001) and your app domain to `web` (port 80). HTTPS is up to the proxy.

Settings live in `.env` (see `.env.example`): database password, the public `API_URL` and
`APP_URL`, and the AI provider (`AI_PROVIDER`, `AI_API_KEY`, optional `AI_BASE_URL` and models).
`API_URL` is baked into the web build, so rebuild `web` after changing it.

### Plain Docker Compose

```bash
cp .env.example .env   # then edit .env
docker compose up -d --build
docker compose ps      # all services should become healthy
docker compose down    # stop; the database volume is kept
```

Database data is in the named volume `postgres-data`. It survives restarts and redeploys. Only
`docker compose down -v` deletes it.

### Coolify

1. Add a new resource from this Git repository and choose **Docker Compose** as the build pack.
2. Enter the variables from `.env.example` in Coolify's environment variables.
3. Assign your domains: the API domain to `api` (port 3001), the app domain to `web` (port 80).
4. Deploy.

## Design tokens

Colour tokens live in `apps/app/global.css` (HSL, read by `tailwind.config.js`).
