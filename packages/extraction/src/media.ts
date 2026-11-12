import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"

import { ExtractionError } from "./errors.js"
import type { AudioInput, ImageInput } from "./ai/types.js"

export type VideoDownload = {
  path: string
  caption: string
  title: string
  uploader: string | null
  /** Length in seconds, when yt-dlp knows it. */
  duration: number | undefined
}

/** The outside programs we use for videos. Replaced by a fake in tests. */
export interface MediaTools {
  download(url: string, dir: string): Promise<VideoDownload>
  extractAudio(videoPath: string, dir: string): Promise<AudioInput | undefined>
  extractFrames(
    videoPath: string,
    dir: string,
    maxFrames: number,
    duration: number | undefined
  ): Promise<ImageInput[]>
}

/** Longest video we process, in seconds. */
export const maxVideoSeconds = 15 * 60
const maxVideoBytes = "250M"

type Run = { code: number; stdout: string; stderr: string }

async function run(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<Run> {
  let child
  try {
    child = Bun.spawn([command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      timeout: timeoutMs,
    })
  } catch {
    throw new ExtractionError(
      "tools_missing",
      `${command} is not installed on the server. Install it, or use the Docker image, which includes it.`
    )
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { code, stdout, stderr }
}

function downloadFailed(stderr: string) {
  if (
    /private|login|log in|sign in|authenticat|cookies|age.restricted|members/i.test(
      stderr
    )
  ) {
    return new ExtractionError(
      "video_unavailable",
      "That video is private or needs a login. Only public videos can be read."
    )
  }
  if (
    /unavailable|removed|not exist|not found|404|deleted|empty media/i.test(
      stderr
    )
  ) {
    return new ExtractionError(
      "video_unavailable",
      "That video is not available any more. Check the link."
    )
  }
  return new ExtractionError(
    "video_unavailable",
    "The video could not be downloaded. The platform may have blocked the request; try again later or update yt-dlp."
  )
}

/** The real tools: yt-dlp for downloads and ffmpeg for audio and frames. */
export const systemMedia: MediaTools = {
  async download(url, dir) {
    const common = ["--no-warnings", "--no-playlist", "--ignore-config"]
    const info = await run("yt-dlp", ["--dump-json", ...common, url], 60_000)
    if (info.code !== 0) throw downloadFailed(info.stderr)
    let meta: Record<string, unknown>
    try {
      meta = JSON.parse(info.stdout.split("\n")[0] ?? "")
    } catch {
      throw downloadFailed("")
    }
    const duration =
      typeof meta.duration === "number" ? meta.duration : undefined
    if (duration !== undefined && duration > maxVideoSeconds) {
      throw new ExtractionError(
        "video_too_long",
        `That video is longer than ${maxVideoSeconds / 60} minutes. Only short videos are supported.`
      )
    }

    const path = join(dir, "video.mp4")
    const download = await run(
      "yt-dlp",
      [
        ...common,
        "--quiet",
        "--max-filesize",
        maxVideoBytes,
        "-f",
        "b[height<=720]/b",
        "--merge-output-format",
        "mp4",
        "-o",
        path,
        url,
      ],
      180_000
    )
    if (download.code !== 0) throw downloadFailed(download.stderr)
    if (!(await stat(path).catch(() => undefined))) throw downloadFailed("")

    const text = (value: unknown) => (typeof value === "string" ? value : "")
    return {
      path,
      caption: text(meta.description),
      title: text(meta.title),
      uploader: text(meta.uploader_id) || text(meta.uploader) || null,
      duration,
    }
  },

  async extractAudio(videoPath, dir) {
    const path = join(dir, "audio.mp3")
    const result = await run(
      "ffmpeg",
      [
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "48k",
        path,
      ],
      120_000
    )
    if (result.code !== 0) return undefined // no audio track
    const info = await stat(path).catch(() => undefined)
    if (!info || info.size === 0) return undefined
    return {
      data: new Uint8Array(await Bun.file(path).arrayBuffer()),
      mediaType: "audio/mpeg",
    }
  },

  async extractFrames(videoPath, dir, maxFrames, duration) {
    // One frame per second for short videos; spread out for longer ones.
    const fps = duration && duration > maxFrames ? maxFrames / duration : 1
    const pattern = join(dir, "frame_%03d.jpg")
    const result = await run(
      "ffmpeg",
      [
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoPath,
        "-vf",
        `fps=${fps},scale=768:-2`,
        "-frames:v",
        String(maxFrames),
        pattern,
      ],
      120_000
    )
    if (result.code !== 0) return []
    const names = (await readdir(dir))
      .filter((name) => name.startsWith("frame_") && name.endsWith(".jpg"))
      .sort()
    return Promise.all(
      names.map(async (name) => ({
        data: new Uint8Array(await Bun.file(join(dir, name)).arrayBuffer()),
        mediaType: "image/jpeg",
      }))
    )
  },
}
