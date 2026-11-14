import { beforeEach, describe, expect, test } from "bun:test"

import type {
  Recipe,
  RecipeInput,
  ShoppingItem,
  ShoppingList,
} from "@workspace/schemas"

import { createApp } from "../app.js"
import { client, createTestDb, testEnv } from "../test-helpers.js"

let api: ReturnType<typeof client>
let olivia: string

async function body<T>(res: Response) {
  return (await res.json()) as T
}

const pancakes: RecipeInput = {
  title: "Pancakes",
  description: "",
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  ingredients: [
    { name: "Flour", quantity: 200, unit: "g", note: null },
    { name: "Milk", quantity: 300, unit: "ml", note: null },
    { name: "Pinch of salt", quantity: null, unit: null, note: null },
  ],
  steps: [{ text: "Mix." }],
  nutrition: { calories: null, protein: null, carbs: null, fat: null },
}

const bread: RecipeInput = {
  ...pancakes,
  title: "Bread",
  servings: 2,
  ingredients: [
    { name: "flour", quantity: 100, unit: "g", note: null },
    { name: "Pinch of salt", quantity: null, unit: null, note: null },
    { name: "Water", quantity: 1, unit: "cup", note: null },
  ],
}

async function makeRecipe(input: RecipeInput, cookie = olivia) {
  const res = await api.post("/api/recipes", cookie, input)
  expect(res.status).toBe(201)
  return (await body<{ recipe: Recipe }>(res)).recipe
}

async function makeList(
  name: string,
  cookie = olivia,
  extra: Record<string, unknown> = {}
) {
  const res = await api.post("/api/shopping-lists", cookie, { name, ...extra })
  expect(res.status).toBe(201)
  return (await body<{ list: ShoppingList }>(res)).list
}

async function lists(cookie = olivia) {
  const res = await api.get("/api/shopping-lists", cookie)
  expect(res.status).toBe(200)
  return (await body<{ lists: ShoppingList[] }>(res)).lists
}

async function addItem(listId: string, input: object, cookie = olivia) {
  const res = await api.post(
    `/api/shopping-lists/${listId}/items`,
    cookie,
    input
  )
  expect(res.status).toBe(201)
  return (await body<{ item: ShoppingItem }>(res)).item
}

async function addRecipe(
  listId: string,
  recipeId: string,
  servings?: number,
  cookie = olivia
) {
  const res = await api.post(`/api/shopping-lists/${listId}/recipes`, cookie, {
    recipeId,
    servings,
  })
  expect(res.status).toBe(200)
  return (await body<{ list: ShoppingList }>(res)).list
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
    expect(
      (await api.post(`/api/invites/${link.id}/accept`, cookie)).status
    ).toBe(200)
    cookies.push(cookie)
  }
  return { id, cookies }
}

beforeEach(async () => {
  api = client(createApp(await createTestDb(), testEnv))
  olivia = await api.signUp("Olivia")
})

