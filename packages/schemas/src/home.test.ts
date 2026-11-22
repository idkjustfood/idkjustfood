import { describe, expect, test } from "bun:test"

import {
  ContactInputSchema,
  phoneHref,
  searchContacts,
} from "./contacts.js"
import { InventoryItemInputSchema, searchInventory } from "./inventory.js"

describe("inventory", () => {
  test("a name is enough, the rest is optional", () => {
    expect(InventoryItemInputSchema.safeParse({ name: "Candles" }).success).toBe(true)
  })

  test("refuses an empty name and a quantity below 1", () => {
    expect(InventoryItemInputSchema.safeParse({ name: " " }).success).toBe(false)
    expect(InventoryItemInputSchema.safeParse({ name: "A", quantity: 0 }).success).toBe(false)
    expect(InventoryItemInputSchema.safeParse({ name: "A", quantity: 1.5 }).success).toBe(false)
  })

  test("search finds items by name, place or note, every word must match", () => {
    const items = [
      { name: "Drill", place: "Garage, red box", note: "" },
      { name: "Candles", place: "Kitchen drawer", note: "for the table" },
    ]
    expect(searchInventory(items, "garage")).toHaveLength(1)
    expect(searchInventory(items, "kitchen table")).toHaveLength(1)
    expect(searchInventory(items, "kitchen garage")).toHaveLength(0)
    expect(searchInventory(items, "  ")).toHaveLength(2)
  })
})

describe("contacts", () => {
  test("only the name is required", () => {
    expect(ContactInputSchema.safeParse({ name: "Dr. Weber" }).success).toBe(true)
  })

  test("an email must look like one, or stay empty", () => {
    expect(ContactInputSchema.safeParse({ name: "A", email: "a@b.de" }).success).toBe(true)
    expect(ContactInputSchema.safeParse({ name: "A", email: "" }).success).toBe(true)
    expect(ContactInputSchema.safeParse({ name: "A", email: "nope" }).success).toBe(false)
  })

  test("search finds contacts by role and phone", () => {
    const contacts = [
      { name: "Max", role: "Plumber", phone: "0170 111", email: "", note: "" },
      { name: "Dr. Weber", role: "Doctor", phone: "030 222", email: "", note: "" },
    ]
    expect(searchContacts(contacts, "plumber").map((c) => c.name)).toEqual(["Max"])
    expect(searchContacts(contacts, "222").map((c) => c.name)).toEqual(["Dr. Weber"])
  })

  test("a phone number becomes a tel link without spaces and dashes", () => {
    expect(phoneHref("+49 170 123-456")).toBe("tel:+49170123456")
    expect(phoneHref("")).toBeNull()
    expect(phoneHref("none")).toBeNull()
  })
})
