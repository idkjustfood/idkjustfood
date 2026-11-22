# Money

Money keeps track of what a person or a household spends and saves. It has five modules in the
**Money** area: **Expenses**, **Budget**, **Bills**, **Savings** and **Receipts**. Everything is
**personal** or **for a household** (every member sees and can change it), like shopping lists and
chores. Nothing here needs the cloud edition, so self-hosted installs have all of it. There is no
bank connection: people type in what they spend.

## Amounts

Amounts are **whole cents** (integers) in the database, the API and the app, never decimals, so
`0.10 + 0.20` is exactly `0.30`. `parseCents` (in `packages/schemas/src/money.ts`) reads what a
person types ("12,50", "12.5", "1.234,56") and returns nothing when it is not an amount, so the
screen says so instead of guessing. The app writes amounts with `formatMoney` (`lib/money-format.ts`),
which follows the language of the person. A hardcoded locale is never used.

Every space (the person's own money, and each household) has **one currency**, chosen in the money
settings (the gear on the Expenses screen). The default is euro. The money screens show one space at
a time, the one selected at the top, because of this.

## In the app

- **Expenses** (also "Add expense" in the "+" sheet). A month at a time, with the total, the spending
  per category, a search field and category filters. Tap an expense to change or delete it. In a
  household every expense says who paid, and "Who owes whom" splits all expenses equally between the
  members and shows the payments that settle it (`balances` and `settleUp`).
- **Budget.** A monthly budget in total and per category. A card shows what is spent and what is left
  or over, with a bar and a word ("On track", "Nearly used" from 80 %, "Over budget"). The spending
  comes from the expenses, so nothing is entered twice. A budget applies to every month.
- **Bills.** Rent, phone, insurance: an amount, the next due day and how often it comes back (weekly,
  monthly, every 3 months, yearly, or once). "Mark as paid" adds the expense (same amount and
  category) and moves the bill to its next day in one step. A monthly bill keeps its day, also after a
  short month (31 January, 28 February, 31 March). Due and overdue bills also show on **Today**, where
  they can be marked as paid too.
- **Savings.** Goals with a target amount and an optional day. Money is put into a goal or taken out
  of it, with a history. The goal shows the progress and, with a day, how much to put aside each month
  (what is missing, divided by the months left, rounded up).
- **Receipts.** Take or choose a photo of a receipt (see below).
- **Categories.** Every space starts with built-in categories (groceries, eating out, home, transport,
  health, fun, clothing, gifts, other), named in the person's language. They can be renamed, deleted
  and added to. Deleting a category keeps its expenses and bills (they have no category) and deletes
  its budget.
- **Offline:** everything except adding a receipt is kept on the phone, and changes are sent when
  there is a connection again, the same way as shopping lists (`lib/money-store.ts`, see
  [shopping-lists.md](shopping-lists.md)). Every change uses ids chosen on the device, so a retry
  never adds something twice.

## Receipts

`POST /api/money/receipts` takes a photo (JPEG, PNG, WebP or GIF, up to 10 MB). The server

1. stores the photo on its own disk, like a document (it also shows in Documents, see
   [files.md](files.md)),
2. has the vision model copy the printed text, then the parsing model pick the shop, the date and the
   total from it (`readReceipt` in `packages/extraction`),
3. saves what it found.

The AI is told never to guess. A value that is not clearly on the receipt stays empty, a date that is
not a real day and an amount that is not sensible are dropped, and the person always checks and
corrects the values before turning the receipt into an expense. If the AI is not set up or fails,
the receipt is still saved with the status `failed` and its values can be typed in. Reading needs the
AI settings from [ai-providers.md](ai-providers.md) (`AI_API_KEY` and a vision model); no other part
of money needs AI. Adding a receipt needs a connection, because the reading happens on the server.

## API

All endpoints need a signed-in user and are in the OpenAPI document (`/api/openapi.json`).

| Method and path | What it does |
| --- | --- |
| `GET /api/money` | Everything the person can see: settings, categories, expenses, budgets, bills, goals, savings entries and receipts. Spaces without categories get the built-in ones |
| `PUT /api/money/settings` | Set the currency of the person's money, or of a household with `householdId` |
| `POST /api/money/categories`, `PATCH`, `DELETE /api/money/categories/{id}` | Add, rename and delete categories |
| `POST /api/money/expenses`, `PATCH`, `DELETE /api/money/expenses/{id}` | Add (with `amountCents`, `date`, optional `categoryId`, `note`, `paidBy`, `householdId`), change and delete expenses |
| `POST /api/money/budgets`, `DELETE /api/money/budgets/{id}` | Set the budget of a category (or the total, with `categoryId` null). Setting it again changes it |
| `POST /api/money/bills`, `PATCH`, `DELETE /api/money/bills/{id}` | Add, change and delete bills |
| `POST /api/money/bills/{id}/pay` | Pay a bill: adds the expense and moves the bill to its next day. Paying again with the same `expenseId` changes nothing |
| `POST /api/money/savings`, `PATCH`, `DELETE /api/money/savings/{id}` | Add, change and delete savings goals |
| `POST /api/money/savings/{id}/entries`, `DELETE /api/money/savings/entries/{id}` | Put money in (positive) or take it out (negative), and delete an entry |
| `POST /api/money/receipts` | Add a receipt from a photo (multipart) |
| `PATCH`, `DELETE /api/money/receipts/{id}` | Correct the values, delete the receipt and its photo |
| `POST /api/money/receipts/{id}/expense` | Turn a receipt into an expense. Needs a total and a date |

Anything you can't see answers `404`, the same as something that doesn't exist. Personal rows are
only for their owner. Household rows are for every member, and a person who leaves loses access. A
category, or a payer, from another space is refused (`400`). Every `POST` accepts an `id` chosen by
the client: sending an id that already exists returns that row and changes nothing, and an id that
belongs to someone else gives `409`.

## Not built yet

Reading a receipt line by line (items and prices), bank import, several currencies in one space,
unequal splits between household members, reminders before a bill is due, a photo of the receipt in
the app, and adding a receipt from the phone's share sheet.
