import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const CLI = join(process.cwd(), "dist", "cli.js");

// A minimal valid config so the CLI resolves a profile without depending on the
// developer's ~/.config/plane-cli/config.yaml. Tests that exercise validation
// past config loading (e.g. priority parsing) need a config present; without one
// the CLI fails earlier with "no config file found" — which is environment-
// dependent and was masking these checks on CI.
const TEST_CONFIG = `active_profile: test
profiles:
  test:
    server:
      base_url: https://plane.example.com
      workspace_slug: acme
    auth:
      api_key: test-key
    defaults:
      projects: ["ENG"]
`;

let configDir: string;
let configPath: string;

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

// runCli invokes the built binary so these are true end-to-end checks of
// argument parsing and the pre-network validation paths (no Plane server needed).
// Every run points at an isolated temp config via --config so the result never
// depends on the host machine. stdin is closed immediately so any prompt
// fallback fails fast instead of hanging.
function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI, "--config", configPath, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
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
    configDir = mkdtempSync(join(tmpdir(), "plc-e2e-"));
    configPath = join(configDir, "config.yaml");
    writeFileSync(configPath, TEST_CONFIG);
  });

  afterAll(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
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

  // transition takes a <key> and <state> argument, and supports json output.
  it("shows the state argument and --json on `issue transition --help`", async () => {
    const { code, stdout } = await runCli(["issue", "transition", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("state");
    expect(stdout).toContain("--json");
  });

  // The mutating commands expose --json/--yaml for scripting, like list/view.
  it("exposes --json on `issue create` and `issue label --help`", async () => {
    const create = await runCli(["issue", "create", "--help"]);
    expect(create.stdout).toContain("--json");
    const label = await runCli(["issue", "label", "--help"]);
    expect(label.stdout).toContain("--json");
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
