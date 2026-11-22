import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { AppState, Platform } from "react-native"

import {
  addDays,
  todayString,
  type BillRepeat,
  type Currency,
  type ExpenseUpdate,
  type SavingsGoalUpdate,
  type BillUpdate,
} from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { deviceStorage } from "@/lib/device-storage"
import { useMyUserId } from "@/lib/households"
import {
  emptyMoney,
  type MoneyData,
  type MoneyOp,
} from "@/lib/money-ops"
import { MoneyStore, type MoneyDeps, type MoneyState } from "@/lib/money-store"
import { newId } from "@/lib/shopping-ops"

/** How often money is refreshed while the app is open. */
const REFRESH_MS = 30_000

async function send(op: MoneyOp) {
  switch (op.type) {
    case "setCurrency":
      await call(
        api.PUT("/api/money/settings", {
          body: { householdId: op.householdId, currency: op.currency },
        })
      )
      return
    case "addCategory":
      await call(
        api.POST("/api/money/categories", {
          body: { id: op.id, name: op.name, householdId: op.householdId },
        })
      )
      return
    case "renameCategory":
      await call(
        api.PATCH("/api/money/categories/{categoryId}", {
          params: { path: { categoryId: op.id } },
          body: { name: op.name },
        })
      )
      return
    case "removeCategory":
      await call(
        api.DELETE("/api/money/categories/{categoryId}", {
          params: { path: { categoryId: op.id } },
        })
      )
      return
    case "addExpense":
      await call(
        api.POST("/api/money/expenses", {
          body: {
            id: op.id,
            amountCents: op.amountCents,
            categoryId: op.categoryId,
            date: op.date,
            note: op.note,
            paidBy: op.paidBy,
            householdId: op.householdId,
          },
        })
      )
      return
    case "updateExpense":
      await call(
        api.PATCH("/api/money/expenses/{expenseId}", {
          params: { path: { expenseId: op.id } },
          body: op.change,
        })
      )
      return
    case "removeExpense":
      await call(
        api.DELETE("/api/money/expenses/{expenseId}", {
          params: { path: { expenseId: op.id } },
        })
      )
      return
    case "setBudget":
      await call(
        api.POST("/api/money/budgets", {
          body: {
            id: op.id,
            categoryId: op.categoryId,
            amountCents: op.amountCents,
            householdId: op.householdId,
          },
        })
      )
      return
    case "removeBudget":
      await call(
        api.DELETE("/api/money/budgets/{budgetId}", {
          params: { path: { budgetId: op.id } },
        })
      )
      return
    case "addBill":
      await call(
        api.POST("/api/money/bills", {
          body: {
            id: op.id,
            title: op.title,
            amountCents: op.amountCents,
            categoryId: op.categoryId ?? null,
            repeat: op.repeat,
            nextDue: op.nextDue,
            householdId: op.householdId,
          },
        })
      )
      return
    case "updateBill":
      await call(
        api.PATCH("/api/money/bills/{billId}", {
          params: { path: { billId: op.id } },
          body: op.change,
        })
      )
      return
    case "removeBill":
      await call(
        api.DELETE("/api/money/bills/{billId}", {
          params: { path: { billId: op.id } },
        })
      )
      return
    case "payBill":
      await call(
        api.POST("/api/money/bills/{billId}/pay", {
          params: { path: { billId: op.billId } },
          body: { expenseId: op.expenseId, date: op.date, paidBy: op.paidBy },
        })
      )
      return
    case "addGoal":
      await call(
        api.POST("/api/money/savings", {
          body: {
            id: op.id,
            name: op.name,
            targetCents: op.targetCents,
            targetDate: op.targetDate,
            householdId: op.householdId,
          },
        })
      )
      return
    case "updateGoal":
      await call(
        api.PATCH("/api/money/savings/{goalId}", {
          params: { path: { goalId: op.id } },
          body: op.change,
        })
      )
      return
    case "removeGoal":
      await call(
        api.DELETE("/api/money/savings/{goalId}", {
          params: { path: { goalId: op.id } },
        })
      )
      return
    case "addSavings":
      await call(
        api.POST("/api/money/savings/{goalId}/entries", {
          params: { path: { goalId: op.goalId } },
          body: { id: op.id, amountCents: op.amountCents, date: op.date },
        })
      )
      return
    case "removeSavings":
      await call(
        api.DELETE("/api/money/savings/entries/{entryId}", {
          params: { path: { entryId: op.id } },
        })
      )
      return
    case "updateReceipt":
      await call(
        api.PATCH("/api/money/receipts/{receiptId}", {
          params: { path: { receiptId: op.id } },
          body: op.change,
        })
      )
      return
    case "removeReceipt":
      await call(
        api.DELETE("/api/money/receipts/{receiptId}", {
          params: { path: { receiptId: op.id } },
        })
      )
      return
    case "receiptToExpense":
      await call(
        api.POST("/api/money/receipts/{receiptId}/expense", {
          params: { path: { receiptId: op.id } },
          body: {
            expenseId: op.expenseId,
            categoryId: op.categoryId,
            paidBy: op.paidBy,
            ...(op.date ? { date: op.date } : {}),
          },
        })
      )
      return
  }
}

