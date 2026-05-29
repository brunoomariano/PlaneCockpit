import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Complexity guards apply to production code, not tests (long arrange/act
    // blocks and many small cases are normal there). max-lines-per-function is
    // intentionally omitted: it fights JSX components and cohesive loops.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/tests/**"],
    rules: {
      complexity: ["error", 12],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
    },
  },
);
