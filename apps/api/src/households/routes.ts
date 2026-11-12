import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { isAPIError } from "better-auth/api"
import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import type { Database } from "@workspace/database"

import type { Auth, AuthEnv } from "../auth.js"
import { requireSession, type AuthVariables } from "../session.js"
import { hasRole, householdStore } from "./store.js"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ErrorSchema = z
  .object({ error: z.string().openapi({ example: "Household not found" }) })
  .openapi("Error")

const RoleSchema = z
  .string()
  .openapi({ description: '"owner" or "member"', example: "member" })

const HouseholdSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    role: RoleSchema.openapi({ description: "Your role in this household" }),
  })
  .openapi("Household")

const MemberSchema = z
  .object({
    id: z.string().openapi({ description: "Membership id (not the user id)" }),
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    role: RoleSchema,
    joinedAt: z.string().openapi({ format: "date-time" }),
  })
  .openapi("Member")

const InviteSchema = z
  .object({
    id: z
      .string()
      .openapi({ description: "Secret code of the invite link. Owners only." }),
    url: z
      .string()
      .nullable()
      .openapi({
        description:
          "Full invite link, built from the server's APP_URL. Null when APP_URL is not set; " +
          "clients then build the link themselves as <app>/invite/<id>.",
      }),
    inviterName: z.string(),
    createdAt: z.string().openapi({ format: "date-time" }),
    expiresAt: z.string().openapi({ format: "date-time" }),
  })
  .openapi("Invite")

const InvitePreviewSchema = z
  .object({
    id: z.string(),
    householdId: z.string(),
    householdName: z.string(),
    inviterName: z.string(),
    expiresAt: z.string().openapi({ format: "date-time" }),
    alreadyMember: z
      .boolean()
      .openapi({ description: "You are already in this household" }),
  })
  .openapi("InvitePreview")

const HouseholdParams = z.object({
  householdId: z
    .string()
    .openapi({ param: { name: "householdId", in: "path" } }),
})
const MemberParams = HouseholdParams.extend({
  memberId: z.string().openapi({ param: { name: "memberId", in: "path" } }),
})
const HouseholdInviteParams = HouseholdParams.extend({
  inviteId: z.string().openapi({ param: { name: "inviteId", in: "path" } }),
})
const InviteParams = z.object({
  inviteId: z.string().openapi({ param: { name: "inviteId", in: "path" } }),
})

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
})
const error = (description: string) => json(ErrorSchema, description)
const noContent = { description: "Done" }

const signedIn = { 401: error("Not signed in") }
const inHousehold = {
  ...signedIn,
  404: error("Household not found, or you are not a member"),
}
const ownerOnly = {
  ...inHousehold,
  403: error("Only owners of the household can do this"),
}

const tags = ["Households"]
const security = [{ cookieAuth: [] }]

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const listHouseholds = createRoute({
  method: "get",
  path: "/households",
  tags,
  security,
  summary: "List the households you belong to",
  responses: {
    200: json(z.object({ households: z.array(HouseholdSchema) }), "Households"),
    ...signedIn,
  },
})

const createHousehold = createRoute({
  method: "post",
  path: "/households",
  tags,
  security,
  summary: "Create a household. You become its owner.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ name: z.string().trim().min(1).max(80) }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: json(z.object({ household: HouseholdSchema }), "Created"),
    400: error("Invalid name"),
    ...signedIn,
  },
})

const listMembers = createRoute({
  method: "get",
  path: "/households/{householdId}/members",
  tags,
  security,
  summary: "List the members of a household",
  request: { params: HouseholdParams },
  responses: {
    200: json(z.object({ members: z.array(MemberSchema) }), "Members"),
    ...inHousehold,
  },
})

const removeMember = createRoute({
  method: "delete",
  path: "/households/{householdId}/members/{memberId}",
  tags,
  security,
  summary: "Remove a member from a household (owners only)",
  request: { params: MemberParams },
  responses: {
    204: noContent,
    400: error("You can't remove yourself or another owner"),
    ...ownerOnly,
  },
})

const leaveHousehold = createRoute({
  method: "post",
  path: "/households/{householdId}/leave",
  tags,
  security,
  summary: "Leave a household",
  request: { params: HouseholdParams },
  responses: {
    204: noContent,
    400: error("The only owner can't leave"),
    ...inHousehold,
  },
})

const listInvites = createRoute({
  method: "get",
  path: "/households/{householdId}/invites",
  tags,
  security,
  summary: "List pending invite links (owners only)",
  request: { params: HouseholdParams },
  responses: {
    200: json(z.object({ invites: z.array(InviteSchema) }), "Pending invites"),
    ...ownerOnly,
  },
})

