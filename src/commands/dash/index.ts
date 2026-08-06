import { Command } from "commander";
import React from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/react";
import { withContext } from "../shared.js";
import { Dashboard } from "../../tui/dashboard.js";
import { ErrorBoundary } from "../../tui/error-boundary.js";
import { ThemeProvider } from "../../tui/theme/context.js";

export function registerDash(program: Command): void {
  program
    .command("dash")
    .description("open the TUI dashboard")
    .action(async function (this: Command) {
      await withContext(this, this.opts(), async ({ ctx }) => {
        const logger = ctx.fileLogger;
        process.on("uncaughtException", (err) => {
          logger.error("uncaughtException in dash", { err });
        });
        process.on("unhandledRejection", (reason) => {
          logger.error("unhandledRejection in dash", { reason });
        });
        const dashboard = React.createElement(Dashboard, { ctx, logger });
        // ThemeProvider wraps the whole tree (including the ErrorBoundary, which
        // also reads theme tokens) so every component can call useTheme.
        const boundary = React.createElement(ErrorBoundary, { logger, children: dashboard });
        const tree = React.createElement(ThemeProvider, { theme: ctx.theme, children: boundary });

        let resolveExit: () => void = () => undefined;
        const exited = new Promise<void>((resolve) => {
          resolveExit = resolve;
        });
        const renderer = await createCliRenderer({
          exitOnCtrlC: false,
          screenMode: "alternate-screen",
          onDestroy: resolveExit,
        });
        const keymap = createDefaultOpenTuiKeymap(renderer);
        createRoot(renderer).render(
          React.createElement(KeymapProvider, { keymap, children: tree }),
        );
        await exited;
      });
    });
}
