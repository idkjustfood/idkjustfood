# idkjustfood

Turns recipe videos into clean written recipes. See `AGENTS.md` for the idea and the plan.

## Layout

```text
apps/
  api/      Hono on Bun: auth, households, recipes and recipe extraction (OpenAPI at /api/openapi.json).
  worker/   Bun process that runs the recipe extraction jobs (pg-boss queue in Postgres).
  app/      Expo (React Native) app for iOS, Android and web, styled with NativeWind (Tailwind) and
            shadcn-style components. Mobile first.
packages/
  schemas/           Shared Zod schemas and recipe logic.
  extraction/        Turns a link, photo or text into a recipe: input modules, AI providers, pipeline.
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

The app reads the API address from `EXPO_PUBLIC_API_URL` (see `apps/app/.env.example`; default `http://localhost:3001`). On a phone, `localhost` is the phone itself, so use your computer's network address instead.
Copy `apps/api/.env.example` to `apps/api/.env` to change the api port (default 3001).

## Adding recipes (supported inputs)

All of these end in the same structured recipe, saved to the user's recipes:

| Input | How it is read |
| --- | --- |
| Instagram Reel, TikTok, YouTube Short link | Caption and video are downloaded with yt-dlp. ffmpeg extracts the audio (transcribed) and a few frames (read for on-screen text). |
| Website link | The page's schema.org Recipe data is used when it is complete (no AI call). Otherwise the page text goes to the AI. |
| Photo or screenshot | JPEG, PNG, WebP or GIF up to 10 MB, read by a vision model. |
| Pasted text | Up to 20 000 characters, parsed by the AI. |

Amounts that the source does not give stay empty; nothing is guessed.

The API queues a job (`POST /api/extractions/link`, `/text`, `/image`) and the worker runs it. Poll
`GET /api/extractions/{jobId}` for the status and the finished recipe. Website links to local or
private network addresses are refused.

Setup: set `AI_PROVIDER=openrouter` and `AI_API_KEY` (see `.env.example`). Models are settings
(`AI_TRANSCRIPTION_MODEL`, `AI_VISION_MODEL`, `AI_PARSING_MODEL`), not code. Without a key, websites
with recipe data still work; everything else answers with a clear message.

To run the worker outside Docker you need `yt-dlp` and `ffmpeg` on your `PATH`.

The Docker image installs both. **yt-dlp changes often** because platforms change, so the version is
pinned in `docker/server.Dockerfile` (`YT_DLP_VERSION`). If downloads start failing, update it:

```bash
docker compose build --build-arg YT_DLP_VERSION=<release from github.com/yt-dlp/yt-dlp/releases> api worker
docker compose up -d
```

More: [how to add an input or platform](docs/adding-an-input.md) and
[how to add an AI provider](docs/ai-providers.md).

## Self-hosting

One Compose file (`docker-compose.yml`) runs everything: `postgres`, `api`, `worker` and `web` (the
app as a static build). It publishes no host ports, so put a reverse proxy in front. Route your API
domain to `api` (port 3001) and your app domain to `web` (port 80). HTTPS is up to the proxy.

Settings live in `.env` (see `.env.example`): database password, the public `API_URL` and
`APP_URL`, and the AI provider (`AI_PROVIDER`, `AI_API_KEY`, optional `AI_BASE_URL` and models).
With only `AI_PROVIDER=openrouter` and `AI_API_KEY` set, every input type works.
Auth needs `BETTER_AUTH_SECRET` (generate with `openssl rand -base64 32`). Email and password
sign-in works without anything else. To add Google or GitHub sign-in, set that provider's
`*_CLIENT_ID` and `*_CLIENT_SECRET`; a provider with no keys stays off. The callback URL is
`<API_URL>/api/auth/callback/<provider>`. A one-shot `migrate` service creates the database tables
before `api` and `worker` start.
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
