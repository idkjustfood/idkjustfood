import { beforeEach, describe, expect, test } from "bun:test"

import {
  activeTimers,
  firstIdle,
  startTimer,
  stopTimer,
  timerEnd,
} from "./cook-timers"

const ids = ["a:0:0", "a:0:1", "a:0:2"]

beforeEach(() => ids.forEach(stopTimer))

describe("cook timers", () => {
  test("starts the first timer when none runs", () => {
    expect(firstIdle(ids)).toBe("a:0:0")
  })

  test("starts the first one that is not running", () => {
    startTimer("a:0:0", 60)
    expect(firstIdle(ids)).toBe("a:0:1")
    startTimer("a:0:1", 60)
    expect(firstIdle(ids)).toBe("a:0:2")
  })

  test("a timer that ran out can be started again", () => {
    startTimer("a:0:0", 1, Date.now() - 5000)
    expect(firstIdle(ids)).toBe("a:0:0")
  })

  test("nothing to start when all run", () => {
    ids.forEach((id) => startTimer(id, 60))
    expect(firstIdle(ids)).toBeNull()
  })

  test("stops timers", () => {
    startTimer("a:0:1", 60)
    expect(activeTimers(ids)).toEqual(["a:0:1"])
    stopTimer("a:0:1")
    expect(timerEnd("a:0:1")).toBeNull()
    expect(activeTimers(ids)).toEqual([])
  })
})
