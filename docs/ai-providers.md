# AI providers

The pipeline asks the AI for three jobs. It only knows the interfaces in
`packages/extraction/src/ai/types.ts`, never a specific provider:

| Job | Interface | Used for |
| --- | --- | --- |
| Transcription | `Transcriber` | Speech of a video to text. Needs a model that accepts audio. |
| Vision | `ImageReader` | Photos and video frames to text. Needs a model that accepts images. |
| Parsing | `RecipeParser` | All the collected text to one recipe (JSON). Also completes a partial recipe, see below. |

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

## Description

The AI's `description` is empty in the normal case. `parseRecipeSystem` forbids describing the dish
or the video, and only allows a tip, storage advice or a serving suggestion that the source really
gives. `readExtractedRecipe` also drops a description that talks about the video or the recipe
itself ("In this video…", "This recipe shows…", in all app languages). Descriptions that a website
already contains, and recipes entered by hand, do not go through this and stay as they are.

## Nutrition estimate

Sources rarely state nutrition. For every recipe the AI parses (video, photo, pasted text, or a page
without recipe data) the pipeline passes `estimateNutrition: true`, and `parseRecipeSystem` then also asks for `nutrition` (calories,
protein, carbs, fat per serving). Values the AI cannot estimate are `null`; a missing or broken
`nutrition` never fails the recipe. The values are saved with `estimated: true`, and the app says
they were estimated by AI. Recipes a website already contains
as structured data, and recipes entered by hand, get no estimate. It works with any provider, because it is part of the shared prompt.

## Sections

When a recipe clearly has parts ("For the dough", "For the sauce"), the parsing prompt asks for a
`section` on each ingredient and step. Without clear parts it stays `null`. See
`docs/recipe-sections.md`.

## Complete a recipe

A saved recipe that only covers part of a dish (a pizza sauce without dough) can be completed with
a free-form message. In the app: open the recipe, tap "Complete with AI", write what is missing
("add a pizza dough"), and check the preview. Nothing is saved until the person taps "Save";
"Discard" leaves the recipe unchanged. One message gives one result, there is no chat.

`POST /api/recipes/{recipeId}/complete` takes `{ message, language }` and returns the recipe's
`ingredients` and `steps` with the additions merged in, plus `addedIngredients` and `addedSteps`
(the places of the new items). It saves nothing; the app saves the result with `PUT /recipes/{id}`.

- It uses the parsing job (`parseRecipe`), with `ParseOptions.instruction` set to
  `completeRecipeSystem(language)`. A provider must use `instruction` as the system prompt when it is
  set (the built-in OpenRouter provider does), so every provider works without further code.
- The AI answers with the new ingredients and steps only. `mergeCompletion` (in `packages/schemas`)
  adds them after the existing ones: existing items are never changed, moved or removed, an ingredient
  that is already in the same part is dropped, and a new part joins an existing part with the same
  name. Servings are not touched.
- The AI leaves an amount empty when it is not sure. The app labels everything it added as
  "Written by AI" in the preview.
- Errors: `400 nothing_to_add` (the AI had nothing to add), `400 invalid_recipe`, `502 ai_failed`,
  `503 ai_not_configured`. The app shows a translated text for each and keeps the typed message.

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
   `parseRecipe` gets the language the recipe must be written in: give the model `options.instruction` when it is set, otherwise
   `parseRecipeSystem(language, estimateNutrition)` as its system prompt, so every provider receives
   the same instruction (see "Language" and "Nutrition estimate" below).

2. Add it to `providers` in `ai/index.ts`.

3. Map the service's errors to `ExtractionError`, as `openrouter.ts` does: a rejected key, a rate
   limit, an unknown model, and `model_cannot_read_images` for a model without image input.

A provider does not need to offer all three jobs with the same service: a job it cannot do can throw
an `ExtractionError("ai_failed", "…")`, and the user can point that job at another provider with
`AI_<JOB>_PROVIDER`.

Nothing in the pipeline, the API or the worker changes. For tests, pass a fake `Ai` to the pipeline
(`fakeAi` in `@workspace/extraction/testing`) or a fake `AiProvider` to `createAi(env, [provider])`.
