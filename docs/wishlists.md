# Wishlists

Wishlists keep wishes and gift ideas, **per person**. You create people ("Mia", "Grandpa") and put
wishes under them. A wish can also sit at the **root**, without a person. People and wishes are
**personal** or **shared with a household**. Nothing here needs the cloud edition.

## In the app

- **More → Family → Wishlists.** The dropdown at the top switches between your own wishlists and
  those of a household.
- Wishes without a person are shown first, under "Not for anyone in particular". Every person is a
  section below it, with a pencil (rename or delete) and a "+" (add a wish for them).
- A wish has a title, an optional note and an optional web link (`http` or `https` only). The
  checkbox marks it as got; open wishes are listed before got ones.
- In the wish form "For" moves the wish to another person, or to no one (the root).
- Deleting a person also deletes their wishes. The form says how many.
- Search finds wishes by title, note or link; while searching, people without a match are hidden.
- **Offline:** people and wishes are kept on the phone and changes are sent when there is a
  connection again (`lib/wishlists.ts`, two lists on the generic store in `lib/list-store.ts`).

## API

| Method and path | What it does |
| --- | --- |
| `GET /api/wish-people` | The people of your wishlists and your households. `?householdId=` limits it |
| `POST /api/wish-people` | Add a person: `name`, optional `householdId` and `id` |
| `PATCH /api/wish-people/{personId}` | Rename a person |
| `DELETE /api/wish-people/{personId}` | Delete a person and their wishes |
| `GET /api/wishes` | Your wishes and those of your households. `?householdId=` limits it |
| `POST /api/wishes` | Add a wish: `title`, optional `note`, `link`, `done`, `personId`, `householdId`, `id` |
| `PATCH /api/wishes/{wishId}` | Change any of those, `personId: null` moves it to the root |
| `DELETE /api/wishes/{wishId}` | Delete a wish |

A wish may only sit under a person of the same space: a personal wish under one of your own people,
a household wish under a person of that household. Otherwise the answer is `404`. Access works as
for contacts: not visible means `404`, a client-chosen `id` makes a retry safe.

## Not built yet

Sharing one person's list with someone outside the household, and hiding got wishes from the
person they are for (surprises).
