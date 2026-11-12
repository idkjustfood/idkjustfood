import { beforeEach, describe, expect, test } from "bun:test"

import type { Recipe, RecipeInput } from "@workspace/schemas"

import { createApp } from "../app.js"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

const pancakes: RecipeInput = {
  title: "Pancakes",
  description: "Fluffy.",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: null,
  tags: ["Breakfast", "Vegetarian"],
  ingredients: [
    { name: "Flour", quantity: 200, unit: "g", note: null },
    { name: "Milk", quantity: 300, unit: "ml", note: "cold" },
    { name: "Pinch of salt", quantity: null, unit: null, note: null },
  ],
  steps: [{ text: "Mix." }, { text: "Fry 2 minutes per side." }],
  nutrition: { calories: 350, protein: null, carbs: null, fat: null },
}

async function create(input: Partial<RecipeInput> = {}, cookie = olivia) {
  const res = await api.post("/api/recipes", cookie, { ...pancakes, ...input })
  expect(res.status).toBe(201)
  return (await body<{ recipe: Recipe }>(res)).recipe
}

async function list(query = "", cookie = olivia) {
  const res = await api.get(`/api/recipes${query}`, cookie)
  expect(res.status).toBe(200)
  return (await body<{ recipes: Recipe[] }>(res)).recipes
}

/** A household owned by `owner`, with `names` as members. Returns its id and their cookies. */
async function household(owner: string, ...names: string[]) {
  const res = await api.post("/api/households", owner, { name: "Home" })
  const id = (await body<{ household: { id: string } }>(res)).household.id
  const cookies: string[] = []
  for (const name of names) {
    const cookie = await api.signUp(name)
    const invite = await api.post(`/api/households/${id}/invites`, owner)
    const { invite: link } = await body<{ invite: { id: string } }>(invite)
    expect((await api.post(`/api/invites/${link.id}/accept`, cookie)).status).toBe(200)
    cookies.push(cookie)
  }
  return { id, cookies }
}

beforeEach(async () => {
  api = client(createApp(await createTestDb(), testEnv))
  olivia = await api.signUp("Olivia")
})