function serverDeps(userId: string | undefined): MoneyDeps {
  const key = `idkjustfood.money.v1.${userId ?? "unknown"}`
  return {
    fetchData: async () => (await call(api.GET("/api/money"))) as MoneyData,
    send,
    storage: {
      read: () => deviceStorage.read(key),
      write: (value) => deviceStorage.write(key, value),
    },
  }
}

/** A few sample entries for the clickable demo, which has no server. */
function demoDeps(): MoneyDeps {
  const today = todayString()
  const me = "demo-user"
  const cat = (key: string) => ({ id: `demo-${key}`, key, name: null, householdId: null })
  const expense = (id: string, amountCents: number, key: string, daysAgo: number, note: string) => ({
    id,
    amountCents,
    categoryId: `demo-${key}`,
    date: addDays(today, -daysAgo),
    note,
    paidBy: me,
    billId: null,
    receiptId: null,
    householdId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  return {
    initial: {
      ...emptyMoney,
      settings: [{ householdId: null, currency: "EUR" }],
      categories: ["groceries", "eatingOut", "home", "transport", "health", "fun", "clothing", "gifts", "other"].map(cat),
      expenses: [
        expense("demo-e1", 4210, "groceries", 0, "Weekly shop"),
        expense("demo-e2", 1450, "eatingOut", 1, "Lunch"),
        expense("demo-e3", 2800, "transport", 2, "Train ticket"),
      ],
      budgets: [
        { id: "demo-b1", categoryId: null, amountCents: 120000, householdId: null },
        { id: "demo-b2", categoryId: "demo-groceries", amountCents: 30000, householdId: null },
      ],
      bills: [
        {
          id: "demo-rent",
          title: "Rent",
          amountCents: 90000,
          categoryId: "demo-home",
          repeat: "monthly" as BillRepeat,
          nextDue: addDays(today, 6),
          dayOfMonth: Number(addDays(today, 6).slice(8, 10)),
          householdId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      goals: [
        {
          id: "demo-trip",
          name: "Summer trip",
          targetCents: 150000,
          targetDate: null,
          householdId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      savingsEntries: [
        { id: "demo-s1", goalId: "demo-trip", amountCents: 40000, date: addDays(today, -10) },
      ],
    },
    send: async () => {},
  }
}

const StoreContext = createContext<MoneyStore | null>(null)

/**
 * Keeps the money of the signed-in person: shows what is saved on this device at once, and syncs
 * with the server whenever it can.
 */
export function MoneyProvider({ children }: { children: ReactNode }) {
  const { demo, offline } = useAppState()
  const userId = useMyUserId()
  const store = useMemo(
    () => new MoneyStore(demo ? demoDeps() : serverDeps(userId)),
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
  if (!store) throw new Error("useMoney must be used inside MoneyProvider")
  return store
}

/** The state of money: everything the person can see, what is waiting to be sent, and whether we are online. */
export function useMoneyState(): MoneyState {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

/** Changes to money. They take effect at once and are sent when possible. */
export function useMoneyActions() {
  const store = useStore()
  const me = useMyUserId() ?? ""
  return useMemo(() => {
    const d = (op: MoneyOp) => store.dispatch(op)
    return {
      /** The person who adds something is the one who paid, unless another member is chosen. */
      addExpense: (
        e: { amountCents: number; categoryId: string | null; date: string; note: string; paidBy?: string },
        householdId: string | null
      ) =>
        d({ type: "addExpense", id: newId(), ...e, paidBy: e.paidBy ?? me, householdId }),
      editExpense: (id: string, change: ExpenseUpdate) =>
        d({ type: "updateExpense", id, change }),
      removeExpense: (id: string) => d({ type: "removeExpense", id }),

      setCurrency: (householdId: string | null, currency: Currency) =>
        d({ type: "setCurrency", householdId, currency }),
      addCategory: (name: string, householdId: string | null) =>
        d({ type: "addCategory", id: newId(), name, householdId }),
      renameCategory: (id: string, name: string) =>
        d({ type: "renameCategory", id, name }),
      removeCategory: (id: string) => d({ type: "removeCategory", id }),

      /** Sets the monthly budget of a category (or the total, with null). */
      setBudget: (
        categoryId: string | null,
        amountCents: number,
        householdId: string | null,
        existingId?: string
      ) =>
        d({
          type: "setBudget",
          // Setting a budget that exists keeps its id, so a later delete finds it on the server.
          id: existingId ?? newId(),
          categoryId,
          amountCents,
          householdId,
        }),
      removeBudget: (id: string) => d({ type: "removeBudget", id }),

      addBill: (
        bill: { title: string; amountCents: number; categoryId: string | null; repeat: BillRepeat; nextDue: string },
        householdId: string | null
      ) => d({ type: "addBill", id: newId(), ...bill, householdId }),
      editBill: (id: string, change: BillUpdate) => d({ type: "updateBill", id, change }),
      removeBill: (id: string) => d({ type: "removeBill", id }),
      payBill: (billId: string, date: string) =>
        d({ type: "payBill", billId, expenseId: newId(), date, paidBy: me }),

      addGoal: (
        goal: { name: string; targetCents: number; targetDate: string | null },
        householdId: string | null
      ) => d({ type: "addGoal", id: newId(), ...goal, householdId }),
      editGoal: (id: string, change: SavingsGoalUpdate) =>
        d({ type: "updateGoal", id, change }),
      removeGoal: (id: string) => d({ type: "removeGoal", id }),
      /** Positive puts money in, negative takes it out. */
      saveToGoal: (goalId: string, amountCents: number, date: string) =>
        d({ type: "addSavings", id: newId(), goalId, amountCents, date }),
      removeSavings: (id: string) => d({ type: "removeSavings", id }),

      editReceipt: (
        id: string,
        change: { shop?: string | null; date?: string | null; totalCents?: number | null }
      ) => d({ type: "updateReceipt", id, change }),
      removeReceipt: (id: string) => d({ type: "removeReceipt", id }),
      /** Adds an expense with the receipt's total and date. Needs both (the date may be given here). */
      receiptToExpense: (
        id: string,
        options: { categoryId: string | null; date: string | null }
      ) =>
        d({
          type: "receiptToExpense",
          id,
          expenseId: newId(),
          categoryId: options.categoryId,
          paidBy: me,
          date: options.date,
        }),

      dispatch: d,
      sync: () => store.sync(),
      me,
    }
  }, [store, me])
}
