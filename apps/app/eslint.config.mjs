import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    // Ignore babel.config.js (Expo preset) when parsing; only TypeScript is needed.
    languageOptions: {
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { configFile: false },
      },
    },
  },
  { ignores: ["*.config.js", ".expo/**"] },
]
