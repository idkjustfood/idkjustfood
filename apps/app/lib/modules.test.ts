import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "bun:test"

import {
  areaOfRoute,
  areas,
  enabledModules,
  getModule,
  moduleIds,
  modules,
  modulesInArea,
  parseDisabled,
  quickActions,
  searchModules,
  toggleModule,
} from "./modules"

describe("module registry", () => {
  test("ids are unique", () => {
    expect(new Set(moduleIds).size).toBe(moduleIds.length)
  })

  test("the bottom bar has a balanced number of areas around the quick-add button", () => {
    expect(areas.length).toBe(6)
    expect(areas.length % 2).toBe(0)
  })

  test("household modules are in the home area, plan keeps the calendar side", () => {
    const ids = (area: "plan" | "home") =>
      modulesInArea(area, []).map((m) => m.id)
    expect(ids("home").sort()).toEqual(
      ["chores", "contacts", "documents", "inventory", "maintenance", "plantsPets"].sort()
    )
    expect(ids("plan").sort()).toEqual(
      ["calendar", "planner", "reminders", "routines", "tasks"].sort()
    )
  })

  test("every module is in an area and has a route", () => {
    for (const m of modules) {
      expect(areas).toContain(m.area)
      expect(m.route.startsWith("/")).toBe(true)
    }
  })

  test("a module that is not built uses the placeholder route", () => {
    for (const m of modules.filter((m) => !m.built))
      expect(m.route).toBe(`/m/${m.id}`)
  })

  test("settings and the module switches cannot be turned off", () => {
    for (const id of ["settings", "household", "modules"])
      expect(getModule(id)?.required).toBe(true)
  })
})

describe("switching modules", () => {
  test("a switched-off module leaves its area and the quick actions", () => {
    const off = toggleModule([], "shopping", false)
    expect(modulesInArea("food", off).map((m) => m.id)).not.toContain("shopping")
    expect(quickActions(off).map((m) => m.id)).not.toContain("shopping")
    expect(enabledModules(off).map((m) => m.id)).not.toContain("shopping")
  })

  test("switching it on again brings it back", () => {
    const off = toggleModule([], "shopping", false)
    const on = toggleModule(off, "shopping", true)
    expect(on).toEqual([])
    expect(modulesInArea("food", on).map((m) => m.id)).toContain("shopping")
  })

  test("required modules stay on", () => {
    expect(toggleModule([], "settings", false)).toEqual([])
  })

  test("switching off twice lists the module once", () => {
    const once = toggleModule([], "tasks", false)
    expect(toggleModule(once, "tasks", false)).toEqual(["tasks"])
  })

  test("saved text is read safely", () => {
    expect(parseDisabled(null)).toEqual([])
    expect(parseDisabled("not json")).toEqual([])
    expect(parseDisabled('{"a":1}')).toEqual([])
    // Unknown and required modules are dropped.
    expect(parseDisabled('["tasks","gone","settings"]')).toEqual(["tasks"])
  })
})

describe("areaOfRoute", () => {
  test("areas and existing screens map to their tab", () => {
    expect(areaOfRoute("index")).toBe("today")
    expect(areaOfRoute("shopping")).toBe("food")
    expect(areaOfRoute("(recipes)")).toBe("food")
    expect(areaOfRoute("planner")).toBe("plan")
    expect(areaOfRoute("calendar")).toBe("plan")
    expect(areaOfRoute("settings")).toBe("more")
  })

  test("a placeholder belongs to the area of its module", () => {
    expect(areaOfRoute("m/[id]", { id: "budget" })).toBe("money")
    expect(areaOfRoute("m/[id]", { id: "tasks" })).toBe("plan")
    expect(areaOfRoute("m/[id]", { id: "chores" })).toBe("home")
    expect(areaOfRoute("home")).toBe("home")
    expect(areaOfRoute("m/[id]", { id: "nope" })).toBe("more")
  })
})

describe("searchModules", () => {
  const text = (m: { id: string }) => m.id
  test("needs every word and ignores case", () => {
    expect(searchModules(modules, "SHOP", text).map((m) => m.id)).toEqual([
      "shopping",
    ])
    expect(searchModules(modules, "shop zzz", text)).toEqual([])
  })
  test("an empty query finds nothing", () => {
    expect(searchModules(modules, "  ", text)).toEqual([])
  })
})

describe("module texts", () => {
  const texts = JSON.parse(
    readFileSync(join(import.meta.dir, "..", "locales", "en", "modules.json"), "utf8")
  ) as Record<string, Record<string, string>>

  test("every module has a name and a description", () => {
    for (const m of modules) {
      expect(texts[m.id]?.name).toBeTruthy()
      expect(texts[m.id]?.description).toBeTruthy()
    }
  })

  test("placeholders say what the module will do, quick actions have a label", () => {
    for (const m of modules) {
      if (!m.built) expect(texts[m.id]?.soon).toBeTruthy()
      if (m.quickAction) expect(texts[m.id]?.quickAction).toBeTruthy()
    }
  })
})
