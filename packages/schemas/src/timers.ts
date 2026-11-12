import { quantityPattern, quantityValue } from "./quantity.js"

/** A time found in a step, for example "30 minutes". */
export type StepTimer = {
  seconds: number
  /** The words from the step, for example "1 hour 30 minutes". */
  label: string
}

const numberWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
}

const wordPattern = Object.keys(numberWords).join("|")
const numberPattern = `(?:${quantityPattern}|${wordPattern})`
const unitPattern =
  "(hours?|hrs?|h|minutes?|mins?|seconds?|secs?)(?![a-zA-Z])"

// "30 minutes", "1½ hours", "20-25 min", "ten minutes", "2 h"
const timePattern = new RegExp(
  `(?<![\\w.,/])(${numberPattern})(?:\\s*(?:-|–|to)\\s*(?:${numberPattern}))?\\s*-?\\s*${unitPattern}`,
  "gi"
)
const halfHour = /\bhalf an hour\b/gi

function numberOf(text: string) {
  const word = numberWords[text.toLowerCase()]
  return word ?? quantityValue(text)
}

function secondsPerUnit(unit: string) {
  const first = unit.toLowerCase()[0]
  if (first === "h") return 3600
  if (first === "m") return 60
  return 1
}

const longest = 48 * 3600

/**
 * Finds times in a step with plain text matching (no AI): "bake 30 minutes",
 * "simmer for 1 hour 30 minutes", "rest 5-10 min". A range uses its lower end.
 */
export function findTimers(text: string): StepTimer[] {
  type Hit = { start: number; end: number; seconds: number; hours: boolean }
  const hits: Hit[] = []

  for (const match of text.matchAll(timePattern)) {
    const unit = match[2]!
    const seconds = Math.round(numberOf(match[1]!) * secondsPerUnit(unit))
    hits.push({
      start: match.index,
      end: match.index + match[0].length,
      seconds,
      hours: secondsPerUnit(unit) === 3600,
    })
  }
  for (const match of text.matchAll(halfHour)) {
    hits.push({
      start: match.index,
      end: match.index + match[0].length,
      seconds: 1800,
      hours: false,
    })
  }
  hits.sort((a, b) => a.start - b.start)

  // "1 hour 30 minutes" is one timer, not two.
  const merged: Hit[] = []
  for (const hit of hits) {
    const previous = merged[merged.length - 1]
    if (
      previous?.hours &&
      !hit.hours &&
      /^\s*(?:and|,)?\s*$/i.test(text.slice(previous.end, hit.start))
    ) {
      previous.end = hit.end
      previous.seconds += hit.seconds
      previous.hours = false
    } else {
      merged.push({ ...hit })
    }
  }

  return merged
    .filter((hit) => hit.seconds > 0 && hit.seconds <= longest)
    .map((hit) => ({
      seconds: hit.seconds,
      label: text.slice(hit.start, hit.end),
    }))
}

/** "30:00", "1:05:00", for a running timer. */
export function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const two = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}
