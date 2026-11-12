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

Three parts that share one backend:

- **API:** takes a video link, collects caption, audio and frames, uses AI to turn them into a
  structured recipe, and stores it.
- **Web frontend:** paste a link, read and manage your saved recipes.
- **Mobile app:** the same, plus sharing a reel straight from Instagram into the app.

## Business model

- **Self-host: free.** Anyone can run the whole stack on their own server, with the AI of their
  choice.
- **Cloud: about 12 € a month.** We host it, and AI costs are included in the plan.

So everything must run self-hosted with simple setup and configuration. Cloud-only features (accounts,
billing, usage limits) must not be required for a self-hosted install.

## Where we are

- A prototype CLI in `src/` proves the pipeline works: `bun run parse "<instagram-url>"`. It uses
  yt-dlp and ffmpeg, plus OpenRouter (through `@ai-sdk/openai`) for both transcription and
  parsing. See `README.md` for setup.
- The API, frontend and mobile app don't exist yet. The prototype's pipeline is the starting
  point for the API.

## Modular by design

The pipeline is built from parts that can be swapped:

- **Sources:** one module per platform (Instagram, YouTube Shorts, TikTok, ...). A source turns a
  link into a caption and a video. Adding a platform means adding a source, nothing else.
- **AI providers:** use whatever AI you want:
  - self-hosted models (for example Ollama or llama.cpp)
  - hosted providers (OpenRouter, OpenAI, Anthropic, Google, ...)
  Transcription and recipe parsing can use different providers. The rest of the code talks to one
  shared interface and never to a specific provider.
- **Clients:** the web frontend and the mobile app only talk to the API, so other clients can be
  built on it too.

## Guiding principles

- **Self-hosting comes first.** If something only works in our cloud, it is a cloud add-on, not
  part of the core.
- **No lock-in.** No feature may depend on one platform or one AI provider. The default provider
  (OpenRouter today) is a setting, not a requirement.
- **Open source friendly.** Easy for others to read, run and extend. Keep modules small with
  clear boundaries, and document how to add a source or a provider.
- **Never invent recipe details.** If an amount isn't in the video, say so instead of guessing.

## Project workflow

- Commit messages follow Conventional Commits (`.claude/rules/commit-messages.md`).
- Work is planned as GitHub issues; see the skills in `.claude/skills/`.
