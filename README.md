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

## Design tokens

Colour tokens live in `apps/app/global.css` (HSL, read by `tailwind.config.js`).
