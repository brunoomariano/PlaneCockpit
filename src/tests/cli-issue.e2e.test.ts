import { describe, it, expect, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";

const CLI = join(process.cwd(), "dist", "cli.js");

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

// runCli invokes the built binary so these are true end-to-end checks of
// argument parsing and the pre-network validation paths (no Plane server needed).
// stdin is closed immediately so any prompt fallback fails fast instead of hanging.
function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.stdin.end();
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

describe("cli issue (e2e, built binary)", () => {
  beforeAll(() => {
    if (!existsSync(CLI)) {
      throw new Error(`build the CLI first (dist/cli.js missing): run \`make build\``);
    }
  });

  it("exposes --body-file and --priority on `issue create --help`", async () => {
    const { code, stdout } = await runCli(["issue", "create", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("--body-file");
    expect(stdout).toContain("--priority");
  });

  it("exposes --body-file on `issue comment --help`", async () => {
    const { code, stdout } = await runCli(["issue", "comment", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("--body-file");
  });

  // The state/label/delete mutations are wired into the binary's command surface.
  it("registers the transition, label and delete subcommands", async () => {
    const { code, stdout } = await runCli(["issue", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("transition");
    expect(stdout).toContain("label");
    expect(stdout).toContain("delete");
  });

  it("exposes --yes on `issue delete --help`", async () => {
    const { code, stdout } = await runCli(["issue", "delete", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("--yes");
  });

  // transition takes a <key> and <state> argument.
  it("shows the state argument on `issue transition --help`", async () => {
    const { code, stdout } = await runCli(["issue", "transition", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("state");
  });

  // Invalid priority is rejected before any network call, with a non-zero exit
  // and a CONFIG error naming the bad value.
  it("rejects an invalid --priority before hitting the API", async () => {
    const { code, stderr } = await runCli([
      "issue",
      "create",
      "-p",
      "ENG",
      "-t",
      "x",
      "--priority",
      "bogus",
    ]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("invalid priority: bogus");
  });
});
