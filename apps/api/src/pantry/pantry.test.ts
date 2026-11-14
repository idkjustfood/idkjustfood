import { beforeEach, describe, expect, test } from "bun:test"

import {
  defaultPantryItems,
  type Pantry,
  type PantryItem,
  type Recipe,
  type RecipeInput,
  type ShoppingList,
} from "@workspace/schemas"

import { createApp } from "../app.js"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

const names = (items: { name: string }[]) => items.map((i) => i.name)

async function getPantry(cookie = olivia, query = "") {
  const res = await api.get(`/api/pantry${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ pantry: Pantry }>(res)).pantry
}

async function addStaple(name: string, extra: object = {}, cookie = olivia) {
  const res = await api.post("/api/pantry/items", cookie, { name, ...extra })
  expect(res.status).toBe(201)
  return (await body<{ item: PantryItem }>(res)).item
}

async function emptyPantry(query = "") {
  for (const item of (await getPantry(olivia, query)).items) {
    await api.del(`/api/pantry/items/${item.id}`, olivia)
  }
}

async function household(owner: string, language?: string) {
  const res = await api.post("/api/households", owner, {
    name: "Home",
    language,
  })
  expect(res.status).toBe(201)
  const id = (await body<{ household: { id: string } }>(res)).household.id
  const cookie = await api.signUp("Sam")
  const invite = await api.post(`/api/households/${id}/invites`, owner)
  const { invite: link } = await body<{ invite: { id: string } }>(invite)
  await api.post(`/api/invites/${link.id}/accept`, cookie)
  return { id, member: cookie }
}

const soup: RecipeInput = {
  title: "Soup",
  description: "",
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  ingredients: [
    { name: "  SALT ", quantity: 1, unit: "tsp", note: null },
    { name: "Olive oil", quantity: 2, unit: "tbsp", note: null },
    { name: "Sea salt", quantity: null, unit: null, note: null },
    { name: "Carrots", quantity: 300, unit: "g", note: null },
  ],
  steps: [{ text: "Cook." }],
  nutrition: { calories: null, protein: null, carbs: null, fat: null },
}

async function addSoup(listId: string, language?: string) {
  const recipe = await body<{ recipe: Recipe }>(
    await api.post("/api/recipes", olivia, soup)
  )
  const res = await api.post(`/api/shopping-lists/${listId}/recipes`, olivia, {
    recipeId: recipe.recipe.id,
    language,
  })
  expect(res.status).toBe(200)
  return body<{ list: ShoppingList; skipped: string[] }>(res)
}

async function makeList(extra: object = {}) {
  const res = await api.post("/api/shopping-lists", olivia, {
    name: "Weekly",
    ...extra,
  })
  return (await body<{ list: ShoppingList }>(res)).list
}

beforeEach(async () => {
  api = client(createApp(await createTestDb(), testEnv))
  olivia = await api.signUp("Olivia")
})

describe("pantry", () => {
  test("needs a signed-in user", async () => {
    expect((await api.get("/api/pantry")).status).toBe(401)
    expect((await api.post("/api/pantry/reset")).status).toBe(401)
  })

  test("a personal pantry starts with the default list, in the person's language", async () => {
    expect(names((await getPantry()).items)).toEqual([...defaultPantryItems.en])
    const eve = await api.signUp("Eve")
    const pantry = await getPantry(eve, "?language=de")
    expect(names(pantry.items)).toEqual([...defaultPantryItems.de])
    expect(pantry.householdId).toBeNull()
  })

  test("a new household starts with the default list for its members", async () => {
    const { id, member } = await household(olivia, "fr")
    for (const cookie of [olivia, member]) {
      const pantry = await getPantry(cookie, `?householdId=${id}`)
      expect(pantry.householdId).toBe(id)
      expect(names(pantry.items)).toEqual([...defaultPantryItems.fr])
    }
  })

  test("staples can be added and removed; names are compared without case and spaces", async () => {
    const flour = await addStaple("  Flour ")
    expect(flour.name).toBe("Flour")
    expect((await addStaple("flour")).id).toBe(flour.id)
    expect(
      (await getPantry()).items.filter((i) => i.name.toLowerCase() === "flour")
    ).toHaveLength(1)

    const path = `/api/pantry/items/${flour.id}`
    expect((await api.del(path, olivia)).status).toBe(204)
    expect(names((await getPantry()).items)).not.toContain("Flour")
    expect((await api.del(path, olivia)).status).toBe(404)
  })

  test("a household's pantry is shared by its members and hidden from others", async () => {
    const { id, member } = await household(olivia)
    const item = await addStaple("Honey", { householdId: id }, member)
    const shared = await getPantry(olivia, `?householdId=${id}`)
    expect(names(shared.items)).toContain("Honey")
    // It is not in the personal pantry.
    expect(names((await getPantry()).items)).not.toContain("Honey")

    const eve = await api.signUp("Eve")
    expect((await api.get(`/api/pantry?householdId=${id}`, eve)).status).toBe(
      404
    )
    const add = await api.post("/api/pantry/items", eve, {
      name: "x",
      householdId: id,
    })
    expect(add.status).toBe(404)
    expect((await api.del(`/api/pantry/items/${item.id}`, eve)).status).toBe(
      404
    )
    const reset = await api.post("/api/pantry/reset", eve, { householdId: id })
    expect(reset.status).toBe(404)
  })

  test("an emptied pantry stays empty", async () => {
    await emptyPantry()
    expect((await getPantry()).items).toEqual([])
  })

  test("reset replaces the list with the default and removes added items", async () => {
    const pantry = await getPantry()
    await addStaple("Flour")
    await api.del(`/api/pantry/items/${pantry.items[0]!.id}`, olivia)

    const res = await api.post("/api/pantry/reset", olivia, {})
    expect(res.status).toBe(200)
    const reset = (await body<{ pantry: Pantry }>(res)).pantry
    expect(names(reset.items)).toEqual([...defaultPantryItems.en])
    expect(names((await getPantry()).items)).toEqual([...defaultPantryItems.en])
  })

  test("reset only changes the chosen space", async () => {
    const { id } = await household(olivia)
    await addStaple("Honey", { householdId: id })
    await addStaple("Flour")
    await api.post("/api/pantry/reset", olivia, { householdId: id })
    const shared = await getPantry(olivia, `?householdId=${id}`)
    expect(names(shared.items)).not.toContain("Honey")
    expect(names((await getPantry()).items)).toContain("Flour")
  })
})

describe("adding a recipe with a pantry", () => {
  test("leaves out the staples of the person and says which", async () => {
    const list = await makeList()
    const { list: result, skipped } = await addSoup(list.id)
    expect(skipped).toEqual(["SALT", "Olive oil"])
    expect(names(result.items)).toEqual(["Sea salt", "Carrots"])
  })

  test("uses the household's pantry for a household list, not the personal one", async () => {
    const { id } = await household(olivia)
    await emptyPantry(`?householdId=${id}`)
    await addStaple("Carrots", { householdId: id })
    const list = await makeList({ householdId: id })
    const { list: result, skipped } = await addSoup(list.id)
    // Salt is a staple only in the personal pantry, carrots only in the household's.
    expect(names(result.items)).toEqual(["SALT", "Olive oil", "Sea salt"])
    expect(skipped).toEqual(["Carrots"])
  })

  test("adds everything when nothing is a staple", async () => {
    await emptyPantry()
    const list = await makeList()
    const { list: result, skipped } = await addSoup(list.id)
    expect(skipped).toEqual([])
    expect(result.items).toHaveLength(4)
  })

  test("makes the pantry in the given language when there is none yet", async () => {
    const list = await makeList()
    await addSoup(list.id, "es")
    expect(names((await getPantry()).items)).toEqual([...defaultPantryItems.es])
  })
})
