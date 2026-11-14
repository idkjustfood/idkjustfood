import { describe, expect, test } from "bun:test"

import { pickLanguage } from "./detect"

const supported = ["en", "de", "es"]

describe("pickLanguage", () => {
  test("uses the first supported device language", () => {
    expect(pickLanguage(["fr-FR", "de-AT", "en"], supported)).toBe("de")
  })
  test("ignores region and case", () => {
    expect(pickLanguage(["ES_mx"], supported)).toBe("es")
  })
  test("falls back to English", () => {
    expect(pickLanguage(["ja-JP"], supported)).toBe("en")
    expect(pickLanguage([], supported)).toBe("en")
  })
})
