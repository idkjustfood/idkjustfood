import type { ChoreKind } from "@workspace/schemas"

/**
 * Chores, home maintenance, plants and pets are the same thing: a task that comes back after a
 * number of days (`docs/household-tasks.md`). This says which module shows which kind. Plain data,
 * no i18n, so it can be tested.
 */
export type TaskModuleId = "chores" | "maintenance" | "plants" | "pets"

export const taskKinds: Record<
  ChoreKind,
  { moduleId: TaskModuleId; route: string }
> = {
  chore: { moduleId: "chores", route: "/chores" },
  maintenance: { moduleId: "maintenance", route: "/maintenance" },
  plant: { moduleId: "plants", route: "/plants" },
  pet: { moduleId: "pets", route: "/pets" },
}

/** The kind of a task. Tasks saved on a device before kinds existed are chores. */
export const kindOf = (task: { kind?: ChoreKind }): ChoreKind =>
  task.kind ?? "chore"

/** The tasks of one kind. */
export function ofKind<T extends { kind?: ChoreKind }>(
  tasks: readonly T[],
  kind: ChoreKind
): T[] {
  return tasks.filter((task) => kindOf(task) === kind)
}
