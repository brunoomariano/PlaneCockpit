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
        const instance = render(tree);
        await instance.waitUntilExit();
      });
    });
}
