import type { SpeechEngine } from "./speech-engine.types"

/**
 * The browser's Web Speech API. Chrome, Edge and Safari have it, Firefox does
 * not. Most browsers send the audio to their own speech service (see
 * docs/cooking-mode.md); nothing goes to our server.
 */
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: ResultEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  abort: () => void
}
type ResultEvent = {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}
type Constructor = new () => Recognition

const constructor = (): Constructor | undefined => {
  const g = globalThis as unknown as {
    SpeechRecognition?: Constructor
    webkitSpeechRecognition?: Constructor
  }
  return g.SpeechRecognition ?? g.webkitSpeechRecognition
}

let current: Recognition | null = null

function detach() {
  if (!current) return
  current.onresult = current.onend = current.onerror = null
  current.abort()
  current = null
}

export const speechEngine: SpeechEngine = {
  isSupported: async () => constructor() !== undefined,

  async start({ lang, onPhrase, onEnd, onError }) {
    const Recognition = constructor()
    if (!Recognition) {
      onError("unsupported")
      return false
    }
    detach()
    const recognition = new Recognition()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!
        if (result.isFinal && result[0]) onPhrase(result[0].transcript)
      }
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed")
        onError("denied")
      else if (event.error === "language-not-supported") onError("unsupported")
      else if (event.error !== "no-speech" && event.error !== "aborted")
        onError("other")
    }
    recognition.onend = () => onEnd()
    current = recognition
    // The browser asks for the microphone here.
    recognition.start()
    return true
  },

  stop: detach,
}
