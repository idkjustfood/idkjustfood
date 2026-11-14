import { z } from "zod"

/**
 * The groups of tags, in the order they are shown. Each group has a color name
 * (the app turns it into classes), so a tag looks the same everywhere.
 */
export const tagGroupKeys = [
  "cuisine",
  "dish",
  "diet",
  "nutrition",
  "time",
  "meal",
] as const
export type TagGroup = (typeof tagGroupKeys)[number]

export const tagGroupColors: Record<TagGroup, string> = {
  cuisine: "orange",
  dish: "sky",
  diet: "green",
  nutrition: "violet",
  time: "amber",
  meal: "rose",
}

/**
 * Every tag a recipe can have, by group, in the order they are shown. The key
 * is what is stored and sent, in every language; the app shows a translated
 * name (`tags.*` in `apps/app/locales/<lang>/common.json`).
 *
 * The planner uses the `meal` tags: `breakfast`, `midday` and `afternoon`.
 */
export const tagsByGroup = {
  cuisine: [
    "italian",
    "french",
    "spanish",
    "greek",
    "mediterranean",
    "german",
    "american",
    "mexican",
    "turkish",
    "middle_eastern",
    "indian",
    "thai",
    "vietnamese",
    "chinese",
    "japanese",
    "korean",
  ],
  dish: [
    "pasta",
    "pizza",
    "salad",
    "soup",
    "stew",
    "curry",
    "rice",
    "noodles",
    "burger",
    "sandwich",
    "bread",
    "bake",
    "sauce",
    "snack",
    "dessert",
    "cake",
    "drink",
  ],
  diet: ["vegetarian", "vegan", "gluten_free", "dairy_free"],
  nutrition: ["high_protein", "low_carb", "low_calorie", "low_fat"],
  time: [
    "under_15_min",
    "under_30_min",
    "under_45_min",
    "under_60_min",
    "under_90_min",
  ],
  meal: ["breakfast", "midday", "afternoon"],
} as const satisfies Record<TagGroup, readonly string[]>

export type TagKey = (typeof tagsByGroup)[TagGroup][number]

/** All tags, sorted by group and then in the order of their group. */
export const tagKeys: readonly TagKey[] = tagGroupKeys.flatMap(
  (group) => tagsByGroup[group] as readonly TagKey[]
)

export const TagSchema = z.enum(tagKeys as [TagKey, ...TagKey[]])

/** A recipe has any number of tags from the list, each at most once. */
export const TagsSchema = z
  .array(TagSchema)
  .max(tagKeys.length)
  .refine((tags) => new Set(tags).size === tags.length, "Tags can't repeat")

export function isTagKey(value: unknown): value is TagKey {
  return typeof value === "string" && (tagKeys as readonly string[]).includes(value)
}

const groupOfKey = new Map<string, TagGroup>(
  tagGroupKeys.flatMap((group) =>
    tagsByGroup[group].map((tag) => [tag, group] as [string, TagGroup])
  )
)

export function tagGroup(tag: TagKey): TagGroup {
  return groupOfKey.get(tag)!
}

/** Puts tags in the fixed order: by group, then as listed in the group. */
export function sortTags(tags: readonly TagKey[]): TagKey[] {
  return tagKeys.filter((tag) => tags.includes(tag))
}

/** Tags split by group, in order. Groups without a tag are left out. */
export function groupTags(
  tags: readonly TagKey[]
): { group: TagGroup; tags: TagKey[] }[] {
  return tagGroupKeys
    .map((group) => ({
      group,
      tags: (tagsByGroup[group] as readonly TagKey[]).filter((tag) =>
        tags.includes(tag)
      ),
    }))
    .filter((entry) => entry.tags.length > 0)
}

