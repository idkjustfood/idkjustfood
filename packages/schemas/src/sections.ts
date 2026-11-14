/** Anything that can belong to a section: an ingredient or a step. */
export type InSection = { section?: string | null }

export type SectionGroup<T> = {
  /** The headline, or null for the items that belong to no section. */
  name: string | null
  /** The items with their place in the original list (numbering and timers need it). */
  items: { item: T; index: number }[]
}

const nameOf = (item: InSection) => item.section?.trim() || null

/**
 * Groups a list by section, in the order the sections first appear. A list
 * without any section is one group without a name, so it looks as it always did.
 */
export function groupBySection<T extends InSection>(
  list: T[]
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = []
  list.forEach((item, index) => {
    const name = nameOf(item)
    let group = groups.find((g) => g.name === name)
    if (!group) {
      group = { name, items: [] }
      groups.push(group)
    }
    group.items.push({ item, index })
  })
  return groups
}

/** True when at least one item is in a section. */
export const hasSections = (list: InSection[]) =>
  list.some((item) => nameOf(item) !== null)

/**
 * Puts the items of one section next to each other (sections in order of first
 * appearance) and writes an empty section as `null`. Lists without sections come
 * back as they were, so a recipe without sections is never changed.
 */
export function arrangeSections<T extends InSection>(list: T[]): T[] {
  if (!hasSections(list)) return list
  return groupBySection(list).flatMap((group) =>
    group.items.map(({ item }) => ({ ...item, section: group.name }))
  )
}

/** The steps in the order they are cooked, each with the headline of its section (or null). */
export function stepsInOrder<T extends InSection>(steps: T[]) {
  return arrangeSections(steps).map((step) => ({
    step,
    section: nameOf(step),
  }))
}
