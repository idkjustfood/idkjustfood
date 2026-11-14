import type { Supermarket } from "./supermarket.js"

/** Aldi shops have one fixed path: bread and produce first, shelves, then chilled and frozen at the back. */
const route: Supermarket["route"] = [
  "bakery",
  "produce",
  "canned",
  "dryGoods",
  "spices",
  "sweets",
  "drinks",
  "household",
  "dairy",
  "meat",
  "fish",
  "frozen",
]

const source =
  "Typical Aldi path from general knowledge. Not checked in a shop, and Aldi Nord and Aldi Süd may differ. Please correct it."

export const aldiSued: Supermarket = {
  id: "aldi-sued",
  aliases: ["aldi"],
  name: "Aldi Süd",
  source,
  route,
}

export const aldiNord: Supermarket = {
  id: "aldi-nord",
  name: "Aldi Nord",
  source,
  route,
}