const createInvite = createRoute({
  method: "post",
  path: "/households/{householdId}/invites",
  tags,
  security,
  summary: "Create an invite link (owners only)",
  description:
    "Anyone who opens the link and accepts joins the household as a member. " +
    "The link works once and expires after 7 days. No email service is needed.",
  request: { params: HouseholdParams },
  responses: {
    201: json(z.object({ invite: InviteSchema }), "Created"),
    ...ownerOnly,
  },
})

const cancelInvite = createRoute({
  method: "delete",
  path: "/households/{householdId}/invites/{inviteId}",
  tags,
  security,
  summary: "Cancel an invite link (owners only). The link stops working.",
  request: { params: HouseholdInviteParams },
  responses: {
    204: noContent,
    ...ownerOnly,
  },
})

const inviteGone = {
  ...signedIn,
  404: error("The invite doesn't exist, was used or cancelled, or has expired"),
}

const getInvite = createRoute({
  method: "get",
  path: "/invites/{inviteId}",
  tags,
  security,
  summary: "Look at an invite before accepting or declining it",
  request: { params: InviteParams },
  responses: {
    200: json(z.object({ invite: InvitePreviewSchema }), "Invite"),
    ...inviteGone,
  },
})

const acceptInvite = createRoute({
  method: "post",
  path: "/invites/{inviteId}/accept",
  tags,
  security,
  summary: "Accept an invite and join the household",
  request: { params: InviteParams },
  responses: {
    200: json(z.object({ household: HouseholdSchema }), "Joined"),
    409: error("You are already a member of this household"),
    ...inviteGone,
  },
})

const declineInvite = createRoute({
  method: "post",
  path: "/invites/{inviteId}/decline",
  tags,
  security,
  summary: "Decline an invite. The link stops working.",
  request: { params: InviteParams },
  responses: {
    204: noContent,
    ...inviteGone,
  },
})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type Env = { Variables: AuthVariables }

const iso = (date: Date) => date.toISOString()

