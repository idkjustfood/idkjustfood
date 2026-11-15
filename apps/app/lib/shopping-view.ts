import { getSupermarket, type Supermarket } from "@workspace/schemas"

/**
 * What part of a shopping list is shown: every item, only the default list (where new items
 * start), or the items moved to one supermarket.
 */
export type ShoppingView =
  { kind: "all" } | { kind: "default" } | { kind: "store"; id: string }

type Moveable = { supermarket: string | null }

/** The id of the supermarket an item was moved to, or null when it is on the default list. */
export function storeIdOf(item: Moveable): string | null {
  return item.supermarket === null ? null : getSupermarket(item.supermarket).id
}

/** The items that belong to the view. They keep their order. */
export function itemsInView<T extends Moveable>(
  items: readonly T[],
  view: ShoppingView
): T[] {
  switch (view.kind) {
    case "all":
      return [...items]
    case "default":
      return items.filter((item) => storeIdOf(item) === null)
    case "store":
      return items.filter((item) => storeIdOf(item) === view.id)
  }
}

/** For each supermarket that has items, how many. Supermarkets without items are not in it. */
export function storeCounts(items: readonly Moveable[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const id = storeIdOf(item)
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/**
 * The supermarket the items of a view are sorted for. A supermarket's own view always uses its
 * route, without the person choosing it again. The other views use the choice saved on the device.
 */
export function sortingFor(view: ShoppingView, chosen: Supermarket) {
  return view.kind === "store" ? getSupermarket(view.id) : chosen
}

/** The view to show now. A supermarket view with no items left falls back to all items. */
export function validView(
  view: ShoppingView,
  items: readonly Moveable[]
): ShoppingView {
  if (view.kind !== "store") return view
  return storeCounts(items).has(view.id) ? view : { kind: "all" }
}