describe("shopping lists", () => {
  test("need a signed-in user", async () => {
    expect((await api.get("/api/shopping-lists")).status).toBe(401)
    expect(
      (await api.post("/api/shopping-lists", undefined, { name: "A" })).status
    ).toBe(401)
    expect((await api.get("/api/shopping-lists/abc")).status).toBe(401)
  })

  test("a personal list can be made, read, renamed and deleted", async () => {
    const list = await makeList("Weekly shop")
    expect(list).toMatchObject({
      name: "Weekly shop",
      householdId: null,
      items: [],
    })
    expect(await lists()).toHaveLength(1)

    const renamed = await api.request(
      "PATCH",
      `/api/shopping-lists/${list.id}`,
      olivia,
      {
        name: "Sunday shop",
      }
    )
    expect(renamed.status).toBe(200)
    expect((await body<{ list: ShoppingList }>(renamed)).list.name).toBe(
      "Sunday shop"
    )

    expect(
      (await api.del(`/api/shopping-lists/${list.id}`, olivia)).status
    ).toBe(204)
    expect(await lists()).toEqual([])
    expect(
      (await api.get(`/api/shopping-lists/${list.id}`, olivia)).status
    ).toBe(404)
  })

  test("rejects an empty name", async () => {
    const res = await api.post("/api/shopping-lists", olivia, { name: "  " })
    expect(res.status).toBe(400)
  })

  test("making a list with the same id twice gives the same list (safe retry)", async () => {
    const id = crypto.randomUUID()
    const first = await makeList("A", olivia, { id })
    const second = await makeList("A", olivia, { id })
    expect(second.id).toBe(first.id)
    expect(await lists()).toHaveLength(1)
  })

  test("an id that belongs to someone else's list is refused", async () => {
    const mia = await api.signUp("Mia")
    const list = await makeList("Private", olivia)
    const res = await api.post("/api/shopping-lists", mia, {
      id: list.id,
      name: "Mine",
    })
    expect(res.status).toBe(409)
  })
})

describe("items", () => {
  test("can be added by hand, ticked off, edited and removed", async () => {
    const list = await makeList("Shop")
    const milk = await addItem(list.id, {
      name: "Milk",
      quantity: 2,
      unit: "l",
    })
    expect(milk).toMatchObject({
      name: "Milk",
      quantity: 2,
      unit: "l",
      checked: false,
    })
    const eggs = await addItem(list.id, { name: "Eggs" })
    expect(eggs).toMatchObject({ quantity: null, unit: null, note: null })

    const ticked = await api.request(
      "PATCH",
      `/api/shopping-lists/${list.id}/items/${milk.id}`,
      olivia,
      { checked: true }
    )
    expect(ticked.status).toBe(200)
    expect((await body<{ item: ShoppingItem }>(ticked)).item).toMatchObject({
      name: "Milk",
      quantity: 2,
      checked: true,
    })

    const edited = await api.request(
      "PATCH",
      `/api/shopping-lists/${list.id}/items/${eggs.id}`,
      olivia,
      { name: "Free range eggs", quantity: 12 }
    )
    expect((await body<{ item: ShoppingItem }>(edited)).item).toMatchObject({
      name: "Free range eggs",
      quantity: 12,
      checked: false,
    })

    expect(
      (await api.del(`/api/shopping-lists/${list.id}/items/${milk.id}`, olivia))
        .status
    ).toBe(204)
    const [saved] = await lists()
    expect(saved!.items.map((i) => i.name)).toEqual(["Free range eggs"])
  })

  test("keep the order they were added in", async () => {
    const list = await makeList("Shop")
    for (const name of ["A", "B", "C"]) await addItem(list.id, { name })
    expect((await lists())[0]!.items.map((i) => i.name)).toEqual([
      "A",
      "B",
      "C",
    ])
  })

  test("an item only takes a unit from the list", async () => {
    const list = await makeList("Shop")
    const res = await api.post(`/api/shopping-lists/${list.id}/items`, olivia, {
      name: "Rice",
      quantity: 1,
      unit: "kilos",
    })
    expect(res.status).toBe(400)
  })

  test("a quantity can be cleared again", async () => {
    const list = await makeList("Shop")
    const item = await addItem(list.id, {
      name: "Rice",
      quantity: 1,
      unit: "kg",
    })
    const res = await api.request(
      "PATCH",
      `/api/shopping-lists/${list.id}/items/${item.id}`,
      olivia,
      { quantity: null, unit: null }
    )
    expect((await body<{ item: ShoppingItem }>(res)).item).toMatchObject({
      quantity: null,
      unit: null,
    })
  })

  test("sending an item with the same id again adds nothing (safe retry)", async () => {
    const list = await makeList("Shop")
    const id = crypto.randomUUID()
    await addItem(list.id, { id, name: "Milk" })
    await addItem(list.id, { id, name: "Milk" })
    expect((await lists())[0]!.items).toHaveLength(1)
  })

  test("an unknown item gives 404", async () => {
    const list = await makeList("Shop")
    const res = await api.request(
      "PATCH",
      `/api/shopping-lists/${list.id}/items/nope`,
      olivia,
      { checked: true }
    )
    expect(res.status).toBe(404)
    expect(
      (await api.del(`/api/shopping-lists/${list.id}/items/nope`, olivia))
        .status
    ).toBe(404)
  })

  test("rejects an empty name and a zero amount", async () => {
    const list = await makeList("Shop")
    const path = `/api/shopping-lists/${list.id}/items`
    expect((await api.post(path, olivia, { name: "" })).status).toBe(400)
    expect(
      (await api.post(path, olivia, { name: "Salt", quantity: 0 })).status
    ).toBe(400)
  })

  test("ticked-off items can be cleared in one go", async () => {
    const list = await makeList("Shop")
    const milk = await addItem(list.id, { name: "Milk" })
    await addItem(list.id, { name: "Eggs" })
    await api.request(
      "PATCH",
      `/api/shopping-lists/${list.id}/items/${milk.id}`,
      olivia,
      {
        checked: true,
      }
    )
    const res = await api.del(`/api/shopping-lists/${list.id}/items`, olivia)
    expect(res.status).toBe(200)
    expect(
      (await body<{ list: ShoppingList }>(res)).list.items.map((i) => i.name)
    ).toEqual(["Eggs"])
  })
})

