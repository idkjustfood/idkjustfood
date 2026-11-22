import type { Contact } from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import type { ListOp } from "@/lib/list-store"
import { createSyncedList } from "@/lib/synced-list"

export type { Contact }

async function send(op: ListOp<Contact>) {
  switch (op.type) {
    case "add":
      await call(api.POST("/api/contacts", { body: op.item }))
      return
    case "update":
      await call(
        api.PATCH("/api/contacts/{contactId}", {
          params: { path: { contactId: op.id } },
          body: op.change,
        })
      )
      return
    case "remove":
      await call(
        api.DELETE("/api/contacts/{contactId}", {
          params: { path: { contactId: op.id } },
        })
      )
      return
  }
}

const base = { householdId: null, note: "", createdAt: "2026-01-01T00:00:00.000Z" }

const contacts = createSyncedList<Contact>({
  name: "contacts",
  fetchItems: async () => (await call(api.GET("/api/contacts"))).contacts,
  send,
  demoItems: () => [
    { id: "demo-plumber", name: "Max Miller", role: "Plumber", phone: "+49 170 1234567", email: "", ...base },
    { id: "demo-doctor", name: "Dr. Weber", role: "Family doctor", phone: "+49 30 987654", email: "praxis@example.com", ...base },
    { id: "demo-school", name: "Primary school", role: "School office", phone: "", email: "office@example.com", ...base },
  ],
})

export const ContactProvider = contacts.Provider
export const useContactState = contacts.useItems
export const useContactActions = contacts.useActions
