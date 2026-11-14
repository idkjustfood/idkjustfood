import { describe, expect, test } from "bun:test"
import { readdirSync } from "node:fs"
import { join } from "node:path"

import {
  matchVoiceCommand,
  recognizerLocale,
  voiceLanguages,
  type VoiceCommand,
} from "./voice-commands"

const spoken: Record<string, Record<VoiceCommand, string>> = {
  en: { next: "Next", back: "back", repeat: "Repeat", startTimer: "Start timer", stopTimer: "Stop the timer." },
  de: { next: "weiter", back: "Zurück", repeat: "wiederholen", startTimer: "Timer starten", stopTimer: "Timer stoppen" },
  es: { next: "siguiente", back: "atrás", repeat: "repetir", startTimer: "iniciar temporizador", stopTimer: "parar temporizador" },
  fr: { next: "suivant", back: "retour", repeat: "répète", startTimer: "démarre le minuteur", stopTimer: "arrête le minuteur" },
  it: { next: "avanti", back: "indietro", repeat: "ripeti", startTimer: "avvia il timer", stopTimer: "ferma il timer" },
}

describe("matchVoiceCommand", () => {
  for (const [language, words] of Object.entries(spoken)) {
    test(`understands ${language}`, () => {
      for (const [command, text] of Object.entries(words)) {
        expect(matchVoiceCommand(text, language)).toBe(command as VoiceCommand)
      }
    })
  }

  test("ignores case, accents and punctuation", () => {
    expect(matchVoiceCommand("  ZURUCK! ", "de")).toBe("back")
    expect(matchVoiceCommand("Étape suivante.", "fr")).toBe("next")
  })

  test("accepts a region in the language code", () => {
    expect(matchVoiceCommand("weiter", "de-AT")).toBe("next")
  })

  test("other speech does nothing", () => {
    expect(matchVoiceCommand("pass me the next bowl", "en")).toBeNull()
    expect(matchVoiceCommand("can you start the timer please", "en")).toBeNull()
    expect(matchVoiceCommand("", "en")).toBeNull()
    expect(matchVoiceCommand("weiter", "en")).toBeNull()
  })

  test("an unknown language uses English", () => {
    expect(matchVoiceCommand("next", "pt")).toBe("next")
  })

  test("every app language has a word list and a recognizer locale", () => {
    const languages = readdirSync(join(import.meta.dir, "..", "locales"))
    for (const language of languages) {
      expect(voiceLanguages).toContain(language)
      expect(recognizerLocale(language)).toContain("-")
    }
  })
})