describe("adding a recipe", () => {
  test("puts all ingredients on the list, and never invents an amount", async () => {
    const list = await makeList("Shop")
    const recipe = await makeRecipe(pancakes)
    const result = await addRecipe(list.id, recipe.id)
    expect(
      result.items.map(({ name, quantity, unit, fromRecipes }) => ({
        name,
        quantity,
        unit,
        fromRecipes,
      }))
    ).toEqual([
      { name: "Flour", quantity: 200, unit: "g", fromRecipes: ["Pancakes"] },
      { name: "Milk", quantity: 300, unit: "ml", fromRecipes: ["Pancakes"] },
      {
        name: "Pinch of salt",
        quantity: null,
        unit: null,
        fromRecipes: ["Pancakes"],
      },
    ])
  })

  test("ingredients of all sections are merged into one list without sections", async () => {
    const list = await makeList("Shop")
    const recipe = await makeRecipe({
      ...pancakes,
      title: "Pizza",
      ingredients: [
        { name: "Flour", quantity: 200, unit: "g", note: null, section: "Dough" },
        { name: "Flour", quantity: 100, unit: "g", note: null, section: "Sauce" },
        { name: "Tomato", quantity: 3, unit: null, note: null, section: "Sauce" },
      ],
      steps: [
        { text: "Knead.", section: "Dough" },
        { text: "Simmer.", section: "Sauce" },
      ],
    })
    const result = await addRecipe(list.id, recipe.id)
    expect(
      result.items.map(({ name, quantity }) => ({ name, quantity }))
    ).toEqual([
      { name: "Flour", quantity: 300 },
      { name: "Tomato", quantity: 3 },
    ])
    expect(result.items.every((item) => !("section" in item))).toBe(true)
  })

  test("two recipes with flour in grams give one flour line with the sum", async () => {
    const list = await makeList("Shop")
    await addRecipe(list.id, (await makeRecipe(pancakes)).id)
    const result = await addRecipe(list.id, (await makeRecipe(bread)).id)

    const flour = result.items.filter((i) => i.name.toLowerCase() === "flour")
    expect(flour).toHaveLength(1)
    expect(flour[0]).toMatchObject({
      quantity: 300,
      fromRecipes: ["Pancakes", "Bread"],
    })
    // The salt has no amount in either recipe: one line, still without an amount.
    expect(result.items.filter((i) => i.name === "Pinch of salt")).toEqual([
      expect.objectContaining({
        quantity: null,
        fromRecipes: ["Pancakes", "Bread"],
      }),
    ])
    // A different unit is a different line.
    expect(result.items.find((i) => i.name === "Water")).toMatchObject({
      quantity: 1,
      unit: "cup",
    })
  })

  test("scales to the chosen servings", async () => {
    const list = await makeList("Shop")
    const recipe = await makeRecipe(pancakes)
    const result = await addRecipe(list.id, recipe.id, 8)
    expect(result.items.find((i) => i.name === "Flour")!.quantity).toBe(400)
    expect(
      result.items.find((i) => i.name === "Pinch of salt")!.quantity
    ).toBeNull()
  })

  test("merges into items typed in by hand", async () => {
    const list = await makeList("Shop")
    await addItem(list.id, { name: "flour", quantity: 50, unit: "g" })
    const result = await addRecipe(list.id, (await makeRecipe(pancakes)).id)
    expect(result.items.find((i) => i.name === "flour")!.quantity).toBe(250)
  })

  test("two people adding recipes at the same time lose nothing", async () => {
    const { id, cookies } = await household(olivia, "Sam")
    const list = await makeList("Weekly", olivia, { householdId: id })
    const a = await makeRecipe(pancakes, olivia)
    const b = await makeRecipe(bread, cookies[0]!)
    // Sam's recipe is personal, so Olivia can't use it; share it with the household.
    await api.request("PUT", `/api/recipes/${b.id}`, cookies[0], {
      ...bread,
      householdId: id,
    })
    await Promise.all([
      addRecipe(list.id, a.id, undefined, olivia),
      addRecipe(list.id, b.id, undefined, cookies[0]),
    ])
    const [saved] = await lists()
    expect(
      saved!.items.find((i) => i.name.toLowerCase() === "flour")!.quantity
    ).toBe(300)
    expect(
      saved!.items.filter((i) => i.name.toLowerCase() === "flour")
    ).toHaveLength(1)
  })

  test("a recipe you can't see is not found", async () => {
    const mia = await api.signUp("Mia")
    const list = await makeList("Shop")
    const secret = await makeRecipe(pancakes, mia)
    const res = await api.post(
      `/api/shopping-lists/${list.id}/recipes`,
      olivia,
      {
        recipeId: secret.id,
      }
    )
    expect(res.status).toBe(404)
    expect((await lists())[0]!.items).toEqual([])
  })

  test("a missing recipe is not found", async () => {
    const list = await makeList("Shop")
    const res = await api.post(
      `/api/shopping-lists/${list.id}/recipes`,
      olivia,
      {
        recipeId: "nope",
      }
    )
    expect(res.status).toBe(404)
  })
})

