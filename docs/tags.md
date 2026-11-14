# Recipe tags

A recipe's tags always come from one fixed list. They are never free text. This keeps search and
filters reliable ("Italian", "italienisch" and "Italy" are the same tag), lets the app show the same
colors and order everywhere, and lets the meal planner rely on them.

## The list

`tagsByGroup` in `packages/schemas/src/tags.ts` is the single source of truth. Groups are shown in this
order, each with its own color:

| Group | Color | Tags |
| --- | --- | --- |
| `cuisine` | orange | `italian`, `french`, `spanish`, `greek`, `mediterranean`, `german`, `american`, `mexican`, `turkish`, `middle_eastern`, `indian`, `thai`, `vietnamese`, `chinese`, `japanese`, `korean` |
| `dish` | blue | `pasta`, `pizza`, `salad`, `soup`, `stew`, `curry`, `rice`, `noodles`, `burger`, `sandwich`, `bread`, `bake`, `sauce`, `snack`, `dessert`, `cake`, `drink` |
| `diet` | green | `vegetarian`, `vegan`, `gluten_free`, `dairy_free` |
| `nutrition` | violet | `high_protein`, `low_carb`, `low_calorie`, `low_fat` |
| `time` | amber | `under_15_min`, `under_30_min`, `under_45_min`, `under_60_min`, `under_90_min` (preparing and cooking together) |
| `meal` | rose | `breakfast`, `midday`, `afternoon` |

The stored value is the key, the same in every language. The app shows a translated name from
`apps/app/locales/<lang>/common.json` (`tags.*`, and `tagGroups.*` for the group names).
Tags are sorted by group and then in the order above, so a recipe's tags look the same everywhere.

## Where it is enforced

- **API:** `RecipeContentSchema` accepts only these keys, each once, so saving a recipe with any other
  tag answers `400`. The list filter `GET /recipes?tags=italian,vegan` takes keys too and answers `400`
  for an unknown tag.
- **Recipe form:** tags are picked from the grouped list (`TagPicker`), never typed. The recipe list
  filters and the recipe pages show the tags in the group's color (`TagChip`, `TagBadge`).
- **AI extraction:** the prompt lists the keys (`tagListForPrompt`) and asks the AI to choose only from
  them. Whatever comes back goes through `fitTags`, so a tag outside the list is dropped, never saved.
- **Websites (schema.org):** the page's cuisine, diet and category are fitted with `fitTags` as well.
- **Meal planner:** the `meal` tags `breakfast`, `midday` and `afternoon` put a recipe in the slot of
  that name. The diet wish of the wizard is one of the `diet` tags. See `docs/meal-planner.md`.
- **Export and import:** JSON keeps the keys. Markdown and the schema.org `keywords` use English names
  ("Under 30 min"). Importing fits what it reads: known spellings become their key, other tags are
  dropped, so older files still work.

## Fitting outside tags

`fitTag` / `fitTags` map a text to a key: not case sensitive, dashes and underscores count as spaces.
It knows the key itself, English, German, Spanish, French and Italian names and some common words
("Lunch" is `midday`, "Dinner" is `afternoon`, "Under 1 hour" is `under_60_min`). Anything it does not
know is dropped.

## Adding a tag

1. Add the key to its group in `tagsByGroup`, and its other spellings to `spellings`, in `tags.ts`.
2. Add the name to `tags` in every `apps/app/locales/<lang>/common.json`.
3. Nothing else: the AI prompt, the pickers and the filters read the list.
4. Run `bun test` in `packages/schemas`; `tags.test.ts` checks the list, and the locale test checks that
   every language has every key.

Adding a group also needs a color in `tagGroupColors` and `apps/app/lib/tags.ts`, and `tagGroups.*` names.

## Existing recipes (migration)

`0008_fixed_tags.sql` keeps the tags of existing recipes that match the list, using the same spellings
as `fitTag` ("Italian" becomes `italian`, "Under 30 min" becomes `under_30_min`), and drops the others
("Spicy", "Over 1 hour", ...). The result is in the order of the list. **Dropped tags are not kept
anywhere**, so back up the database first if you want to keep a copy. It is generated from
`tagSpellings`; do not edit the spelling list in the SQL by hand.
