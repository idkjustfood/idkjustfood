import { useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { speechEngine } from "./speech-engine"
import {
  matchVoiceCommand,
  recognizerLocale,
  type VoiceCommand,
} from "./voice-commands"

export type VoiceStatus =
  | "off"
  | "listening"
  /** The microphone or speech recognition is blocked. */
  | "denied"
  /** This browser or phone has no speech recognition. */
  | "unsupported"
  | "error"

/** A restart that fails this many times in a row ends the listening. */
const MAX_QUICK_RESTARTS = 5
const RESTART_AFTER_MS = 300

/**
 * Listens for the cooking commands while `enabled` is true. The system ends
 * recognition by itself often (after a short silence), so it starts again
 * until it is turned off, the app goes to the background or the screen closes.
 * The microphone is off in all of those cases.
 */
export function useVoiceControl({
  enabled,
  language,
  onCommand,
}: {
  enabled: boolean
  language: string
  onCommand: (command: VoiceCommand) => void
}) {
  const [status, setStatus] = useState<VoiceStatus>("off")
  const [supported, setSupported] = useState<boolean | null>(null)
  const onCommandRef = useRef(onCommand)
  onCommandRef.current = onCommand

  useEffect(() => {
    let cancelled = false
    void speechEngine
      .isSupported()
      .catch(() => false)
      .then((ok) => !cancelled && setSupported(ok))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setStatus("off")
      return
    }
    let active = true
    let foreground = AppState.currentState === "active"
    let timer: ReturnType<typeof setTimeout> | undefined
    let quickRestarts = 0
    let startedAt = 0

    const stop = () => {
      clearTimeout(timer)
      speechEngine.stop()
    }
    const fail = (next: VoiceStatus) => {
      active = false
      stop()
      setStatus(next)
    }

    async function begin() {
      if (!active || !foreground) return
      startedAt = Date.now()
      try {
        const ok = await speechEngine.start({
          lang: recognizerLocale(language),
          onPhrase: (text) => {
            const command = matchVoiceCommand(text, language)
            if (command) onCommandRef.current(command)
          },
          onEnd: () => {
            if (!active || !foreground) return
            quickRestarts = Date.now() - startedAt < 1000 ? quickRestarts + 1 : 0
            if (quickRestarts >= MAX_QUICK_RESTARTS) return fail("error")
            timer = setTimeout(() => void begin(), RESTART_AFTER_MS)
          },
          onError: (reason) =>
            fail(
              reason === "denied"
                ? "denied"
                : reason === "unsupported"
                  ? "unsupported"
                  : "error"
            ),
        })
        if (!ok) fail("denied")
        else if (active) setStatus("listening")
      } catch {
        fail("error")
      }
    }

    const appState = AppState.addEventListener("change", (state) => {
      foreground = state === "active"
      if (!active) return
      if (foreground) {
        quickRestarts = 0
        void begin()
      } else {
        stop()
      }
    })

    void begin()
    return () => {
      active = false
      appState.remove()
      stop()
    }
  }, [enabled, language])

  return { status, supported }
}