/** Household, member and invite endpoints. Mounted under /api. */
export function householdRoutes(db: Database, auth: Auth, env: AuthEnv) {
  const store = householdStore(db)
  const appUrl = env.APP_URL?.replace(/\/+$/, "")
  const inviteUrl = (id: string) => (appUrl ? `${appUrl}/invite/${id}` : null)

  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = issue?.path.join(".")
        return c.json(
          { error: field ? `${field}: ${issue?.message}` : "Invalid request" },
          400
        )
      }
    },
  })

  for (const path of ["/households", "/households/*", "/invites/*"]) {
    app.use(path, requireSession(auth))
  }

  // Better Auth errors (for example "already a member") keep their status code.
  app.onError((err, c) => {
    if (isAPIError(err)) {
      const status = (err.statusCode || 500) as ContentfulStatusCode
      return c.json({ error: err.body?.message ?? err.message }, status)
    }
    throw err
  })

  /**
   * Loads the caller's membership, or answers 404. Every route that shows
   * household data goes through this, so people who left or were removed
   * lose access right away.
   */
  async function access(c: Context<Env>, householdId: string) {
    const membership = await store.membership(householdId, c.get("user").id)
    if (!membership) {
      return {
        denied: c.json({ error: "Household not found" }, 404),
      } as const
    }
    return { membership } as const
  }

  /** Like `access`, and answers 403 when the caller is not an owner. */
  async function ownerAccess(c: Context<Env>, householdId: string) {
    const result = await access(c, householdId)
    if (result.denied) return result
    if (!hasRole(result.membership.role, "owner")) {
      return {
        denied: c.json(
          { error: "Only owners of the household can do this" },
          403
        ),
        membership: undefined,
      } as const
    }
    return result
  }

  app.openapi(listHouseholds, async (c) => {
    const households = await store.listForUser(c.get("user").id)
    return c.json({ households }, 200)
  })

  app.openapi(createHousehold, async (c) => {
    const { name } = c.req.valid("json")
    const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`
    const org = await auth.api.createOrganization({
      body: { name, slug },
      headers: c.req.raw.headers,
    })
    return c.json(
      { household: { id: org!.id, name: org!.name, role: "owner" } },
      201
    )
  })

  app.openapi(listMembers, async (c) => {
    const { householdId } = c.req.valid("param")
    const { denied } = await access(c, householdId)
    if (denied) return denied
    const members = await store.listMembers(householdId)
    return c.json(
      { members: members.map((m) => ({ ...m, joinedAt: iso(m.joinedAt) })) },
      200
    )
  })

  app.openapi(removeMember, async (c) => {
    const { householdId, memberId } = c.req.valid("param")
    const { denied, membership } = await ownerAccess(c, householdId)
    if (denied) return denied
    const target = await store.findMember(householdId, memberId)
    if (!target) return c.json({ error: "Member not found" }, 404)
    if (target.id === membership.id) {
      return c.json(
        { error: "You can't remove yourself. Leave the household instead." },
        400
      )
    }
    if (hasRole(target.role, "owner")) {
      return c.json({ error: "Owners can't be removed" }, 400)
    }
    await auth.api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: householdId },
      headers: c.req.raw.headers,
    })
    return c.body(null, 204)
  })

  app.openapi(leaveHousehold, async (c) => {
    const { householdId } = c.req.valid("param")
    const { denied, membership } = await access(c, householdId)
    if (denied) return denied
    if (hasRole(membership.role, "owner")) {
      const owners = (await store.listMembers(householdId)).filter((m) =>
        hasRole(m.role, "owner")
      )
      if (owners.length <= 1) {
        return c.json(
          {
            error:
              "You are the only owner, so you can't leave. Remove the other members first, " +
              "or make someone else an owner.",
          },
          400
        )
      }
    }
    await auth.api.leaveOrganization({
      body: { organizationId: householdId },
      headers: c.req.raw.headers,
    })
    return c.body(null, 204)
  })

  app.openapi(listInvites, async (c) => {
    const { householdId } = c.req.valid("param")
    const { denied } = await ownerAccess(c, householdId)
    if (denied) return denied
    const invites = await store.listInvites(householdId)
    return c.json(
      {
        invites: invites.map((i) => ({
          ...i,
          url: inviteUrl(i.id),
          createdAt: iso(i.createdAt),
          expiresAt: iso(i.expiresAt),
        })),
      },
      200
    )
  })

  app.openapi(createInvite, async (c) => {
    const { householdId } = c.req.valid("param")
    const { denied } = await ownerAccess(c, householdId)
    if (denied) return denied
    const user = c.get("user")
    const invite = await store.createInvite(householdId, user.id)
    return c.json(
      {
        invite: {
          id: invite.id,
          url: inviteUrl(invite.id),
          inviterName: user.name,
          createdAt: iso(invite.createdAt),
          expiresAt: iso(invite.expiresAt),
        },
      },
      201
    )
  })

  app.openapi(cancelInvite, async (c) => {
    const { householdId, inviteId } = c.req.valid("param")
    const { denied } = await ownerAccess(c, householdId)
    if (denied) return denied
    if (!(await store.deleteInvite(inviteId, householdId))) {
      return c.json({ error: "Invite not found" }, 404)
    }
    return c.body(null, 204)
  })

  const gone = (c: Context<Env>) =>
    c.json({ error: "This invite is no longer valid" }, 404)

  app.openapi(getInvite, async (c) => {
    const { inviteId } = c.req.valid("param")
    const invite = await store.findInvite(inviteId)
    if (!invite) return gone(c)
    const membership = await store.membership(
      invite.householdId,
      c.get("user").id
    )
    return c.json(
      {
        invite: {
          ...invite,
          expiresAt: iso(invite.expiresAt),
          alreadyMember: !!membership,
        },
      },
      200
    )
  })

  app.openapi(acceptInvite, async (c) => {
    const { inviteId } = c.req.valid("param")
    const invite = await store.findInvite(inviteId)
    if (!invite) return gone(c)
    const userId = c.get("user").id
    if (await store.membership(invite.householdId, userId)) {
      return c.json(
        { error: "You are already a member of this household" },
        409
      )
    }
    // Delete first, so the same link can't be used twice at the same time.
    if (!(await store.deleteInvite(invite.id))) return gone(c)
    await auth.api.addMember({
      body: { userId, organizationId: invite.householdId, role: "member" },
    })
    return c.json(
      {
        household: {
          id: invite.householdId,
          name: invite.householdName,
          role: "member",
        },
      },
      200
    )
  })

  app.openapi(declineInvite, async (c) => {
    const { inviteId } = c.req.valid("param")
    const invite = await store.findInvite(inviteId)
    if (!invite || !(await store.deleteInvite(invite.id))) return gone(c)
    return c.body(null, 204)
  })

  return app
}

function slugify(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "household"
  )
}
