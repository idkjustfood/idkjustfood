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

export const addMethods: Record<
  AddMethod,
  { title: string; description: string; icon: LucideIcon; steps: string[] }
> = {
  video: {
    title: "Video link",
    description: "An Instagram reel, a TikTok or a YouTube Short.",
    icon: Video,
    steps: [
      "Downloading the video",
      "Reading the caption",
      "Listening to what is said",
      "Reading text shown in the video",
      "Writing the recipe",
    ],
  },
  website: {
    title: "Website link",
    description: "A recipe page from any cooking website.",
    icon: Globe,
    steps: [
      "Opening the page",
      "Finding the recipe on the page",
      "Writing the recipe",
    ],
  },
  photo: {
    title: "Photo or screenshot",
    description: "A cookbook page or a screenshot of a recipe.",
    icon: Camera,
    steps: ["Uploading the photo", "Reading the text", "Writing the recipe"],
  },
  text: {
    title: "Paste text",
    description: "A recipe you copied from a message or a note.",
    icon: FileText,
    steps: ["Reading the text", "Writing the recipe"],
  },
  write: {
    title: "Write it yourself",
    description: "Type in a recipe from scratch, or one you know by heart.",
    icon: PenLine,
    steps: [],
  },
  import: {
    title: "Import a recipe",
    description: "A recipe saved as JSON, or in the schema.org Recipe format.",
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
