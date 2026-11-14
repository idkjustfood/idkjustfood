import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  defaultPantry,
  pantryKey,
  toRecipeLanguage,
  type Pantry,
  type PantryItem,
} from "@workspace/schemas"

import { api, call } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import i18n from "@/lib/i18n"
import { newId } from "@/lib/shopping-ops"

/** The space is a household id, or null for the person's own pantry. */
type Space = string | null

const key = (space: Space, demo: boolean) =>
  ["pantry", { space, demo }] as const

const language = () => toRecipeLanguage(i18n.language)

/** The demo has no server, so its pantries live here until the app is closed. */
const demoPantries = new Map<Space, PantryItem[]>()

function demoItems(space: Space) {
  let items = demoPantries.get(space)
  if (!items) {
    items = defaultPantry("en").map((name) => ({ id: newId(), name }))
    demoPantries.set(space, items)
  }
  return items
}

const demoPantry = (space: Space): Pantry => ({
  householdId: space,
  items: [...demoItems(space)],
})

/**
 * The pantry staples of a space: things always at home, left out when a recipe is added to a
 * shopping list. The server makes the pantry with the default list the first time it is read.
 */
export function usePantry(space: Space) {
  const { demo } = useAppState()
  return useQuery({
    queryKey: key(space, demo),
    queryFn: async (): Promise<Pantry> =>
      demo
        ? demoPantry(space)
        : (
            await call(
              api.GET("/api/pantry", {
                params: {
                  query: {
                    householdId: space ?? undefined,
                    language: language(),
                  },
                },
              })
            )
          ).pantry,
  })
}

/** Adds a staple. Adding a name that is already there changes nothing. */
export function useAddStaple(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (name: string) => {
      if (demo) {
        const items = demoItems(space)
        if (!items.some((item) => pantryKey(item.name) === pantryKey(name))) {
          items.push({ id: newId(), name: name.trim() })
        }
        return
      }
      await call(
        api.POST("/api/pantry/items", {
          body: {
            id: newId(),
            name,
            householdId: space,
            language: language(),
          },
        })
      )
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key(space, demo) }),
  })
}

export function useRemoveStaple(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (demo) {
        demoPantries.set(
          space,
          demoItems(space).filter((item) => item.id !== itemId)
        )
        return
      }
      await call(
        api.DELETE("/api/pantry/items/{itemId}", {
          params: { path: { itemId } },
        })
      )
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key(space, demo) }),
  })
}

/** Replaces the list with the default one. Items the person added are removed. */
export function useResetPantry(space: Space) {
  const client = useQueryClient()
  const { demo } = useAppState()
  return useMutation({
    mutationFn: async (): Promise<Pantry> => {
      if (demo) {
        demoPantries.delete(space)
        return demoPantry(space)
      }
      return (
        await call(
          api.POST("/api/pantry/reset", {
            body: { householdId: space, language: language() },
          })
        )
      ).pantry
    },
    onSuccess: (pantry) => client.setQueryData(key(space, demo), pantry),
  })
}
