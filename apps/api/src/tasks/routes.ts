import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"

import type { Database } from "@workspace/database"
import {
  TaskInputSchema,
  TaskSchema,
  TaskUpdateSchema,
  type Task,
} from "@workspace/schemas"

import type { Auth } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { taskStore, type TaskRow } from "./store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Task not found" }) })
  .openapi("Error")

const TaskBody = TaskSchema.openapi("Task")
const InputBody = TaskInputSchema.openapi("TaskInput")
const UpdateBody = TaskUpdateSchema.openapi("TaskUpdate")

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})
const error = (description: string) => json(ErrorSchema, description)
const body = <T extends z.ZodType>(schema: T) => ({
  content: { "application/json": { schema } },
  required: true as const,
})

const signedIn = { 401: error("Not signed in") }
const tags = ["Tasks"]
const security = [{ cookieAuth: [] }]
const notFound = error("The task doesn't exist, or you can't see it")

const taskId = z.object({
  taskId: z.string().openapi({ param: { name: "taskId", in: "path" } }),
})

const listTasks = createRoute({
  method: "get",
  path: "/tasks",
  tags,
  security,
  summary: "List to-do tasks",
  description:
    "Your own tasks and the tasks of your households. With `householdId`, only the tasks of " +
    "that household. Open tasks come first, soonest due day first.",
  request: { query: z.object({ householdId: z.string().optional() }) },
  responses: {
    200: json(z.object({ tasks: z.array(TaskBody) }), "The tasks"),
    404: error("Household not found, or you are not a member"),
    ...signedIn,
  },
})

const createTask = createRoute({
  method: "post",
  path: "/tasks",
  tags,
  security,
  summary: "Add a task",
  description:
    "`householdId` creates the task for a household, so every member sees it; without it the " +
    "task is personal. `assigneeId` is only for household tasks and must be a member. You may " +
    "choose the `id`. Sending an id that already exists returns that task and changes nothing.",
  request: { body: body(InputBody) },
  responses: {
    201: json(z.object({ task: TaskBody }), "Added, or already there"),
    400: error("Invalid task"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's task"),
    ...signedIn,
  },
})

const updateTask = createRoute({
  method: "patch",
  path: "/tasks/{taskId}",
  tags,
  security,
  summary: "Change a task",
  description:
    "Everyone who can see the task can change it, tick it off (`done: true`) or open it again. " +
    "A household task stays in its household.",
  request: { params: taskId, body: body(UpdateBody) },
  responses: {
    200: json(z.object({ task: TaskBody }), "The changed task"),
    400: error("Invalid change"),
    404: notFound,
    ...signedIn,
  },
})

const deleteTask = createRoute({
  method: "delete",
  path: "/tasks/{taskId}",
  tags,
  security,
  summary: "Delete a task",
  description: "Everyone who can see the task can delete it.",
  request: { params: taskId },
  responses: {
    204: { description: "Deleted" },
    404: notFound,
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables }

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  note: row.note,
  dueDate: row.dueDate,
  householdId: row.organizationId,
  assigneeId: row.assigneeId,
  doneAt: row.doneAt ? row.doneAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
})

/** Sorted like the app shows them: open first, soonest due day first, done last. */
const sorted = (rows: TaskRow[]) =>
  [...rows].sort((a, b) => {
    if (!!a.doneAt !== !!b.doneAt) return a.doneAt ? 1 : -1
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

/** To-do task endpoints. Mounted under /api. */
export function taskRoutes(db: Database, auth: Auth) {
  const store = taskStore(db)

  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = issue?.path.join(".")
        return c.json(
          { error: field ? `${field}: ${issue?.message}` : "Invalid request" },
          400
        )
      }
    },
  })

  for (const path of ["/tasks", "/tasks/*"]) {
    app.use(path, requireSession(auth))
  }

  app.openapi(listTasks, async (c) => {
    const { householdId } = c.req.valid("query")
    const userId = c.get("user").id
    const rows = householdId
      ? await store.forSpace(userId, householdId)
      : await store.listForUser(userId)
    if (!rows) return c.json({ error: "Household not found" }, 404)
    return c.json({ tasks: sorted(rows).map(toTask) }, 200)
  })

  app.openapi(createTask, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    const householdId = input.householdId ?? null
    if (!(await store.mayUse(userId, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    if (!(await store.mayAssign(householdId, input.assigneeId ?? null))) {
      return c.json(
        { error: "assigneeId: must be a member of the household" },
        400
      )
    }
    const result = await store.create(userId, input)
    if ("conflict" in result) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ task: toTask(result.row) }, 201)
  })

  app.openapi(updateTask, async (c) => {
    const { taskId } = c.req.valid("param")
    const change = c.req.valid("json")
    const existing = await store.access(taskId, c.get("user").id)
    if (!existing) return c.json({ error: "Task not found" }, 404)
    if (
      change.assigneeId !== undefined &&
      !(await store.mayAssign(existing.organizationId, change.assigneeId))
    ) {
      return c.json(
        { error: "assigneeId: must be a member of the household" },
        400
      )
    }
    const row = await store.update(taskId, change)
    if (!row) return c.json({ error: "Task not found" }, 404)
    return c.json({ task: toTask(row) }, 200)
  })

  app.openapi(deleteTask, async (c) => {
    const { taskId } = c.req.valid("param")
    if (
      !(await store.access(taskId, c.get("user").id)) ||
      !(await store.remove(taskId))
    ) {
      return c.json({ error: "Task not found" }, 404)
    }
    return c.body(null, 204)
  })

  return app
}
