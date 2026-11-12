import {
  Camera,
  FileText,
  Globe,
  Video,
  type LucideIcon,
} from "lucide-react-native"

export type AddMethod = "video" | "website" | "photo" | "text"

export const addMethods: Record<
  AddMethod,
  { title: string; description: string; icon: LucideIcon; steps: string[] }
> = {
  video: {
    title: "Video link",
    description: "An Instagram reel. YouTube Shorts and TikTok come later.",
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
}

export function isAddMethod(value: unknown): value is AddMethod {
  return typeof value === "string" && value in addMethods
}

export type LinkProblem = "unsupported" | "invalid" | null

/** A quick check before sending a link. The API does the real check later. */
export function checkLink(method: AddMethod, link: string): LinkProblem {
  const url = link.trim().toLowerCase()
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return "invalid"
  if (method === "video" && !/instagram\.com\/(reel|reels|p)\//.test(url))
    return "unsupported"
  return null
}
