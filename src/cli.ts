// Usage: bun run parse "https://www.instagram.com/reel/XXXX/"
import { join } from "node:path";
import { createProvider, parseRecipe, transcribeAudio } from "./ai";
import { loadConfig } from "./config";
import {
  assertToolsInstalled,
  createRunDir,
  downloadReel,
  extractAudio,
  extractFrames,
} from "./media";

const log = (msg: string) => console.error(msg);

async function main(): Promise<void> {
  const url = Bun.argv[2];
  if (!url) throw new Error('Usage: bun run parse "<instagram-url>"');

  const config = loadConfig();
  assertToolsInstalled();
  const provider = createProvider(config);
  const dir = await createRunDir(config.workDir);

  // 1. Caption + video
  log("Fetching caption and video...");
  const reel = await downloadReel(url, dir);
  await Bun.write(join(dir, "caption.txt"), reel.caption);

  // 2. Audio (may not exist) + frames
  log("Extracting audio and frames...");
  const audioPath = await extractAudio(reel.videoPath, dir);
  const framePaths = await extractFrames(reel.videoPath, dir, config.maxFrames, reel.duration);
  log(`  ${framePaths.length} frames, ${audioPath ? "audio found" : "no audio track"}`);

  // 3. Transcribe (empty if the reel has no speech)
  let transcript = "";
  if (audioPath) {
    log(`Transcribing with ${config.transcribeModel}...`);
    try {
      const audio = new Uint8Array(await Bun.file(audioPath).arrayBuffer());
      transcript = await transcribeAudio(provider, config.transcribeModel, audio);
      await Bun.write(join(dir, "transcript.txt"), transcript);
      if (!transcript) log("  no speech detected");
    } catch (err) {
      log(`  Transcription failed, continuing without it: ${(err as Error).message}`);
    }
  }

  // 4. Parse the recipe from all three sources
  log(`Parsing recipe with ${config.parseModel}...`);
  const frames = await Promise.all(
    framePaths.map(async (p) => new Uint8Array(await Bun.file(p).arrayBuffer())),
  );
  const recipe = await parseRecipe(provider, config.parseModel, {
    caption: reel.caption,
    transcript,
    frames,
  });

  const recipePath = join(dir, "recipe.txt");
  await Bun.write(recipePath, recipe);
  console.log(recipe);
  log(`\nSaved to ${recipePath}`);
}

main().catch((err: unknown) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
