import { describe, expect, test } from "bun:test"

import {
  modeOf,
  parsePercent,
  percentsOf,
  percentsValid,
  splitFor,
} from "./expense-split"

const members = ["me", "you"]

describe("splitFor", () => {
  test("equal has no split", () => expect(splitFor("equal", "me", members)).toBeNull())
  test("alone is only the payer", () =>
    expect(splitFor("alone", "me", members)).toEqual({ me: 100 }))
  test("others leaves the payer out", () =>
    expect(splitFor("others", "me", members)).toEqual({ you: 100 }))
  test("others in a bigger household still adds up to 100", () => {
    const split = splitFor("others", "a", ["a", "b", "c"])!
    expect(Object.values(split).reduce((x, y) => x + y, 0)).toBe(100)
    expect(split.a).toBeUndefined()
  })
  test("custom drops zero shares", () =>
    expect(splitFor("custom", "me", members, { me: 70, you: 30 })).toEqual({ me: 70, you: 30 }))
  test("custom 100/0 is just one person", () =>
    expect(splitFor("custom", "me", members, { me: 100, you: 0 })).toEqual({ me: 100 }))
})

describe("modeOf", () => {
  test("recognises the simple modes", () => {
    expect(modeOf(null, "me", members)).toBe("equal")
    expect(modeOf({ me: 100 }, "me", members)).toBe("alone")
    expect(modeOf({ you: 100 }, "me", members)).toBe("others")
    expect(modeOf({ me: 70, you: 30 }, "me", members)).toBe("custom")
  })
})

describe("percents", () => {
  test("start equal, or from the saved split", () => {
    expect(percentsOf(null, members)).toEqual({ me: 50, you: 50 })
    expect(percentsOf({ me: 70, you: 30 }, members)).toEqual({ me: 70, you: 30 })
    expect(percentsOf({ me: 100 }, members)).toEqual({ me: 100, you: 0 })
  })
  test("must add up to 100", () => {
    expect(percentsValid({ me: 70, you: 30 })).toBe(true)
    expect(percentsValid({ me: 70, you: 20 })).toBe(false)
    expect(percentsValid({ me: Number.NaN, you: 100 })).toBe(false)
  })
  test("parsePercent", () => {
    expect(parsePercent("70")).toBe(70)
    expect(parsePercent("")).toBe(0)
    expect(Number.isNaN(parsePercent("7x"))).toBe(true)
  })
})
