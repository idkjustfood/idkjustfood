import type {
  ShoppingItem,
  ShoppingItemInput,
  ShoppingItemUpdate,
  ShoppingList,
} from "@workspace/schemas"

/**
 * A change to a shopping list, made on this device. Changes are kept in a
 * queue and sent to the server in order, so they also work without a
 * connection. They only use ids chosen on the device, so sending one twice
 * does no harm.
 */
export type ShoppingOp =
  | {
      type: "createList"
      id: string
      name: string
      householdId: string | null
      userId: string
    }
  | { type: "renameList"; listId: string; name: string }
  | { type: "deleteList"; listId: string }
  | {
      type: "addItem"
      listId: string
      item: ShoppingItemInput & { id: string }
    }
  | {
      type: "updateItem"
      listId: string
      itemId: string
      change: ShoppingItemUpdate
    }
  | { type: "removeItem"; listId: string; itemId: string }
  | { type: "clearChecked"; listId: string }

function withList(
  lists: ShoppingList[],
  listId: string,
  change: (list: ShoppingList) => ShoppingList
) {
  return lists.map((list) => (list.id === listId ? change(list) : list))
}

/** The lists after one change. Never changes its input. */
export function applyOp(
  lists: ShoppingList[],
  op: ShoppingOp,
  now = new Date().toISOString()
): ShoppingList[] {
  switch (op.type) {
    case "createList":
      if (lists.some((list) => list.id === op.id)) return lists
      return [
        ...lists,
        {
          id: op.id,
          name: op.name,
          householdId: op.householdId,
          userId: op.userId,
          items: [],
          createdAt: now,
          updatedAt: now,
        },
      ]
    case "renameList":
      return withList(lists, op.listId, (list) => ({ ...list, name: op.name }))
    case "deleteList":
      return lists.filter((list) => list.id !== op.listId)
    case "addItem":
      return withList(lists, op.listId, (list) =>
        list.items.some((item) => item.id === op.item.id)
          ? list
          : {
              ...list,
              items: [
                ...list.items,
                {
                  id: op.item.id,
                  name: op.item.name,
                  quantity: op.item.quantity ?? null,
                  unit: op.item.unit ?? null,
                  note: op.item.note ?? null,
                  checked: false,
                  fromRecipes: [],
                },
              ],
            }
      )
    case "updateItem":
      return withList(lists, op.listId, (list) => ({
        ...list,
        items: list.items.map((item) =>
          item.id === op.itemId ? applyChange(item, op.change) : item
        ),
      }))
    case "removeItem":
      return withList(lists, op.listId, (list) => ({
        ...list,
        items: list.items.filter((item) => item.id !== op.itemId),
      }))
    case "clearChecked":
      return withList(lists, op.listId, (list) => ({
        ...list,
        items: list.items.filter((item) => !item.checked),
      }))
  }
}

function applyChange(item: ShoppingItem, change: ShoppingItemUpdate) {
  const next = { ...item }
  if (change.name !== undefined) next.name = change.name
  if (change.quantity !== undefined) next.quantity = change.quantity
  if (change.unit !== undefined) next.unit = change.unit
  if (change.note !== undefined) next.note = change.note
  if (change.checked !== undefined) next.checked = change.checked
  return next
}

/** The server's lists with the changes that are still waiting to be sent put on top. */
export function applyOps(lists: ShoppingList[], queue: ShoppingOp[]) {
  return queue.reduce((all, op) => applyOp(all, op), lists)
}

/**
 * A new id made on the device. Long and random enough that two devices never
 * pick the same one (React Native has no `crypto.randomUUID` everywhere).
 */
export function newId() {
  const random = () => Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${random()}${random()}${random()}`
}

/** What to do with a queued change the server answered with an error. */
export function afterError(status: number): "retry-later" | "drop" {
  // 0 is "could not reach the server". Server trouble (5xx) and a missing
  // sign-in (401) can also pass, so the change is kept for the next try.
  if (status === 0 || status >= 500 || status === 401 || status === 429) {
    return "retry-later"
  }
  // The list or item is gone or not ours any more (404, 403), or the change
  // was never valid (400, 409): sending it again would fail the same way.
  return "drop"
}
