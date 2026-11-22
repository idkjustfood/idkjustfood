import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"

import type { Database } from "@workspace/database"
import {
  aiConfigured,
  checkImage,
  ExtractionError,
  maxImageBytes,
  readReceipt,
  type Ai,
} from "@workspace/extraction"
import {
  DateSchema,
  ExpenseSchema,
  ReceiptCreateSchema,
  ReceiptSchema,
  ReceiptUpdateSchema,
  splitReceipt,
} from "@workspace/schemas"

import type { Auth, AuthEnv } from "../auth.js"
import { fileStore } from "../files/store.js"
import {
  filesDirectoryFromEnv,
  localDiskStorage,
  type FileStorage,
} from "../files/storage.js"
import type { LogVariables } from "../logging.js"
import { requireSession, type AuthVariables } from "../session.js"
import { toExpense, toReceipt } from "./routes.js"
import { moneyStore } from "./store.js"

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Receipt not found" }) })
  .openapi("Error")

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
const tags = ["Money"]
const security = [{ cookieAuth: [] }]
const notFound = error("The receipt doesn't exist, or you can't see it")

const Receipt = ReceiptSchema.openapi("Receipt")
const ExpenseBody = ExpenseSchema.openapi("Expense")

const receiptId = z.object({
  receiptId: z.string().openapi({ param: { name: "receiptId", in: "path" } }),
})

const UploadBody = z
  .object({
    file: z.file().openapi({
      type: "string",
      format: "binary",
      description: "A photo of the receipt: JPEG, PNG, WebP or GIF, up to 10 MB.",
    }),
    householdId: z.string().optional().openapi({
      description: "Put the receipt in this household. Leave out to keep it personal.",
    }),
    id: z.string().min(1).max(100).optional().openapi({
      description:
        "You may choose the receipt's id. Sending an id that already exists returns that receipt " +
        "and reads nothing again.",
    }),
  })
  .openapi("ReceiptUpload")

