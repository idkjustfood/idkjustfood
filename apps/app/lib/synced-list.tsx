import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { AppState, Platform } from "react-native"

import { useAppState } from "@/lib/app-state"
import { deviceStorage } from "@/lib/device-storage"
import { useMyUserId } from "@/lib/households"
import {
  ListStore,
  type ListChange,
  type ListDeps,
  type ListItem,
  type ListOp,
  type ListState,
} from "@/lib/list-store"
import { newId } from "@/lib/shopping-ops"

/** How often a list is refreshed while the app is open. */
const REFRESH_MS = 30_000

/**
 * Sets up a list that works offline (see `lib/list-store.ts`) and gives back its provider and
 * hooks. Home inventory and contacts use it; a new list of this kind is one call.
 */
export function createSyncedList<T extends ListItem>(config: {
  /** Name used in the device storage key and in error messages. */
  name: string
  fetchItems: () => Promise<T[]>
  send: (op: ListOp<T>) => Promise<void>
  /** Items for the clickable demo, which has no server. */
  demoItems: () => T[]
}) {
  const Context = createContext<ListStore<T> | null>(null)

  function Provider({ children }: { children: ReactNode }) {
    const { demo, offline } = useAppState()
    const userId = useMyUserId()
    const store = useMemo(() => {
      const deps: ListDeps<T> = demo
        ? { initial: config.demoItems(), send: async () => {} }
        : {
            fetchItems: config.fetchItems,
            send: config.send,
            storage: (() => {
              const key = `idkjustfood.${config.name}.v1.${userId ?? "unknown"}`
              return {
                read: () => deviceStorage.read(key),
                write: (value: string) => deviceStorage.write(key, value),
              }
            })(),
          }
      return new ListStore<T>(deps)
    }, [demo, userId])

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

    return <Context value={store}>{children}</Context>
  }

  function useStore() {
    const store = useContext(Context)
    if (!store) {
      throw new Error(`use ${config.name} inside its provider`)
    }
    return store
  }

  /** The state: every item the person can see, what is waiting to be sent, and whether we are online. */
  function useItems(): ListState<T> {
    const store = useStore()
    return useSyncExternalStore(store.subscribe, store.getState, store.getState)
  }

  /** Changes. They take effect at once and are sent when possible. */
  function useActions() {
    const store = useStore()
    return useMemo(
      () => ({
        /** `householdId` null makes a personal item, a household id an item for that household. */
        add: (
          fields: Omit<T, "id" | "householdId" | "createdAt">,
          householdId: string | null
        ) =>
          store.dispatch({
            type: "add",
            item: { id: newId(), householdId, ...fields } as Omit<T, "createdAt">,
          }),
        edit: (id: string, change: ListChange<T>) =>
          store.dispatch({ type: "update", id, change }),
        remove: (id: string) => store.dispatch({ type: "remove", id }),
        sync: () => store.sync(),
      }),
      [store]
    )
  }

  return { Provider, useItems, useActions }
}
