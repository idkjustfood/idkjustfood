# Ingredient units

An ingredient's unit is always one value from a fixed list, or empty for "no unit". It is never free
text. This keeps shopping lists merging, unit conversion and translations reliable.

## The list

`unitKeys` in `packages/schemas/src/units.ts` is the single source of truth:

| Key | Meaning | Converted to the other system? |
| --- | --- | --- |
| `g`, `kg`, `mg` | mass | yes (to `oz` / `lb`) |
| `oz`, `lb` | mass | yes (to `g` / `kg`) |
| `ml`, `l` | volume | yes (to `fl_oz`, `tsp`, `tbsp`, `cup`) |
| `fl_oz`, `cup` | volume | yes (to `ml` / `l`) |
| `tsp`, `tbsp` | spoons | no, used in both systems |
| `piece`, `pinch`, `clove`, `bunch`, `slice`, `can`, `pack` | counts | no, only scaled |

The stored value is the key, the same in every language. The app shows a translated name from
`apps/app/locales/<lang>/common.json` (`units.*`): "EL", "Stück" and "Prise" in German, "tbsp",
"piece" and "pinch" in English.

## What the dropdown shows

The dropdown follows the person's unit system (Settings). Metric shows `mg`, `g`, `kg`, `ml`, `l`;
imperial shows `oz`, `lb`, `fl_oz`. The generic units (spoons, `cup`, `piece`, `pinch`, `clove`, …)
show for both (`unitsForSystem`). A saved unit from the other system stays visible on its own row.

## Where it is enforced

- **API:** `IngredientSchema` (recipes) and the shopping item schemas accept only these keys, so the API
  answers `400` for anything else.
- **Recipe form and shopping list:** the unit is picked from a dropdown (`UnitPicker`), never typed.
- **Extraction:** `fitUnit` / `fitIngredientUnits` map what a source says ("grams", "Esslöffel",
  "cuillères à soupe") to a key. A unit that does not fit (for example "handful") is dropped, the amount
  stays, and the original word goes into the ingredient's note.
- **Import (JSON, schema.org):** old files with free-text units are fitted the same way.

## Adding a unit or a spelling

1. Add the key to `unitKeys` and `englishLabels`, and its spellings to `spellings` in `units.ts`.
   Add its size to `units` if it can be converted.
2. Add the name to `units` in every `apps/app/locales/<lang>/common.json`.
3. Add the key to the AI prompt in `packages/extraction/src/ai/prompts.ts`.
4. Write a data migration if existing recipes should change.

## Migration

`0007_ingredient_units.sql` maps the units of existing recipes and shopping items to the list. It is
generated from `unitSpellings`. Units that are not in the list are dropped and moved into the note.
