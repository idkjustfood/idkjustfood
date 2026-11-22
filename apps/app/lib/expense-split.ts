import { splitCentsBy, type ExpenseSplit } from "@workspace/schemas"

/**
 * How the form offers to share an expense. Pure logic, no texts: the screen names the modes.
 * - `equal`: between all members (stored as no split at all)
 * - `alone`: not shared, it is only the payer's own expense
 * - `others`: paid for the others: everyone but the payer shares it, the payer owes nothing
 * - `custom`: a percentage per member, for example 70/30
 */
export type SplitMode = "equal" | "alone" | "others" | "custom"

/** The split a mode stands for. `percents` is only used by `custom`. */
export function splitFor(
  mode: SplitMode,
  paidBy: string,
  members: readonly string[],
  percents: Readonly<Record<string, number>> = {}
): ExpenseSplit | null {
  switch (mode) {
    case "equal":
      return null
    case "alone":
      return { [paidBy]: 100 }
    case "others": {
      const others = members.filter((member) => member !== paidBy)
      if (others.length === 0) return null
      const parts = splitCentsBy(100, others.map(() => 1))
      return Object.fromEntries(others.map((member, i) => [member, parts[i]!]))
    }
    case "custom": {
      const entries = Object.entries(percents).filter(([, p]) => p > 0)
      return entries.length > 0 ? Object.fromEntries(entries) : null
    }
  }
}

const sameSplit = (a: ExpenseSplit | null, b: ExpenseSplit | null) => {
  if (a === null || b === null) return a === b
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/** The mode of a saved split. Anything that is not one of the simple modes is `custom`. */
export function modeOf(
  split: ExpenseSplit | null,
  paidBy: string,
  members: readonly string[]
): SplitMode {
  for (const mode of ["equal", "alone", "others"] as const) {
    if (sameSplit(split, splitFor(mode, paidBy, members))) return mode
  }
  return "custom"
}

/** Percent per member for the custom fields: the saved split, or an equal share to start from. */
export function percentsOf(
  split: ExpenseSplit | null,
  members: readonly string[]
): Record<string, number> {
  if (split) return Object.fromEntries(members.map((m) => [m, split[m] ?? 0]))
  const parts = splitCentsBy(100, members.map(() => 1))
  return Object.fromEntries(members.map((m, i) => [m, parts[i]!]))
}

/** Whether custom percentages are usable: whole numbers that add up to 100. */
export function percentsValid(percents: Readonly<Record<string, number>>): boolean {
  const values = Object.values(percents)
  return (
    values.every((p) => Number.isInteger(p) && p >= 0 && p <= 100) &&
    values.reduce((a, b) => a + b, 0) === 100
  )
}

/** Reads what a person typed in a percent field. Empty is 0, anything else that is not a number is NaN. */
export function parsePercent(text: string): number {
  const value = text.trim()
  return value === "" ? 0 : /^\d{1,3}$/.test(value) ? Number(value) : Number.NaN
}
