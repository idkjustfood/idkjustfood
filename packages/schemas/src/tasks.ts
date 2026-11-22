import { z } from "zod"

import { DateSchema } from "./planner.js"

/**
 * To-do tasks: something to do once, with an optional due day and, in a household, an optional
 * person it is assigned to. A task is personal or belongs to a household, like shopping lists.
 * (Things that come back after a number of days are chores, see `chores.ts`.)
 *
 * Days are plain calendar dates ("2026-11-21"). The server never works with time zones.
 */

const title = z.string().trim().min(1).max(200)
const note = z.string().trim().max(2000)

export const TaskSchema = z.object({
  id: z.string(),
  title,
  /** Empty text when there is no note. */
  note: z.string(),
  /** The day the task is due, `YYYY-MM-DD`, or null. */
  dueDate: DateSchema.nullable(),
  /** The household the task belongs to, or null for a personal task. */
  householdId: z.string().nullable(),
  /** The household member the task is assigned to. Always null for a personal task. */
  assigneeId: z.string().nullable(),
  /** When the task was ticked off, or null while it is open. */
  doneAt: z.string().nullable(),
  createdAt: z.string(),
})
export type Task = z.infer<typeof TaskSchema>

/** What a client sends to add a task. The client may choose the `id`, so a retry adds nothing twice. */
export const TaskInputSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title,
  note: note.optional(),
  dueDate: DateSchema.nullable().optional(),
  /** Empty (null) means a personal task. */
  householdId: z.string().nullable().optional(),
  /** Only for a household task, and only a member of that household. */
  assigneeId: z.string().nullable().optional(),
})
export type TaskInput = z.infer<typeof TaskInputSchema>

/** What a client sends to change a task. Only the fields that are sent change. */
export const TaskUpdateSchema = z.object({
  title: title.optional(),
  note: note.optional(),
  dueDate: DateSchema.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  /** True ticks the task off, false opens it again. */
  done: z.boolean().optional(),
})
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>

/** Open tasks first (soonest due day first, tasks without a day last), then done ones. */
export function sortTasks<
  T extends Pick<Task, "dueDate" | "doneAt" | "createdAt">,
>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (!!a.doneAt !== !!b.doneAt) return a.doneAt ? 1 : -1
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  })
}

/** Open tasks that are due on `today` or earlier. */
export function tasksDue<T extends Pick<Task, "dueDate" | "doneAt">>(
  tasks: readonly T[],
  today: string
): T[] {
  return tasks.filter(
    (task) => !task.doneAt && task.dueDate !== null && task.dueDate <= today
  )
}
