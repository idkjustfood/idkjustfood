import { describe, expect, test } from "bun:test"

import { choreKinds } from "@workspace/schemas"

import { getModule } from "./modules"
import { kindOf, ofKind, taskKinds } from "./task-kinds"

describe("task kinds", () => {
  test("every kind belongs to a built module in the home area", () => {
    for (const kind of choreKinds) {
      const module = getModule(taskKinds[kind].moduleId)
      expect(module?.area).toBe("home")
      expect(module?.built).toBe(true)
      expect(module?.route).toBe(taskKinds[kind].route)
    }
  })

  test("a task without a kind is a chore", () => {
    expect(kindOf({})).toBe("chore")
    expect(kindOf({ kind: "pet" })).toBe("pet")
  })

  test("ofKind keeps only the tasks of one kind", () => {
    const tasks = [{ id: "a" }, { id: "b", kind: "plant" as const }]
    expect(ofKind(tasks, "chore").map((t) => t.id)).toEqual(["a"])
    expect(ofKind(tasks, "plant").map((t) => t.id)).toEqual(["b"])
  })
})
