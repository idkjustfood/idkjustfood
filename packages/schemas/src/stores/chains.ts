import { standardRoute } from "./standard.js"
import type { Supermarket } from "./supermarket.js"

/**
 * Chains with no route of their own known: they are laid out like the standard supermarket and
 * are listed so people can find their shop by name. When someone knows the real route of a
 * chain, give it its own file (like `aldi.ts`) and remove it from here.
 */
const source =
  "No route of its own is known. Uses the standard route. Not checked in a shop."

const likeStandard = (id: string, name: string): Supermarket => ({
  id,
  name,
  source,
  route: standardRoute,
})

export const standardChains: readonly Supermarket[] = [
  likeStandard("netto-marken-discount", "Netto Marken-Discount"),
  likeStandard("netto", "Netto (Stavenhagen)"),
  likeStandard("penny", "Penny"),
  likeStandard("norma", "Norma"),
  likeStandard("rewe", "Rewe"),
  likeStandard("edeka", "Edeka"),
  likeStandard("marktkauf", "Marktkauf"),
  likeStandard("kaufland", "Kaufland"),
  likeStandard("globus", "Globus"),
  likeStandard("tegut", "tegut"),
  likeStandard("famila", "Famila"),
  likeStandard("combi", "Combi"),
  likeStandard("hit", "Hit"),
  likeStandard("v-markt", "V-Markt"),
  likeStandard("feneberg", "Feneberg"),
  likeStandard("wasgau", "Wasgau"),
  likeStandard("coop", "Coop"),
  likeStandard("buenting", "Bünting"),
  likeStandard("alnatura", "Alnatura"),
  likeStandard("denns", "Denns Biomarkt"),
  likeStandard("basic", "Basic"),
  likeStandard("bio-company", "Bio Company"),
  likeStandard("metro", "Metro"),
  likeStandard("selgros", "Selgros"),
]
