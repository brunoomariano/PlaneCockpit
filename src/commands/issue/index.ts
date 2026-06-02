import { Command } from "commander";
import { input, select } from "@inquirer/prompts";
import { withContext } from "../shared.js";
import { renderObject, renderIssues } from "../../utils/formatting.js";
import { findView } from "../../app.js";
import { resolveViewProjects, firstDefaultProject } from "../../config/resolve-view-projects.js";
import { buildIssueUrl } from "../../utils/urls.js";
import { defaultBrowserOpener } from "../../utils/browser.js";
import { NotFoundError, ConfigError } from "../../utils/errors.js";
import { readBodyFile } from "../../utils/input-source.js";
import type { IssuePriority } from "../../types/issue.js";

export function registerIssue(program: Command): void {
  const issue = program.command("issue").description("manage issues / work items");

  issue
    .command("list")
    .description("list issues, optionally using a configured view")
    .option(
      "-p, --project <identifier>",
      "project identifier (defaults to the first of profile defaults.projects)",
    )
    .option("-v, --view <name>", "use a named view from the active profile")
    .option("--limit <n>", "limit results")
    .option("--json", "output as json")
    .option("--yaml", "output as yaml")
    .action(async function (
      this: Command,
      opts: { project?: string; view?: string; limit?: string },
    ) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx, format, limit }) => {
        const view = opts.view ? findView(ctx.runtime.profile, opts.view) : undefined;
        if (opts.view && !view) {
          throw new NotFoundError(`view not found in profile: ${opts.view}`);
        }
        const defaultProjects = ctx.runtime.profile.defaults?.projects;
        // --project forces a single project; a view defines its own set (which
        // may be multi-project); with neither, the CLI uses the first default
        // project.
        let projects: string[];
        if (opts.project) {
          projects = [opts.project];
        } else if (view) {
          projects = resolveViewProjects(view, defaultProjects);
        } else {
          const fallback = firstDefaultProject(defaultProjects);
          if (!fallback) {
            throw new NotFoundError(
              "project is required (pass --project or configure defaults.projects)",
            );
          }
          projects = [fallback];
        }
        const issues = await ctx.issues.list(
          projects,
          view,
          limit ?? view?.query_limit,
          ctx.runtime.profile.defaults?.sort,
        );
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
        process.stdout.write(renderObject(issue, format));
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
    .description("create a new issue (interactive, or headless via flags / --body-file)")
    .option("-p, --project <identifier>", "project identifier")
    .option("-t, --title <title>", "issue title")
    .option("--body-file <path>", "read the description from a file ('-' for stdin)")
    .option("--priority <p>", "priority (urgent|high|medium|low|none)")
    .action(async function (this: Command, opts: CreateOptions) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx, format }) => {
        const project = opts.project ?? firstDefaultProject(ctx.runtime.profile.defaults?.projects);
        if (!project) throw new NotFoundError("project is required (pass --project)");
        const fields = await resolveCreateFields(opts);
        const created = await ctx.issues.create(project, fields);
        process.stdout.write(renderObject(created, format));
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
        process.stdout.write(renderObject(updated, format));
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
    .description("add a comment to an issue (inline, from a file, or interactive)")
    .option("-m, --message <text>", "comment text")
    .option("--body-file <path>", "read the comment from a file ('-' for stdin)")
    .action(async function (this: Command, key: string, opts: CommentOptions) {
      await withContext(this, { ...this.opts(), ...opts }, async ({ ctx }) => {
        const text = await resolveCommentBody(opts);
        if (!text) throw new ConfigError("empty comment");
        await ctx.issues.comment(key, text);
        process.stdout.write(`commented on ${key}\n`);
      });
    });
}

interface CommentOptions {
  message?: string;
  bodyFile?: string;
}

// resolveCommentBody picks the comment text: --body-file (or '-' for stdin) wins,
// then -m/--message, then an interactive prompt on a TTY. Headless callers that
// supply neither and have no TTY get an empty string, which the caller rejects.
export async function resolveCommentBody(opts: CommentOptions): Promise<string> {
  if (opts.bodyFile) return readBodyFile(opts.bodyFile);
  if (opts.message !== undefined) return opts.message;
  if (!process.stdin.isTTY) return "";
  return input({ message: "comment" });
}

interface CreateOptions {
  project?: string;
  title?: string;
  bodyFile?: string;
  priority?: string;
}

interface CreateFields {
  name: string;
  description?: string;
  priority?: IssuePriority;
}

const PRIORITIES: readonly IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

// parsePriority validates a --priority flag value against the known set, failing
// with a clear message rather than passing an arbitrary string to the API.
export function parsePriority(value: string): IssuePriority {
  const match = PRIORITIES.find((p) => p === value);
  if (!match) {
    throw new ConfigError(`invalid priority: ${value}`, { expected: PRIORITIES });
  }
  return match;
}

// resolveCreateFields gathers the issue fields. When the title is provided it
// runs headless (no prompts) so agents/MCP and scripts can drive it; otherwise,
// and only on an interactive TTY, it falls back to prompting. --body-file (or
// '-' for stdin) supplies the description without inlining markdown as an arg.
export async function resolveCreateFields(opts: CreateOptions): Promise<CreateFields> {
  const bodyFromFile = opts.bodyFile ? await readBodyFile(opts.bodyFile) : undefined;
  const priority = opts.priority ? parsePriority(opts.priority) : undefined;

  // Headless path: title present means do not prompt for anything.
  if (opts.title) {
    return { name: opts.title, description: bodyFromFile || undefined, priority };
  }
  // A missing title with no TTY cannot be prompted — fail clearly instead of hanging.
  if (!process.stdin.isTTY) {
    throw new ConfigError("title is required in non-interactive mode (pass --title)");
  }

  const title = await input({ message: "title" });
  const description = bodyFromFile ?? (await input({ message: "description (optional)" }));
  const resolvedPriority =
    priority ??
    (await select({
      message: "priority",
      choices: PRIORITIES.map((value) => ({ value })),
      default: "medium" satisfies IssuePriority,
    }));
  return { name: title, description: description || undefined, priority: resolvedPriority };
}
