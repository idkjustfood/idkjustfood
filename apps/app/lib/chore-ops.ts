import type { Chore, ChoreKind, ChoreUpdate } from "@workspace/schemas"

/**
 * A change to the chores, made on this device. Changes are kept in a queue and sent to the
 * server in order, so chores also work without a connection. Every change uses ids chosen on
 * the device and absolute values (the day a chore was checked, not "toggle"), so sending one
 * twice does no harm.
 */
export type ChoreOp =
  | {
      type: "add"
      id: string
      name: string
      /** Left out in changes saved before kinds existed: that means a chore. */
      kind?: ChoreKind
      intervalDays: number
      householdId: string | null
    }
  | { type: "update"; choreId: string; change: ChoreUpdate }
  | { type: "remove"; choreId: string }

/** The chores after one change. Never changes its input. */
export function applyChoreOp(
  chores: Chore[],
  op: ChoreOp,
  now = new Date().toISOString()
): Chore[] {
  switch (op.type) {
    case "add":
      if (chores.some((chore) => chore.id === op.id)) return chores
      return [
        ...chores,
        {
          id: op.id,
          name: op.name,
          kind: op.kind ?? "chore",
          intervalDays: op.intervalDays,
          lastDoneOn: null,
          householdId: op.householdId,
          createdAt: now,
        },
      ]
    case "update":
      return chores.map((chore) =>
        chore.id === op.choreId ? { ...chore, ...definedOnly(op.change) } : chore
      )
    case "remove":
      return chores.filter((chore) => chore.id !== op.choreId)
  }
}

/** The server's chores with the changes that are still waiting to be sent put on top. */
export function applyChoreOps(chores: Chore[], queue: ChoreOp[]) {
  return queue.reduce((all, op) => applyChoreOp(all, op), chores)
}

/** A change without the fields that were not given. `null` is a value (it clears the day). */
function definedOnly(change: ChoreUpdate): Partial<Chore> {
  const result: Partial<Chore> = {}
  if (change.name !== undefined) result.name = change.name
  if (change.intervalDays !== undefined) result.intervalDays = change.intervalDays
  if (change.lastDoneOn !== undefined) result.lastDoneOn = change.lastDoneOn
  return result
}
