# Notes

Notes are plain text a person or household wants to keep. A note is **personal** or **shared with a
household** (every member sees and changes it). Nothing here needs the cloud edition, so self-hosted
installs have it too.

## In the app

- **Life → Notes**, and "Add note" in the "+" sheet. The dropdown at the top switches
  between your own notes and the notes of a household, like shopping lists.
- A note has an optional title and a body. It needs at least one of them. Without a title, the first
  line of the text is shown as the heading.
- Newest first. Search finds a note by words in its title or text.
- Tap a note to edit or delete it.
- **Offline:** notes are kept on the phone and changes are sent when there is a connection again.
  It uses the generic list store (`lib/list-store.ts`, `lib/notes.ts`).

## API

| Method and path | What it does |
| --- | --- |
| `GET /api/notes` | Your notes and the notes of your households. `?householdId=` limits it to one household |
| `POST /api/notes` | Add a note: optional `title`, `body`, `householdId` and `id` (one of title or body must have text) |
| `PATCH /api/notes/{noteId}` | Change `title` or `body` |
| `DELETE /api/notes/{noteId}` | Delete a note |

Access works as for contacts: not visible means `404`, a client-chosen `id` makes a retry safe.

## Not built yet

Pinning, checklists inside a note, and sorting by last change.
