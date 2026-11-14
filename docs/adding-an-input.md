# Adding an input or a platform

Every way to add a recipe (Instagram, TikTok, a website, a photo, pasted text) is one **input
module** in `packages/extraction/src/inputs/`. The pipeline never knows which modules exist, so
adding one means writing a file and registering it. Nothing else changes.

## How a recipe is made

```text
input ──► module.gather ──► text, pictures, audio ──► AI reads what is not text yet
                                                         │
                       recipe ◄── validate (Zod) ◄── AI parses it all into one recipe
```

1. `selectInput` picks the first module whose `canHandle(input)` is true.
2. The module's `gather` collects what it can: text (a caption, a page, pasted text), pictures
   (a photo, video frames), audio (a video's sound), and the `source` to show in the app.
3. The pipeline lets the AI turn audio and pictures into text, and parses everything into one
   recipe that follows the schema in `packages/schemas`.
4. If the module already has a complete recipe (a web page with schema.org data), it returns it as
   `recipe` and the pipeline makes **no AI call**, except to translate it (see "Language").
5. The temporary folder (`context.workDir`) is deleted after every job. Download things into it, not
   anywhere else, and the cleanup is automatic.

## Sections

A module that returns a complete recipe can give its steps (and ingredients) a `section`, for
example from a schema.org `HowToSection`. Leave it out when the source has no parts. See
`docs/recipe-sections.md`.

## Language

Every recipe is written in the language the person picked in the app (`en`, `de`, `es`, `fr`
or `it`; see `packages/schemas/src/language.ts`). The app sends it as `language` with the request,
the API saves it on the job, and the worker passes it to the pipeline (`PipelineOptions.language`).
Without it, the recipe stays in the language of the source.

A new module does not handle this: whatever it collects goes through the parsing step, and the AI
translates there. Only two things are the module's business:

- Put the text as it is in the source into `texts`. Do not translate it yourself.
- If the module returns a finished `recipe` (no AI), also return `language`, the language the source
  says it is in (a web page has `<html lang>`; see `pageLanguage`). The pipeline skips the AI when it
  already is the wanted language, and otherwise asks the AI to translate only the words. Amounts,
  units, tags, servings and times always stay as the source has them. Without an AI key a finished
  recipe is kept in its own language.

## Write the module

An `InputModule` (see `inputs/types.ts`) has four parts:

| Part | What it does |
| --- | --- |
| `id` | A short unique name. |
| `canHandle(input)` | True when this module is the one for the input. |
| `needsAi` | True when the module always needs the AI. Only `false` if it can finish without it. |
| `validate(input)` | Optional. Checks the input fast, before a job is queued, and throws an `ExtractionError` with a message for the person. |
| `gather(input, context)` | Returns `{ source, texts, images, audio?, recipe?, language? }`. |

### A new video platform

Video platforms share the download (yt-dlp) and the audio and frame extraction (ffmpeg). Describe
only the links of the platform, like `inputs/tiktok.ts`:

```ts
import { videoPlatformModule } from "./video.js"

export const example = videoPlatformModule({
  id: "example",
  label: "Example video",
  hosts: ["example.com"], // subdomains match too
  isVideoPath: (url) => /^\/watch\/\w+/.test(url.pathname),
  unsupportedMessage: "That is not a video link. Copy the link of the video itself.",
})
```

yt-dlp must support the site. If it does not, write a full module as below.

### Any other input

```ts
export const myInput: InputModule = {
  id: "my-input",
  needsAi: true,
  canHandle: (input) => input.type === "link" && input.url.startsWith("my:"),
  async gather(input, { workDir, fetchPage }) {
    return {
      source: { kind: "import", label: "My input", url: null },
      texts: [{ label: "What it contains", text: "..." }],
      images: [],
    }
  },
}
```

If it needs a new kind of input (not a link, an image or text), add it to `ExtractionInput` in
`inputs/types.ts`, and a route in `apps/api/src/extractions/routes.ts`.

## Register it

Add the module to `inputModules` in `inputs/index.ts`. Order matters: the first match wins, so keep
the catch-all `website` module last.

```ts
export const inputModules: InputModule[] = [instagram, tiktok, youtube, myInput, photo, text, website]
```

## Rules

- **Never invent details.** Put only what the source says into `texts`. The AI is told to leave an
  amount empty when the source has none.
- **Fetch web pages with `context.fetchPage`**, never with a bare `fetch`. It refuses local and
  private network addresses and limits time and size.
- **Throw `ExtractionError`** with a plain message for anything a person can fix (private video,
  unsupported link). Other errors are logged and shown as a generic failure.
- Add tests next to the module. `inputs/inputs.test.ts` shows how to test a new module with the
  pipeline and a fake AI (`@workspace/extraction/testing`).
