import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { AppState, Platform } from "react-native"

import {
  addIngredients,
  type ShoppingItem,
  type ShoppingItemInput,
  type ShoppingItemUpdate,
  type ShoppingList,
} from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { deviceStorage } from "@/lib/device-storage"
import { useMyUserId } from "@/lib/households"
import {
  household as demoHousehold,
  recipes as demoRecipes,
  shoppingLists as demoLists,
} from "@/lib/mock-data"
import { fromSample } from "@/lib/recipes"
import { newId, planAddItem, type ShoppingOp } from "@/lib/shopping-ops"
import {
  ShoppingStore,
  type ShoppingDeps,
  type ShoppingState,
} from "@/lib/shopping-store"

export type { ShoppingItem, ShoppingList }

/** How often the lists are refreshed while the app is open. */
const REFRESH_MS = 30_000

async function send(op: ShoppingOp) {
  switch (op.type) {
    case "createList":
      await call(
        api.POST("/api/shopping-lists", {
          body: { id: op.id, name: op.name, householdId: op.householdId },
        })
      )
      return
    case "renameList":
      await call(
        api.PATCH("/api/shopping-lists/{listId}", {
          params: { path: { listId: op.listId } },
          body: { name: op.name },
        })
      )
      return
    case "deleteList":
      await call(
        api.DELETE("/api/shopping-lists/{listId}", {
          params: { path: { listId: op.listId } },
        })
      )
      return
    case "addItem":
      await call(
        api.POST("/api/shopping-lists/{listId}/items", {
          params: { path: { listId: op.listId } },
          body: op.item,
        })
      )
      return
    case "updateItem":
      await call(
        api.PATCH("/api/shopping-lists/{listId}/items/{itemId}", {
          params: { path: { listId: op.listId, itemId: op.itemId } },
          body: op.change,
        })
      )
      return
    case "removeItem":
      await call(
        api.DELETE("/api/shopping-lists/{listId}/items/{itemId}", {
          params: { path: { listId: op.listId, itemId: op.itemId } },
        })
      )
      return
    case "clearChecked":
      await call(
        api.DELETE("/api/shopping-lists/{listId}/items", {
          params: { path: { listId: op.listId } },
        })
      )
      return
  }
}

function serverDeps(userId: string | undefined): ShoppingDeps {
  const key = `idkjustfood.shopping.v1.${userId ?? "unknown"}`
  return {
    fetchLists: async () => (await call(api.GET("/api/shopping-lists"))).lists,
    send,
    addRecipe: async (list, recipeId, servings) =>
      (
        await call(
          api.POST("/api/shopping-lists/{listId}/recipes", {
            params: { path: { listId: list.id } },
            body: { recipeId, servings },
          })
        )
      ).list,
    storage: {
      read: () => deviceStorage.read(key),
      write: (value) => deviceStorage.write(key, value),
    },
  }
}

/** Sample lists from the clickable prototype, in the shape the API uses. */
function demoDeps(): ShoppingDeps {
  const initial: ShoppingList[] = demoLists.map((list) => ({
    id: list.id,
    name: list.name,
    householdId: list.space === "household" ? demoHousehold.id : null,
    userId: "demo-user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: list.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: null,
      checked: item.checked,
      fromRecipes: item.fromRecipes,
    })),
  }))
  return {
    initial,
    send: async () => {},
    addRecipe: async (list, recipeId, servings) => {
      const sample = demoRecipes.find((r) => r.id === recipeId)
      if (!sample)
        throw Object.assign(new Error("Recipe not found"), { status: 404 })
      const recipe = fromSample(sample)
      const { items } = list
      const merged = addIngredients(
        items,
        recipe.ingredients,
        recipe.title,
        (servings ?? recipe.servings) / recipe.servings
      )
      return {
        ...list,
        items: merged.map((item, index) => ({
          ...item,
          id: items[index]?.id ?? newId(),
        })),
      }
    },
  }
}

const StoreContext = createContext<ShoppingStore | null>(null)

/**
 * Keeps the shopping lists for the signed-in person: shows what is saved on
 * this device at once, and syncs with the server whenever it can.
 */
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const { demo, offline } = useAppState()
  const userId = useMyUserId()
  const store = useMemo(
    () => new ShoppingStore(demo ? demoDeps() : serverDeps(userId)),
    [demo, userId]
  )

  useEffect(() => {
    void store.start()
    const timer = setInterval(() => void store.sync(), REFRESH_MS)
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") void store.sync()
    })
    const onOnline = () => void store.sync()
    if (Platform.OS === "web") globalThis.addEventListener?.("online", onOnline)
    return () => {
      clearInterval(timer)
      appState.remove()
      if (Platform.OS === "web") {
        globalThis.removeEventListener?.("online", onOnline)
      }
    }
  }, [store])

  // "Pretend to be offline" in the settings stops all talking to the server.
  useEffect(() => {
    store.setPaused(offline)
  }, [store, offline])

  return <StoreContext value={store}>{children}</StoreContext>
}

function useStore() {
  const store = useContext(StoreContext)
  if (!store)
    throw new Error("useShopping must be used inside ShoppingProvider")
  return store
}

/** The state of the lists: what to show, what is waiting to be sent, and whether we are online. */
export function useShoppingState(): ShoppingState {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

/** Changes to shopping lists. They take effect at once and are sent when possible. */
export function useShoppingActions() {
  const store = useStore()
  const userId = useMyUserId() ?? "unknown"

  return useMemo(
    () => ({
      /** Makes a list (personal when `householdId` is null) and returns its id. */
      createList(name: string, householdId: string | null) {
        const id = newId()
        store.dispatch({ type: "createList", id, name, householdId, userId })
        return id
      },
      renameList: (listId: string, name: string) =>
        store.dispatch({ type: "renameList", listId, name }),
      deleteList: (listId: string) =>
        store.dispatch({ type: "deleteList", listId }),
      /** Adds an item, or adds its amount to the same ingredient already on the list. */
      addItem(listId: string, item: Omit<ShoppingItemInput, "id">) {
        const list = store.getState().lists.find((l) => l.id === listId)
        if (!list) return
        const op = planAddItem(list, item, newId())
        if (op) store.dispatch(op)
      },
      updateItem: (
        listId: string,
        itemId: string,
        change: ShoppingItemUpdate
      ) => store.dispatch({ type: "updateItem", listId, itemId, change }),
      removeItem: (listId: string, itemId: string) =>
        store.dispatch({ type: "removeItem", listId, itemId }),
      clearChecked: (listId: string) =>
        store.dispatch({ type: "clearChecked", listId }),
      /** Needs a connection. Throws an error with a message for people when it fails. */
      addRecipe: (listId: string, recipeId: string, servings?: number) =>
        store.addRecipe(listId, recipeId, servings),
      sync: () => store.sync(),
    }),
    [store, userId]
  )
}

/** One list by id, or undefined when it is not there (yet). */
export function useShoppingList(listId: string | undefined) {
  const { lists, loaded } = useShoppingState()
  return { list: lists.find((l) => l.id === listId), loaded }
}

/** A short label for the kind of list: "Personal" or the household's name. */
export function useListKind() {
  const { demo } = useAppState()
  return useCallback(
    (list: ShoppingList, householdName: string | undefined) =>
      list.householdId
        ? (householdName ?? (demo ? demoHousehold.name : "Household"))
        : "Personal",
    [demo]
  )
}
