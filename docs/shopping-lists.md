# Shopping lists

A shopping list is either **personal** (only its owner sees it) or **shared with a household**
(every member sees and changes it). Both kinds work the same way. Nothing here needs the cloud
edition, so self-hosted installs have it too.

## In the app

- **Shopping tab:** the lists of the space you picked with the dropdown at the top: your personal
  space, or one of your households. Lists of other spaces never show. A new list is made in the
  selected space. The choice is remembered on the device; if you leave the household, the app goes
  back to your personal space. Without a household there is no dropdown.
- **Add items by hand** with a name and an optional amount and unit. An item that matches a line
  already on the list (same name and unit) is merged into it, like a recipe's ingredients. The same
  item without an amount is not added twice. Tick them off (they move to "In the basket"), remove them, or clear all
  ticked items.
- **Add a recipe:** from a list ("Add a recipe" in the header) or from the recipe screen
  ("Add to shopping list", for the servings you chose there).
- Same ingredients are merged. See [How merging works](#how-merging-works).
- **Pantry staples** (Settings, "Pantry staples") are left out when a recipe is added, and the
  app tells you which ones were skipped. See [Pantry staples](#pantry-staples).

## API

All endpoints need a signed-in user and are in the OpenAPI document (`/api/openapi.json`).

| Method and path | What it does |
| --- | --- |
| `GET /api/shopping-lists` | Your personal lists and the lists of your households, with items |
| `POST /api/shopping-lists` | Make a list. `householdId` shares it with a household, no `householdId` makes a personal list |
| `GET /api/shopping-lists/{listId}` | One list with its items |
| `PATCH /api/shopping-lists/{listId}` | Rename. Everyone who can see the list can |
| `DELETE /api/shopping-lists/{listId}` | Delete. The person who made it, or a household owner |
| `POST /api/shopping-lists/{listId}/items` | Add an item as written |
| `PATCH /api/shopping-lists/{listId}/items/{itemId}` | Change an item or tick it (`checked`) |
| `DELETE /api/shopping-lists/{listId}/items/{itemId}` | Remove an item |
| `DELETE /api/shopping-lists/{listId}/items` | Remove all ticked items |
| `POST /api/shopping-lists/{listId}/recipes` | Add a recipe's ingredients (`recipeId`, optional `servings`). Answers with the list and `skipped`: the names of the ingredients left out because they are pantry staples |
| `GET /api/pantry` | The pantry staples of your personal space, or of a household with `?householdId=` |
| `POST /api/pantry/items` | Add a staple (`name`, optional `householdId`) |
| `DELETE /api/pantry/items/{itemId}` | Remove a staple |
| `POST /api/pantry/reset` | Replace the list with the default one (optional `householdId`) |

### Who can see what

A list you can't see answers `404`, the same as a list that doesn't exist, so nobody can find
out that someone else's list exists.

- Personal list: only its owner. Other members of the same household can't see it either.
- Household list: only members of that household. A person who leaves loses access.
- Adding a recipe needs access to both the list and the recipe.

### Ids chosen by the client

`POST /api/shopping-lists` and `POST .../items` accept an optional `id`. Sending an id that
already exists returns the existing list or item and changes nothing, so a retry after a lost
connection never creates duplicates. An id used by someone else's list gives `409`.

## How merging works

`POST .../recipes` scales every amount to the chosen servings and puts the ingredients on the
list. An ingredient is merged into an existing line when:

- the name is the same (ignoring upper and lower case and spaces), and
- the unit is the same (units come from a fixed list, see `docs/units.md`), and
- the line is not ticked off yet, and
- both have an amount, or both have none.

Sections of a recipe (see `docs/recipe-sections.md`) do not matter: ingredients of all sections are merged
as one list. Then the amounts add up: 200 g flour + 100 g flour is 300 g flour. Otherwise a new line is added.
Units are **not converted** (cups to grams would be a guess), so `1 cup` and `200 g` of flour stay
two lines. An ingredient without an amount is added without one and never changes another line's
amount. The code is `addIngredients` in `packages/schemas/src/shopping.ts`. The API runs the merge
in a transaction, so two people adding recipes at once don't lose each other's lines.

## Pantry staples

Most kitchens always have salt, pepper and oil. Each person (personal space) and each household
keeps a list of such items. When a recipe is added to a shopping list, ingredients that are on the
list **of that list's space** are left out: a household list uses the household's staples, a personal
list uses the person's own. The answer of `POST .../recipes` has `skipped` with the names that were
left out, and the app shows them, so nothing disappears without notice.

- **Matching** compares the whole name and ignores upper and lower case and extra spaces: `Salt`
  matches `salt`. Similar names do not match (`sea salt` is not `salt`). Added names that are
  already on the list are not added twice.
- **Default list:** a pantry is made the first time it is needed (when it is read, when a
  household is created, or when a recipe is added) and starts with a default list in the
  person's language: salt, pepper, black pepper, oil, olive oil and vegetable oil. The lists
  are in `defaultPantryItems` in `packages/schemas/src/pantry.ts`; a new language needs its own list
  there. Clients send the language they use (`language`), the API falls back to English. A pantry the
  person emptied stays empty.
- **Who can change it:** the person for their own pantry, every member for a household's. Other
  people get `404`, like for lists.
- **Reset:** `POST /api/pantry/reset` replaces the whole list with the default one and removes
  added items. The app asks for confirmation first.
- **In the app:** Settings, "Pantry staples" (it shows the space picked with the dropdown), also
  linked from the household screen. After creating a household the app says that its list exists.
- **Offline:** adding a recipe already needs a connection (see below), and so does the pantry, because
  it is matched on the server. Without a connection the staples can't be changed, and a recipe isn't added.

The code is in `apps/api/src/pantry` and `packages/schemas/src/pantry.ts` (`splitStaples`).

## Offline on the phone

Lists are used in shops, often with bad signal, so they work without a connection. The code is in
`apps/app/lib/shopping-store.ts` and `shopping-ops.ts`.

- The lists are kept on the device (async storage on phones, local storage on the web) every time
  they change, so they open without a connection.
- A change (tick, add, remove, rename, new list, delete) shows at once and is added to a queue that is
  also kept on the device, so it survives closing the app.
- The queue is sent in order when the server can be reached: when the app opens, comes back to the
  front, the browser goes online, and every 30 seconds while it is open. After that the lists are
  loaded from the server again, so changes of other household members show up (a refresh is
  enough, there are no live updates).
- While changes are waiting, a banner says that you are offline and how many changes are waiting.
- If the server rejects a change for good (for example the list was deleted by someone else), that
  change is dropped. Network errors and server errors keep it in the queue.
- If two people change the same item, the last change to reach the server wins.
- **Adding a recipe needs a connection**, because the server merges it with what is on the list. The
  app says so if you are offline.
- The settings screen has "Pretend to be offline" to try this without airplane mode.

Lists saved on a device are kept per account on that device and are not removed when you log out.
