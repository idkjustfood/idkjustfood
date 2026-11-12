// The two AI calls: transcribe the audio, then parse the recipe. Both go through OpenRouter
// via its OpenAI-compatible chat API.
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { Config } from "./config";

export function createProvider(config: Config) {
  return createOpenAI({
    name: "openrouter",
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    // Optional attribution headers; OpenRouter shows them in its dashboard.
    headers: { "X-Title": "idkjustfood" },
  });
}

type Provider = ReturnType<typeof createProvider>;

/**
 * Turns speech into text by sending the audio to an audio-capable chat model.
 * OpenRouter has no Whisper-style transcription endpoint, but many chat models accept audio input.
 */
export async function transcribeAudio(
  provider: Provider,
  model: string,
  audio: Uint8Array,
): Promise<string> {
  const { text } = await generateText({
    // `.chat()` uses /chat/completions, which OpenRouter supports for every model.
    model: provider.chat(model),
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "file", data: audio, mediaType: "audio/mpeg" },
          {
            type: "text",
            text:
              "Transcribe the speech in this audio word for word, in the language that is spoken. " +
              "Output only the transcript, no comments or timestamps. " +
              "If there is no speech (only music or noise), output exactly: (no speech)",
          },
        ],
      },
    ],
  });

  const transcript = text.trim();
  return transcript === "(no speech)" ? "" : transcript;
}

export interface RecipeSources {
  caption: string;
  transcript: string;
  frames: Uint8Array[];
}

export async function parseRecipe(
  provider: Provider,
  model: string,
  sources: RecipeSources,
): Promise<string> {
  const { text } = await generateText({
    model: provider.chat(model),
    maxOutputTokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          ...sources.frames.map((frame) => ({
            type: "file" as const,
            data: frame,
            mediaType: "image/jpeg",
          })),
          { type: "text", text: buildPrompt(sources) },
        ],
      },
    ],
  });
  return text.trim();
}

function buildPrompt({ caption, transcript }: RecipeSources): string {
  return `Extract the recipe from this Instagram video.

CAPTION:
${caption || "(none)"}

SPOKEN TRANSCRIPT:
${transcript || "(none)"}

The images are frames from the video; read any on-screen text (ingredient lists, quantities).
The recipe may be split across the caption, the spoken transcript and on-screen text. Merge all three.
If they conflict, prefer the on-screen text for quantities and say so in Notes.

Output plain text in this format:
Title
Servings / time (if known)
Ingredients (with quantities)
Steps (numbered)
Notes

Only use information from the sources above. If a quantity isn't stated anywhere, write "amount not specified" instead of guessing.
Write the recipe in the same language as the sources.`;
}
