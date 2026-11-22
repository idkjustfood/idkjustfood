import type { Wish, WishPerson } from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import type { ListOp } from "@/lib/list-store"
import { createSyncedList } from "@/lib/synced-list"

export type { Wish, WishPerson }

async function sendPerson(op: ListOp<WishPerson>) {
  switch (op.type) {
    case "add":
      await call(api.POST("/api/wish-people", { body: op.item }))
      return
    case "update":
      await call(
        api.PATCH("/api/wish-people/{personId}", {
          params: { path: { personId: op.id } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/wish-people/{personId}", {
          params: { path: { personId: op.id } },
        })
      )
      return
  }
}

async function sendWish(op: ListOp<Wish>) {
  switch (op.type) {
    case "add":
      await call(api.POST("/api/wishes", { body: op.item }))
      return
    case "update":
      await call(
        api.PATCH("/api/wishes/{wishId}", {
          params: { path: { wishId: op.id } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/wishes/{wishId}", {
          params: { path: { wishId: op.id } },
        })
      )
      return
  }
}

const at = "2026-01-01T00:00:00.000Z"

const people = createSyncedList<WishPerson>({
  name: "wish-people",
  fetchItems: async () => (await call(api.GET("/api/wish-people"))).people,
  send: sendPerson,
  demoItems: () => [
    { id: "demo-mia", name: "Mia", householdId: null, createdAt: at },
    { id: "demo-grandpa", name: "Grandpa", householdId: null, createdAt: at },
  ],
})

const wishes = createSyncedList<Wish>({
  name: "wishes",
  fetchItems: async () => (await call(api.GET("/api/wishes"))).wishes,
  send: sendWish,
  demoItems: () => {
    const base = { note: "", link: "", done: false, householdId: null, createdAt: at }
    return [
      { id: "demo-lego", title: "Lego set", personId: "demo-mia", ...base },
      { id: "demo-book", title: "Picture book about dinosaurs", personId: "demo-mia", ...base },
      { id: "demo-socks", title: "Warm socks", personId: "demo-grandpa", ...base },
      { id: "demo-plant", title: "A big plant for the hall", personId: null, ...base },
    ]
  },
})

export const WishPersonProvider = people.Provider
export const useWishPersonState = people.useItems
export const useWishPersonActions = people.useActions
export const WishProvider = wishes.Provider
export const useWishState = wishes.useItems
export const useWishActions = wishes.useActions
