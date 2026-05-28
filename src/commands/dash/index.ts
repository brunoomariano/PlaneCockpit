import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { withContext } from "../shared.js";
import { Dashboard } from "../../tui/dashboard.js";

export function registerDash(program: Command): void {
  program
    .command("dash")
    .description("open the TUI dashboard")
    .action(async function (this: Command) {
      await withContext(this, this.opts(), async ({ ctx }) => {
        const instance = render(React.createElement(Dashboard, { ctx }));
        await instance.waitUntilExit();
      });
    });
}
