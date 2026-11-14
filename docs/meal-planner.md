# Meal planner

A meal plan holds the meals you want to cook, for as many weeks as you like. Every day has exactly
three slots: **Breakfast**, **Midday** and **Afternoon**. A slot holds one recipe and the number of
servings to cook. You fill the plan by hand, or let the app fill it from your saved recipes.

A plan is either **personal** (only its owner sees it) or **shared with a household** (every member
sees and changes it). You choose which when you make it. Nothing here needs the cloud edition, so
self-hosted installs have it too.

## In the app

- **Planner tab:** one week at a time. Use the arrows to move between weeks (also weeks far in the
  future) and "This week" to jump back. Each day shows its three slots; tap a slot to pick a recipe,
  swap it, change the servings or remove it.
- **Several plans:** the chips under the title switch between the plans of the selected space. The
  space dropdown at the top (your personal space or one of your households) decides which plans you
  see and where "New plan" puts the new one. Plans of other spaces never show. The choice is
  remembered on the device and is the same one the recipes and shopping lists use.
- **Calories:** every day shows the estimated calories for one person, added up from the recipes'
  nutrition values. They are always estimates. A meal whose recipe has no estimate is not counted, and
  the day says so (a `+` after the number).
- **Auto-plan** (button at the bottom): a wizard in three steps, see [below](#automatic-planning).
- **Shopping list** (button at the bottom): adds the ingredients of this week, or of the whole plan,
  to a shopping list you choose. **Nothing reaches a shopping list unless you tap this.** Amounts are
  scaled to each meal's servings and merged like when you add a recipe (see
  [shopping lists](shopping-lists.md#how-merging-works)). It needs a connection.

The plan screen and the wizard use big touch targets and keep their main buttons at the bottom of
the screen, so they work with one hand.

## Automatic planning

The planner is **plain code, not AI** (`autoPlan` in `packages/schemas/src/autoplan.ts`). The same
wishes and recipes always give the same plan, with any AI provider or none.

**The wizard**

1. **Goals** (all optional): calories per day, a diet, the longest time per meal, how many weeks (1 to
   4), servings per meal, and whether to keep or replace meals you already planned.
2. **Days:** every day of those weeks can be skipped, can have single meals skipped, and can have its
   own servings.
3. **Result:** says whether everything was filled. Slots that found no recipe stay empty, with the
   reason. Then you can change any meal by hand.

**How it picks recipes**

- **Diet** is a tag: only recipes with that tag (any capitalisation) are used, for example
  `vegetarian`.
- **Time** is preparing plus cooking. A recipe that says neither is skipped, not guessed. A note says
  how many were skipped.
- **Calories** are split over the day: 30 % breakfast, 40 % midday, 30 % afternoon. A recipe only
  matches a slot when its calories per serving are within 35 % of the slot's share, and the closest one
  wins. Recipes without a calorie estimate are skipped (with a note). Meals you keep count with their
  own calories, and the rest of the day is shared by the other slots. A skipped slot keeps its share,
  because you eat something else there.
- **Meal-time tags:** a recipe tagged `breakfast`, `lunch`/`midday` or `dinner`/`supper`/`afternoon`
  is only planned in a matching slot (and preferred there). A recipe without these tags fits any slot.
- **Variety:** the least used recipe wins ties, and a recipe is never planned twice on one day.
- **Not enough recipes:** the slot stays empty and is listed in the answer (`unfilled`). Nothing is
  made up.
- A household plan only uses the household's recipes, so every member can open them. A personal plan
  uses your own recipes and your households'.

By default only **empty** slots are filled. With "Replace them" (`overwrite`) the slots the planner
works on are emptied first. Skipped days and skipped meals are never touched.

## API

All endpoints need a signed-in user and are in the OpenAPI document (`/api/openapi.json`).

| Method and path | What it does |
| --- | --- |
| `GET /api/meal-plans` | Your personal plans and your households' plans (without meals) |
| `POST /api/meal-plans` | Make a plan. `householdId` shares it with a household, no `householdId` makes a personal plan |
| `GET /api/meal-plans/{planId}` | One plan with its meals. `?from=` and `?to=` (`YYYY-MM-DD`) pick some days |
| `PATCH /api/meal-plans/{planId}` | Rename. Everyone who can see the plan can |
| `DELETE /api/meal-plans/{planId}` | Delete. The person who made it, or a household owner |
| `PUT /api/meal-plans/{planId}/meals/{date}/{slot}` | Put a recipe in a slot (also to swap it), with `servings` |
| `PATCH /api/meal-plans/{planId}/meals/{date}/{slot}` | Change the servings of a planned meal |
| `DELETE /api/meal-plans/{planId}/meals/{date}/{slot}` | Empty a slot |
| `POST /api/meal-plans/{planId}/generate` | Fill days automatically (`goals`, `days`, `servings`, `overwrite`) |
| `POST /api/meal-plans/{planId}/shopping-list` | Add the plan's ingredients to a list (`listId`, optional `from` and `to`) |

`slot` is `breakfast`, `midday` or `afternoon`. `date` is a calendar day, `YYYY-MM-DD`, with no
time zone. A meal in the answer carries a small summary of its recipe (title, times, estimated
calories per serving), so a plan can be shown without loading every recipe.

### Who can see what

A plan you can't see answers `404`, the same as a plan that doesn't exist.

- Personal plan: only its owner.
- Household plan: only members of that household. A person who leaves loses access.
- A household plan only takes the household's recipes. A personal plan takes your own recipes and
  those of your households.
- Adding a plan to a shopping list needs access to both.

### Weeks

A plan has no fixed length. Its meals are stored by date, and a "week" is the seven days from a
Monday (`weekStart`, `buildWeek` in `packages/schemas/src/planner.ts`). That is why you can plan weeks
in the future without making anything first. If a recipe is deleted, its slots become empty.

## Code

- `packages/schemas/src/planner.ts`: plan, meal and request schemas, week helpers.
- `packages/schemas/src/autoplan.ts`: the automatic planner (pure function, with tests).
- `packages/database/src/schema/planner.ts`: the `meal_plan` and `meal_plan_meal` tables. A slot is
  unique per plan, date and slot.
- `apps/api/src/planner/`: routes and database queries.
- `apps/app/app/(app)/(tabs)/planner/`: the plan screen and the wizard. `apps/app/lib/planner.ts`
  holds the queries, `planner-wizard.ts` turns the wizard's state into a request.

## Not included

- The calorie and nutrient optimizer (a separate, later ticket) and price optimization.
- Suggesting recipes you haven't saved.
- Offline planning: unlike shopping lists, the planner needs a connection.
