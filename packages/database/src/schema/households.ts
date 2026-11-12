import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { organization, user } from "./auth.js"

/**
 * A link that lets anyone who has it join a household (a Better Auth organization).
 * The id is the secret part of the link. An invite works once: accepting, declining
 * or cancelling it deletes the row, so the link stops working.
 */
export const householdInvite = pgTable(
  "household_invite",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("household_invite_organizationId_idx").on(table.organizationId),
  ]
)
