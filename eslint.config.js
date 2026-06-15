import js from "@eslint/js";
import ts from "typescript-eslint";

export default [
  {
    ignores: ["dist/", "node_modules/", "*.config.js", "biome.json"],
  },
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
];
