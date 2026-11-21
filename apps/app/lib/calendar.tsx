import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { AppState, Platform } from "react-native"

import { addDays, todayString, type CalendarColor, type CalendarEntry } from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import type { CalendarOp } from "@/lib/calendar-ops"
import {
  CalendarStore,
  type CalendarDeps,
  type CalendarState,
} from "@/lib/calendar-store"
import { deviceStorage } from "@/lib/device-storage"
import { useMyUserId } from "@/lib/households"
import { newId } from "@/lib/shopping-ops"

export type { CalendarEntry }

/** How often the calendar is refreshed while the app is open. */
const REFRESH_MS = 30_000

async function send(op: CalendarOp) {
  switch (op.type) {
    case "add":
      await call(
        api.POST("/api/calendar", {
          body: {
            id: op.id,
            title: op.title,
            color: op.color,
            date: op.date,
            householdId: op.householdId,
          },
        })
      )
      return
    case "update":
      await call(
        api.PATCH("/api/calendar/{entryId}", {
          params: { path: { entryId: op.entryId } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/calendar/{entryId}", {
          params: { path: { entryId: op.entryId } },
        })
      )
      return
  }
}

function serverDeps(userId: string | undefined): CalendarDeps {
  const key = `idkjustfood.calendar.v1.${userId ?? "unknown"}`
  return {
    fetchEntries: async () => (await call(api.GET("/api/calendar"))).entries,
    send,
    storage: {
      read: () => deviceStorage.read(key),
      write: (value) => deviceStorage.write(key, value),
    },
  }
}

/** A few sample entries for the clickable demo, which has no server. */
function demoDeps(): CalendarDeps {
  const today = todayString()
  const base = { householdId: null, createdAt: "2026-01-01T00:00:00.000Z" }
  return {
    initial: [
      { id: "demo-dentist", title: "Dentist", color: "sky", date: today, ...base },
      { id: "demo-birthday", title: "Anna's birthday", color: "rose", date: addDays(today, 1), ...base },
      { id: "demo-market", title: "Farmers market", color: "sage", date: addDays(today, 4), ...base },
    ],
    send: async () => {},
  }
}

const StoreContext = createContext<CalendarStore | null>(null)

/**
 * Keeps the calendar for the signed-in person: shows what is saved on this device at once, and
 * syncs with the server whenever it can.
 */
export function CalendarProvider({ children }: { children: ReactNode }) {
  const { demo, offline } = useAppState()
  const userId = useMyUserId()
  const store = useMemo(
    () => new CalendarStore(demo ? demoDeps() : serverDeps(userId)),
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
  if (!store) throw new Error("useCalendar must be used inside CalendarProvider")
  return store
}

/**
 * The state of the calendar: every entry the person can see (personal ones and the ones of all
 * their households), what is waiting to be sent, and whether we are online.
 */
export function useCalendarState(): CalendarState {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

/** Changes to the calendar. They take effect at once and are sent when possible. */
export function useCalendarActions() {
  const store = useStore()
  return useMemo(
    () => ({
      /** `householdId` null makes a personal entry, a household id an entry for that household. */
      add: (
        entry: { title: string; color: CalendarColor; date: string },
        householdId: string | null
      ) => store.dispatch({ type: "add", id: newId(), ...entry, householdId }),
      edit: (
        entryId: string,
        change: { title: string; color: CalendarColor; date: string }
      ) => store.dispatch({ type: "update", entryId, change }),
      remove: (entryId: string) => store.dispatch({ type: "remove", entryId }),
      sync: () => store.sync(),
    }),
    [store]
  )
}
