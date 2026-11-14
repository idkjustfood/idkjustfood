type Lock = { release: () => Promise<void> }
type WakeLockApi = { request: (type: "screen") => Promise<Lock> }

const api = () => (globalThis.navigator as { wakeLock?: WakeLockApi } | undefined)?.wakeLock

let lock: Lock | null = null
let wanted = false

async function request() {
  const wakeLock = api()
  if (!wakeLock || !wanted || lock) return
  try {
    lock = await wakeLock.request("screen")
  } catch {
    lock = null
  }
}

// Browsers let go of the lock when the tab is hidden. Ask again when it is back.
function onVisible() {
  if (document.visibilityState !== "visible") return
  lock = null
  void request()
}

/** The browser's Screen Wake Lock API. */
export const keepAwake = {
  /** Resolves `false` when the browser has no wake lock or refuses it. */
  async hold(): Promise<boolean> {
    if (!api()) return false
    wanted = true
    document.addEventListener("visibilitychange", onVisible)
    await request()
    return lock !== null
  },
  release() {
    wanted = false
    document.removeEventListener("visibilitychange", onVisible)
    void lock?.release().catch(() => {})
    lock = null
  },
}
