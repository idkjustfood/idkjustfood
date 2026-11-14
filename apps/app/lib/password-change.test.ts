import { describe, expect, test } from "bun:test"

import {
  isWrongCurrentPassword,
  validatePasswordChange,
} from "./password-change"

describe("validatePasswordChange", () => {
  const ok = { current: "old-password", next: "new-password-1", repeat: "new-password-1" }

  test("accepts a valid change", () => {
    expect(validatePasswordChange(ok)).toBeNull()
  })

  test("needs the current password", () => {
    expect(validatePasswordChange({ ...ok, current: "" })).toBe("currentMissing")
  })

  test("new password needs at least 8 characters", () => {
    expect(
      validatePasswordChange({ ...ok, next: "short", repeat: "short" })
    ).toBe("tooShort")
    expect(
      validatePasswordChange({ ...ok, next: "12345678", repeat: "12345678" })
    ).toBeNull()
  })

  test("repeated password must match", () => {
    expect(validatePasswordChange({ ...ok, repeat: "other-password" })).toBe(
      "mismatch"
    )
  })

  test("new password must differ from the current one", () => {
    expect(
      validatePasswordChange({
        current: "same-password",
        next: "same-password",
        repeat: "same-password",
      })
    ).toBe("sameAsCurrent")
  })
})

describe("isWrongCurrentPassword", () => {
  test("recognises the Better Auth code and message", () => {
    expect(isWrongCurrentPassword({ code: "INVALID_PASSWORD" })).toBe(true)
    expect(isWrongCurrentPassword({ message: "Invalid password" })).toBe(true)
  })

  test("ignores other errors", () => {
    expect(isWrongCurrentPassword({ status: 0, message: "Failed to fetch" })).toBe(
      false
    )
    expect(isWrongCurrentPassword(null)).toBe(false)
  })
})