describe("recipes", () => {
  test("need a signed-in user", async () => {
    expect((await api.get("/api/recipes")).status).toBe(401)
    expect((await api.post("/api/recipes", undefined, pancakes)).status).toBe(401)
    expect((await api.get("/api/recipes/abc")).status).toBe(401)
  })

  test("are saved exactly as written and can be read back", async () => {
    const saved = await create()
    expect(saved).toMatchObject({
      ...pancakes,
      householdId: null,
      source: { kind: "manual", label: null, url: null },
    })
    expect(saved.userId).toBeString()

    const res = await api.get(`/api/recipes/${saved.id}`, olivia)
    expect(res.status).toBe(200)
    expect((await body<{ recipe: Recipe }>(res)).recipe).toEqual(saved)
    expect(await list()).toEqual([saved])
  })

  test("an empty amount stays empty", async () => {
    const saved = await create()
    expect(saved.ingredients[2]).toEqual({
      name: "Pinch of salt",
      quantity: null,
      unit: null,
      note: null,
    })
    expect(saved.cookMinutes).toBeNull()
    expect(saved.nutrition.protein).toBeNull()
  })

  test("reject recipes that are not valid", async () => {
    for (const bad of [
      { title: "  " },
      { servings: 0 },
      { ingredients: [{ name: "Flour", quantity: 0, unit: "g", note: null }] },
      { ingredients: [{ name: "", quantity: 1, unit: null, note: null }] },
      { tags: ["a,b"] },
      { nutrition: { calories: -1, protein: null, carbs: null, fat: null } },
    ]) {
      const res = await api.post("/api/recipes", olivia, { ...pancakes, ...bad })
      expect(res.status).toBe(400)
    }
    expect(await list()).toEqual([])
  })

  test("can be edited", async () => {
    const saved = await create()
    const res = await api.request("PUT", `/api/recipes/${saved.id}`, olivia, {
      ...pancakes,
      title: "Thick pancakes",
      servings: 6,
      ingredients: [],
    })
    expect(res.status).toBe(200)
    const { recipe } = await body<{ recipe: Recipe }>(res)
    expect(recipe).toMatchObject({ id: saved.id, title: "Thick pancakes", servings: 6 })
    expect(recipe.ingredients).toEqual([])
    expect(new Date(recipe.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(saved.updatedAt).getTime()
    )
    expect((await list())[0]?.title).toBe("Thick pancakes")
  })

  test("can be deleted", async () => {
    const saved = await create()
    expect((await api.del(`/api/recipes/${saved.id}`, olivia)).status).toBe(204)
    expect((await api.get(`/api/recipes/${saved.id}`, olivia)).status).toBe(404)
    expect(await list()).toEqual([])
    expect((await api.del(`/api/recipes/${saved.id}`, olivia)).status).toBe(404)
  })

  test("belong to their author alone", async () => {
    const saved = await create()
    const sam = await api.signUp("Sam")
    expect((await api.get(`/api/recipes/${saved.id}`, sam)).status).toBe(404)
    expect(
      (await api.request("PUT", `/api/recipes/${saved.id}`, sam, pancakes)).status
    ).toBe(404)
    expect((await api.del(`/api/recipes/${saved.id}`, sam)).status).toBe(404)
    expect(await list("", sam)).toEqual([])
    expect(await list()).toHaveLength(1)
  })
})

describe("search and tags", () => {
  beforeEach(async () => {
    await create({ title: "Lentil dal", tags: ["Indian", "Vegan"], ingredients: [
      { name: "Red lentils", quantity: 250, unit: "g", note: null },
    ] })
    await create({ title: "Tuscan pasta", tags: ["Italian"], ingredients: [
      { name: "Penne", quantity: 400, unit: "g", note: "lentil-free" },
      { name: "100% cream", quantity: null, unit: null, note: null },
    ] })
    await create({ title: "Toast", tags: ["Vegan", "Under 15 min"], ingredients: [] })
  })

  const titles = async (query: string) =>
    (await list(query)).map((r) => r.title).sort()

  test("search finds titles and ingredient names", async () => {
    expect(await titles("?q=dal")).toEqual(["Lentil dal"])
    expect(await titles("?q=LENTIL")).toEqual(["Lentil dal"])
    expect(await titles("?q=penne")).toEqual(["Tuscan pasta"])
    expect(await titles("?q=nothing")).toEqual([])
  })

  test("search treats % and _ as plain characters", async () => {
    expect(await titles("?q=100%25")).toEqual(["Tuscan pasta"])
    expect(await titles("?q=%25")).toEqual(["Tuscan pasta"])
    expect(await titles("?q=_")).toEqual([])
  })

  test("a tag filter needs every tag", async () => {
    expect(await titles("?tags=Vegan")).toEqual(["Lentil dal", "Toast"])
    expect(await titles("?tags=vegan,indian")).toEqual(["Lentil dal"])
    expect(await titles("?tags=Vegan,Italian")).toEqual([])
    expect(await titles("?tags=Under%2015%20min")).toEqual(["Toast"])
  })

  test("search and tags work together", async () => {
    expect(await titles("?q=l&tags=Vegan")).toEqual(["Lentil dal", "Toast"].filter((t) => /l/i.test(t)))
    expect(await titles("?q=toast&tags=Indian")).toEqual([])
  })
})

describe("households", () => {
  test("members see a household's recipes and others do not", async () => {
    const { id, cookies } = await household(olivia, "Bob")
    const bob = cookies[0]!
    const sam = await api.signUp("Sam")

    const shared = await create({ title: "Shared stew", householdId: id })
    const mine = await create({ title: "Only mine" })
    expect(shared.householdId).toBe(id)

    // Bob sees the shared recipe, but not Olivia's private one.
    expect((await list(`?householdId=${id}`, bob)).map((r) => r.title)).toEqual([
      "Shared stew",
    ])
    expect((await api.get(`/api/recipes/${shared.id}`, bob)).status).toBe(200)
    expect((await api.get(`/api/recipes/${mine.id}`, bob)).status).toBe(404)
    // The shared recipe is not in Bob's own list.
    expect(await list("", bob)).toEqual([])
    // Olivia's own list has only her private one.
    expect((await list("")).map((r) => r.title)).toEqual(["Only mine"])

    // Sam is not in the household.
    expect((await api.get(`/api/recipes/${shared.id}`, sam)).status).toBe(404)
    expect((await api.get(`/api/recipes?householdId=${id}`, sam)).status).toBe(404)
  })

  test("cannot add a recipe to a household you are not in", async () => {
    const { id } = await household(olivia)
    const sam = await api.signUp("Sam")
    const res = await api.post("/api/recipes", sam, { ...pancakes, householdId: id })
    expect(res.status).toBe(404)
  })

  test("members can edit, and lose access when they leave", async () => {
    const { id, cookies } = await household(olivia, "Bob")
    const bob = cookies[0]!
    const shared = await create({ householdId: id })

    const edit = await api.request("PUT", `/api/recipes/${shared.id}`, bob, {
      ...pancakes,
      title: "Bob's version",
    })
    expect(edit.status).toBe(200)
    // Leaving the title out of householdId keeps it shared.
    expect((await body<{ recipe: Recipe }>(edit)).recipe.householdId).toBe(id)

    expect((await api.post(`/api/households/${id}/leave`, bob)).status).toBe(204)
    expect((await api.get(`/api/recipes/${shared.id}`, bob)).status).toBe(404)
    expect((await api.get(`/api/recipes?householdId=${id}`, bob)).status).toBe(404)
  })

  test("only the author or an owner can delete a shared recipe", async () => {
    const { id, cookies } = await household(olivia, "Bob", "Cleo")
    const [bob, cleo] = cookies as [string, string]
    const bobs = await create({ householdId: id }, bob)

    expect((await api.del(`/api/recipes/${bobs.id}`, cleo)).status).toBe(403)
    expect((await api.get(`/api/recipes/${bobs.id}`, cleo)).status).toBe(200)
    // The household owner can remove it.
    expect((await api.del(`/api/recipes/${bobs.id}`, olivia)).status).toBe(204)

    const cleos = await create({ householdId: id }, cleo)
    expect((await api.del(`/api/recipes/${cleos.id}`, cleo)).status).toBe(204)
  })

  test("the author can share a recipe later, or take it back", async () => {
    const { id, cookies } = await household(olivia, "Bob")
    const bob = cookies[0]!
    const saved = await create()
    expect((await api.get(`/api/recipes/${saved.id}`, bob)).status).toBe(404)

    const share = await api.request("PUT", `/api/recipes/${saved.id}`, olivia, {
      ...pancakes,
      householdId: id,
    })
    expect(share.status).toBe(200)
    expect((await api.get(`/api/recipes/${saved.id}`, bob)).status).toBe(200)

    // Bob can't un-share it.
    const steal = await api.request("PUT", `/api/recipes/${saved.id}`, bob, {
      ...pancakes,
      householdId: null,
    })
    expect(steal.status).toBe(403)

    const back = await api.request("PUT", `/api/recipes/${saved.id}`, olivia, {
      ...pancakes,
      householdId: null,
    })
    expect((await body<{ recipe: Recipe }>(back)).recipe.householdId).toBeNull()
    expect((await api.get(`/api/recipes/${saved.id}`, bob)).status).toBe(404)
  })
})
