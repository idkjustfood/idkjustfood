import { ExpoSpeechRecognitionModule } from "expo-speech-recognition"

import type { SpeechEngine } from "./speech-engine.types"

/**
 * iOS and Android: the phone's own speech recognition. Uses on-device
 * recognition where the phone offers it, so audio does not have to leave it.
 */
let subscriptions: { remove: () => void }[] = []

function clear() {
  subscriptions.forEach((s) => s.remove())
  subscriptions = []
}

export const speechEngine: SpeechEngine = {
  isSupported: async () => ExpoSpeechRecognitionModule.isRecognitionAvailable(),

  async start({ lang, onPhrase, onEnd, onError }) {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!permission.granted) return false
    clear()
    subscriptions = [
      ExpoSpeechRecognitionModule.addListener("result", (event) => {
        if (!event.isFinal) return
        for (const result of event.results) onPhrase(result.transcript)
      }),
      ExpoSpeechRecognitionModule.addListener("end", () => onEnd()),
      ExpoSpeechRecognitionModule.addListener("error", (event) => {
        // "no-speech" and "aborted" are normal; the system ends the session next.
        if (event.error === "not-allowed") onError("denied")
        else if (event.error === "language-not-supported") onError("unsupported")
        else if (event.error !== "no-speech" && event.error !== "aborted") onError("other")
      }),
    ]
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: false,
      continuous: true,
      requiresOnDeviceRecognition:
        ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    })
    return true
  },

  stop() {
    clear()
    ExpoSpeechRecognitionModule.abort()
  },
}
