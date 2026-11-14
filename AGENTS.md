# idkjustfood

## The idea

Recipes on social media are hard to follow. In a short video the recipe is spread over the
caption, what the person says, and text shown on screen, and none of it can be saved as a recipe.

idkjustfood turns a recipe video into a clean written recipe: title, servings, ingredients with
amounts, and steps. The user shares or pastes a link, and the recipe comes back.

idkjustfood is **open source**.

## Supported platforms

- **Instagram Reels:** first, and the only one in the prototype.
- **YouTube Shorts** and **TikTok:** later.

Each platform is its own source module (see "Modular by design"), so adding one doesn't change the
rest of the pipeline.

## What we are building

Two parts that share one backend:

- **API:** takes a video link, collects caption, audio and frames, uses AI to turn them into a
  structured recipe, and stores it.
- **App:** one Expo (React Native) codebase for iOS, Android and web. Paste a link, read and manage
  your saved recipes, and on mobile share a reel straight from Instagram into the app.

**Mobile first.** The app is designed for the phone: touch targets, one-handed use, offline in the
shop. The web version comes from the same code. Desktop is a bonus and for the initial setup
(for example trying things on a computer), so it must work, but it never decides a design.

## Business model

- **Self-host: free.** Anyone can run the whole stack on their own server, with the AI of their
  choice.
- **Cloud: about 12 € a month.** We host it, and AI costs are included in the plan.

So everything must run self-hosted with simple setup and configuration. Cloud-only features (accounts,
billing, usage limits) must not be required for a self-hosted install.

## Ways to add a recipe

All of them end in the same structured recipe:

- **Video link:** Instagram Reels first, YouTube Shorts and TikTok later.
- **Website link:** most recipe pages already contain structured recipe data, so this needs little
  or no AI.
- **Photo or screenshot:** a cookbook page or a screenshot of a recipe.
- **Plain text paste.**

## Features

**Recipes**
- Structured data, not text. An ingredient has a name, quantity, unit and note. The quantity stays
  empty when the source doesn't say. Servings, times and steps are structured too.
- Nutritional values per recipe, looked up in a food database (Open Food Facts, USDA as fallback)
  and always shown as an estimate.
- Scale servings (4 to 6 updates every amount).
- Unit conversion (metric or imperial, grams or cups), set per user.
- Cooking mode: one step at a time, big text, screen stays on, hands-free "next" by voice.
- Timers from steps: "bake 30 minutes" becomes a tap-to-start timer.
- Search and tags. Cuisine, diet and cooking time are tagged by the same AI call that parses the
  recipe.
- Export and import: JSON, Markdown and schema.org Recipe.

**Shopping**
- Add a recipe's ingredients to a shopping list. Same ingredients merge (200 g + 100 g flour).
- Shared lists. The mobile app has to work offline, because lists are used in shops.

**Households**
- Shared recipes and lists for a household, built on Better Auth organizations. A self-hosted
  install supports several users.

**Later**
- Meal planner, then a calorie and nutrient optimizer on top of it. The optimizer is normal code,
  not AI. Price optimization is not planned, because there is no good open price data.

## Tech stack (planned)

TypeScript everywhere, in one monorepo.

- **API:** Hono on Bun, Zod schemas, OpenAPI. The app uses a typed client generated from it.
- **Database:** PostgreSQL with Drizzle.
- **Background jobs:** pg-boss (the queue lives in Postgres, no Redis). The worker is the same
  code run as its own process.
- **App (`apps/app`):** Expo (React Native) for iOS, Android and web, with Expo Router and
  TanStack Query. Styling is NativeWind (Tailwind) with React Native Reusables (shadcn-style
  components), so all platforms share one set of components and design tokens. Sharing a reel into
  the app needs `expo-share-intent` and our own app builds, not Expo Go.
- **Auth:** Better Auth, including organizations for households.
- **AI:** Vercel AI SDK behind our own provider interface.
- **Payments:** Stripe, as a cloud-only module.
- **Marketing page:** Astro in `apps/marketing`, cloud only. The self-host setup (`api`, `worker`,
  `app` as a static web build, `postgres` in Docker Compose) does not contain it, and neither billing nor pricing screens.
- **Shared schemas:** `packages/schemas` holds the Zod recipe, ingredient and list schemas.

## Where we are

- The API has auth, households, recipes (manual entry) and recipe extraction. The extraction
  pipeline lives in `packages/extraction`: input modules (Instagram, TikTok, YouTube Shorts,
  websites, photos, text), swappable AI providers (OpenRouter built in) and the pg-boss job that
  the worker runs. See `README.md`, `docs/adding-an-input.md` and `docs/ai-providers.md`.
- Shopping lists (personal and household) work end to end, including merging ingredients and
  offline use on the phone. See `docs/shopping-lists.md`.
- The app has all its screens; adding a recipe from a link, photo or text is not connected to the
  extraction endpoints yet.

## Modular by design

The pipeline is built from parts that can be swapped:

- **Sources:** one module per platform (Instagram, YouTube Shorts, TikTok, ...). A source turns a
  link into a caption and a video. Adding a platform means adding a source, nothing else.
- **AI providers:** use whatever AI you want:
  - self-hosted models (for example Ollama or llama.cpp)
  - hosted providers (OpenRouter, OpenAI, Anthropic, Google, ...)
  Transcription and recipe parsing can use different providers. The rest of the code talks to one
  shared interface and never to a specific provider.
- **Clients:** the app (web and mobile) only talks to the API, so other clients can be
  built on it too.

## Guiding principles

- **Self-hosting comes first.** If something only works in our cloud, it is a cloud add-on, not
  part of the core.
- **No lock-in.** No feature may depend on one platform or one AI provider. The default provider
  (OpenRouter today) is a setting, not a requirement.
- **Mobile first.** Design and test on the phone first. Web and desktop are a bonus from the same
  code, never a separate design.
- **Open source friendly.** Easy for others to read, run and extend. Keep modules small with
  clear boundaries, and document how to add a source or a provider.
- **Never invent recipe details.** If an amount isn't in the video, say so instead of guessing.

## Project workflow

- Commit messages follow Conventional Commits (`.claude/rules/commit-messages.md`).
- Work is planned as GitHub issues; see the skills in `.claude/skills/`.

