import { readdir } from "node:fs/promises"

import type { Ai, ImageInput } from "./ai/types.js"
import type { MediaTools } from "./media.js"

/** A recipe as the AI would answer it. Amounts are only there when the source said so. */
export const pancakeJson = {
  title: "Pancakes",
  description: "Fluffy pancakes.",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 15,
  tags: ["Breakfast", "Vegetarian", "Under 30 min"],
  ingredients: [
    { name: "flour", quantity: 200, unit: "g", note: null },
    { name: "milk", quantity: 300, unit: "ml", note: null },
    { name: "salt", quantity: null, unit: null, note: "a pinch" },
  ],
  steps: [{ text: "Mix everything." }, { text: "Fry for 2 minutes per side." }],
}

/** A fake AI provider for tests. It records what it was asked. */
export function fakeAi(overrides: Partial<Ai> = {}): Ai & {
  calls: {
    transcribe: number
    readImages: ImageInput[][]
    parseRecipe: string[]
  }
} {
  const calls = {
    transcribe: 0,
    readImages: [] as ImageInput[][],
    parseRecipe: [] as string[],
  }
  return {
    calls,
    async transcribe() {
      calls.transcribe++
      return "Two hundred grams of flour."
    },
    async readImages(images) {
      calls.readImages.push(images)
      return "200 g flour"
    },
    async parseRecipe(material) {
      calls.parseRecipe.push(material)
      return pancakeJson
    },
    ...overrides,
  }
}

/** An AI that fails the test when it is used. For paths that must not call the AI. */
export const noAi: Ai = {
  async transcribe() {
    throw new Error("the AI must not be used here")
  },
  async readImages() {
    throw new Error("the AI must not be used here")
  },
  async parseRecipe() {
    throw new Error("the AI must not be used here")
  },
}

/** Fake yt-dlp and ffmpeg: writes small files into the work folder like the real ones do. */
export function fakeMedia(
  options: { audio?: boolean; caption?: string } = {}
): MediaTools & { dirs: string[] } {
  const dirs: string[] = []
  return {
    dirs,
    async download(_url, dir) {
      dirs.push(dir)
      const path = `${dir}/video.mp4`
      await Bun.write(path, "video")
      return {
        path,
        caption: options.caption ?? "Easy pancakes!\n200 g flour, 300 ml milk",
        title: "Pancakes",
        uploader: "chef",
        duration: 20,
      }
    },
    async extractAudio(_path, dir) {
      if (options.audio === false) return undefined
      await Bun.write(`${dir}/audio.mp3`, "audio")
      return { data: new Uint8Array([1, 2, 3]), mediaType: "audio/mpeg" }
    },
    async extractFrames(_path, dir) {
      await Bun.write(`${dir}/frame_001.jpg`, "frame")
      return [
        { data: new Uint8Array([0xff, 0xd8, 0xff]), mediaType: "image/jpeg" },
      ]
    },
  }
}

/** Files left in a folder (empty when nothing is left or the folder is gone). */
export async function filesIn(dir: string) {
  return readdir(dir).catch(() => [])
}

/** Bytes of a tiny valid PNG, for upload tests. */
export const tinyPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48,
  0x44, 0x52,
])
