/**
 * The step timers that are running, by timer id (for example
 * "<recipe id>:<step>:<n>"). Kept outside the components so a timer keeps
 * running when the screen changes, and so voice commands can start and stop
 * the same timers as the buttons.
 */
const endTimes = new Map<string, number>()
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

/** When the timer ends (a time in ms), or `null` when it was never started. */
export const timerEnd = (id: string) => endTimes.get(id) ?? null

export function startTimer(id: string, seconds: number, now = Date.now()) {
  endTimes.set(id, now + seconds * 1000)
  notify()
}

export function stopTimer(id: string) {
  if (endTimes.delete(id)) notify()
}

export function subscribeTimers(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The timer "start timer" starts: the first one that is not running. A timer
 * that has run out counts as not running, so it can be started again.
 */
export function firstIdle(ids: string[], now = Date.now()) {
  return ids.find((id) => (endTimes.get(id) ?? 0) <= now) ?? null
}

/** The timers of a step that are running or ringing. */
export const activeTimers = (ids: string[]) =>
  ids.filter((id) => endTimes.has(id))
