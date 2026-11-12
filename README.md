# idkjustfood

Turns an Instagram recipe reel into a written recipe.

A reel spreads its recipe over three places: the caption, what the person says, and text shown on
screen. The tool collects all three and asks an AI model to merge them into one recipe.

## How it works

1. `yt-dlp` downloads the video and its caption.
2. `ffmpeg` pulls out the audio and up to 30 still frames.
3. An audio-capable model on [OpenRouter](https://openrouter.ai) turns the speech into text.
4. A vision model on OpenRouter reads the caption, the transcript and the frames and writes the
   recipe.

Both AI calls use the `@ai-sdk/openai` package pointed at OpenRouter's OpenAI-compatible API.

## Requirements

- [Bun](https://bun.sh)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org) on your `PATH`
  - Windows: `winget install yt-dlp.yt-dlp` and `winget install Gyan.FFmpeg`
  - macOS: `brew install yt-dlp ffmpeg`
- An OpenRouter API key

After installing the tools, restart your terminal so it sees the new `PATH`. A terminal inside an
editor or app (VS Code, Claude desktop) needs that app restarted, because new terminal tabs copy
the app's old `PATH`.

## Setup

```bash
bun install
cp .env.example .env   # then add your OPENROUTER_API_KEY
```

## Usage

```bash
bun run parse "https://www.instagram.com/reel/XXXX/"
```

The recipe is printed and saved, together with the caption, transcript, audio and frames, in
`work/<timestamp>/`.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | (required) | Your OpenRouter key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible chat API |
| `PARSE_MODEL` | `google/gemini-3.5-flash` | Writes the recipe; must accept images |
| `TRANSCRIBE_MODEL` | `google/gemini-3.5-flash-lite` | Transcribes the audio; must accept audio |
| `MAX_FRAMES` | `30` | Most frames sent to the parse model |
| `WORK_DIR` | `work` | Where each run's files go |

Models that accept audio are listed on
[openrouter.ai/models](https://openrouter.ai/models?input_modalities=audio).

## Limits

- Login-protected posts need `--cookies-from-browser chrome` added to the `yt-dlp` calls in
  `src/media.ts`.
- If transcription fails, the tool warns and continues with the caption and frames only.