const uploadReceipt = createRoute({
  method: "post",
  path: "/money/receipts",
  tags,
  security,
  summary: "Add a receipt from a photo",
  description:
    "Stores the photo on the server's own disk (it also shows in the documents) and has the AI " +
    "read the shop, the date and the total. A value the AI cannot clearly read stays empty: it " +
    "never guesses. When reading fails, the receipt is still saved with status `failed`, and the " +
    "values can be typed in. Reading takes a few seconds.",
  request: {
    body: {
      content: { "multipart/form-data": { schema: UploadBody } },
      required: true,
    },
  },
  responses: {
    201: json(z.object({ receipt: Receipt }), "Saved, read or not"),
    400: error("Not an image, empty, or too large"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's receipt"),
    ...signedIn,
  },
})

const createManualReceipt = createRoute({
  method: "post",
  path: "/money/receipts/manual",
  tags,
  security,
  summary: "Add a receipt without a photo",
  description:
    "Adds a receipt that is typed in. Everything but the id is optional: the shop, the date, " +
    "the total and the lines (each with an optional category of the same space). Nothing is read " +
    "by the AI, so this works on a server without AI. You may choose the id: sending an id that " +
    "already exists returns that receipt and changes nothing.",
  request: { body: body(ReceiptCreateSchema.openapi("ReceiptCreate")) },
  responses: {
    201: json(z.object({ receipt: Receipt }), "Saved"),
    400: error("A category is not valid"),
    404: error("Household not found, or you are not a member"),
    409: error("That id is already used by someone else's receipt"),
    ...signedIn,
  },
})

const updateReceipt = createRoute({
  method: "patch",
  path: "/money/receipts/{receiptId}",
  tags,
  security,
  summary: "Correct a receipt",
  description:
    "Change what was read or typed. Send `null` to clear a value. `items` replaces all the lines.",
  request: {
    params: receiptId,
    body: body(ReceiptUpdateSchema.openapi("ReceiptUpdate")),
  },
  responses: {
    200: json(z.object({ receipt: Receipt }), "The corrected receipt"),
    400: error("Invalid change"),
    404: notFound,
    ...signedIn,
  },
})

const deleteReceipt = createRoute({
  method: "delete",
  path: "/money/receipts/{receiptId}",
  tags,
  security,
  summary: "Delete a receipt",
  description:
    "Deletes the receipt and its photo. An expense made from it stays, without the link.",
  request: { params: receiptId },
  responses: { 204: { description: "Deleted" }, 404: notFound, ...signedIn },
})

const ToExpense = z
  .object({
    expenseId: z.string().min(1).max(100),
    categoryId: z.string().nullable().optional(),
    paidBy: z.string().optional(),
    date: DateSchema.optional().openapi({
      description: "Used when the receipt has no date of its own.",
    }),
  })
  .openapi("ReceiptToExpense")

const toExpenseRoute = createRoute({
  method: "post",
  path: "/money/receipts/{receiptId}/expense",
  tags,
  security,
  summary: "Turn a receipt into an expense",
  description:
    "Adds the expenses of a receipt, with the shop as their note. The receipt needs a total, " +
    "and a date (its own or `date`). Without lines it is one expense with the total. With lines " +
    "it is one expense per category, the sum of its lines; lines without a category use " +
    "`categoryId`. The lines must add up to the total. You choose the first expense's `expenseId`, " +
    "the others get `<expenseId>-2`, `<expenseId>-3` and so on: sending it again returns the " +
    "same expenses and changes nothing.",
  request: { params: receiptId, body: body(ToExpense) },
  responses: {
    201: json(
      z.object({
        expense: ExpenseBody.openapi({ description: "The first expense." }),
        expenses: z.array(ExpenseBody),
      }),
      "The expenses"
    ),
    400: error(
      "The receipt has no total or date yet, its lines do not add up to the total, or a category or payer is not valid"
    ),
    404: notFound,
    409: error("That expense id is already used for something else"),
    ...signedIn,
  },
})

type Env = { Variables: AuthVariables & Partial<LogVariables> }

/** Receipt endpoints. Mounted under /api. */
export function receiptRoutes(
  db: Database,
  auth: Auth,
  env: AuthEnv,
  ai: Ai,
  /** True when `ai` is the real one, which needs a key; tests pass a fake that does not. */
  needsKey: boolean,
  storage: FileStorage = localDiskStorage(filesDirectoryFromEnv(env))
) {
  const store = moneyStore(db)
  const files = fileStore(db)

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

  /** The categories of a space, as the AI is offered them. */
  async function spaceCategories(userId: string, householdId: string | null) {
    await store.ensureCategories(userId)
    return (await store.categories(userId))
      .filter((c) => c.organizationId === householdId)
      .map((c) => ({ id: c.id, label: c.name ?? c.key ?? "" }))
      .filter((c) => c.label)
  }

  /** Whether every category used by the lines belongs to the space. */
  async function itemsValid(
    userId: string,
    householdId: string | null,
    items: { categoryId: string | null }[]
  ) {
    const ids = new Set(items.flatMap((i) => (i.categoryId ? [i.categoryId] : [])))
    for (const categoryId of ids) {
      if (!(await store.categoryInSpace(categoryId, userId, householdId))) return false
    }
    return true
  }

  for (const path of ["/money/receipts", "/money/receipts/*"]) {
    app.use(path, requireSession(auth))
  }

  // Stop huge uploads before they are read into memory.
  app.use("/money/receipts", async (c, next) => {
    if (c.req.method !== "POST") return next()
    return bodyLimit({
      maxSize: maxImageBytes + 64 * 1024,
      onError: (c) =>
        c.json({ error: "The photo is too large. The limit is 10 MB." }, 400),
    })(c, next)
  })

  app.openapi(uploadReceipt, async (c) => {
    const { file, householdId: householdField, id } = c.req.valid("form")
    const userId = c.get("user").id
    const householdId = householdField || null
    if (!(await store.mayUse(userId, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    const data = new Uint8Array(await file.arrayBuffer())
    let mimeType: string
    try {
      mimeType = checkImage(data)
    } catch (cause) {
      if (cause instanceof ExtractionError) {
        return c.json({ error: cause.message }, 400)
      }
      throw cause
    }

    // The same id again: nothing is stored or read a second time.
    if (id) {
      const existing = await store.receipt(id, userId)
      if (existing) return c.json({ receipt: toReceipt(existing) }, 201)
    }

    const stored = await files.create(userId, {
      name: `receipt-${new Date().toISOString().slice(0, 10)}.${mimeType.split("/")[1]}`,
      mimeType,
      sizeBytes: data.byteLength,
      householdId,
      folderId: null,
    })
    try {
      await storage.put(stored.storageKey, data)
    } catch (cause) {
      await files.remove(stored.id)
      throw cause
    }

    const created = await store.createReceipt(userId, {
      id,
      householdId,
      fileId: stored.id,
    })
    if ("conflict" in created) {
      await storage.remove(stored.storageKey)
      await files.remove(stored.id)
      return c.json({ error: "That id is already in use" }, 409)
    }

    const log = c.get("log")
    let reading: Parameters<typeof store.updateReceipt>[1]
    if (needsKey && !aiConfigured(env)) {
      reading = {
        status: "failed",
        error:
          "No AI key is set on this server, so the receipt was not read. You can type in the values.",
      }
    } else {
      try {
        const details = await readReceipt(
          ai,
          { data },
          await spaceCategories(userId, householdId)
        )
        reading = { status: "ready", error: null, ...details }
      } catch (cause) {
        if (cause instanceof ExtractionError) {
          log?.warn("receipt reading failed", { code: cause.code })
          reading = { status: "failed", error: cause.message }
        } else {
          log?.error("receipt reading failed", { error: String(cause) })
          reading = {
            status: "failed",
            error: "Reading the receipt failed. You can type in the values.",
          }
        }
      }
    }
    const row = await store.updateReceipt(created.row.id, reading)
    return c.json({ receipt: toReceipt(row ?? created.row) }, 201)
  })

  app.openapi(createManualReceipt, async (c) => {
    const input = c.req.valid("json")
    const userId = c.get("user").id
    const householdId = input.householdId || null
    if (!(await store.mayUse(userId, householdId))) {
      return c.json({ error: "Household not found" }, 404)
    }
    if (input.id) {
      const existing = await store.receipt(input.id, userId)
      if (existing) return c.json({ receipt: toReceipt(existing) }, 201)
    }
    const items = input.items ?? []
    if (!(await itemsValid(userId, householdId, items))) {
      return c.json({ error: "Category not found" }, 400)
    }
    const created = await store.createReceipt(userId, {
      id: input.id,
      householdId,
      fileId: null,
      status: "ready",
      shop: input.shop || null,
      date: input.date ?? null,
      totalCents: input.totalCents ?? null,
      items,
    })
    if ("conflict" in created) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    return c.json({ receipt: toReceipt(created.row) }, 201)
  })

  app.openapi(updateReceipt, async (c) => {
    const { receiptId: idParam } = c.req.valid("param")
    const current = await store.receipt(idParam, c.get("user").id)
    if (!current) return c.json({ error: "Receipt not found" }, 404)
    const change = c.req.valid("json")
    if (
      change.items &&
      !(await itemsValid(c.get("user").id, current.organizationId, change.items))
    ) {
      return c.json({ error: "Category not found" }, 400)
    }
    const row = await store.updateReceipt(idParam, {
      ...change,
      // A person who corrected the values has looked at them: they are no longer "failed".
      status: "ready",
      error: null,
    })
    if (!row) return c.json({ error: "Receipt not found" }, 404)
    return c.json({ receipt: toReceipt(row) }, 200)
  })

  app.openapi(deleteReceipt, async (c) => {
    const { receiptId: idParam } = c.req.valid("param")
    const userId = c.get("user").id
    const found = await store.receipt(idParam, userId)
    if (!found) return c.json({ error: "Receipt not found" }, 404)
    await store.removeReceipt(idParam)
    if (found.fileId) {
      const file = await files.access(found.fileId, userId)
      if (file?.mayDelete) {
        await storage.remove(file.row.storageKey)
        await files.remove(file.row.id)
      }
    }
    return c.body(null, 204)
  })

  app.openapi(toExpenseRoute, async (c) => {
    const { receiptId: idParam } = c.req.valid("param")
    const userId = c.get("user").id
    const receipt = await store.receipt(idParam, userId)
    if (!receipt) return c.json({ error: "Receipt not found" }, 404)
    const input = c.req.valid("json")
    const date = receipt.date ?? input.date
    if (!receipt.totalCents || !date) {
      return c.json({ error: "The receipt needs a total and a date first." }, 400)
    }
    const paidBy = input.paidBy ?? userId
    if (
      (input.categoryId &&
        !(await store.categoryInSpace(input.categoryId, userId, receipt.organizationId))) ||
      !(await store.mayPay(receipt.organizationId, userId, paidBy))
    ) {
      return c.json({ error: "Category or payer not found" }, 400)
    }
    // A retry: the first expense is there already, so return what was made.
    const parts = splitReceipt(receipt, input.categoryId ?? null, input.expenseId)
    if (!parts) {
      return c.json(
        { error: "The lines of the receipt do not add up to its total." },
        400
      )
    }
    const result = await store.receiptToExpenses(userId, receipt, {
      parts,
      date,
      paidBy,
    })
    if (result.conflict) {
      return c.json({ error: "That id is already in use" }, 409)
    }
    const expenses = result.expenses.map(toExpense)
    return c.json({ expense: expenses[0]!, expenses }, 201)
  })

  return app
}
