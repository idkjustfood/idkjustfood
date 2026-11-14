import { standardRoute } from "./standard.js"
import type { Supermarket } from "./supermarket.js"

/** Lidl has its bakery at the entrance, before the fresh produce. The rest follows the standard route. */
export const lidl: Supermarket = {
  id: "lidl",
  name: "Lidl",
  source:
    "Bakery first is common knowledge about Lidl. The rest is the standard route. Not checked in a shop. Please correct it.",
  route: [
    "bakery",
    "produce",
    ...standardRoute.filter((s) => s !== "bakery" && s !== "produce"),
  ],
}
