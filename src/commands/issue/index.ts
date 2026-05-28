import { Command } from "commander";
import { input, select } from "@inquirer/prompts";
import { withContext } from "../shared.js";
import { renderAny, renderIssues } from "../../utils/formatting.js";
import { findView } from "../../app.js";
import { buildIssueUrl } from "../../utils/urls.js";
import { defaultBrowserOpener } from "../../utils/browser.js";
import { NotFoundError } from "../../utils/errors.js";

export function registerIssue(program: Command): void {
  const issue = program.command("issue").description("manage issues / work items");

  issue
    .command("list")
    .description("list issues, optionally using a configured view")
    .option("-p, --project <identifier>", "project identifier (defaults to profile defaults.project)")
    .option("-v, --view <name>", "use a named view from the active profile")
    .option("--limit <n>", "limit results")
    .option("--json", "output as json")
    .option("--yaml", "output as yaml")
    .action(async function (this: Command, opts: { project?: string; view?: string; limit?: string }) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx, format, limit }) => {
        const view = opts.view ? findView(ctx.runtime.profile, opts.view) : undefined;
        if (opts.view && !view) {
          throw new NotFoundError(`view not found in profile: ${opts.view}`);
        }
        const projectId =
          opts.project ?? view?.project ?? ctx.runtime.profile.defaults?.project;
        if (!projectId) {
          throw new NotFoundError("project is required (pass --project or configure defaults.project)");
        }
        const issues = await ctx.issues.list(projectId, view, limit ?? view?.limit);
        process.stdout.write(renderIssues(issues, format));
        process.stdout.write("\n");
      });
    });

  issue
    .command("view <key>")
    .description("show a single issue by its key (e.g. ENG-123)")
    .option("--json", "output as json")
    .option("--yaml", "output as yaml")
    .action(async function (this: Command, key: string) {
      await withContext(this, this.opts(), async ({ ctx, format }) => {
        const issue = await ctx.issues.view(key);
        process.stdout.write(renderAny(issue, format === "table" ? "yaml" : format));
        process.stdout.write("\n");
      });
    });

  issue
    .command("open <key>")
    .description("open the issue in the default browser")
    .action(async function (this: Command, key: string) {
      await withContext(this, this.opts(), async ({ ctx }) => {
        const resolved = await ctx.issues.resolver.resolve(key);
        const url = buildIssueUrl(
          ctx.runtime.profile.server,
          { id: resolved.issueId },
          resolved.project.id,
        );
        process.stdout.write(`${url}\n`);
        await defaultBrowserOpener.open(url);
      });
    });

  issue
    .command("create")
    .description("create a new issue interactively")
    .option("-p, --project <identifier>", "project identifier")
    .option("-t, --title <title>", "issue title")
    .action(async function (
      this: Command,
      opts: { project?: string; title?: string },
    ) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx, format }) => {
        const project = opts.project ?? ctx.runtime.profile.defaults?.project;
        if (!project) throw new NotFoundError("project is required (pass --project)");
        const title = opts.title ?? (await input({ message: "title" }));
        const description = await input({ message: "description (optional)" });
        const priority = await select({
          message: "priority",
          choices: [
            { value: "none" as const },
            { value: "low" as const },
            { value: "medium" as const },
            { value: "high" as const },
            { value: "urgent" as const },
          ],
          default: "medium",
        });
        const created = await ctx.issues.create(project, {
          name: title,
          description: description || undefined,
          priority,
        });
        process.stdout.write(renderAny(created, format === "table" ? "yaml" : format));
        process.stdout.write("\n");
      });
    });

  issue
    .command("edit <key>")
    .description("edit an issue (title, description, priority)")
    .option("--title <title>", "new title")
    .option("--description <text>", "new description")
    .option("--priority <p>", "new priority (urgent|high|medium|low|none)")
    .action(async function (
      this: Command,
      key: string,
      opts: { title?: string; description?: string; priority?: string },
    ) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx, format }) => {
        const patch: Record<string, unknown> = {};
        if (opts.title) patch.name = opts.title;
        if (opts.description) patch.description = opts.description;
        if (opts.priority) patch.priority = opts.priority;
        const updated = await ctx.issues.update(key, patch);
        process.stdout.write(renderAny(updated, format === "table" ? "yaml" : format));
        process.stdout.write("\n");
      });
    });

  issue
    .command("assign <key> <user>")
    .description("assign an issue to a user (use 'me' for yourself)")
    .action(async function (this: Command, key: string, userSpec: string) {
      await withContext(this, this.opts(), async ({ ctx }) => {
        const user = await ctx.users.resolveAssignee(userSpec);
        await ctx.issues.assign(key, [user.id]);
        process.stdout.write(`assigned ${key} to ${user.display_name}\n`);
      });
    });

  issue
    .command("comment <key>")
    .description("add a comment to an issue")
    .option("-m, --message <text>", "comment text (otherwise prompts)")
    .action(async function (this: Command, key: string, opts: { message?: string }) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx }) => {
        const text = opts.message ?? (await input({ message: "comment" }));
        if (!text) throw new NotFoundError("empty comment");
        await ctx.issues.comment(key, text);
        process.stdout.write(`commented on ${key}\n`);
      });
    });
}
