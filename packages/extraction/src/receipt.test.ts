import { describe, expect, test } from "bun:test"

import { readReceipt } from "./receipt.js"
import { fakeAi } from "./testing.js"

// The first bytes of a PNG: enough for the type check.
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])

const receiptText = "LIDL\n20.11.2026\nMilk 1,09\nTOTAL 17,99"

function ai(answer: unknown, text = receiptText) {
  return fakeAi({
    readImages: async () => text,
    parseRecipe: async () => answer,
  })
}

describe("readReceipt", () => {
  test("returns what the AI read", async () => {
    const result = await readReceipt(
      ai({ shop: " Lidl ", date: "2026-11-20", totalCents: 1799 }),
      { data: png }
    )
    expect(result).toEqual({ shop: "Lidl", date: "2026-11-20", totalCents: 1799, items: [] })
  })

  test("what is not clearly there stays empty", async () => {
    const result = await readReceipt(
      ai({ shop: null, date: "2026-02-30", totalCents: -5 }),
      { data: png }
    )
    expect(result).toEqual({ shop: null, date: null, totalCents: null, items: [] })
  })

  test("puts each line in one of the offered categories, never in an invented one", async () => {
    const categories = [
      { id: "c-food", label: "groceries" },
      { id: "c-snack", label: "snacks" },
    ]
    let instruction: string | undefined
    const fake = fakeAi({
      readImages: async () => receiptText,
      parseRecipe: async (_text, options) => {
        instruction = options?.instruction
        return {
          shop: "Lidl",
          date: null,
          totalCents: 1500,
          items: [
            { name: "Milk", amountCents: 109, categoryId: "c-food" },
            { name: "Chocolate", amountCents: 191, categoryId: "c-snack" },
            { name: "Mystery", amountCents: 200, categoryId: "made-up" },
            { name: "", amountCents: 100, categoryId: null },
            { name: "Free", amountCents: 0, categoryId: null },
          ],
        }
      },
    })
    const result = await readReceipt(fake, { data: png }, categories)
    expect(result.items.map(({ name, amountCents, categoryId }) => ({ name, amountCents, categoryId }))).toEqual([
      { name: "Milk", amountCents: 109, categoryId: "c-food" },
      { name: "Chocolate", amountCents: 191, categoryId: "c-snack" },
      { name: "Mystery", amountCents: 200, categoryId: null },
    ])
    expect(instruction).toContain("c-snack")
    expect(instruction).toContain("snacks")
  })

  test("gives the vision model the receipt instruction and the parser the receipt text", async () => {
    let instruction: string | undefined
    let material = ""
    const fake = fakeAi({
      readImages: async (_images, options) => {
        instruction = options?.instruction
        return receiptText
      },
      parseRecipe: async (text) => {
        material = text
        return { shop: null, date: null, totalCents: null }
      },
    })
    await readReceipt(fake, { data: png })
    expect(instruction).toContain("receipt")
    expect(material).toBe(receiptText)
  })

  test("fails when no text can be read, without asking the parser", async () => {
    const fake = ai({}, "   ")
    await expect(readReceipt(fake, { data: png })).rejects.toMatchObject({
      code: "invalid_input",
    })
    expect(fake.calls.parseRecipe).toHaveLength(0)
  })

  test("fails when the answer is not usable", async () => {
    await expect(
      readReceipt(ai("not an object"), { data: png })
    ).rejects.toMatchObject({ code: "invalid_recipe" })
  })

  test("only accepts real images", async () => {
    await expect(
      readReceipt(ai({}), { data: new Uint8Array([1, 2, 3]) })
    ).rejects.toMatchObject({ code: "invalid_input" })
  })
})
