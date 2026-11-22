/**
 * The module registry: the one list the whole app is built from. Navigation, the Today screen,
 * the "+" sheet and search all read it. Adding a module means adding one entry here and a
 * screen. See `docs/adding-a-module.md`.
 *
 * This file is plain data and logic. It does not import i18n, so it can be tested. Texts are
 * translation keys in `locales/<language>/modules.json`, translated when shown.
 */

/** The bottom tabs. Today has no modules of its own: it collects items from the others. */
export const areas = ["today", "plan", "home", "food", "money", "more"] as const
export type Area = (typeof areas)[number]

/** Areas that hold modules. */
export type ModuleArea = Exclude<Area, "today">

/** A heading inside an area, for areas with many modules (More has Family). */
export type ModuleGroup = "family"

export type AppModule = {
  id: string
  /** `modules:<id>.name`, `.description` and `.quickAction` hold its texts. */
  area: ModuleArea
  group?: ModuleGroup
  /** Where the module lives. Modules that are not built yet use `/m/<id>`, a placeholder. */
  route: string
  /** False for placeholders, true when the module already works. */
  built: boolean
  /** Modules the person cannot switch off, so they can always get to settings. */
  required?: boolean
  /** Has an action in the "+" sheet. */
  quickAction?: { route: string }
}

const placeholder = (id: string) => `/m/${id}`

export const modules: readonly AppModule[] = [
  // Plan
  {
    id: "calendar",
    area: "plan",
    route: "/calendar",
    built: true,
    quickAction: { route: "/calendar" },
  },
  {
    id: "tasks",
    area: "plan",
    route: placeholder("tasks"),
    built: false,
    quickAction: { route: placeholder("tasks") },
  },
  {
    id: "routines",
    area: "plan",
    route: placeholder("routines"),
    built: false,
  },
  {
    id: "reminders",
    area: "plan",
    route: placeholder("reminders"),
    built: false,
    quickAction: { route: placeholder("reminders") },
  },
  {
    id: "planner",
    area: "plan",
    route: "/planner",
    built: true,
    quickAction: { route: "/planner" },
  },
  // Home
  {
    id: "chores",
    area: "home",
    route: "/chores",
    built: true,
    quickAction: { route: "/chores" },
  },
  {
    id: "maintenance",
    area: "home",
    route: "/maintenance",
    built: true,
  },
  {
    id: "documents",
    area: "home",
    route: "/documents",
    built: true,
    quickAction: { route: "/documents" },
  },
  {
    id: "inventory",
    area: "home",
    route: "/inventory",
    built: true,
  },
  {
    id: "contacts",
    area: "home",
    route: "/contacts",
    built: true,
  },
  {
    id: "plants",
    area: "home",
    route: "/plants",
    built: true,
  },
  {
    id: "pets",
    area: "home",
    route: "/pets",
    built: true,
  },
  // Food
  {
    id: "recipes",
    area: "food",
    route: "/recipes",
    built: true,
    quickAction: { route: "/add" },
  },
  {
    id: "cooking",
    area: "food",
    // Cooking mode starts from a recipe, so this opens the recipes.
    route: "/recipes",
    built: true,
  },
  {
    id: "shopping",
    area: "food",
    route: "/shopping",
    built: true,
    quickAction: { route: "/shopping" },
  },
  {
    id: "pantry",
    area: "food",
    route: "/settings/pantry",
    built: true,
  },
  // Money
  {
    id: "budget",
    area: "money",
    route: "/budget",
    built: true,
  },
  {
    id: "expenses",
    area: "money",
    route: "/expenses",
    built: true,
    quickAction: { route: "/expenses" },
  },
  {
    id: "bills",
    area: "money",
    route: "/bills",
    built: true,
  },
  {
    id: "savings",
    area: "money",
    route: "/savings",
    built: true,
  },
  {
    id: "receipts",
    area: "money",
    route: "/receipts",
    built: true,
    quickAction: { route: "/receipts" },
  },
  // More, Family
  {
    id: "notes",
    area: "more",
    group: "family",
    route: placeholder("notes"),
    built: false,
    quickAction: { route: placeholder("notes") },
  },
  {
    id: "wishlists",
    area: "more",
    group: "family",
    route: placeholder("wishlists"),
    built: false,
  },
  // More
  {
    id: "household",
    area: "more",
    route: "/settings/household",
    built: true,
    required: true,
  },
  {
    id: "settings",
    area: "more",
    route: "/settings",
    built: true,
    required: true,
  },
  {
    id: "modules",
    area: "more",
    route: "/settings/modules",
    built: true,
    required: true,
  },
  {
    id: "exportImport",
    area: "more",
    route: "/settings",
    built: true,
  },
]

export const moduleIds = modules.map((m) => m.id)

export function getModule(id: string): AppModule | undefined {
  return modules.find((m) => m.id === id)
}

/** Switched-off module ids, as saved on the device. Unknown ids (removed modules) are dropped. */
export function parseDisabled(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter(
      (id): id is string =>
        typeof id === "string" && !!getModule(id) && !getModule(id)!.required
    )
  } catch {
    return []
  }
}

export function isEnabled(module: AppModule, disabled: readonly string[]) {
  return module.required === true || !disabled.includes(module.id)
}

/** The modules that are switched on, in registry order. */
export function enabledModules(disabled: readonly string[]): AppModule[] {
  return modules.filter((m) => isEnabled(m, disabled))
}

/** The enabled modules of one area. */
export function modulesInArea(
  area: ModuleArea,
  disabled: readonly string[]
): AppModule[] {
  return enabledModules(disabled).filter((m) => m.area === area)
}

/** Modules with an action in the "+" sheet. */
export function quickActions(disabled: readonly string[]): AppModule[] {
  return enabledModules(disabled).filter((m) => m.quickAction)
}

/** Turns a module on or off. Required modules cannot be switched off. */
export function toggleModule(
  disabled: readonly string[],
  id: string,
  on: boolean
): string[] {
  const module = getModule(id)
  if (!module || module.required) return [...disabled]
  const rest = disabled.filter((d) => d !== id)
  return on ? rest : [...rest, id]
}

/**
 * The area a tab-route belongs to, so the right tab stays highlighted inside a module. Routes
 * of the areas themselves, the module placeholders (`m/[id]`) and the existing screens are known.
 */
export function areaOfRoute(
  routeName: string,
  params?: Record<string, unknown>
): Area | null {
  switch (routeName) {
    case "index":
      return "today"
    case "plan":
    case "home":
    case "food":
    case "money":
    case "more":
      return routeName
    case "m/[id]": {
      const id = typeof params?.id === "string" ? params.id : ""
      return getModule(id)?.area ?? "more"
    }
    case "(recipes)":
    case "shopping":
    case "add":
      return "food"
    case "planner":
    case "calendar":
      return "plan"
    case "chores":
    case "maintenance":
    case "plants":
    case "pets":
    case "inventory":
    case "contacts":
    case "documents":
      return "home"
    case "expenses":
    case "budget":
    case "bills":
    case "savings":
    case "receipts":
      return "money"
    case "settings":
      return "more"
    default:
      return null
  }
}

/** Search: modules whose name, description or keywords contain every word typed. */
export function searchModules<T extends AppModule>(
  list: readonly T[],
  query: string,
  textOf: (module: T) => string
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return list.filter((m) => {
    const text = textOf(m).toLowerCase()
    return words.every((w) => text.includes(w))
  })
}
