# idkjustfood

Turns recipe videos into clean written recipes. See `AGENTS.md` for the idea and the plan.

## Layout

```text
apps/
  api/      Hono on Bun. Health check at GET /health, nothing else yet.
  worker/   Bun process for background jobs. Starts and logs, no jobs yet.
  web/      Next.js web app.
  mobile/   Expo (React Native) app, styled with NativeWind (Tailwind) and shadcn-style components.
packages/
  schemas/           Shared Zod schemas (empty for now).
  ui/                Shared shadcn/ui components and design tokens for the web app.
  eslint-config/     Shared ESLint configs.
  typescript-config/ Shared tsconfig bases.
```

## Commands

Run from the repo root:

```bash
bun install
bun run dev        # api, worker and web
bun run typecheck
bun run lint
```

The mobile app is started on its own: `cd apps/mobile && bun run dev`.
Copy `apps/api/.env.example` to `apps/api/.env` to change the api port (default 3001).

## Design tokens

`apps/mobile/global.css` repeats the colour tokens of `packages/ui/src/styles/globals.css` in HSL,
because NativeWind uses Tailwind 3 and cannot read oklch. Update both when a token changes.

## Adding web components

```bash
bunx shadcn@latest add button -c apps/web
```

Components land in `packages/ui/src/components` and are imported from `@workspace/ui/components/*`.
