import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { AppState, Platform } from "react-native"

import {
  localDay,
  type Chore,
  type ChoreDay,
  type ChoreKind,
} from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { msUntilNextDay } from "@/lib/chore-view"
import type { ChoreOp } from "@/lib/chore-ops"
import { ChoreStore, type ChoreDeps, type ChoreState } from "@/lib/chore-store"
import { deviceStorage } from "@/lib/device-storage"
import { useMyUserId } from "@/lib/households"
import { newId } from "@/lib/shopping-ops"

export type { Chore }

/** How often the chores are refreshed while the app is open. */
const REFRESH_MS = 30_000

async function send(op: ChoreOp) {
  switch (op.type) {
    case "add":
      await call(
        api.POST("/api/chores", {
          body: {
            id: op.id,
            name: op.name,
            kind: op.kind,
            intervalDays: op.intervalDays,
            householdId: op.householdId,
          },
        })
      )
      return
    case "update":
      await call(
        api.PATCH("/api/chores/{choreId}", {
          params: { path: { choreId: op.choreId } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/chores/{choreId}", {
          params: { path: { choreId: op.choreId } },
        })
      )
      return
  }
}

function serverDeps(userId: string | undefined): ChoreDeps {
  const key = `idkjustfood.chores.v1.${userId ?? "unknown"}`
  return {
    fetchChores: async () => (await call(api.GET("/api/chores"))).chores,
    send,
    storage: {
      read: () => deviceStorage.read(key),
      write: (value) => deviceStorage.write(key, value),
    },
  }
}

/** A few sample chores for the clickable demo, which has no server. */
function demoDeps(): ChoreDeps {
  const base = {
    kind: "chore" as const,
    householdId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
  const daysAgo = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return localDay(date)
  }
  return {
    initial: [
      { id: "demo-towels", name: "Switch towels", intervalDays: 3, lastDoneOn: daysAgo(3), ...base },
      { id: "demo-sheets", name: "Change bed sheets", intervalDays: 14, lastDoneOn: daysAgo(5), ...base },
      { id: "demo-bins", name: "Take out the bins", intervalDays: 7, lastDoneOn: null, ...base },
      { id: "demo-filter", name: "Clean the dryer filter", intervalDays: 90, lastDoneOn: null, ...base, kind: "maintenance" },
      { id: "demo-ficus", name: "Water the ficus", intervalDays: 3, lastDoneOn: daysAgo(3), ...base, kind: "plant" },
      { id: "demo-litter", name: "Clean the litter box", intervalDays: 2, lastDoneOn: daysAgo(1), ...base, kind: "pet" },
    ],
    send: async () => {},
  }
}

const StoreContext = createContext<ChoreStore | null>(null)

/**
 * Keeps the chores for the signed-in person: shows what is saved on this device at once, and
 * syncs with the server whenever it can.
 */
export function ChoreProvider({ children }: { children: ReactNode }) {
  const { demo, offline } = useAppState()
  const userId = useMyUserId()
  const store = useMemo(
    () => new ChoreStore(demo ? demoDeps() : serverDeps(userId)),
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
  if (!store) throw new Error("useChores must be used inside ChoreProvider")
  return store
}

/** The state of the chores: what to show, what is waiting to be sent, and whether we are online. */
export function useChoreState(): ChoreState {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

/** Changes to chores. They take effect at once and are sent when possible. */
export function useChoreActions() {
  const store = useStore()
  return useMemo(
    () => ({
      add: (
        name: string,
        intervalDays: number,
        householdId: string | null,
        kind: ChoreKind = "chore"
      ) =>
        store.dispatch({
          type: "add",
          id: newId(),
          name,
          kind,
          intervalDays,
          householdId,
        }),
      /** Checks a chore off today (the date on this device). */
      check: (choreId: string, today: ChoreDay = localDay()) =>
        store.dispatch({
          type: "update",
          choreId,
          change: { lastDoneOn: today },
        }),
      /** Takes a check back: the chore is due again. */
      undo: (choreId: string) =>
        store.dispatch({
          type: "update",
          choreId,
          change: { lastDoneOn: null },
        }),
      edit: (choreId: string, change: { name: string; intervalDays: number }) =>
        store.dispatch({ type: "update", choreId, change }),
      remove: (choreId: string) => store.dispatch({ type: "remove", choreId }),
      sync: () => store.sync(),
    }),
    [store]
  )
}

/**
 * Today's date on this device. It changes at 00:00 and when the app comes back to the front,
 * so a chore shows up again the moment its day starts, even if the app stayed open.
 */
export function useToday(): ChoreDay {
  const [today, setToday] = useState(() => localDay())
  useEffect(() => {
    const refresh = () => setToday(localDay())
    // A little after midnight, so the clock has certainly passed it.
    const timer = setTimeout(refresh, msUntilNextDay() + 1000)
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh()
    })
    return () => {
      clearTimeout(timer)
      appState.remove()
    }
  }, [today])
  return today
}
