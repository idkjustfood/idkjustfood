import type { InventoryItem } from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import type { ListOp } from "@/lib/list-store"
import { createSyncedList } from "@/lib/synced-list"

export type { InventoryItem }

async function send(op: ListOp<InventoryItem>) {
  switch (op.type) {
    case "add":
      await call(api.POST("/api/inventory", { body: op.item }))
      return
    case "update":
      await call(
        api.PATCH("/api/inventory/{itemId}", {
          params: { path: { itemId: op.id } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/inventory/{itemId}", {
          params: { path: { itemId: op.id } },
        })
      )
      return
  }
}

const base = { householdId: null, note: "", createdAt: "2026-01-01T00:00:00.000Z" }

const inventory = createSyncedList<InventoryItem>({
  name: "inventory",
  fetchItems: async () => (await call(api.GET("/api/inventory"))).items,
  send,
  demoItems: () => [
    { id: "demo-candles", name: "Candles", place: "Kitchen drawer", quantity: 6, ...base },
    { id: "demo-tools", name: "Drill", place: "Garage, red box", quantity: 1, ...base },
    { id: "demo-bulbs", name: "Light bulbs", place: "", quantity: 4, ...base },
  ],
})

export const InventoryProvider = inventory.Provider
export const useInventoryState = inventory.useItems
export const useInventoryActions = inventory.useActions
