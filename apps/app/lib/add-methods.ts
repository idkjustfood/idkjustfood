import {
  Camera,
  FileText,
  Globe,
  PenLine,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react-native"

/** "write" and "import" need no AI, so they have their own screens and no progress steps. */
export type AddMethod =
  "video" | "website" | "photo" | "text" | "write" | "import"

/**
 * `titleKey`, `descriptionKey` and the step keys are translation keys in the `add`
 * namespace. Call `t()` with them when rendering, so a language switch updates the text.
 */
/**
 * `titleKey`, `descriptionKey` and the step keys are translation keys in the `add`
 * namespace. Call `t()` with them when rendering, so a language switch updates the text.
 */
export const addMethods: Record<
  AddMethod,
  {
    titleKey: string
    descriptionKey: string
    icon: LucideIcon
    steps: string[]
  }
> = {
  video: {
    titleKey: "add:methods.video.title",
    descriptionKey: "add:methods.video.description",
    icon: Video,
    steps: [
      "add:steps.video.download",
      "add:steps.video.caption",
      "add:steps.video.audio",
      "add:steps.video.onScreenText",
      "add:steps.video.write",
    ],
  },
  website: {
    titleKey: "add:methods.website.title",
    descriptionKey: "add:methods.website.description",
    icon: Globe,
    steps: [
      "add:steps.website.open",
      "add:steps.website.find",
      "add:steps.website.write",
    ],
  },
  photo: {
    titleKey: "add:methods.photo.title",
    descriptionKey: "add:methods.photo.description",
    icon: Camera,
    steps: [
      "add:steps.photo.upload",
      "add:steps.photo.read",
      "add:steps.photo.write",
    ],
  },
  text: {
    titleKey: "add:methods.text.title",
    descriptionKey: "add:methods.text.description",
    icon: FileText,
    steps: ["add:steps.text.read", "add:steps.text.write"],
  },
  write: {
    titleKey: "add:methods.write.title",
    descriptionKey: "add:methods.write.description",
    icon: PenLine,
    steps: [],
  },
  import: {
    titleKey: "add:methods.import.title",
    descriptionKey: "add:methods.import.description",
    icon: Upload,
    steps: [],
  },
}

export function isAddMethod(value: unknown): value is AddMethod {
  return typeof value === "string" && value in addMethods
}

export type LinkProblem = "unsupported" | "invalid" | null

/** A quick check before sending a link. The API does the real check later. */
export function checkLink(method: AddMethod, link: string): LinkProblem {
  const url = link.trim().toLowerCase()
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return "invalid"
  if (
    method === "video" &&
    !/^https?:\/\/([^/]+\.)?(instagram\.com|instagr\.am|tiktok\.com|youtube\.com|youtu\.be)\//.test(
      url
    )
  )
    return "unsupported"
  return null
}
