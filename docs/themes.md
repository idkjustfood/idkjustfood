# Themes

The app has a theme system. A theme is one named definition: colours, corner
shapes, a heading font and an icon style, each with a light and a dark variant.
The default theme is **cozy** (warm cream, soft pastels, rounded shapes,
hand-written headings, hand-drawn icons). **Classic** is the neutral look the app
had before and proves that switching works.

People choose a theme in **Settings → Preferences → Theme**. It applies at once
and is saved on the device (so it also works offline). Light, dark and system
(**Settings → Appearance**) work inside every theme.

Nothing needs a cloud service, so themes work the same in a self-hosted install.

## How it works

- `apps/app/lib/themes.ts` holds all theme definitions. It is plain TypeScript.
- `AppThemeProvider` (`lib/theme.tsx`) puts the chosen theme's tokens on the app
  as CSS variables (`--background`, `--primary`, `--radius`, ...).
- `tailwind.config.js` maps the variables to class names: `bg-background`,
  `text-foreground`, `bg-card`, `rounded-lg`, and the pastel tones
  `bg-tone-rose`, `text-tone-rose-foreground` (also `sage`, `peach`, `lavender`,
  `butter`, `sky`).
- Shared components (`Screen`, `Card`, `ListRow`, `Button`, `Badge`, `Chip`,
  `EmptyState`, `Heading`, `Icon`, ...) only use those classes, so a new theme
  changes every screen without touching one.

Screens must not contain colours of their own: no `#hex`, no `rgb()`, no Tailwind
palette colours such as `bg-amber-100`. `lib/themes.test.ts` fails when one slips in.
Use a token class instead. For the few places that need a colour value and not a
class (for example a placeholder colour), use `useTheme().color("muted-foreground")`.

## Adding a theme

1. Open `apps/app/lib/themes.ts`, copy `classic` and give the copy a new `id`
   (lower-case, stable: it is what gets saved) and a `nameKey` such as
   `theme.forest`.
2. Fill in the `light` and `dark` colours. Every token in `colorTokens` is
   required, as an `"H S% L%"` triplet. Set `shape` (corner radius, soft shadow,
   optional organic card corners), `icons` (`"cozy"` or `"classic"`) and
   `headingFont` (`null` for the system font).
3. Add the theme to the `themes` array.
4. Add its name under `theme.<name>` in `apps/app/locales/<language>/settings.json`
   for every language (see `docs/translations.md`).
5. Run `bun test lib` in `apps/app`. The tests check that every token exists, that
   text has a contrast of at least 4.5 (3 for input borders) in light and dark, and
   that screens contain no hardcoded colours.

That is all: the dropdown lists every theme in `themes`.

### A new heading font

Add the font package (`bun add @expo-google-fonts/<name>`), register it in
`lib/fonts.ts`, and use its family name as `headingFont`. Use fonts with a free
licence that allows use in an open source project (for example the SIL Open Font
License). Body text stays on the system font so it is easy to read.

### Adding a colour token

Add the name to `colorTokens`, give it a value in every theme, add it to
`tailwind.config.js` and to the fallback in `global.css`.

## Licences

- **Heading font:** [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand)
  by Mariela Monsalve, SIL Open Font License 1.1, from the
  `@expo-google-fonts/patrick-hand` package.
- **Cozy icons:** drawn for this project (`components/ui/cozy-icons.tsx`) and
  covered by the project's own licence. Nothing is copied from another icon set.
- **Classic icons:** [Lucide](https://lucide.dev) (ISC licence), through
  `lucide-react-native`.

## Icons

Screens keep using `<Icon as={Search} />` with the Lucide icon. With a theme whose
`icons` is `"cozy"`, `Icon` draws the matching hand-drawn icon from
`cozy-icons.tsx` instead; an icon without a cozy drawing falls back to Lucide.
To give a new icon a cozy version, draw it on a 24 × 24 grid and add it to the
`cozyFor` map. Illustrations for recipe categories (soup, salad, pasta, pizza,
dessert, breakfast) are in `categoryIcons` and show on recipe covers.

## Not saved on the server

The theme is saved on the device, like units and language. It is not stored on the
user's account on the server yet.
