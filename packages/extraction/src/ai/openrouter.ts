import { createOpenAI } from "@ai-sdk/openai"
import { APICallError, generateText } from "ai"

import { ExtractionError } from "../errors.js"
import {
  noSpeech,
  nothingFound,
  parseJsonReply,
  parseRecipeSystem,
  readImagesPrompt,
  transcribePrompt,
} from "./prompts.js"
import type { AiProvider, ProviderOptions } from "./types.js"

// This is the only file that knows about OpenRouter. It talks to OpenRouter's
// OpenAI-compatible chat API through the Vercel AI SDK. The same code works with any
// other service that speaks that API (set AI_BASE_URL), but it is registered as
// "openrouter" only. Other providers get their own file.

function modelFor({ apiKey, baseUrl, model }: ProviderOptions) {
  const openai = createOpenAI({
    name: "openrouter",
    baseURL: baseUrl,
    apiKey,
    headers: { "X-Title": "idkjustfood" },
  })
  // `.chat()` uses /chat/completions, which OpenRouter supports for every model.
  return openai.chat(model)
}

/** Turns an error from the AI service into one the person can act on. */
function explain(cause: unknown, options: ProviderOptions, job: string) {
  if (cause instanceof ExtractionError) return cause
  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode
    const detail = `${cause.message} ${cause.responseBody ?? ""}`
    if (status === 401 || status === 403) {
      return new ExtractionError(
        "ai_failed",
        "The AI provider rejected the API key. Check AI_API_KEY."
      )
    }
    if (status === 429) {
      return new ExtractionError(
        "ai_failed",
        "The AI provider says there were too many requests or the credit is used up. Try again later."
      )
    }
    if (
      job === "images" &&
      (status === 400 || status === 404) &&
      /image|vision|multimodal|modalit/i.test(detail)
    ) {
      return new ExtractionError(
        "model_cannot_read_images",
        `The model "${options.model}" can't read images. Set AI_VISION_MODEL to a model that accepts images.`
      )
    }
    if (status === 404 || (status === 400 && /model/i.test(detail))) {
      return new ExtractionError(
        "ai_failed",
        `The AI provider does not know the model "${options.model}". Check the model settings.`
      )
    }
    return new ExtractionError(
      "ai_failed",
      `The AI provider returned an error (${status ?? "no status"}).`
    )
  }
  return new ExtractionError(
    "ai_failed",
    "The AI provider could not be reached."
  )
}

export const openrouter: AiProvider = {
  id: "openrouter",
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  defaultModels: {
    transcription: "google/gemini-3.5-flash-lite",
    vision: "google/gemini-3.5-flash",
    parsing: "google/gemini-3.5-flash",
  },

  transcriber(options) {
    return {
      async transcribe(audio) {
        try {
          // OpenRouter has no Whisper-style endpoint, but many chat models accept audio.
          const { text } = await generateText({
            model: modelFor(options),
            temperature: 0,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "file",
                    data: audio.data,
                    mediaType: audio.mediaType,
                  },
                  { type: "text", text: transcribePrompt },
                ],
              },
            ],
          })
          const transcript = text.trim()
          return transcript === noSpeech ? "" : transcript
        } catch (cause) {
          throw explain(cause, options, "audio")
        }
      },
    }
  },

  imageReader(options) {
    return {
      async readImages(images) {
        try {
          const { text } = await generateText({
            model: modelFor(options),
            temperature: 0,
            maxOutputTokens: 4000,
            messages: [
              {
                role: "user",
                content: [
                  ...images.map((image) => ({
                    type: "image" as const,
                    image: image.data,
                    mediaType: image.mediaType,
                  })),
                  { type: "text" as const, text: readImagesPrompt },
                ],
              },
            ],
          })
          const result = text.trim()
          return result === nothingFound ? "" : result
        } catch (cause) {
          throw explain(cause, options, "images")
        }
      },
    }
  },

  recipeParser(options) {
    return {
      async parseRecipe(material, parseOptions) {
        let reply: string
        try {
          const { text } = await generateText({
            model: modelFor(options),
            temperature: 0,
            maxOutputTokens: 6000,
            system:
              parseOptions?.instruction ??
              parseRecipeSystem(
                parseOptions?.language,
                parseOptions?.estimateNutrition
              ),
            prompt: material,
          })
          reply = text
        } catch (cause) {
          throw explain(cause, options, "text")
        }
        try {
          return parseJsonReply(reply)
        } catch {
          throw new ExtractionError(
            "invalid_recipe",
            "The AI answered, but not in a form we can read. Try again, or use a different parsing model."
          )
        }
      },
    }
  },
}