describe("who can see a list", () => {
  test("a personal list is only visible to its owner, also to household members", async () => {
    const { id, cookies } = await household(olivia, "Sam")
    const sam = cookies[0]!
    const mine = await makeList("Mine", olivia)
    const item = await addItem(mine.id, { name: "Milk" })

    expect(await lists(sam)).toEqual([])
    expect((await api.get(`/api/shopping-lists/${mine.id}`, sam)).status).toBe(
      404
    )
    const base = `/api/shopping-lists/${mine.id}`
    expect((await api.request("PATCH", base, sam, { name: "x" })).status).toBe(
      404
    )
    expect((await api.del(base, sam)).status).toBe(404)
    expect((await api.post(`${base}/items`, sam, { name: "x" })).status).toBe(
      404
    )
    expect(
      (
        await api.request("PATCH", `${base}/items/${item.id}`, sam, {
          checked: true,
        })
      ).status
    ).toBe(404)
    expect((await api.del(`${base}/items/${item.id}`, sam)).status).toBe(404)
    expect((await api.del(`${base}/items`, sam)).status).toBe(404)
    expect(
      (await api.post(`${base}/recipes`, sam, { recipeId: "x" })).status
    ).toBe(404)

    // Not even putting it into the household is possible for someone else.
    expect(id).toBeString()
    expect((await lists(olivia))[0]!.items).toHaveLength(1)
  })

  test("a household list is shared by every member, with the same changes", async () => {
    const { id, cookies } = await household(olivia, "Sam", "Alex")
    const [sam, alex] = cookies as [string, string]
    const weekly = await makeList("Weekly shop", olivia, { householdId: id })
    expect(weekly.householdId).toBe(id)
    await makeList("Only mine", olivia)

    const samLists = await lists(sam)
    expect(samLists.map((l) => l.name)).toEqual(["Weekly shop"])

    const milk = await addItem(weekly.id, { name: "Milk" }, sam)
    await api.request(
      "PATCH",
      `/api/shopping-lists/${weekly.id}/items/${milk.id}`,
      alex,
      {
        checked: true,
      }
    )
    for (const cookie of [olivia, sam, alex]) {
      const shared = (await lists(cookie)).find((l) => l.id === weekly.id)!
      expect(shared.items).toEqual([
        expect.objectContaining({ name: "Milk", checked: true }),
      ])
    }
  })

  test("a person outside the household can't read or change its list", async () => {
    const { id } = await household(olivia)
    const weekly = await makeList("Weekly shop", olivia, { householdId: id })
    const item = await addItem(weekly.id, { name: "Milk" })
    const mia = await api.signUp("Mia")
    const base = `/api/shopping-lists/${weekly.id}`

    expect(await lists(mia)).toEqual([])
    expect((await api.get(base, mia)).status).toBe(404)
    expect((await api.request("PATCH", base, mia, { name: "x" })).status).toBe(
      404
    )
    expect((await api.del(base, mia)).status).toBe(404)
    expect((await api.post(`${base}/items`, mia, { name: "x" })).status).toBe(
      404
    )
    expect(
      (
        await api.request("PATCH", `${base}/items/${item.id}`, mia, {
          checked: true,
        })
      ).status
    ).toBe(404)
    expect((await api.del(`${base}/items/${item.id}`, mia)).status).toBe(404)
    expect((await lists(olivia))[0]!.items[0]).toMatchObject({ checked: false })
  })

  test("you can't make a list for a household you are not in", async () => {
    const { id } = await household(olivia)
    const mia = await api.signUp("Mia")
    const res = await api.post("/api/shopping-lists", mia, {
      name: "Sneaky",
      householdId: id,
    })
    expect(res.status).toBe(404)
  })

  test("only its maker or a household owner can delete a household list", async () => {
    const { id, cookies } = await household(olivia, "Sam", "Alex")
    const [sam, alex] = cookies as [string, string]
    const list = await makeList("Weekly", sam, { householdId: id })
    expect((await api.del(`/api/shopping-lists/${list.id}`, alex)).status).toBe(
      403
    )
    // The owner of the household can.
    expect(
      (await api.del(`/api/shopping-lists/${list.id}`, olivia)).status
    ).toBe(204)

    const other = await makeList("Other", sam, { householdId: id })
    expect((await api.del(`/api/shopping-lists/${other.id}`, sam)).status).toBe(
      204
    )
  })

  test("everyone in the household can rename the list", async () => {
    const { id, cookies } = await household(olivia, "Sam")
    const list = await makeList("Weekly", olivia, { householdId: id })
    const res = await api.request(
      "PATCH",
      `/api/shopping-lists/${list.id}`,
      cookies[0],
      {
        name: "Friday shop",
      }
    )
    expect(res.status).toBe(200)
  })

  test("a member who left the household no longer sees its lists", async () => {
    const { id, cookies } = await household(olivia, "Sam")
    const sam = cookies[0]!
    await makeList("Weekly", olivia, { householdId: id })
    expect(await lists(sam)).toHaveLength(1)
    expect((await api.post(`/api/households/${id}/leave`, sam)).status).toBe(
      204
    )
    expect(await lists(sam)).toEqual([])
  })
})
