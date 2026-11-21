# Adding a module

The app is built from a list of modules (`apps/app/lib/modules.ts`). A module is one part of the
household app: recipes, shopping, a calendar, expenses. Navigation, the Today screen, the "+" sheet,
search and the "Modules" settings page all read this list. Adding a module needs a screen and one
registry entry. No navigation code changes.

## The structure

- **Areas** are the bottom tabs (the side bar on wide screens): Today, Plan, Home, Food, Money, More.
  The phone shows six, three on each side of the "+" button. Keep the number even, or the "+" ends
  up off-centre.
- **Modules** sit in an area. Inside an area they are a list. Family
  modules sit under More in their own group; `group` puts modules under a heading.
- A module that is not built yet points to `/m/<id>`, a placeholder screen that shows its name and
  what it will do. When the real screen exists, change `route` and set `built: true`.
- Switching a module off (Settings → Modules) removes it from the navigation, Today, "+" and search.
  The choice is stored on the device (`lib/preferences.ts`). Modules with `required: true` (settings,
  household, the modules page itself) cannot be switched off.

## Steps

1. **Add the entry** to `modules` in `apps/app/lib/modules.ts`:

   ```ts
   {
     id: "tasks",            // unique, also the translation key
     area: "plan",           // plan | home | food | money | more
     route: "/m/tasks",      // where it lives
     built: false,           // true once the real screen exists
     quickAction: { route: "/m/tasks" }, // optional: shows in the "+" sheet
   }
   ```

2. **Add the icon** in `apps/app/lib/module-icons.ts` (`moduleIcons`). It is kept apart so the
   registry stays free of React Native and can be tested.
3. **Add the texts** to `apps/app/locales/<language>/modules.json` in every language, under the
   module's id: `name`, `description`, `soon` (placeholders only) and `quickAction` (when it has
   one). See `docs/translations.md`.
4. **Build the screen.** A real module is a folder or file under `apps/app/app/(app)/(tabs)/` with
   its own route. If it is part of an area, add its route name to `areaOfRoute` in `lib/modules.ts`
   so the right tab stays highlighted.
5. **Today items (optional).** If the module has something for today, add a kind to `TodayItem`
   in `lib/today.ts`, a function that builds the items, and call it from `useTodayItems` in
   `lib/use-today.ts`. Items of switched-off modules are dropped for you (`timeline`).
6. **Search results (optional).** Search finds modules by name and description today. Results from
   inside a module (a recipe, a task) come later; see `components/shell-sheets.tsx`.

## What a module must provide

| What | Where | Needed |
| --- | --- | --- |
| Area, route, id | `lib/modules.ts` | always |
| Icon | `lib/module-icons.ts` | always |
| Name, description | `locales/*/modules.json` | always |
| Placeholder line (`soon`) | `locales/*/modules.json` | while not built |
| Quick action | registry `quickAction` + `quickAction` text | optional |
| Today items | `lib/today.ts`, `lib/use-today.ts` | optional |

`bun test lib` in `apps/app` checks the registry and that every module has its texts.
