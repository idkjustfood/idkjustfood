# AI providers

The pipeline asks the AI for three jobs. It only knows the interfaces in
`packages/extraction/src/ai/types.ts`, never a specific provider:

| Job | Interface | Used for |
| --- | --- | --- |
| Transcription | `Transcriber` | Speech of a video to text. Needs a model that accepts audio. |
| Vision | `ImageReader` | Photos and video frames to text. Needs a model that accepts images. |
| Parsing | `RecipeParser` | All the collected text to one recipe (JSON). |

Only OpenRouter is built in (`ai/openrouter.ts`, on top of the Vercel AI SDK). It is the only file
that knows OpenRouter.

## Settings

Environment variables, read by both the API and the worker:

| Variable | Meaning |
| --- | --- |
| `AI_PROVIDER` | Provider id. Default `openrouter`. |
| `AI_API_KEY` | API key. Without a key, videos, photos and text answer with a clear error. Websites that contain recipe data still work. |
| `AI_BASE_URL` | Optional. Changes the provider's address. |
| `AI_TRANSCRIPTION_MODEL`, `AI_VISION_MODEL`, `AI_PARSING_MODEL` | The model of each job. Empty means the provider's default. |
| `AI_<JOB>_PROVIDER`, `AI_<JOB>_API_KEY`, `AI_<JOB>_BASE_URL` | Optional. Let one job (`TRANSCRIPTION`, `VISION` or `PARSING`) use another provider. |

Changing a model needs no code change and no rebuild, only a restart. If the vision model cannot
read images, the job fails with the message "The model … can't read images" and does not guess.

## Language

Recipes are written in the language the person selected in the app (English, German, Spanish,
French or Italian), also when the source is in another language. The language reaches the parsing
job as `parseRecipe(material, { language })`. `parseRecipeSystem(language)` in `ai/prompts.ts`
turns it into the instruction: write the title, description, ingredient names, notes and steps in
that language, translate when the source differs, keep a text that already is in it, and never
change or add an amount. Units and tags are fixed keys, so they are the same in every language.
The same call translates recipes that a website already contains (the pipeline then keeps amounts,
units, tags, servings and times from the page and only takes the words). Without `language`, the
recipe stays in the language of the material. Nothing to set up on a self-hosted install: it works
with any provider and model that the parsing job uses.

## Add a provider

1. Create `packages/extraction/src/ai/<name>.ts` that exports an `AiProvider`:

   ```ts
   export const ollama: AiProvider = {
     id: "ollama",
     defaultBaseUrl: "http://localhost:11434/v1",
     defaultModels: { transcription: "...", vision: "llava", parsing: "llama3.1" },
     transcriber: (options) => ({ async transcribe(audio) { /* return the text */ } }),
     imageReader: (options) => ({ async readImages(images) { /* return the text */ } }),
     recipeParser: (options) => ({ async parseRecipe(material, { language }) { /* return the JSON */ } }),
   }
   ```

   `options` has `apiKey`, `baseUrl` and `model`. Use the shared prompts from `ai/prompts.ts` so every
   provider is asked the same thing, and `parseJsonReply` to read the model's answer.
   `parseRecipe` gets the language the recipe must be written in: give the model
   `parseRecipeSystem(language)` as its system prompt, so every provider receives the same
   instruction (see "Language" below).

2. Add it to `providers` in `ai/index.ts`.

3. Map the service's errors to `ExtractionError`, as `openrouter.ts` does: a rejected key, a rate
   limit, an unknown model, and `model_cannot_read_images` for a model without image input.

A provider does not need to offer all three jobs with the same service: a job it cannot do can throw
an `ExtractionError("ai_failed", "…")`, and the user can point that job at another provider with
`AI_<JOB>_PROVIDER`.

Nothing in the pipeline, the API or the worker changes. For tests, pass a fake `Ai` to the pipeline
(`fakeAi` in `@workspace/extraction/testing`) or a fake `AiProvider` to `createAi(env, [provider])`.
