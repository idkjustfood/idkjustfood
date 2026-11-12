import * as Clipboard from "expo-clipboard"
import { Platform, Share } from "react-native"

export async function copyText(text: string) {
  await Clipboard.setStringAsync(text)
}

/** True when the phone's (or browser's) share sheet is available. */
export const canShare =
  Platform.OS !== "web" ||
  (typeof navigator !== "undefined" && typeof navigator.share === "function")

/** Opens the share sheet. Resolves quietly when the person closes it. */
export async function shareText(message: string, title?: string) {
  try {
    await Share.share(
      Platform.OS === "ios" ? { url: message, title } : { message, title }
    )
  } catch {
    // Closing the web share dialog rejects; nothing to do.
  }
}

/** "today", "tomorrow", "in 5 days". */
export function inDays(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "tomorrow"
  return `in ${days} days`
}
