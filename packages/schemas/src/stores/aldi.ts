import type { Supermarket } from "./supermarket.js"

/**
 * Aldi has one fixed path through the shop, the same in almost every branch: bread and fresh
 * produce first, then one pass along the shelves, and the chilled and frozen counters at the
 * back. This is an approximation; improve it if your branch differs.
 */
export const aldi: Supermarket = {
  id: "aldi",
  name: "Aldi",
  route: [
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
  ],
}
