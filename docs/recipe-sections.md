# Recipe sections

Some recipes are made of parts: a pizza with a dough and a sauce, a dish with two sauces. A recipe
can be split into **named sections**. Sections are optional. Most recipes have none, and a recipe
without sections looks and works exactly as it always did.

## The data

An ingredient and a step each have an optional `section` (the name of the part, for example
`"Sauce"`). Empty (`null`) or left out means "no section". There is no separate list of sections:
the sections of a recipe are the names its ingredients and steps use.

```json
{
  "ingredients": [
    { "name": "Flour", "quantity": 200, "unit": "g", "note": null, "section": "Dough" },
    { "name": "Tomato", "quantity": 3, "unit": null, "note": null, "section": "Sauce" }
  ],
  "steps": [
    { "text": "Knead the dough.", "section": "Dough" },
    { "text": "Simmer the sauce.", "section": "Sauce" },
    { "text": "Bake for 12 minutes." }
  ]
}
```

- The schema is in `packages/schemas/src/recipe.ts`, the helpers are in
  `packages/schemas/src/sections.ts`.
- Recipes are stored as JSON, so **no migration is needed**. Existing recipes have no `section`
  and stay as they are.
- The API saves the items of one section next to each other, in the order the sections first
  appear (`arrangeSections`). A list without sections is not changed.
- A section name has 1 to 100 characters. Ingredients and steps use the same names, so "Sauce"
  on an ingredient and on a step is the same section.

## In the app

- **Recipe view:** each section is a headline with its ingredients (or steps) below it. Step
  numbers go on across sections. Ingredients and steps without a section come first, without a
  headline.
- **Editing:** the "Sections" card of the form is empty by default, so nobody has to use it. "Add a
  section" adds a name. Each ingredient and step then gets a choice of section (including "No
  section"). A section can be renamed, moved up and down, and removed. Removing a section keeps
  its ingredients and steps, they just lose the section. A new row starts in the section of the row
  above it. A section without ingredients or steps is not saved.
- **Cooking mode:** steps are shown one at a time in order, with the name of the step's section
  above it.
- **Servings and units:** scaling and unit conversion work on every ingredient, whatever its
  section.

## Shopping lists

Sections are not used on shopping lists. When a recipe is added to a list, all of its ingredients
are merged as before, whichever section they came from (200 g flour from "Dough" + 100 g flour from
"Sauce" becomes 300 g flour). The list shows no section headlines. Sections are not part of the
meal planner either.

## Extraction

- **AI (video, photo, text, websites without recipe data):** the parsing prompt
  (`parseRecipeSystem` in `packages/extraction/src/ai/prompts.ts`) asks for a `section` on each
  ingredient and step only when the material clearly splits the recipe into named parts ("For the
  dough", "For the sauce"). Otherwise `section` is `null` everywhere. The AI must not invent parts.
- **A recipe with only one part has no sections.** `readExtractedRecipe` removes the section when
  every ingredient and step has the same one, because one headline over everything tells the
  reader nothing.
- **Websites with schema.org data** need no AI. A `HowToSection` in `recipeInstructions` becomes a
  section of its steps. schema.org has no standard way to group ingredients, so those stay without
  a section.
- **Translation:** section names are translated like other words, and a name is translated once, so
  its ingredients and steps keep the same headline.
- Providers do not need any change: they return the JSON the prompt describes.

## Export and import

- **JSON:** `section` is on each ingredient and step. Import reads it back.
- **Markdown:** each section is a `###` headline under "Ingredients" and under "Steps". Step
  numbers go on across sections.
- **schema.org:** steps with sections are written as `HowToSection` (a name and its
  `HowToStep` list). Ingredients stay a flat `recipeIngredient` list, as the standard has no
  grouping, and our own `x-idkjustfood-ingredients` key keeps each ingredient's section. Import
  reads `HowToSection` back as sections.
