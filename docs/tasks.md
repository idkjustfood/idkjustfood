# Tasks

A task is something to do **once**: "Call the plumber", with an optional note and an optional due
day. (Things that come back after a number of days are [chores](household-tasks.md).) Tasks are
**personal** or **for a household**, like shopping lists and the calendar. Nothing here needs the
cloud edition, so self-hosted installs have it too.

## In the app

- **Life → Tasks** (also in the "+" sheet as "Add task"). The screen shows the tasks of the space
  selected at the top: your personal tasks, or the tasks of one household. A new task goes to that
  space.
- Open tasks come first, the soonest due day first, tasks without a day last. Done tasks are listed
  below and can be opened again. A task whose day has passed is marked as overdue.
- The big box ticks a task off, the pencil edits it (title, note, day, who it is for) or deletes it.
- **Assigned to:** in a household, a task can be given to one member ("For Sam"). Personal tasks
  cannot be assigned. Anyone in the household can still tick off or change the task.
- **Today** shows open tasks that are due today or overdue, in a "To do" section. Personal and
  household tasks come together there, and each says which one it is. Tasks can be ticked off from
  Today. Tasks without a day, and tasks due later, are not shown. The section disappears when the
  Tasks module is switched off.
- **Offline:** tasks are kept on the phone and changes are sent when there is a connection again,
  the same way as shopping lists and the calendar (`lib/todo-store.ts`, see
  [shopping-lists.md](shopping-lists.md)).

## Days

A due day is a plain calendar date (`2026-11-21`). The server never works with time zones: the app
sends the date it sees on the device, and works out "today" on the device too (`todoItems` in
`lib/today.ts`).

## API

All endpoints need a signed-in user and are in the OpenAPI document (`/api/openapi.json`).

| Method and path | What it does |
| --- | --- |
| `GET /api/tasks` | Your personal tasks and the tasks of your households. `?householdId=` limits it to one household. Open tasks first, soonest day first |
| `POST /api/tasks` | Add a task: `title`, optional `note`, `dueDate`, `householdId` (none means personal), `assigneeId` and `id` |
| `PATCH /api/tasks/{taskId}` | Change `title`, `note`, `dueDate`, `assigneeId`, or tick it off with `done: true` (`false` opens it again) |
| `DELETE /api/tasks/{taskId}` | Delete a task |

A task you can't see answers `404`, the same as one that doesn't exist. Personal tasks are only for
their owner. Household tasks are for every member, and a person who leaves loses access. Any member
can change, tick off or delete a household task. `assigneeId` must be a member of the task's
household; for a personal task it is refused with `400`.

`POST` accepts an `id` chosen by the client. Sending an id that already exists returns that task and
changes nothing, so a retry after a lost connection never adds a task twice. An id that belongs to
someone else's task gives `409`.

## Code

- `packages/schemas/src/tasks.ts`: the schemas, `sortTasks` and `tasksDue`.
- `packages/database/src/schema/tasks.ts`: the `task` table.
- `apps/api/src/tasks/`: routes, queries and tests.
- `apps/app/lib/todo-ops.ts`, `todo-store.ts`, `todos.tsx`: the offline store and its provider.
- `apps/app/app/(app)/(tabs)/tasks.tsx`: the screen.

## Not built yet

Repeating tasks (use chores), sub-tasks, reminders for a task.
