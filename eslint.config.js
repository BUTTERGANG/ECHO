// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // The React 19 / React-Compiler hooks rules below flag idiomatic patterns
    // (loading from the local DB on mount, reading the current time for the
    // streak). Expo's own template hook (use-color-scheme.web.ts) also trips
    // them. Keep them visible as warnings rather than hard errors.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
