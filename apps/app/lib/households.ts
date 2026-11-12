import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import * as Linking from "expo-linking"

import { api, ApiError, call, type Schemas } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { household as demoHousehold } from "@/lib/mock-data"

export type Household = Schemas["Household"]
export type Member = Schemas["Member"]
export type Invite = Schemas["Invite"]
export type InvitePreview = Schemas["InvitePreview"]

const keys = {
  households: ["households"] as const,
  members: (id: string) => ["households", id, "members"] as const,
  invites: (id: string) => ["households", id, "invites"] as const,
  invite: (id: string) => ["invites", id] as const,
}

export const isOwner = (role: string | undefined) =>
  !!role?.split(",").includes("owner")

const demoOnly = () => {
  throw new ApiError(
    "This doesn't work with sample data. Log in to manage a real household.",
    0
  )
}

/**
 * The household shown in the app. People normally have one; with several,
 * the oldest one is used for now.
 */
export function useHousehold() {
  const { demo } = useAppState()
  const query = useQuery({
    queryKey: [...keys.households, { demo }],
    queryFn: async () =>
      demo
        ? [{ id: demoHousehold.id, name: demoHousehold.name, role: "owner" }]
        : (await call(api.GET("/api/households"))).households,
  })
  return { ...query, household: query.data?.[0] }
}

export function useMembers(householdId: string | undefined) {
  const { demo } = useAppState()
  return useQuery({
    queryKey: [...keys.members(householdId ?? ""), { demo }],
    enabled: !!householdId,
    queryFn: async (): Promise<Member[]> =>
      demo
        ? demoHousehold.members
        : (
            await call(
              api.GET("/api/households/{householdId}/members", {
                params: { path: { householdId: householdId! } },
              })
            )
          ).members,
  })
}

/** Pending invite links. Only owners may see them, so pass `enabled` accordingly. */
export function useInvites(householdId: string | undefined, enabled: boolean) {
  const { demo } = useAppState()
  return useQuery({
    queryKey: [...keys.invites(householdId ?? ""), { demo }],
    enabled: !!householdId && enabled,
    queryFn: async (): Promise<Invite[]> =>
      demo
        ? demoHousehold.invites
        : (
            await call(
              api.GET("/api/households/{householdId}/invites", {
                params: { path: { householdId: householdId! } },
              })
            )
          ).invites,
  })
}

export function useInvitePreview(inviteId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.invite(inviteId),
    enabled,
    retry: false,
    queryFn: async () =>
      (
        await call(
          api.GET("/api/invites/{inviteId}", {
            params: { path: { inviteId } },
          })
        )
      ).invite,
  })
}

/** The link to share. Uses the server's link, or builds one that opens this app. */
export function inviteLink(invite: Pick<Invite, "id" | "url">) {
  return invite.url ?? Linking.createURL(`/invite/${invite.id}`)
}

function refresh(client: QueryClient) {
  return client.invalidateQueries({ queryKey: keys.households })
}

export function useCreateHousehold() {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (name: string) =>
      demo
        ? demoOnly()
        : (await call(api.POST("/api/households", { body: { name } })))
            .household,
    onSuccess: () => refresh(client),
  })
}

export function useCreateInvite(householdId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (): Promise<Invite> =>
      demo
        ? demoHousehold.invites[0]!
        : (
            await call(
              api.POST("/api/households/{householdId}/invites", {
                params: { path: { householdId } },
              })
            )
          ).invite,
    onSuccess: () => refresh(client),
  })
}

export function useCancelInvite(householdId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (inviteId: string) =>
      demo
        ? demoOnly()
        : call(
            api.DELETE("/api/households/{householdId}/invites/{inviteId}", {
              params: { path: { householdId, inviteId } },
            })
          ),
    onSuccess: () => refresh(client),
  })
}

export function useRemoveMember(householdId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (memberId: string) =>
      demo
        ? demoOnly()
        : call(
            api.DELETE("/api/households/{householdId}/members/{memberId}", {
              params: { path: { householdId, memberId } },
            })
          ),
    onSuccess: () => refresh(client),
  })
}

export function useLeaveHousehold(householdId: string) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async () =>
      demo
        ? demoOnly()
        : call(
            api.POST("/api/households/{householdId}/leave", {
              params: { path: { householdId } },
            })
          ),
    onSuccess: () => refresh(client),
  })
}

export function useAnswerInvite(inviteId: string) {
  const client = useQueryClient()
  const accept = useMutation({
    mutationFn: async () =>
      (
        await call(
          api.POST("/api/invites/{inviteId}/accept", {
            params: { path: { inviteId } },
          })
        )
      ).household,
    onSuccess: () => refresh(client),
  })
  const decline = useMutation({
    mutationFn: () =>
      call(
        api.POST("/api/invites/{inviteId}/decline", {
          params: { path: { inviteId } },
        })
      ),
  })
  return { accept, decline }
}
