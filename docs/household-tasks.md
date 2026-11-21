# Household chores

A chore is a task that comes back after a number of days: "Switch towels, every 3 days". You check
it off, it disappears from the list, and it returns at 00:00 on its day. Chores are **personal** or
**shared with a household** (every member sees and checks the same chores). Nothing here needs the
cloud edition, so self-hosted installs have it too.

## How a chore comes back

- The repeat interval is **whole days** (1 to 365). There are no hours.
- Checking a chore stores **the day** it was checked, not the time. It is due again from 00:00 on
  *that day + the interval*.
- Example: "Switch towels", every 3 days, checked on Monday at 14:00. It is hidden on Monday, Tuesday and Wednesday, and
  shows again on Thursday at 00:00 (after 2 days and the remaining 10 hours). Checking it at
  08:00 or 23:00 changes nothing.
- A new chore, or one that was never checked, is due right away.
- The days are calendar dates on the phone of the person who checks, so summer time and time zones
  never shift a chore by a day. The server never works with time zones. It stores `lastDoneOn` as a
  plain date (`2026-11-21`) and the app works out what is due with today's date on the device.
- A shared chore is checked once for everyone. People in different time zones each see it come back
  at their own 00:00.

The rules live in `packages/schemas/src/chores.ts` (`choreDueDay`, `isChoreDue`, `daysUntilDue`,
`splitChores`) with tests in `chores.test.ts`. The app and the API use the same code.

## In the app

- **Home → Chores** (also in the "+" sheet as "Add chore"). The dropdown at the top switches between
  your own chores and the chores of a household, like shopping lists.
- **To do** lists the chores that are due. Tap one to check it off. It moves to **Later**, where it
  says when it comes back ("Back tomorrow", "Back in 2 days").
- Tap a checked chore in **Later** to take the check back by mistake. It is due again.
- The pencil edits the name and the interval, or deletes the chore.
- The list updates by itself at 00:00 while the app is open, and when you come back to the app.
- **Offline:** chores are kept on the phone and changes are sent when there is a connection again,
  the same way as shopping lists (`lib/chore-store.ts`, see [shopping-lists.md](shopping-lists.md)).

## API

All endpoints need a signed-in user and are in the OpenAPI document (`/api/openapi.json`).

| Method and path | What it does |
| --- | --- |
| `GET /api/chores` | Your personal chores and the chores of your households. `?householdId=` limits it to one household |
| `POST /api/chores` | Add a chore: `name`, `intervalDays`, optional `householdId` (none means personal) and optional `id` |
| `PATCH /api/chores/{choreId}` | Change `name`, `intervalDays` or `lastDoneOn`. Send today's date as `lastDoneOn` to check a chore off, `null` to take it back |
| `DELETE /api/chores/{choreId}` | Delete a chore |

A chore you can't see answers `404`, the same as one that doesn't exist. Personal chores are only
for their owner; household chores are for every member, and a person who leaves loses access. Any
member can check, edit or delete a household chore.

`POST` accepts an `id` chosen by the client. Sending an id that already exists returns that chore and
changes nothing, so a retry after a lost connection never adds a chore twice. An id that belongs to
someone else's chore gives `409`.

## Not built yet

Reminders or notifications, assigning a chore to a person, a history of who did what, and intervals
shorter than a day.
