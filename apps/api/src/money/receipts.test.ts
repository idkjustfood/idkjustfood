import { beforeEach, describe, expect, test } from "bun:test"

// `createApp` comes first on purpose: it adds `.openapi()` to Zod, which the schemas need.
import { createApp } from "../app.js"
import { fakeAi } from "@workspace/extraction/testing"
import type { Expense, Receipt } from "@workspace/schemas"
import type { FileStorage } from "../files/storage.js"
import { client, createTestDb, testEnv } from "../test-helpers.js"

// The first bytes of a PNG: enough for the type check.
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])

let api: ReturnType<typeof client>
let olivia: string
let stored: Map<string, Uint8Array>
let reading: { shop: string | null; date: string | null; totalCents: number | null } | "fail"
let readCount: number

function memoryStorage(): FileStorage {
  return {
    async put(key, data) {
      stored.set(key, data)
    },
    async read(key) {
      const data = stored.get(key)
      return data ? new Blob([data]) : undefined
    },
    async remove(key) {
      stored.delete(key)
    },
  }
}

async function body<T>(res: Response) {
  return (await res.json()) as T
}

function form(content: BlobPart = png, extra: Record<string, string> = {}) {
  const data = new FormData()
  data.append("file", new File([content], "r.png", { type: "image/png" }))
  for (const [key, value] of Object.entries(extra)) data.append(key, value)
  return data
}

const upload = (data: FormData, cookie = olivia) =>
  api.app.request("/api/money/receipts", {
    method: "POST",
    headers: { origin: testEnv.BETTER_AUTH_URL, cookie },
    body: data,
  })

async function addReceipt(extra: Record<string, string> = {}, cookie = olivia) {
  const res = await upload(form(png, extra), cookie)
  expect(res.status).toBe(201)
  return (await body<{ receipt: Receipt }>(res)).receipt
}

const patch = (id: string, change: object, cookie = olivia) =>
  api.request("PATCH", `/api/money/receipts/${id}`, cookie, change)

beforeEach(async () => {
  stored = new Map()
  readCount = 0
  reading = { shop: "Lidl", date: "2026-11-20", totalCents: 1799 }
  const ai = fakeAi({
    readImages: async () => "LIDL 20.11.2026 TOTAL 17,99",
    parseRecipe: async () => {
      readCount++
      if (reading === "fail") throw new Error("boom")
      return reading
    },
  })
  api = client(
    createApp(await createTestDb(), testEnv, { ai, storage: memoryStorage() })
  )
  olivia = await api.signUp("Olivia")
})

