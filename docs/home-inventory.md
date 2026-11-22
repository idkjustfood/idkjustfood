# Home inventory

The inventory lists what a household owns and where it is kept: "Candles, kitchen drawer, 6".
Items are **personal** or **shared with a household** (every member sees and changes them).
Nothing here needs the cloud edition, so self-hosted installs have it too.

## In the app

- **Home → Home inventory.** The dropdown at the top switches between your own items and the items
  of a household, like shopping lists.
- An item has a name, a place (a room, a box, a shelf), a quantity (1 or more) and a note. Only the
  name is required. A place or note that was not written down stays empty; nothing is guessed.
- Search finds an item by name, place or note. Every word typed has to match.
- Tap an item to edit or delete it.
- **Offline:** items are kept on the phone and changes are sent when there is a connection again.
  This is the generic list store in `lib/list-store.ts`, set up with `createSyncedList`
  (`lib/synced-list.tsx`). `lib/inventory.ts` only says which API calls to use.

## API

| Method and path | What it does |
| --- | --- |
| `GET /api/inventory` | Your items and the items of your households. `?householdId=` limits it to one household |
| `POST /api/inventory` | Add an item: `name`, optional `place`, `quantity`, `note`, `householdId` (none means personal) and `id` |
| `PATCH /api/inventory/{itemId}` | Change `name`, `place`, `quantity` or `note` |
| `DELETE /api/inventory/{itemId}` | Delete an item |

An item you can't see answers `404`, the same as one that doesn't exist. `POST` accepts an `id`
chosen by the client: sending an id that already exists returns that item and changes nothing, and
an id that belongs to someone else gives `409`. The access rules are shared with the contacts
(`apps/api/src/space-store.ts`).

## Not built yet

Photos of items, and linking an item to a document (for example its warranty).
