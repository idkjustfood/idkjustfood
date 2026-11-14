# Translations

Every text the person sees in `apps/app` comes from a translation file. Never write user-visible text
directly in the code. See `docs/translations.md` for the setup.

## Rules

- Every new or changed text gets a key in `apps/app/locales/en/<namespace>.json` and the same key in
  every other language folder (`de`, `es`, `fr`, `it`, and any added later). Write the translations
  yourself; do not leave a language untranslated, copy the English text, or leave a key empty.
- Keep the key set identical in all languages, and keep `{{placeholders}}` unchanged.
- Use `t("namespace:key")` in components and `i18n.t(...)` in code outside components, called when the
  text is shown, not when the module loads. Pure logic that has tests must not import i18n; return a
  key or code and translate it in the component.
- Plurals use `key_one` / `key_other` (more forms where the language needs them) with `{{count}}`.
- Numbers, amounts, minutes and dates go through `formatNumber`, `formatAmount`, `formatMinutes` and
  the helpers in `lib/planner-format.ts`. Never hardcode a locale such as `"en-GB"`.
- Saved recipe content (titles, ingredients, steps) is not translated by the app. New recipes from the AI are written in the selected language by the API (`docs/ai-providers.md`). A new language is added to `packages/schemas/src/language.ts` too.
- Names of brands and technical terms (Instagram, OpenRouter, JSON) stay as they are.
- Run `bun test lib` in `apps/app`. `lib/i18n/locales.test.ts` fails on missing keys, empty texts, lost
  placeholders and hardcoded text in `.tsx` files. Fix the cause; do not weaken the test.
