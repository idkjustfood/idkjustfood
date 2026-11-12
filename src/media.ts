// Everything that touches yt-dlp and ffmpeg: download the reel, pull out audio and frames.
import { $ } from "bun";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const REQUIRED_TOOLS = ["yt-dlp", "ffmpeg"] as const;

/** Stops early with a clear message when an external tool is not on PATH. */
export function assertToolsInstalled(): void {
  const missing = REQUIRED_TOOLS.filter((tool) => !Bun.which(tool));
  if (missing.length > 0) {
    throw new Error(
      `Missing tools on PATH: ${missing.join(", ")}. See the README section "Requirements". ` +
        "If you just installed them, restart your terminal (or the app that opened it) " +
        "so it picks up the new PATH.",
    );
  }
}

export interface Download {
  dir: string;
  videoPath: string;
  caption: string;
  title: string;
  /** Video length in seconds, if yt-dlp knows it. */
  duration: number | undefined;
}

export async function createRunDir(workDir: string): Promise<string> {
  const dir = join(workDir, `${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Reads the caption and downloads the video as `video.mp4` into `dir`. */
export async function downloadReel(url: string, dir: string): Promise<Download> {
  // For login-gated posts add `--cookies-from-browser chrome` to both calls.
  const meta = JSON.parse(await $`yt-dlp --dump-json --no-warnings --no-playlist ${url}`.text());

  const videoPath = join(dir, "video.mp4");
  await $`yt-dlp --quiet --no-warnings --no-playlist --merge-output-format mp4 -o ${videoPath} ${url}`;

  return {
    dir,
    videoPath,
    caption: typeof meta.description === "string" ? meta.description : "",
    title: typeof meta.title === "string" ? meta.title : "",
    duration: typeof meta.duration === "number" ? meta.duration : undefined,
  };
}

/**
 * Extracts mono 16 kHz MP3 audio. Returns `undefined` when the video has no audio track.
 */
export async function extractAudio(videoPath: string, dir: string): Promise<string | undefined> {
  const audioPath = join(dir, "audio.mp3");
  const result =
    await $`ffmpeg -loglevel error -y -i ${videoPath} -vn -ac 1 -ar 16000 -b:a 48k ${audioPath}`
      .quiet()
      .nothrow();
  if (result.exitCode !== 0) return undefined;

  const info = await stat(audioPath).catch(() => undefined);
  return info && info.size > 0 ? audioPath : undefined;
}

/**
 * Extracts up to `maxFrames` JPEG frames spread evenly over the video (at most one per second),
 * scaled to 768 px wide. Returns the frame paths in order.
 */
export async function extractFrames(
  videoPath: string,
  dir: string,
  maxFrames: number,
  duration: number | undefined,
): Promise<string[]> {
  // One frame per second for short videos; spread them out for long ones so the end is covered too.
  const fps = duration && duration > maxFrames ? maxFrames / duration : 1;
  const pattern = join(dir, "frame_%03d.jpg");
  await $`ffmpeg -loglevel error -y -i ${videoPath} -vf fps=${fps},scale=768:-2 -frames:v ${maxFrames} ${pattern}`.quiet();

  const names = (await readdir(dir)).filter((n) => n.startsWith("frame_") && n.endsWith(".jpg"));
  return names.sort().map((n) => join(dir, n));
}
