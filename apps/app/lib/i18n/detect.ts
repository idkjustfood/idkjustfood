/** The language used when nothing else fits, and the one every other language falls back to. */
export const FALLBACK_LANGUAGE = "en"

/**
 * Picks the first supported language from the device's preferred languages.
 * `["de-AT", "en"]` gives "de" when German is supported. Falls back to English.
 */
export function pickLanguage(
  preferred: readonly string[],
  supported: readonly string[]
) {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0]
    const match = supported.find((code) => code.toLowerCase() === base)
    if (match) return match
  }
  return FALLBACK_LANGUAGE
}
