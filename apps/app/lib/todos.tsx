import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { AppState, Platform } from "react-native"

import { addDays, todayString, type Task } from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { deviceStorage } from "@/lib/device-storage"
import { useMyUserId } from "@/lib/households"
import { newId } from "@/lib/shopping-ops"
import type { TodoOp } from "@/lib/todo-ops"
import { TodoStore, type TodoDeps, type TodoState } from "@/lib/todo-store"

export type { Task }

/** How often the tasks are refreshed while the app is open. */
const REFRESH_MS = 30_000

async function send(op: TodoOp) {
  switch (op.type) {
    case "add":
      await call(
        api.POST("/api/tasks", {
          body: {
            id: op.id,
            title: op.title,
            note: op.note,
            dueDate: op.dueDate,
            householdId: op.householdId,
            assigneeId: op.assigneeId,
          },
        })
      )
      return
    case "update":
      await call(
        api.PATCH("/api/tasks/{taskId}", {
          params: { path: { taskId: op.taskId } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/tasks/{taskId}", {
          params: { path: { taskId: op.taskId } },
        })
      )
      return
  }
}

function serverDeps(userId: string | undefined): TodoDeps {
  const key = `idkjustfood.todos.v1.${userId ?? "unknown"}`
  return {
    fetchTasks: async () => (await call(api.GET("/api/tasks"))).tasks,
    send,
    storage: {
      read: () => deviceStorage.read(key),
      write: (value) => deviceStorage.write(key, value),
    },
  }
}

/** A few sample tasks for the clickable demo, which has no server. */
function demoDeps(): TodoDeps {
  const today = todayString()
  const base = {
    note: "",
    householdId: null,
    assigneeId: null,
    doneAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
  return {
    initial: [
      { id: "demo-plumber", title: "Call the plumber", dueDate: today, ...base },
      { id: "demo-gift", title: "Buy a birthday gift", dueDate: addDays(today, 3), ...base },
      { id: "demo-photos", title: "Sort the holiday photos", dueDate: null, ...base },
    ],
    send: async () => {},
  }
}

const StoreContext = createContext<TodoStore | null>(null)

/**
 * Keeps the to-do tasks for the signed-in person: shows what is saved on this device at once,
 * and syncs with the server whenever it can.
 */
export function TodoProvider({ children }: { children: ReactNode }) {
  const { demo, offline } = useAppState()
  const userId = useMyUserId()
  const store = useMemo(
    () => new TodoStore(demo ? demoDeps() : serverDeps(userId)),
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
  if (!store) throw new Error("useTodos must be used inside TodoProvider")
  return store
}

/**
 * The state of the to-do tasks: every task the person can see (personal ones and the ones of all
 * their households), what is waiting to be sent, and whether we are online.
 */
export function useTodoState(): TodoState {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

/** Changes to the tasks. They take effect at once and are sent when possible. */
export function useTodoActions() {
  const store = useStore()
  return useMemo(
    () => ({
      /** `householdId` null makes a personal task, a household id a task for that household. */
      add: (
        task: { title: string; note: string; dueDate: string | null },
        householdId: string | null,
        assigneeId: string | null
      ) =>
        store.dispatch({
          type: "add",
          id: newId(),
          ...task,
          householdId,
          assigneeId,
        }),
      edit: (
        taskId: string,
        change: {
          title: string
          note: string
          dueDate: string | null
          assigneeId: string | null
        }
      ) => store.dispatch({ type: "update", taskId, change }),
      setDone: (taskId: string, done: boolean) =>
        store.dispatch({ type: "update", taskId, change: { done } }),
      remove: (taskId: string) => store.dispatch({ type: "remove", taskId }),
      sync: () => store.sync(),
    }),
    [store]
  )
}
