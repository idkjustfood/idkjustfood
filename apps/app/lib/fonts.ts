import { PatrickHand_400Regular } from "@expo-google-fonts/patrick-hand"
import { useFonts } from "expo-font"

/**
 * The fonts themes can use for headings (`headingFont` in lib/themes.ts). All of
 * them have a free licence that allows use in an open source project; see
 * docs/themes.md. Body text uses the system font, which is always easy to read.
 */
const fonts = { PatrickHand_400Regular }

/** True once the fonts are ready (or failed to load, then the system font is used). */
export function useAppFonts() {
  const [loaded, error] = useFonts(fonts)
  return loaded || !!error
}
