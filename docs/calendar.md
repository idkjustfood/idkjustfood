# Calendar

The calendar holds things that happen on a day: an appointment, a birthday, a plan. An entry has a
**title**, a **colour** and a **day**. Entries are **personal** or **for a household** (every member
sees and can change them), like shopping lists and chores. Nothing here needs the cloud edition, so
self-hosted installs have it too.

## In the app

- **Life → Calendar** (also in the "+" sheet as "Add event"). It shows one month. Days with entries
  have a dot in the colour of each entry (up to three). The arrows move between months, "Go to
  today" comes back.
- Tap a day to see its entries under the month, and to add a new one for that day. Tap an entry to
  change its title, colour or day, or to delete it.
- Personal entries and the entries of all your households are shown **together**, whichever space
  is selected at the top. Each entry says which it is: "Personal" or the name of the household.
- A new entry is for the selected space. In the form, "Add it to" lets the person choose
  "Personal" or one of their households. The owner of an entry cannot be changed afterwards.
- **Today** shows the entries of today in a "Calendar" section and the entries of **tomorrow** in a
  "Tomorrow" section at the end. Only the calendar looks ahead to tomorrow. Meals, shopping lists and
  chores show today only. Both sections show the colour of each entry, and disappear when the
  Calendar module is switched off.
- **Offline:** the calendar is kept on the phone and changes are sent when there is a connection
  again, the same way as shopping lists and chores (`lib/calendar-store.ts`, see
  [shopping-lists.md](shopping-lists.md)).

## Colours

An entry's colour is the name of a design token: `rose`, `peach`, `butter`, `sage`, `sky` or
`lavender` (`calendarColors` in `packages/schemas/src/calendar.ts`). Screens draw it with the
`tone-*` classes in `lib/calendar-colors.ts`, so every theme can paint the colours its own way and no
colour value is hardcoded. Colour is never the only sign: the title is always next to it.

## Days

A day is a plain calendar date (`2026-11-21`). The server never works with time zones: the app
sends the date it sees on the device, and works out "today" and "tomorrow" on the device too
(`calendarItems` in `lib/today.ts`). The month grid starts on Monday (`monthGrid` in
`packages/schemas/src/calendar.ts`).

## API

All endpoints need a signed-in user and are in the OpenAPI document (`/api/openapi.json`).

| Method and path | What it does |
| --- | --- |
| `GET /api/calendar` | Your personal entries and the entries of your households, sorted by day. `?householdId=` limits it to one household |
| `POST /api/calendar` | Add an entry: `title`, `color`, `date`, optional `householdId` (none means personal) and optional `id` |
| `PATCH /api/calendar/{entryId}` | Change `title`, `color` or `date` |
| `DELETE /api/calendar/{entryId}` | Delete an entry |

An entry you can't see answers `404`, the same as one that doesn't exist. Personal entries are only
for their owner. Household entries are for every member, and a person who leaves loses access. Any
member can change or delete a household entry.

`POST` accepts an `id` chosen by the client. Sending an id that already exists returns that entry and
changes nothing, so a retry after a lost connection never adds an entry twice. An id that belongs to
someone else's entry gives `409`.

## Not built yet

Times of day, repeating entries, reminders, and importing from or syncing with other calendars.
