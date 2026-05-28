import { Command } from "commander";
import { withContext } from "../shared.js";
import { renderAny } from "../../utils/formatting.js";
import Table from "cli-table3";

export function registerProject(program: Command): void {
  const project = program.command("project").description("manage Plane projects");

  project
    .command("list")
    .description("list projects in the active workspace")
    .option("--json", "output as json")
    .option("--yaml", "output as yaml")
    .action(async function (this: Command) {
      await withContext(this, this.opts(), async ({ ctx, format }) => {
        const projects = await ctx.projects.list();
        if (format !== "table") {
          process.stdout.write(renderAny(projects, format));
          process.stdout.write("\n");
          return;
        }
        const table = new Table({ head: ["IDENTIFIER", "NAME"], style: { head: ["cyan"] } });
        for (const p of projects) table.push([p.identifier, p.name]);
        process.stdout.write(`${table.toString()}\n`);
      });
    });

  project
    .command("view <identifier>")
    .description("show a single project")
    .option("--json", "output as json")
    .option("--yaml", "output as yaml")
    .action(async function (this: Command, identifier: string) {
      await withContext(this, this.opts(), async ({ ctx, format }) => {
        const p = await ctx.projects.findByIdentifier(identifier);
        process.stdout.write(renderAny(p, format === "table" ? "yaml" : format));
        process.stdout.write("\n");
      });
    });
}
