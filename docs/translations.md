# Translations

Every text the person sees in the app comes from a translation file. The app
uses [i18next](https://www.i18next.com) with `react-i18next` and
`expo-localization`, the same on iOS, Android and web. Nothing needs a cloud
service, so it works in a self-hosted install too.

Supported today: English (`en`, the fallback), German (`de`), Spanish (`es`),
French (`fr`) and Italian (`it`).

## How it works

- Texts live in `apps/app/locales/<language>/<namespace>.json`. A namespace is
  one file per part of the app (`common`, `auth`, `recipes`, `add`, `shopping`,
  `planner`, `settings`).
- On first start the app uses the phone or browser language. If we don't have
  it, it uses English. The person can pick another language in
  **Settings → Language**; the choice is saved on the device.
- A missing translation falls back to English, so a text is never empty and
  never shows a raw key.

## Using a text

```tsx
const { t } = useTranslation()
<Text>{t("recipes:list.title")}</Text>
```

Outside of components use `i18n.t("recipes:list.title")` from `@/lib/i18n`, and
call it when the text is shown, not when the module loads, so switching the
language updates it.

- **Plurals:** write `key_one` and `key_other` (some languages need `_few` or
  `_many` too) and pass `{ count }`.
- **Numbers, amounts, minutes, dates:** use `formatNumber`, `formatAmount` and
  `formatMinutes` from `lib/format.ts` and `dayLabel` from `lib/planner-format.ts`.
  They follow the current language.
- **Recipe content** (titles, ingredients, steps) is not translated; it stays
  in the language of its source.

## Adding a language

1. Copy `apps/app/locales/en` to `apps/app/locales/<code>` (for example `pt`).
2. Translate the values. Keep the keys and `{{placeholders}}` as they are.
3. Set `languageName` in `common.json` to the language's own name ("Português").

That is all. The app finds the folder at build time and lists it in the
language picker. For languages with more plural forms (for example Polish) add
the extra keys (`_few`, `_many`); see the
[i18next plural docs](https://www.i18next.com/translation-function/plurals).

## Checks

`bun test lib` in `apps/app` runs `lib/i18n/locales.test.ts`. It fails when

- a language is missing a file or a key (or has an extra one),
- a text is empty or lost a `{{placeholder}}`,
- a `.tsx` file contains hardcoded text (words between tags, or in props such
  as `title`, `placeholder` or `aria-label`).

## Contributing a translation

Open a pull request with the new or improved files under `apps/app/locales`.
Fixes to wording in an existing language are welcome too. Right-to-left
languages are not supported yet.
