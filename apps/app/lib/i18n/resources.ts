/**
 * Loads every translation file: `locales/<language>/<namespace>.json`.
 * Adding a language means adding a folder there, nothing else. Metro finds the
 * files at build time through `require.context`.
 */
type Resources = Record<string, Record<string, Record<string, unknown>>>

declare const require: {
  context: (
    path: string,
    deep: boolean,
    filter: RegExp
  ) => { keys(): string[]; (id: string): unknown }
}

const context = require.context("../../locales", true, /\.json$/)

export const resources: Resources = {}
for (const key of context.keys()) {
  const match = /^\.\/([^/]+)\/([^/]+)\.json$/.exec(key)
  if (!match) continue
  const [, language, namespace] = match
  const raw = context(key) as { default?: unknown }
  ;(resources[language] ??= {})[namespace] = (raw.default ?? raw) as Record<
    string,
    unknown
  >
}

export const supportedLanguages = Object.keys(resources).sort()
