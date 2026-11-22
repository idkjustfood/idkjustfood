import { describe, expect, test } from "bun:test"

import { noteHeading, NoteInputSchema, searchNotes } from "./notes.js"
import { openWishesFirst, searchWishes, WishInputSchema } from "./wishlists.js"

describe("notes", () => {
  test("a note needs a title or some text", () => {
    expect(NoteInputSchema.safeParse({}).success).toBe(false)
    expect(NoteInputSchema.safeParse({ title: " ", body: "\n" }).success).toBe(false)
    expect(NoteInputSchema.safeParse({ title: "Hi" }).success).toBe(true)
    expect(NoteInputSchema.safeParse({ body: "Hi" }).success).toBe(true)
  })

  test("the heading is the title, or the first line with text", () => {
    expect(noteHeading({ title: " Wi-Fi ", body: "x" })).toBe("Wi-Fi")
    expect(noteHeading({ title: "", body: "\n\nFirst line\nSecond" })).toBe("First line")
    expect(noteHeading({ title: "", body: "" })).toBe("")
  })

  test("search needs every word, in title or text", () => {
    const notes = [
      { title: "Wi-Fi", body: "password on the fridge" },
      { title: "Gift", body: "blue vase" },
    ]
    expect(searchNotes(notes, "fridge wifi")).toHaveLength(0)
    expect(searchNotes(notes, "fridge wi-fi")).toHaveLength(1)
    expect(searchNotes(notes, "  ")).toHaveLength(2)
  })
})

describe("wishes", () => {
  test("only web links are accepted", () => {
    const ok = (link: string) => WishInputSchema.safeParse({ title: "X", link }).success
    expect(ok("")).toBe(true)
    expect(ok("https://example.com/a?b=1")).toBe(true)
    expect(ok("javascript:alert(1)")).toBe(false)
    expect(ok("example.com")).toBe(false)
  })

  test("open wishes come first and keep their order", () => {
    const list = [
      { id: 1, done: true },
      { id: 2, done: false },
      { id: 3, done: true },
      { id: 4, done: false },
    ]
    expect(openWishesFirst(list).map((w) => w.id)).toEqual([2, 4, 1, 3])
  })

  test("search looks in title, note and link", () => {
    const wishes = [
      { title: "Lego", note: "", link: "" },
      { title: "Shirt", note: "size M", link: "https://shop.example" },
    ]
    expect(searchWishes(wishes, "size")).toHaveLength(1)
    expect(searchWishes(wishes, "shop lego")).toHaveLength(0)
  })
})
