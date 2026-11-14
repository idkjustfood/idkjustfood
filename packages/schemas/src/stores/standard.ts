import type { Supermarket } from "./supermarket.js"

/**
 * The typical German supermarket (Rewe, Edeka, Kaufland, ...): fresh produce and bread at the
 * entrance, the long aisles of dry goods and sweets, then the chilled and frozen counters, and
 * drinks at the end where the heavy things are easy to carry to the checkout.
 */
export const standard: Supermarket = {
  id: "standard",
  route: [
    "produce",
    "bakery",
    "dryGoods",
    "canned",
    "spices",
    "sweets",
    "meat",
    "fish",
    "dairy",
    "frozen",
    "drinks",
    "household",
  ],
}
