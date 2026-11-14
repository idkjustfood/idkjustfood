/**
 * Matches what a person says in cooking mode to a command. Plain text matching,
 * no AI and no platform code, so it is the same on the web, iOS and Android.
 *
 * Only a short, whole phrase counts ("next", "start the timer"). A sentence
 * that merely contains such a word ("pass me the next bowl") does nothing, so
 * talking in the kitchen does not trigger anything.
 */

export type VoiceCommand = "next" | "back" | "repeat" | "startTimer" | "stopTimer"

type Phrases = Record<VoiceCommand, string[]>

/** The words per language, chosen by the app language. Accents do not matter. */
const phrases: Record<string, Phrases> = {
  en: {
    next: ["next", "next step", "continue", "go on", "forward"],
    back: ["back", "go back", "previous", "previous step"],
    repeat: ["repeat", "again", "say again", "read again"],
    startTimer: ["start timer", "start the timer", "timer start", "begin timer"],
    stopTimer: ["stop timer", "stop the timer", "cancel timer", "timer stop"],
  },
  de: {
    next: ["weiter", "nächster", "nächster schritt", "nächste", "vor"],
    back: ["zurück", "zurückgehen", "vorheriger", "vorheriger schritt"],
    repeat: ["wiederholen", "wiederhole", "nochmal", "noch mal"],
    startTimer: ["timer starten", "starte timer", "starte den timer", "timer start"],
    stopTimer: ["timer stoppen", "stoppe timer", "stoppe den timer", "timer stopp", "timer beenden"],
  },
  es: {
    next: ["siguiente", "siguiente paso", "adelante", "continuar", "continúa"],
    back: ["atrás", "anterior", "paso anterior", "volver"],
    repeat: ["repetir", "repite", "otra vez", "de nuevo"],
    startTimer: ["iniciar temporizador", "inicia el temporizador", "empezar temporizador", "iniciar cronómetro"],
    stopTimer: ["parar temporizador", "para el temporizador", "detener temporizador", "detén el temporizador"],
  },
  fr: {
    next: ["suivant", "étape suivante", "continue", "continuer", "prochaine étape"],
    back: ["retour", "précédent", "étape précédente", "reviens", "revenir"],
    repeat: ["répète", "répéter", "encore", "répétez"],
    startTimer: ["démarrer le minuteur", "démarre le minuteur", "lance le minuteur", "lancer le minuteur", "démarrer minuteur"],
    stopTimer: ["arrête le minuteur", "arrêter le minuteur", "stop minuteur", "arrêter minuteur"],
  },
  it: {
    next: ["avanti", "prossimo", "prossimo passo", "passo successivo", "continua"],
    back: ["indietro", "precedente", "passo precedente", "torna indietro"],
    repeat: ["ripeti", "di nuovo", "ancora"],
    startTimer: ["avvia timer", "avvia il timer", "inizia timer", "fai partire il timer", "parti timer"],
    stopTimer: ["ferma timer", "ferma il timer", "stop timer", "interrompi timer"],
  },
}

/** Lower case, no accents, no punctuation, single spaces. */
export function normalizeSpeech(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const lookups = new Map<string, Map<string, VoiceCommand>>()

function lookup(language: string) {
  const code = language.toLowerCase().split(/[-_]/)[0]!
  const key = code in phrases ? code : "en"
  let table = lookups.get(key)
  if (!table) {
    table = new Map()
    for (const [command, words] of Object.entries(phrases[key]!)) {
      for (const word of words) table.set(normalizeSpeech(word), command as VoiceCommand)
    }
    lookups.set(key, table)
  }
  return table
}

/** The command in what was said, or `null` when it is not one. */
export function matchVoiceCommand(
  transcript: string,
  language: string
): VoiceCommand | null {
  return lookup(language).get(normalizeSpeech(transcript)) ?? null
}

/** The languages that have a word list. */
export const voiceLanguages = Object.keys(phrases)

/** Language codes for the speech recognizer, which wants a region. */
const recognizerLocales: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
}

export const recognizerLocale = (language: string) =>
  recognizerLocales[language.toLowerCase().split(/[-_]/)[0]!] ?? "en-US"
