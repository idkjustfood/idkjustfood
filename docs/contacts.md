# Contacts

Contacts keep the numbers a household needs at hand: craftspeople, doctors, school. A contact is
**personal** or **shared with a household** (every member sees and changes it). Nothing here needs
the cloud edition, so self-hosted installs have it too.

## In the app

- **Home → Contacts.** The dropdown at the top switches between your own contacts and the contacts
  of a household, like shopping lists.
- A contact has a name, what they do (a role, like "Plumber"), a phone number, an email address and
  a note. Only the name is required. An email address must look like one or stay empty.
- The phone and the letter next to a contact call or write to them. They only show for what is
  filled in.
- Search finds a contact by name, role, phone, email or note.
- Tap a contact to edit or delete it.
- **Offline:** contacts are kept on the phone and changes are sent when there is a connection again.
  The same generic list store as the inventory is used (`lib/list-store.ts`, `lib/contacts.ts`).

## API

| Method and path | What it does |
| --- | --- |
| `GET /api/contacts` | Your contacts and the contacts of your households. `?householdId=` limits it to one household |
| `POST /api/contacts` | Add a contact: `name`, optional `role`, `phone`, `email`, `note`, `householdId` and `id` |
| `PATCH /api/contacts/{contactId}` | Change any of those fields |
| `DELETE /api/contacts/{contactId}` | Delete a contact |

Access works as for the inventory: not visible means `404`, a client-chosen `id` makes a retry safe.

## Not built yet

Importing contacts from the phone's address book.
