import { ExtractionError } from "../errors.js"
import { openrouter } from "./openrouter.js"
import type { Ai, AiJob, AiProvider } from "./types.js"

export * from "./types.js"
export { parseJsonReply } from "./prompts.js"

/**
 * Every provider the server knows. To add one, write a file like `openrouter.ts`
 * and add it here. Nothing else changes.
 */
export const providers: AiProvider[] = [openrouter]

export type AiEnv = Record<string, string | undefined>

type JobSettings = {
  provider: AiProvider
  apiKey: string
  baseUrl: string | undefined
  model: string
}

const jobEnvName: Record<AiJob, string> = {
  transcription: "TRANSCRIPTION",
  vision: "VISION",
  parsing: "PARSING",
}

const value = (text: string | undefined) => text?.trim() || undefined

/**
 * Reads the AI settings of one job. Each job can use its own provider and model:
 *   AI_PROVIDER, AI_API_KEY, AI_BASE_URL            shared by all jobs
 *   AI_<JOB>_PROVIDER, AI_<JOB>_MODEL               per job, where JOB is
 *                                                   TRANSCRIPTION, VISION or PARSING
 * Returns undefined when no API key is set.
 */
function jobSettings(
  job: AiJob,
  env: AiEnv,
  registry: AiProvider[]
): JobSettings | undefined {
  const name = jobEnvName[job]
  const providerId = (
    value(env[`AI_${name}_PROVIDER`]) ??
    value(env.AI_PROVIDER) ??
    "openrouter"
  ).toLowerCase()
  const provider = registry.find((p) => p.id === providerId)
  if (!provider) {
    throw new ExtractionError(
      "ai_not_configured",
      `AI provider "${providerId}" is not known. Use one of: ${registry
        .map((p) => p.id)
        .join(", ")}.`
    )
  }
  const apiKey = value(env[`AI_${name}_API_KEY`]) ?? value(env.AI_API_KEY)
  if (!apiKey) return undefined
  return {
    provider,
    apiKey,
    baseUrl:
      value(env[`AI_${name}_BASE_URL`]) ??
      value(env.AI_BASE_URL) ??
      provider.defaultBaseUrl,
    model: value(env[`AI_${name}_MODEL`]) ?? provider.defaultModels[job],
  }
}

/** True when an API key is set, so the AI jobs can run. */
export function aiConfigured(env: AiEnv, registry = providers) {
  try {
    return (["transcription", "vision", "parsing"] as const).every(
      (job) => jobSettings(job, env, registry) !== undefined
    )
  } catch {
    return false
  }
}

const notConfigured = () =>
  new ExtractionError(
    "ai_not_configured",
    "No AI key is set on this server. Set AI_PROVIDER and AI_API_KEY to read videos, photos and text."
  )

/**
 * Builds the `Ai` the pipeline uses from the environment. Nothing is checked until
 * a job runs, so work that needs no AI (a web page with recipe data) works without a key.
 */
export function createAi(env: AiEnv, registry = providers): Ai {
  const settings = (job: AiJob) => {
    const found = jobSettings(job, env, registry)
    if (!found) throw notConfigured()
    return {
      provider: found.provider,
      options: {
        apiKey: found.apiKey,
        baseUrl: found.baseUrl,
        model: found.model,
      },
    }
  }
  return {
    async transcribe(audio) {
      const { provider, options } = settings("transcription")
      return provider.transcriber(options).transcribe(audio)
    },
    async readImages(images) {
      const { provider, options } = settings("vision")
      return provider.imageReader(options).readImages(images)
    },
    async parseRecipe(material) {
      const { provider, options } = settings("parsing")
      return provider.recipeParser(options).parseRecipe(material)
    },
  }
}
