import type { Task, TaskUpdate } from "@workspace/schemas"

/**
 * A change to the to-do tasks, made on this device. Changes are kept in a queue and sent to the
 * server in order, so tasks also work without a connection. Every change uses ids chosen on the
 * device and absolute values, so sending one twice does no harm.
 */
export type TodoOp =
  | {
      type: "add"
      id: string
      title: string
      note: string
      dueDate: string | null
      /** The household the task is for, or null for a personal task. */
      householdId: string | null
      assigneeId: string | null
    }
  | { type: "update"; taskId: string; change: TaskUpdate }
  | { type: "remove"; taskId: string }

/** The tasks after one change. Never changes its input. */
export function applyTodoOp(
  tasks: Task[],
  op: TodoOp,
  now = new Date().toISOString()
): Task[] {
  switch (op.type) {
    case "add":
      if (tasks.some((task) => task.id === op.id)) return tasks
      return [
        ...tasks,
        {
          id: op.id,
          title: op.title,
          note: op.note,
          dueDate: op.dueDate,
          householdId: op.householdId,
          assigneeId: op.householdId ? op.assigneeId : null,
          doneAt: null,
          createdAt: now,
        },
      ]
    case "update":
      return tasks.map((task) =>
        task.id === op.taskId ? changeTask(task, op.change, now) : task
      )
    case "remove":
      return tasks.filter((task) => task.id !== op.taskId)
  }
}

/** The server's tasks with the changes that are still waiting to be sent put on top. */
export function applyTodoOps(tasks: Task[], queue: TodoOp[]) {
  return queue.reduce((all, op) => applyTodoOp(all, op), tasks)
}

/** A task with a change applied. Fields that were not given stay as they are. */
function changeTask(task: Task, change: TaskUpdate, now: string): Task {
  const next = { ...task }
  if (change.title !== undefined) next.title = change.title
  if (change.note !== undefined) next.note = change.note
  if (change.dueDate !== undefined) next.dueDate = change.dueDate
  if (change.assigneeId !== undefined && task.householdId) {
    next.assigneeId = change.assigneeId
  }
  if (change.done !== undefined) {
    // Ticking a task that is already done keeps the first time it was done.
    next.doneAt = change.done ? (task.doneAt ?? now) : null
  }
  return next
}
