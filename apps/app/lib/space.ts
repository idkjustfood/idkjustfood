/**
 * The space the app shows: the user's personal space (`null`) or one of their
 * households (its id). Lists, plans and recipes belong to exactly one space.
 */
export type SpaceId = string | null

/** Only the items of one space. Items of other spaces never show up. */
export function inSpace<T extends { householdId: string | null }>(
  items: readonly T[],
  space: SpaceId
): T[] {
  return items.filter((item) => item.householdId === space)
}

/**
 * The selection to use once the households are known: the saved one when the
 * user is still in that household, the personal space otherwise.
 */
export function resolveSpace(
  selected: SpaceId,
  households: readonly { id: string }[]
): SpaceId {
  return selected && households.some((h) => h.id === selected) ? selected : null
}