/** Other ways to write a tag, in the app's languages. Used to fit old and outside tags. */
const spellings: Record<TagKey, string[]> = {
  italian: ["italy", "italienisch", "italien", "italiano", "italia", "italienne"],
  french: ["france", "französisch", "frankreich", "francés", "francia", "français", "francese", "française"],
  spanish: ["spain", "spanisch", "spanien", "español", "españa", "espagnol", "espagne", "spagnolo", "spagna"],
  greek: ["greece", "griechisch", "griechenland", "griego", "grecia", "grec", "grèce", "greco"],
  mediterranean: ["mediterran", "mediterráneo", "méditerranéen", "mediterraneo"],
  german: ["germany", "deutsch", "deutschland", "alemán", "alemania", "allemand", "allemagne", "tedesco", "germania"],
  american: ["usa", "amerikanisch", "americano", "estadounidense", "américain", "americain"],
  mexican: ["mexico", "mexikanisch", "mexiko", "mexicano", "méxico", "mexicain", "mexique", "messicano", "messico"],
  turkish: ["turkey", "türkisch", "türkei", "turco", "turquía", "turc", "turquie", "turchia"],
  middle_eastern: ["middle east", "orientalisch", "naher osten", "oriente medio", "moyen orient", "moyen-orient", "medio oriente", "mediorientale", "lebanese", "arabic"],
  indian: ["india", "indisch", "indien", "indio", "indiano", "inde"],
  thai: ["thailand", "thailändisch", "tailandés", "tailandia", "thaï", "thaïlandais", "thaïlande", "tailandese"],
  vietnamese: ["vietnam", "vietnamesisch", "vietnamita", "vietnamien"],
  chinese: ["china", "chinesisch", "chino", "chinois", "chine", "cinese", "cina"],
  japanese: ["japan", "japanisch", "japonés", "japón", "japonais", "japon", "giapponese", "giappone"],
  korean: ["korea", "koreanisch", "coreano", "corea", "coréen", "corée"],

  pasta: ["pâtes", "pasta dish", "spaghetti", "tagliatelle", "penne", "lasagne", "lasagna"],
  pizza: ["pizzas"],
  salad: ["salads", "salat", "ensalada", "salade", "insalata"],
  soup: ["soups", "suppe", "sopa", "soupe", "zuppa", "minestra"],
  stew: ["eintopf", "guiso", "ragoût", "ragout", "stufato"],
  curry: ["curries"],
  rice: ["reis", "reisgericht", "arroz", "riz", "riso"],
  noodles: ["noodle", "nudeln", "fideos", "nouilles"],
  burger: ["burgers", "hamburger"],
  sandwich: ["sandwiches", "belegtes brot", "bocadillo", "sándwich", "panino", "toast"],
  bread: ["brot", "pan", "pain", "pane"],
  bake: ["baked", "casserole", "auflauf", "gratin", "al horno", "horneado", "gratiné", "al forno"],
  sauce: ["sauces", "soße", "sosse", "salsa", "dip", "dressing"],
  snack: ["snacks", "fingerfood", "finger food", "aperitivo", "apéritif", "appetizer", "starter"],
  dessert: ["desserts", "sweet", "nachtisch", "nachspeise", "süßspeise", "postre", "dolce", "dolci"],
  cake: ["cakes", "kuchen", "torte", "pastel", "tarta", "gâteau", "gateau", "torta", "cookies", "biscuits"],
  drink: ["drinks", "beverage", "getränk", "cocktail", "smoothie", "bebida", "boisson", "bevanda"],

  vegetarian: ["veggie", "vegetarisch", "vegetariano", "vegetariana", "végétarien", "végétarienne"],
  vegan: ["veganes", "vegano", "vegana", "végétalien", "végane", "plant based"],
  gluten_free: ["glutenfree", "glutenfrei", "sin gluten", "sans gluten", "senza glutine"],
  dairy_free: ["dairyfree", "lactose free", "lactosefree", "laktosefrei", "milchfrei", "sin lácteos", "sin lactosa", "sans produits laitiers", "sans lactose", "senza latticini", "senza lattosio"],

  high_protein: ["protein rich", "proteinreich", "eiweißreich", "alto en proteínas", "rico en proteínas", "riche en protéines", "ricco di proteine", "alto contenuto proteico"],
  low_carb: ["lowcarb", "kohlenhydratarm", "bajo en carbohidratos", "pauvre en glucides", "faible en glucides", "a basso contenuto di carboidrati", "povero di carboidrati"],
  low_calorie: ["low cal", "kalorienarm", "bajo en calorías", "faible en calories", "ipocalorico", "a basso contenuto calorico"],
  low_fat: ["fettarm", "bajo en grasa", "pauvre en graisses", "povero di grassi", "a basso contenuto di grassi"],

  under_15_min: ["under 15 minutes", "under 15", "15 min", "unter 15 min", "unter 15 minuten", "menos de 15 min", "moins de 15 min", "meno di 15 min"],
  under_30_min: ["under 30 minutes", "under 30", "30 min", "unter 30 min", "unter 30 minuten", "menos de 30 min", "moins de 30 min", "meno di 30 min"],
  under_45_min: ["under 45 minutes", "under 45", "45 min", "unter 45 min", "unter 45 minuten", "menos de 45 min", "moins de 45 min", "meno di 45 min"],
  under_60_min: ["under 60 minutes", "under 60", "60 min", "under 1 hour", "under an hour", "unter 60 min", "unter 1 stunde", "unter einer stunde", "menos de 60 min", "menos de 1 hora", "moins de 60 min", "moins d'1 heure", "meno di 60 min", "meno di 1 ora"],
  under_90_min: ["under 90 minutes", "under 90", "90 min", "under 1.5 hours", "unter 90 min", "unter 90 minuten", "menos de 90 min", "moins de 90 min", "meno di 90 min"],

  breakfast: ["frühstück", "fruehstueck", "desayuno", "petit-déjeuner", "petit déjeuner", "colazione", "brunch"],
  midday: ["lunch", "noon", "mittag", "mittagessen", "almuerzo", "comida", "déjeuner", "dejeuner", "pranzo"],
  afternoon: ["dinner", "supper", "evening", "abend", "abendessen", "nachmittag", "cena", "tarde", "dîner", "diner", "soir", "après-midi", "pomeriggio"],
}

