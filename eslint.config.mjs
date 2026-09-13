import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" }
    },
    rules: {
      // Only Obsidian's own @electron/remote may be used (see obsidianRemote in
      // main.ts); a value import here would bundle a second one beside it.
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@electron/remote",
          message: "Use obsidianRemote() in main.ts; a bundled @electron/remote runs a second callback registry beside Obsidian's."
        }]
      }]
    }
  }
]);
