# Shopping lists

A shopping list is either **personal** (only its owner sees it) or **shared with a household**
(every member sees and changes it). Both kinds work the same way. Nothing here needs the cloud
edition, so self-hosted installs have it too.

## In the app

- **Shopping tab:** all your lists, each marked "Personal" or with the household's name. Choose
  which kind when you make a list.
- **Add items by hand** with a name and an optional amount and unit. An item that matches a line
  already on the list (same name and unit) is merged into it, like a recipe's ingredients. The same
  item without an amount is not added twice. Tick them off (they move to "In the basket"), remove them, or clear all
  ticked items.
- **Add a recipe:** from a list ("Add a recipe" in the header) or from the recipe screen
  ("Add to shopping list", for the servings you chose there).
- Same ingredients are merged. See [How merging works](#how-merging-works).

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
| `POST /api/shopping-lists/{listId}/recipes` | Add a recipe's ingredients (`recipeId`, optional `servings`) |

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
- the unit is the same (`g`, `gram` and `grams` count as the same), and
- the line is not ticked off yet, and
- both have an amount, or both have none.

Then the amounts add up: 200 g flour + 100 g flour is 300 g flour. Otherwise a new line is added.
Units are **not converted** (cups to grams would be a guess), so `1 cup` and `200 g` of flour stay
two lines. An ingredient without an amount is added without one and never changes another line's
amount. The code is `addIngredients` in `packages/schemas/src/shopping.ts`. The API runs the merge
in a transaction, so two people adding recipes at once don't lose each other's lines.

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
