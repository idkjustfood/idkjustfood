import { ExtractionError } from "../errors.js"
import type { ExtractionInput, InputModule } from "./types.js"

export type VideoPlatform = {
  id: string
  /** Shown in the recipe's source, for example "Instagram reel". */
  label: string
  /** Host names of the platform. Subdomains match too. */
  hosts: string[]
  /** True for the paths of links that point at one video. */
  isVideoPath(url: URL): boolean
  /** Said when the link is on this platform but is not a video link. */
  unsupportedMessage: string
}

function parseUrl(input: ExtractionInput) {
  if (input.type !== "link") return undefined
  try {
    const url = new URL(input.url)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined
  } catch {
    return undefined
  }
}

function onHost(url: URL, hosts: string[]) {
  const host = url.hostname.toLowerCase()
  return hosts.some((h) => host === h || host.endsWith(`.${h}`))
}

/**
 * Builds the input module of a video platform. The download and the audio and
 * frame extraction are the same for all of them (yt-dlp and ffmpeg), so a platform
 * only says which links it owns.
 */
export function videoPlatformModule(platform: VideoPlatform): InputModule {
  return {
    id: platform.id,
    needsAi: true,

    canHandle(input) {
      const url = parseUrl(input)
      return !!url && onHost(url, platform.hosts)
    },

    validate(input) {
      const url = parseUrl(input)
      if (!url || !platform.isVideoPath(url)) {
        throw new ExtractionError(
          "unsupported_link",
          platform.unsupportedMessage
        )
      }
    },

    async gather(input, { workDir, media, maxFrames }) {
      const url = parseUrl(input)
      if (!url)
        throw new ExtractionError("invalid_input", "That is not a valid link.")
      if (!platform.isVideoPath(url)) {
        throw new ExtractionError(
          "unsupported_link",
          platform.unsupportedMessage
        )
      }

      const video = await media.download(url.toString(), workDir)
      const [audio, images] = await Promise.all([
        media.extractAudio(video.path, workDir),
        media.extractFrames(video.path, workDir, maxFrames, video.duration),
      ])

      const texts = []
      if (video.caption.trim())
        texts.push({ label: "Caption", text: video.caption.trim() })
      // A title that only repeats the caption adds nothing.
      if (video.title.trim() && !video.caption.includes(video.title.trim())) {
        texts.push({ label: "Video title", text: video.title.trim() })
      }

      return {
        source: {
          kind: "video",
          label: video.uploader
            ? `${platform.label} · @${video.uploader.replace(/^@/, "")}`
            : platform.label,
          url: url.toString(),
        },
        texts,
        images,
        audio,
        imagesLabel: "Text and details seen in frames of the video",
      }
    },
  }
}