describe("receipts", () => {
  test("need a signed-in user", async () => {
    expect((await upload(form(), "")).status).toBe(401)
  })

  test("a photo is stored and read", async () => {
    const receipt = await addReceipt()
    expect(receipt).toMatchObject({
      status: "ready",
      shop: "Lidl",
      date: "2026-11-20",
      totalCents: 1799,
      expenseId: null,
      error: null,
      householdId: null,
    })
    expect(receipt.fileId).toBeTruthy()
    expect(stored.size).toBe(1)
    const data = await body<{ receipts: Receipt[] }>(await api.get("/api/money", olivia))
    expect(data.receipts.map((r) => r.id)).toEqual([receipt.id])
  })

  test("what the AI cannot read stays empty", async () => {
    reading = { shop: null, date: null, totalCents: null }
    const receipt = await addReceipt()
    expect(receipt).toMatchObject({ status: "ready", shop: null, date: null, totalCents: null })
  })

  test("an unreadable answer is cleaned: bad dates and amounts are dropped", async () => {
    reading = { shop: "Shop", date: "2026-02-30", totalCents: -4 }
    const receipt = await addReceipt()
    expect(receipt).toMatchObject({ shop: "Shop", date: null, totalCents: null })
  })

  test("when reading fails, the receipt is saved and can be filled in by hand", async () => {
    reading = "fail"
    const receipt = await addReceipt()
    expect(receipt.status).toBe("failed")
    expect(receipt.error).toBeTruthy()
    expect(receipt.totalCents).toBeNull()
    const res = await patch(receipt.id, { shop: "Bakery", date: "2026-11-19", totalCents: 450 })
    expect((await body<{ receipt: Receipt }>(res)).receipt).toMatchObject({
      status: "ready",
      error: null,
      shop: "Bakery",
      totalCents: 450,
    })
  })

  test("only images are accepted", async () => {
    const res = await upload(form("just text"))
    expect(res.status).toBe(400)
    expect(stored.size).toBe(0)
  })

  test("sending the same id twice stores and reads once", async () => {
    const first = await addReceipt({ id: "r1" })
    const again = await addReceipt({ id: "r1" })
    expect(again.id).toBe(first.id)
    expect(stored.size).toBe(1)
    expect(readCount).toBe(1)
    const eve = await api.signUp("Eve")
    expect((await upload(form(png, { id: "r1" }), eve)).status).toBe(409)
  })

  test("are private, and shared in a household", async () => {
    const receipt = await addReceipt()
    const eve = await api.signUp("Eve")
    expect((await patch(receipt.id, { shop: "x" }, eve)).status).toBe(404)
    expect((await api.request("DELETE", `/api/money/receipts/${receipt.id}`, eve)).status).toBe(404)
    const res = await api.post("/api/households", olivia, { name: "Home" })
    const hid = (await body<{ household: { id: string } }>(res)).household.id
    const member = await api.signUp("Sam")
    const invite = await api.post(`/api/households/${hid}/invites`, olivia)
    const { invite: link } = await body<{ invite: { id: string } }>(invite)
    await api.post(`/api/invites/${link.id}/accept`, member)
    const shared = await addReceipt({ householdId: hid })
    const seen = await body<{ receipts: Receipt[] }>(await api.get("/api/money", member))
    expect(seen.receipts.map((r) => r.id)).toEqual([shared.id])
    expect((await upload(form(png, { householdId: hid }), eve)).status).toBe(404)
  })

  test("becomes an expense with one call, once", async () => {
    const receipt = await addReceipt()
    const make = () =>
      api.post(`/api/money/receipts/${receipt.id}/expense`, olivia, { expenseId: "e1" })
    const res = await make()
    expect(res.status).toBe(201)
    const { expense } = await body<{ expense: Expense }>(res)
    expect(expense).toMatchObject({
      id: "e1",
      amountCents: 1799,
      date: "2026-11-20",
      note: "Lidl",
      receiptId: receipt.id,
    })
    expect((await make()).status).toBe(201)
    const data = await body<{ expenses: Expense[]; receipts: Receipt[] }>(
      await api.get("/api/money", olivia)
    )
    expect(data.expenses).toHaveLength(1)
    expect(data.receipts[0]!.expenseId).toBe("e1")
    // The id belongs to another expense now.
    const other = await addReceipt()
    expect(
      (await api.post(`/api/money/receipts/${other.id}/expense`, olivia, { expenseId: "e1" })).status
    ).toBe(409)
  })

  test("needs a total and a date to become an expense", async () => {
    reading = { shop: "Lidl", date: null, totalCents: 500 }
    const receipt = await addReceipt()
    const path = `/api/money/receipts/${receipt.id}/expense`
    expect((await api.post(path, olivia, { expenseId: "e1" })).status).toBe(400)
    const res = await api.post(path, olivia, { expenseId: "e1", date: "2026-11-18" })
    expect((await body<{ expense: Expense }>(res)).expense.date).toBe("2026-11-18")
    reading = { shop: "Lidl", date: "2026-11-20", totalCents: null }
    const noTotal = await addReceipt()
    expect(
      (await api.post(`/api/money/receipts/${noTotal.id}/expense`, olivia, { expenseId: "e2" })).status
    ).toBe(400)
  })

  test("deleting a receipt deletes its photo and keeps the expense", async () => {
    const receipt = await addReceipt()
    await api.post(`/api/money/receipts/${receipt.id}/expense`, olivia, { expenseId: "e1" })
    const res = await api.request("DELETE", `/api/money/receipts/${receipt.id}`, olivia)
    expect(res.status).toBe(204)
    expect(stored.size).toBe(0)
    const data = await body<{ expenses: Expense[]; receipts: Receipt[] }>(
      await api.get("/api/money", olivia)
    )
    expect(data.receipts).toHaveLength(0)
    expect(data.expenses[0]!.receiptId).toBeNull()
  })

  test("without an AI key the receipt is saved and says so", async () => {
    const bare = client(
      createApp(await createTestDb(), testEnv, { storage: memoryStorage() })
    )
    const cookie = await bare.signUp("Ann")
    const res = await bare.app.request("/api/money/receipts", {
      method: "POST",
      headers: { origin: testEnv.BETTER_AUTH_URL, cookie },
      body: form(),
    })
    expect(res.status).toBe(201)
    const { receipt } = await body<{ receipt: Receipt }>(res)
    expect(receipt.status).toBe("failed")
    expect(receipt.error).toContain("AI")
  })
})
