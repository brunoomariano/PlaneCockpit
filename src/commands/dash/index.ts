import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { withContext } from "../shared.js";
import { Dashboard } from "../../tui/dashboard.js";
import { ErrorBoundary } from "../../tui/error-boundary.js";

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
        const tree = React.createElement(ErrorBoundary, { logger, children: dashboard });

        // Enter the terminal's alternate screen buffer so the TUI renders on a
        // throwaway screen. On exit the terminal restores the previous contents
        // and nothing the dashboard drew is left in the scrollback (like gh dash).
        const enterAltScreen = "\x1b[?1049h";
        const leaveAltScreen = "\x1b[?1049l";
        const usesAltScreen = process.stdout.isTTY === true;

        let restored = false;
        const restoreScreen = (): void => {
          if (restored || !usesAltScreen) return;
          restored = true;
          process.stdout.write(leaveAltScreen);
        };

        // Guard against the process being torn down (Ctrl+C / kill) before the
        // finally block runs, which would otherwise leave the terminal stuck on
        // the alternate screen.
        if (usesAltScreen) {
          process.stdout.write(enterAltScreen);
          process.once("exit", restoreScreen);
        }

        const instance = render(tree);
        try {
          await instance.waitUntilExit();
        } finally {
          restoreScreen();
        }
      });
    });
}
