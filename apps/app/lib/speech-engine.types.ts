/** What the voice control needs from the platform's speech recognition. */
export type SpeechStart = {
  /** A language with a region, for example "en-US". */
  lang: string
  /** Called with each finished phrase. */
  onPhrase: (text: string) => void
  /** Called when the system stops listening by itself, for example after a silence. */
  onEnd: () => void
  /** Called when listening cannot go on. `denied` means the microphone or speech recognition is blocked. */
  onError: (reason: "denied" | "unsupported" | "other") => void
}

export type SpeechEngine = {
  /** True when the browser or phone has speech recognition. */
  isSupported: () => Promise<boolean>
  /** Asks for permission if needed and starts listening. Resolves `false` when it was denied. */
  start: (options: SpeechStart) => Promise<boolean>
  /** Stops listening and turns the microphone off. */
  stop: () => void
}
