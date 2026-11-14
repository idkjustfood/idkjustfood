/**
 * Fake sample data for the UI shell. Nothing here comes from the API.
 * Replace with real queries once the API endpoints exist.
 */

import type { UnitKey } from "@workspace/schemas"

export type SourceKind = "video" | "website" | "photo" | "text"

export type Ingredient = {
  id: string
  name: string
  /** Empty when the source does not say. Never guessed. */
  quantity: number | null
  unit: UnitKey | null
  note?: string
}

export type Step = {
  id: string
  text: string
  /** A step like "bake 30 minutes" gets a tap-to-start timer. */
  timerMinutes?: number
}

export type Nutrition = {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type Space = "personal" | "household"

export type Recipe = {
  id: string
  title: string
  description: string
  source: { kind: SourceKind; label: string; url?: string }
  servings: number
  prepMinutes: number
  cookMinutes: number
  tags: string[]
  ingredients: Ingredient[]
  steps: Step[]
  /** Per serving, an estimate from a food database. */
  nutrition: Nutrition
  space: Space
  /** Placeholder cover colour until there are real images. */
  cover: string
}

export const recipes: Recipe[] = [
  {
    id: "tuscan-pasta",
    title: "Creamy Tuscan chicken pasta",
    description:
      "A weeknight pasta with sun-dried tomatoes, spinach and parmesan.",
    source: {
      kind: "video",
      label: "Instagram reel · @weeknightpasta",
      url: "https://www.instagram.com/reel/example1",
    },
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 25,
    tags: ["Italian", "Pasta", "Under 45 min"],
    ingredients: [
      { id: "i1", name: "Penne", quantity: 400, unit: "g" },
      {
        id: "i2",
        name: "Chicken breast",
        quantity: 500,
        unit: "g",
        note: "cut into strips",
      },
      { id: "i3", name: "Garlic", quantity: 3, unit: "clove", note: "minced" },
      { id: "i4", name: "Sun-dried tomatoes", quantity: 100, unit: "g" },
      { id: "i5", name: "Cream", quantity: 250, unit: "ml" },
      { id: "i6", name: "Baby spinach", quantity: 2, unit: null, note: "handfuls" },
      { id: "i7", name: "Parmesan", quantity: 50, unit: "g", note: "grated" },
      { id: "i8", name: "Salt and pepper", quantity: null, unit: null },
    ],
    steps: [
      {
        id: "s1",
        text: "Cook the penne in salted water until al dente.",
        timerMinutes: 11,
      },
      {
        id: "s2",
        text: "Season the chicken and fry it in a large pan until golden, about 6 minutes.",
        timerMinutes: 6,
      },
      {
        id: "s3",
        text: "Add the garlic and sun-dried tomatoes and cook for one minute.",
      },
      {
        id: "s4",
        text: "Pour in the cream, bring to a simmer and stir in the spinach until it wilts.",
      },
      {
        id: "s5",
        text: "Add the parmesan and the drained pasta. Toss and serve.",
      },
    ],
    nutrition: { kcal: 780, protein: 48, carbs: 82, fat: 28 },
    space: "personal",
    cover: "bg-amber-200 dark:bg-amber-900",
  },
  {
    id: "smashed-potatoes",
    title: "Crispy smashed potatoes",
    description:
      "Boiled baby potatoes, smashed flat and roasted until crunchy.",
    source: {
      kind: "video",
      label: "Instagram reel · @crispythings",
      url: "https://www.instagram.com/reel/example2",
    },
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 50,
    tags: ["Side dish", "Vegetarian", "Gluten-free"],
    ingredients: [
      { id: "i1", name: "Baby potatoes", quantity: 600, unit: "g" },
      {
        id: "i2",
        name: "Olive oil",
        quantity: null,
        unit: null,
        note: "a good drizzle",
      },
      { id: "i3", name: "Flaky salt", quantity: null, unit: null },
      { id: "i4", name: "Rosemary", quantity: 2, unit: null, note: "sprigs" },
    ],
    steps: [
      { id: "s1", text: "Boil the potatoes until soft.", timerMinutes: 20 },
      { id: "s2", text: "Smash each potato flat with the bottom of a glass." },
      {
        id: "s3",
        text: "Drizzle with oil, add salt and rosemary, and bake at 220 °C.",
        timerMinutes: 30,
      },
    ],
    nutrition: { kcal: 340, protein: 6, carbs: 48, fat: 14 },
    space: "household",
    cover: "bg-yellow-200 dark:bg-yellow-900",
  },
  {
    id: "lentil-dal",
    title: "One-pot red lentil dal",
    description: "Warming, cheap and ready in half an hour.",
    source: {
      kind: "website",
      label: "example-kitchen.com",
      url: "https://example-kitchen.com/dal",
    },
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 25,
    tags: ["Indian", "Vegan", "Under 45 min"],
    ingredients: [
      {
        id: "i1",
        name: "Red lentils",
        quantity: 250,
        unit: "g",
        note: "rinsed",
      },
      { id: "i2", name: "Onion", quantity: 1, unit: null, note: "chopped" },
      { id: "i3", name: "Coconut milk", quantity: 400, unit: "ml" },
      { id: "i4", name: "Chopped tomatoes", quantity: 400, unit: "g" },
      { id: "i5", name: "Curry powder", quantity: 2, unit: "tbsp" },
      { id: "i6", name: "Vegetable stock", quantity: 500, unit: "ml" },
    ],
    steps: [
      {
        id: "s1",
        text: "Soften the onion in a little oil, then stir in the curry powder.",
      },
      {
        id: "s2",
        text: "Add lentils, tomatoes, coconut milk and stock. Simmer until thick.",
        timerMinutes: 20,
      },
      { id: "s3", text: "Season and serve with rice or flatbread." },
    ],
    nutrition: { kcal: 460, protein: 19, carbs: 46, fat: 22 },
    space: "household",
    cover: "bg-orange-200 dark:bg-orange-900",
  },
  {
    id: "banana-pancakes",
    title: "Banana oat pancakes",
    description: "Three-ingredient pancakes from a cookbook page.",
    source: { kind: "photo", label: "Photo of a cookbook page" },
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    tags: ["Breakfast", "Vegetarian", "Under 15 min"],
    ingredients: [
      { id: "i1", name: "Ripe bananas", quantity: 2, unit: null },
      { id: "i2", name: "Eggs", quantity: 2, unit: null },
      { id: "i3", name: "Rolled oats", quantity: 80, unit: "g" },
      {
        id: "i4",
        name: "Butter",
        quantity: null,
        unit: null,
        note: "for the pan",
      },
    ],
    steps: [
      { id: "s1", text: "Blend bananas, eggs and oats into a smooth batter." },
      {
        id: "s2",
        text: "Fry small pancakes in butter, about 2 minutes per side.",
        timerMinutes: 4,
      },
    ],
    nutrition: { kcal: 390, protein: 14, carbs: 58, fat: 11 },
    space: "personal",
    cover: "bg-lime-200 dark:bg-lime-900",
  },
  {
    id: "chili-noodles",
    title: "Garlic chili oil noodles",
    description:
      "Ten-minute noodles with a sizzling garlic and chili dressing.",
    source: {
      kind: "video",
      label: "Instagram reel · @noodlenights",
      url: "https://www.instagram.com/reel/example3",
    },
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 5,
    tags: ["Asian", "Vegan", "Under 15 min"],
    ingredients: [
      { id: "i1", name: "Wheat noodles", quantity: 100, unit: "g" },
      { id: "i2", name: "Garlic", quantity: 2, unit: "clove", note: "grated" },
      { id: "i3", name: "Chili flakes", quantity: 1, unit: "tbsp" },
      { id: "i4", name: "Soy sauce", quantity: 2, unit: "tbsp" },
      {
        id: "i5",
        name: "Neutral oil",
        quantity: 3,
        unit: "tbsp",
        note: "very hot",
      },
      { id: "i6", name: "Spring onion", quantity: null, unit: null },
    ],
    steps: [
      { id: "s1", text: "Cook the noodles.", timerMinutes: 4 },
      {
        id: "s2",
        text: "Put garlic, chili and spring onion in a bowl and pour the hot oil over them.",
      },
      { id: "s3", text: "Add soy sauce and the drained noodles and toss." },
    ],
    nutrition: { kcal: 610, protein: 13, carbs: 74, fat: 30 },
    space: "personal",
    cover: "bg-red-200 dark:bg-red-900",
  },
  {
    id: "greek-salad",
    title: "Greek salad",
    description: "Tomatoes, cucumber, olives and feta.",
    source: { kind: "text", label: "Pasted text" },
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 0,
    tags: ["Greek", "Vegetarian", "Gluten-free", "Under 15 min"],
    ingredients: [
      { id: "i1", name: "Tomatoes", quantity: 4, unit: null },
      { id: "i2", name: "Cucumber", quantity: 0.5, unit: null },
      { id: "i3", name: "Red onion", quantity: 0.5, unit: null },
      { id: "i4", name: "Kalamata olives", quantity: 80, unit: "g" },
      { id: "i5", name: "Feta", quantity: 200, unit: "g" },
      { id: "i6", name: "Olive oil", quantity: 3, unit: "tbsp" },
      { id: "i7", name: "Dried oregano", quantity: 1, unit: "tsp" },
    ],
    steps: [
      { id: "s1", text: "Cut the vegetables into chunks." },
      { id: "s2", text: "Top with olives and the block of feta." },
      { id: "s3", text: "Pour over the oil and sprinkle with oregano." },
    ],
    nutrition: { kcal: 420, protein: 15, carbs: 14, fat: 34 },
    space: "household",
    cover: "bg-sky-200 dark:bg-sky-900",
  },
]

export const recipeTags = Array.from(
  new Set(recipes.flatMap((r) => r.tags))
).sort()

export function findRecipe(id: string | undefined) {
  return [...recipes, importedRecipe].find((r) => r.id === id)
}

/** What a freshly imported recipe looks like before the user saves it. */
export const importedRecipe: Recipe = {
  id: "imported",
  title: "Lemon garlic salmon traybake",
  description: "Salmon and green beans roasted on one tray.",
  source: {
    kind: "video",
    label: "Instagram reel · @trayfortwo",
    url: "https://www.instagram.com/reel/example4",
  },
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 15,
  tags: ["Fish", "Gluten-free", "Under 45 min"],
  ingredients: [
    { id: "i1", name: "Salmon fillets", quantity: 2, unit: null },
    { id: "i2", name: "Green beans", quantity: 200, unit: "g" },
    { id: "i3", name: "Lemon", quantity: 1, unit: null, note: "sliced" },
    { id: "i4", name: "Garlic", quantity: null, unit: null },
    { id: "i5", name: "Olive oil", quantity: null, unit: null },
    { id: "i6", name: "Salt and pepper", quantity: null, unit: null },
  ],
  steps: [
    { id: "s1", text: "Spread the beans on a tray and put the salmon on top." },
    { id: "s2", text: "Add lemon slices, garlic, oil, salt and pepper." },
    { id: "s3", text: "Bake at 200 °C.", timerMinutes: 15 },
  ],
  nutrition: { kcal: 450, protein: 36, carbs: 9, fat: 29 },
  space: "personal",
  cover: "bg-rose-200 dark:bg-rose-900",
}

export type ShoppingItem = {
  id: string
  name: string
  quantity: number | null
  unit: UnitKey | null
  category: string
  checked: boolean
  /** Recipes this item came from. More than one means amounts were merged. */
  fromRecipes: string[]
  /** The single amounts before merging, for example ["200 g", "100 g"]. */
  mergedFrom?: string[]
}

export type ShoppingList = {
  id: string
  name: string
  space: Space
  sharedWith: string[]
  updated: string
  items: ShoppingItem[]
}

export const shoppingLists: ShoppingList[] = [
  {
    id: "weekly",
    name: "Weekly shop",
    space: "household",
    sharedWith: ["Sam", "Alex"],
    updated: "Updated 10 min ago by Sam",
    items: [
      {
        id: "a",
        name: "Garlic",
        quantity: 5,
        unit: "clove",
        category: "Produce",
        checked: false,
        fromRecipes: [
          "Creamy Tuscan chicken pasta",
          "Garlic chili oil noodles",
        ],
        mergedFrom: ["3 cloves", "2 cloves"],
      },
      {
        id: "b",
        name: "Baby spinach",
        quantity: 2,
        unit: "bunch",
        category: "Produce",
        checked: true,
        fromRecipes: ["Creamy Tuscan chicken pasta"],
      },
      {
        id: "c",
        name: "Onion",
        quantity: 1,
        unit: null,
        category: "Produce",
        checked: false,
        fromRecipes: ["One-pot red lentil dal"],
      },
      {
        id: "d",
        name: "Tomatoes",
        quantity: 4,
        unit: null,
        category: "Produce",
        checked: false,
        fromRecipes: ["Greek salad"],
      },
      {
        id: "e",
        name: "Cream",
        quantity: 250,
        unit: "ml",
        category: "Dairy",
        checked: false,
        fromRecipes: ["Creamy Tuscan chicken pasta"],
      },
      {
        id: "f",
        name: "Parmesan",
        quantity: 50,
        unit: "g",
        category: "Dairy",
        checked: false,
        fromRecipes: ["Creamy Tuscan chicken pasta"],
      },
      {
        id: "g",
        name: "Feta",
        quantity: 200,
        unit: "g",
        category: "Dairy",
        checked: true,
        fromRecipes: ["Greek salad"],
      },
      {
        id: "h",
        name: "Chopped tomatoes",
        quantity: 800,
        unit: "g",
        category: "Pantry",
        checked: false,
        fromRecipes: ["One-pot red lentil dal", "Pasta sauce"],
        mergedFrom: ["400 g", "400 g"],
      },
      {
        id: "i",
        name: "Red lentils",
        quantity: 250,
        unit: "g",
        category: "Pantry",
        checked: false,
        fromRecipes: ["One-pot red lentil dal"],
      },
      {
        id: "j",
        name: "Olive oil",
        quantity: null,
        unit: null,
        category: "Pantry",
        checked: false,
        fromRecipes: ["Crispy smashed potatoes", "Greek salad"],
      },
    ],
  },
  {
    id: "saturday",
    name: "Saturday dinner",
    space: "personal",
    sharedWith: [],
    updated: "Updated yesterday",
    items: [
      {
        id: "a",
        name: "Wheat noodles",
        quantity: 100,
        unit: "g",
        category: "Pantry",
        checked: false,
        fromRecipes: ["Garlic chili oil noodles"],
      },
      {
        id: "b",
        name: "Chili flakes",
        quantity: 1,
        unit: "tbsp",
        category: "Pantry",
        checked: false,
        fromRecipes: ["Garlic chili oil noodles"],
      },
      {
        id: "c",
        name: "Spring onion",
        quantity: null,
        unit: null,
        category: "Produce",
        checked: false,
        fromRecipes: ["Garlic chili oil noodles"],
      },
    ],
  },
  {
    id: "bbq",
    name: "Garden party",
    space: "household",
    sharedWith: ["Sam"],
    updated: "Updated 3 days ago",
    items: [
      {
        id: "a",
        name: "Baby potatoes",
        quantity: 1.2,
        unit: "kg",
        category: "Produce",
        checked: true,
        fromRecipes: ["Crispy smashed potatoes"],
      },
      {
        id: "b",
        name: "Rosemary",
        quantity: 4,
        unit: null,
        category: "Produce",
        checked: true,
        fromRecipes: ["Crispy smashed potatoes"],
      },
    ],
  },
]

export function findShoppingList(id: string | undefined) {
  return shoppingLists.find((l) => l.id === id)
}

export type Member = {
  id: string
  userId: string
  name: string
  email: string
  role: "owner" | "member"
  joinedAt: string
  you?: boolean
}

/** The demo household. Same shape as the API's answers, so the screens can use both. */
export const household = {
  id: "demo-household",
  name: "Flat 3B",
  members: [
    {
      id: "m1",
      userId: "demo-user",
      name: "You",
      email: "you@example.com",
      role: "owner",
      joinedAt: daysAgo(90),
      you: true,
    },
    {
      id: "m2",
      userId: "u2",
      name: "Sam",
      email: "sam@example.com",
      role: "member",
      joinedAt: daysAgo(60),
    },
    {
      id: "m3",
      userId: "u3",
      name: "Alex",
      email: "alex@example.com",
      role: "member",
      joinedAt: daysAgo(30),
    },
  ] satisfies Member[],
  invites: [
    {
      id: "3b7f2c",
      url: "https://idkjustfood.example/invite/3b7f2c",
      inviterName: "You",
      createdAt: daysAgo(2),
      expiresAt: daysAgo(-5),
    },
  ],
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/** Shown on the self-host settings screen. Set by the server admin, not in the app. */
export const aiProviders = {
  transcription: { provider: "OpenRouter", model: "openai/whisper-1" },
  parsing: { provider: "OpenRouter", model: "google/gemini-2.5-flash" },
}