/** How a text is compared with the list: no case, no dashes, one space, no end dot. */
export function normalizeTagText(text: string) {
  return text
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
    .replace(/\.$/, "")
    .trim()
}

const aliases = new Map<string, TagKey>()
for (const key of tagKeys) {
  for (const word of [key, ...spellings[key]]) {
    const normal = normalizeTagText(word)
    if (!aliases.has(normal)) aliases.set(normal, key)
  }
}

/** Every known text (normalized) and the tag it stands for. Used by the data migration. */
export const tagSpellings: [string, TagKey][] = [...aliases]

/** The tag a text stands for ("Italienisch" is `italian`), or null when it is not on the list. */
export function fitTag(text: unknown): TagKey | null {
  if (typeof text !== "string") return null
  return aliases.get(normalizeTagText(text)) ?? null
}

/**
 * Makes tags from outside (an AI answer, a web page, a file someone imports)
 * fit the list: known spellings become their key, anything else is dropped,
 * repeats are removed and the result is in the fixed order.
 */
export function fitTags(tags: unknown): TagKey[] {
  const list = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? tags.split(",")
      : []
  const fitted = new Set<TagKey>()
  for (const item of list) {
    const key = fitTag(item)
    if (key) fitted.add(key)
  }
  return sortTags([...fitted])
}

/** The meal tags the planner uses. */
export const mealTags = tagsByGroup.meal
export type MealTag = (typeof mealTags)[number]

/** True for the three tags that say when a meal is eaten. */
export function isMealTag(tag: TagKey): tag is MealTag {
  return (mealTags as readonly string[]).includes(tag)
}

/** A tag in English, for files that people read (Markdown, schema.org keywords). */
export function tagLabelEn(tag: TagKey) {
  const text = tag.replace(/_/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}
