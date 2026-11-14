import { classifySection, type StoreSection } from "./sections.js"

/**
 * One supermarket: the order in which a shopper walks through its sections. Each supermarket
 * is its own small file in this folder and is listed in `index.ts`. See
 * `docs/adding-a-supermarket.md`.
 */
export type Supermarket = {
  /** Stable id that is saved on the device, for example "aldi". Never rename it. */
  id: string
  /**
   * The brand name, shown as written in every language. Leave it out for a layout that is no
   * brand ("standard"); the app then uses the translation `shopping:store.<id>`.
   */
  name?: string
  /** Older ids that still mean this supermarket, so choices saved on a device keep working. */
  aliases?: readonly string[]
  /**
   * Where the route comes from, and how sure it is. Required, so nobody has to guess: a route
   * that was not checked in a shop says so.
   */
  source: string
  /** The sections in walking order. A section that is missing here is shown before "other". */
  route: readonly StoreSection[]
}

export type StoreGroup<T> = { section: StoreSection; items: T[] }

/**
 * Groups items by section and puts the groups in the supermarket's walking order. Empty
 * sections are left out, "other" is always last, and items keep their order inside a group.
 * Nothing is lost or duplicated.
 */
export function sortByRoute<T extends { name: string }>(
  items: readonly T[],
  supermarket: Supermarket
): StoreGroup<T>[] {
  const bySection = new Map<StoreSection, T[]>()
  for (const item of items) {
    const section = classifySection(item.name)
    bySection.set(section, [...(bySection.get(section) ?? []), item])
  }
  const order = [
    ...supermarket.route.filter((s) => s !== "other"),
    // Sections the route forgot are not hidden.
    ...[...bySection.keys()].filter(
      (s) => s !== "other" && !supermarket.route.includes(s)
    ),
    "other" as const,
  ]
  return order.flatMap((section) => {
    const group = bySection.get(section)
    return group ? [{ section, items: group }] : []
  })
}
