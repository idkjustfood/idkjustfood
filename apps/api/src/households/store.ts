import { randomBytes } from "node:crypto"
import { and, asc, eq, gt, lte } from "drizzle-orm"

import { schema, type Database } from "@workspace/database"

const { householdInvite, member, organization, user } = schema

/** How long an invite link stays valid. */
export const INVITE_TTL_DAYS = 7

/** Better Auth stores several roles as a comma-separated list. */
export function hasRole(role: string, wanted: string) {
  return role.split(",").some((r) => r.trim() === wanted)
}

/** Database queries for households (Better Auth organizations) and invite links. */
export function householdStore(db: Database) {
  return {
    /** The households a user belongs to, with their role in each. */
    listForUser(userId: string) {
      return db
        .select({
          id: organization.id,
          name: organization.name,
          role: member.role,
        })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(member.userId, userId))
        .orderBy(asc(organization.createdAt))
    },

    /** The user's membership in a household, or undefined if they are not in it. */
    async membership(householdId: string, userId: string) {
      const [row] = await db
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(
          and(eq(member.organizationId, householdId), eq(member.userId, userId))
        )
      return row
    },

    listMembers(householdId: string) {
      return db
        .select({
          id: member.id,
          userId: member.userId,
          name: user.name,
          email: user.email,
          role: member.role,
          joinedAt: member.createdAt,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, householdId))
        .orderBy(asc(member.createdAt))
    },

    async findMember(householdId: string, memberId: string) {
      const [row] = await db
        .select({ id: member.id, userId: member.userId, role: member.role })
        .from(member)
        .where(
          and(eq(member.id, memberId), eq(member.organizationId, householdId))
        )
      return row
    },

    async createInvite(householdId: string, inviterId: string) {
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000)
      const [row] = await db
        .insert(householdInvite)
        .values({
          // The id is the secret in the link, so it must be hard to guess.
          id: randomBytes(24).toString("base64url"),
          organizationId: householdId,
          inviterId,
          expiresAt,
        })
        .returning()
      return row!
    },

    /** Pending invites of a household. Expired ones are removed on the way. */
    async listInvites(householdId: string) {
      await db
        .delete(householdInvite)
        .where(
          and(
            eq(householdInvite.organizationId, householdId),
            lte(householdInvite.expiresAt, new Date())
          )
        )
      return db
        .select({
          id: householdInvite.id,
          inviterName: user.name,
          createdAt: householdInvite.createdAt,
          expiresAt: householdInvite.expiresAt,
        })
        .from(householdInvite)
        .innerJoin(user, eq(householdInvite.inviterId, user.id))
        .where(eq(householdInvite.organizationId, householdId))
        .orderBy(asc(householdInvite.createdAt))
    },

    /** A valid (not expired) invite with its household, or undefined. */
    async findInvite(inviteId: string) {
      const [row] = await db
        .select({
          id: householdInvite.id,
          householdId: organization.id,
          householdName: organization.name,
          inviterName: user.name,
          expiresAt: householdInvite.expiresAt,
        })
        .from(householdInvite)
        .innerJoin(
          organization,
          eq(householdInvite.organizationId, organization.id)
        )
        .innerJoin(user, eq(householdInvite.inviterId, user.id))
        .where(
          and(
            eq(householdInvite.id, inviteId),
            gt(householdInvite.expiresAt, new Date())
          )
        )
      return row
    },

    /** Deletes an invite. Returns false if there was none. */
    async deleteInvite(inviteId: string, householdId?: string) {
      const rows = await db
        .delete(householdInvite)
        .where(
          householdId
            ? and(
                eq(householdInvite.id, inviteId),
                eq(householdInvite.organizationId, householdId)
              )
            : eq(householdInvite.id, inviteId)
        )
        .returning({ id: householdInvite.id })
      return rows.length > 0
    },
  }
}

export type HouseholdStore = ReturnType<typeof householdStore>
