# Meal planner

A meal plan holds the meals you want to cook, for as many weeks as you like. Every day has exactly
three slots: **Breakfast**, **Midday** and **Afternoon** (the last main meal of the day, dinner;
see `docs/tags.md` for what each meal means). A slot holds one recipe and the number of
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
- **Meal prep:** cook a recipe once and eat it in several slots. Open a meal and tap "Meal prep",
  choose the later meals the batch is eaten in, and how many servings each one is. The planner
  marks the cooking meal and the leftovers with an icon. See [Meal prep](#meal-prep).
- **Calories:** every day shows the estimated calories for one person, added up from the recipes'
  nutrition values (every recipe of every slot counts). They are always estimates. A meal whose recipe has no estimate is not counted, and
  the day says so (a `+` after the number).
- **Auto-plan** (button at the bottom): a wizard in three steps, see [below](#automatic-planning).
- **Shopping list** (button at the bottom): adds the ingredients of the meals you choose to a
  shopping list. Choose "Next 2 days", "Next 3 days", the week shown, the whole plan, or "Choose
  days" for any range from one day up to a year (arrows move the first and last day). The sheet
  shows the days and how many meals they cover before anything is added. A range without meals
  can't be added, so no empty request is sent. **Nothing reaches a shopping list unless you tap
  this.** Every recipe of every slot is included. Amounts are scaled to each meal's servings and merged like when you add a recipe (see
  [shopping lists](shopping-lists.md#how-merging-works)). It needs a connection.

The plan screen and the wizard use big touch targets and keep their main buttons at the bottom of
the screen, so they work with one hand.

## Meal prep

Meal prep means cooking a recipe once and eating it again on other days. One meal is the
**cooking meal**; the others are its **leftovers** and point back to it.

- Servings add up: the cooking meal's servings plus all the leftovers' servings are what is
  cooked. For example 1 serving on Sunday and 1 each on Monday, Tuesday and Thursday is a batch of 4.
- Leftovers must come after the cooking meal (a later day, or a later slot on the same day).
- Each meal keeps its own servings, so the daily calories count what is eaten that day.
- On a **shopping list** the batch is bought once: the cooking meal adds the ingredients for the
  whole batch and its leftovers add nothing. Choose days that include the cooking day, or the
  batch is not added.
- A cooking meal with leftovers can't swap its recipe. End the meal prep first. A leftover that
  gets another recipe leaves the batch.
- "End meal prep" on the cooking meal, or removing the cooking meal, turns its leftovers into
  ordinary meals (they are then bought for on their own). Nothing is deleted.
- If the recipe is deleted, the whole batch leaves the plan, like any other meal.
- The automatic planner doesn't plan meal prep yet.

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

- **Diet** is one of the diet tags (`vegetarian`, `vegan`, `gluten_free`, `dairy_free`, see
  `docs/tags.md`): only recipes with that tag are used.
- **Time** is preparing plus cooking. A recipe that says neither is skipped, not guessed. A note says
  how many were skipped.
- **Calories** are split over the day: 30 % breakfast, 40 % midday, 30 % afternoon. A recipe only
  matches a slot when its calories per serving are within 35 % of the slot's share, and the closest one
  wins. Recipes without a calorie estimate are skipped (with a note). Meals you keep count with their
  own calories, and the rest of the day is shared by the other slots. A skipped slot keeps its share,
  because you eat something else there.
- **Meal tags:** a recipe tagged `breakfast`, `midday` or `afternoon` is only planned in the slot of
  that name (and preferred there). A recipe with none of these tags fits any slot. A recipe tagged
  `snack` is never planned: snacks have no slot (three meals a day stays as is).
- **Variety:** the least used recipe wins ties, and a recipe is never planned twice on one day.
- **Not enough recipes:** the slot stays empty and is listed in the answer (`unfilled`). Nothing is
  made up.
- A household plan only uses the household's recipes, so every member can open them. A personal plan
  uses your own recipes and your households'.

By default only **empty** slots are filled. A slot with any recipe counts as planned, and all its
recipes are kept (and counted for the day's calories). The planner itself puts one recipe in a slot.
With "Replace them" (`overwrite`) the slots the planner works on are emptied first, every recipe in
them. Skipped days and skipped meals are never touched.

## API

All endpoints need a signed-in user and are in the OpenAPI document (`/api/openapi.json`).

| Method and path | What it does |
| --- | --- |
| `GET /api/meal-plans` | Your personal plans and your households' plans (without meals) |
| `POST /api/meal-plans` | Make a plan. `householdId` shares it with a household, no `householdId` makes a personal plan |
| `GET /api/meal-plans/{planId}` | One plan with its meals. `?from=` and `?to=` (`YYYY-MM-DD`) pick some days |
| `PATCH /api/meal-plans/{planId}` | Rename. Everyone who can see the plan can |
| `DELETE /api/meal-plans/{planId}` | Delete. The person who made it, or a household owner |
| `POST /api/meal-plans/{planId}/meals/{date}/{slot}` | Add a recipe to a slot, next to the others, with `servings`. Adding a recipe that is already in the slot only changes its servings |
| `PUT /api/meal-plans/{planId}/meals/{date}/{slot}` | Make a recipe the only meal of the slot (everything else in the slot goes) |
| `DELETE /api/meal-plans/{planId}/meals/{date}/{slot}` | Empty a slot (every meal in it) |
| `PATCH /api/meal-plans/{planId}/meals/{mealId}` | Change one meal: `servings`, `recipeId` (a swap that keeps its place) or both. `409` if the new recipe is already in that slot |
| `DELETE /api/meal-plans/{planId}/meals/{mealId}` | Remove one meal, the others in its slot stay |
| `POST /api/meal-plans/{planId}/meal-prep` | Plan meal prep: `recipeId`, the cooking `date` and `slot`, `servings` and `eat` (later slots with servings). Calling it again for the same cooking meal adds days |
| `DELETE /api/meal-plans/{planId}/meal-prep/{mealId}` | End meal prep: a cooking meal frees all its leftovers, a leftover leaves the batch |
| `POST /api/meal-plans/{planId}/generate` | Fill days automatically (`goals`, `days`, `servings`, `overwrite`) |
| `POST /api/meal-plans/{planId}/shopping-list` | Add the plan's ingredients to a list (`listId`, optional `from` and `to`, both days included) |

`slot` is `breakfast`, `midday` or `afternoon`. A meal has its own `id`; use it to change or remove
one meal when a slot holds several. Within a slot, meals come back in the order they were added. A
recipe is in a slot only once (the same recipe in two slots of a day is fine). `date` is a calendar day, `YYYY-MM-DD`, with no
time zone. A meal in the answer carries a small summary of its recipe (title, times, estimated
calories per serving), so a plan can be shown without loading every recipe. A meal that takes part
in meal prep has `prep`: `cook` (with `batchServings` and `leftovers`) or `leftover` (with the
cooking meal's id, date and slot).

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
- `packages/database/src/schema/planner.ts`: the `meal_plan` and `meal_plan_meal` tables. A meal is unique
  per plan, date, slot and recipe, so a slot can hold several recipes. `prep_from_meal_id` links a
  leftover to its cooking meal (meal prep).
- `apps/api/src/planner/`: routes and database queries.
- `apps/app/app/(app)/(tabs)/planner/`: the plan screen and the wizard. `apps/app/lib/planner.ts`
  holds the queries, `planner-wizard.ts` turns the wizard's state into a request.

## Not included

- The calorie and nutrient optimizer (a separate, later ticket) and price optimization.
- Suggesting recipes you haven't saved.
- Offline planning: unlike shopping lists, the planner needs a connection.
