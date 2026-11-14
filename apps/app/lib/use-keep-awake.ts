import { useEffect, useState } from "react"

import { keepAwake } from "./keep-awake"

/**
 * Keeps the screen on while the calling screen is open. Returns `unsupported`
 * when the device or browser cannot do that, so the screen can show a hint.
 */
export function useKeepScreenOn() {
  const [unsupported, setUnsupported] = useState(false)
  useEffect(() => {
    let cancelled = false
    void keepAwake.hold().then((ok) => {
      if (!cancelled) setUnsupported(!ok)
    })
    return () => {
      cancelled = true
      keepAwake.release()
    }
  }, [])
  return { unsupported }
}
