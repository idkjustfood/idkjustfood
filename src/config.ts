// All settings come from environment variables. Bun loads `.env` automatically.

export interface Config {
  /** OpenRouter API key. */
  apiKey: string;
  /** OpenAI-compatible base URL. */
  baseURL: string;
  /** Model that reads caption, transcript and frames and writes the recipe. Must accept images. */
  parseModel: string;
  /** Model that turns the audio into text. Must accept audio input. */
  transcribeModel: string;
  /** Upper limit for frames sent to the parse model. */
  maxFrames: number;
  /** Folder that holds one sub-folder per run. */
  workDir: string;
}

export function loadConfig(): Config {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key " +
        "(https://openrouter.ai/settings/keys).",
    );
  }

  const maxFrames = Number(process.env.MAX_FRAMES ?? 30);
  if (!Number.isInteger(maxFrames) || maxFrames < 1) {
    throw new Error(`MAX_FRAMES must be a positive whole number, got "${process.env.MAX_FRAMES}".`);
  }

  return {
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    parseModel: process.env.PARSE_MODEL ?? "google/gemini-3.5-flash",
    transcribeModel: process.env.TRANSCRIBE_MODEL ?? "google/gemini-3.5-flash-lite",
    maxFrames,
    workDir: process.env.WORK_DIR ?? "work",
  };
}
