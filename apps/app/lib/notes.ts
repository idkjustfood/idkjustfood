import type { Note } from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import type { ListOp } from "@/lib/list-store"
import { createSyncedList } from "@/lib/synced-list"

export type { Note }

async function send(op: ListOp<Note>) {
  switch (op.type) {
    case "add":
      await call(api.POST("/api/notes", { body: op.item }))
      return
    case "update":
      await call(
        api.PATCH("/api/notes/{noteId}", {
          params: { path: { noteId: op.id } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/notes/{noteId}", {
          params: { path: { noteId: op.id } },
        })
      )
      return
  }
}

const base = { householdId: null }

const notes = createSyncedList<Note>({
  name: "notes",
  fetchItems: async () => (await call(api.GET("/api/notes"))).notes,
  send,
  demoItems: () => [
    { id: "demo-wifi", title: "Wi-Fi", body: "Guest network: sunny-kitchen\nPassword on the fridge.", createdAt: "2026-01-02T00:00:00.000Z", ...base },
    { id: "demo-gift", title: "", body: "Ask Grandma about the blue vase.", createdAt: "2026-01-01T00:00:00.000Z", ...base },
  ],
})

export const NoteProvider = notes.Provider
export const useNoteState = notes.useItems
export const useNoteActions = notes.useActions
