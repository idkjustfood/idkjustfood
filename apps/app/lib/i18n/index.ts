import { getLocales } from "expo-localization"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { FALLBACK_LANGUAGE, pickLanguage } from "./detect"
import { resources, supportedLanguages } from "./resources"

export { supportedLanguages }

/** The namespaces are the json files in each language folder. */
export const NAMESPACES = Object.keys(resources[FALLBACK_LANGUAGE] ?? {})

/** The device's language, or English when the device uses one we don't have. */
export function deviceLanguage() {
  const tags = getLocales().map((locale) => locale.languageTag)
  return pickLanguage(tags, supportedLanguages)
}

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  ns: NAMESPACES,
  defaultNS: "common",
  interpolation: { escapeValue: false },
  // Never show an empty text: an empty translation counts as missing.
  returnEmptyString: false,
  initAsync: false,
})

export default i18n
