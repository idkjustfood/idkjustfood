# Adding a supermarket

The shopping list is shown in the order a shopper walks through the shop. Each supermarket is one
small file that says in which order its sections come. The list screen, the selection and the
sorting do not change when you add one.

## How it works

1. Every item gets a **section** from its name (`classifySection` in
   `packages/schemas/src/stores/sections.ts`): fruit and vegetables, bakery, dairy and so on. It
   is a plain word list in English, German, Spanish, French and Italian, not AI. What it can't
   place goes to `other`, which is always shown last, never hidden.
2. A **supermarket** (`packages/schemas/src/stores/supermarket.ts`) is a `route`: the sections in
   walking order. `sortByRoute` groups the items by section and orders the groups by the route.
3. The person picks a supermarket on the shopping list screen. The choice is saved on the device
   (it works offline) and the "standard" layout is used until they pick one.

Most German supermarkets are laid out almost the same, so `standard.ts` is the default. A chain
with a fixed path of its own gets its own file, like `aldi.ts`.

## Add a supermarket

1. Copy `packages/schemas/src/stores/aldi.ts` to a new file, for example `lidl.ts`.
2. Set a stable `id` (it is saved on devices, never rename it), the brand `name` (shown as written
   in every language) and the `route`: every section in walking order. Leave `other` out.
3. Add it to `supermarkets` in `packages/schemas/src/stores/index.ts`.
4. Run `bun test` in `packages/schemas`. The tests check that ids are unique and routes are valid.

That is all. It shows up in the selection by itself. A layout that is not a brand (like
`standard`) has no `name`; the app then translates `shopping:store.<id>` and you add that key to
every language folder in `apps/app/locales`.

## Add a word or a section

- A missing word: add it to the list of its section in `rules` in `sections.ts`. Words of up to
  three letters must start a word (so `ham` does not match `champignon`); longer words match
  anywhere in the name, which makes German compounds like `Rinderhack` work. The first section
  with a match wins, so put specific words (`tomato paste`) before general ones.
- A new section: add it to `storeSections`, give it words, add `shopping:section.<id>` to every
  language folder, and add it to the routes.

## Limits

- The layouts are approximations. Branches of the same chain differ; improve a route if yours does.
- Units, amounts and recipes are not looked at, only the name of the item.
