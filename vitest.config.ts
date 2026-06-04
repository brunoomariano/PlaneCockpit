import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Coverage targets 95% on the tested surface area only. The Plane SDK
      // adapters and command wiring are excluded until integration tests cover
      // them, otherwise the threshold would fail on untestable I/O paths.
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
      include: [
        "src/tui/issue-list.tsx",
        "src/tui/help-modal.tsx",
        "src/tui/text-buffer.ts",
        "src/tui/issue-editor-draft.ts",
        "src/utils/input-source.ts",
        "src/keybindings/key-spec.ts",
        "src/keybindings/load.ts",
        "src/keybindings/dispatcher.ts",
        "src/cache/factory.ts",
        "src/cache/keys.ts",
        "src/cache/memory.ts",
        "src/cache/sqlite.ts",
        "src/commands/issue/resolve-field.ts",
        "src/config/credentials.ts",
        "src/config/env.ts",
        "src/config/profiles.ts",
        "src/config/schema.ts",
        "src/plane/filters.ts",
        "src/plane/projects.ts",
        "src/plane/resolver.ts",
        "src/plane/states.ts",
        "src/plane/labels.ts",
        "src/plane/users.ts",
        "src/utils/ansi-lines.ts",
        "src/utils/async.ts",
        "src/utils/file-logger.ts",
        "src/utils/formatting.ts",
        "src/utils/html-to-markdown.ts",
        "src/utils/markdown-to-ansi.ts",
        "src/utils/text-to-html.ts",
        "src/utils/log-paths.ts",
        "src/utils/urls.ts",
      ],
      exclude: ["src/**/*.test.ts", "src/tests/**", "src/cli.ts", "src/tui/**", "src/types/**"],
    },
  },
});
