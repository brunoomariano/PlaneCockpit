import { Command } from "commander";
import { createReadStream, existsSync, statSync, unlinkSync } from "node:fs";
import { resolveLogPath } from "../../utils/log-paths.js";

export function registerLog(program: Command): void {
  const log = program.command("log").description("inspect the TUI/debug log file");

  log
    .command("path")
    .description("print the log file path")
    .action(function () {
      process.stdout.write(`${resolveLogPath()}\n`);
    });

  log
    .command("tail")
    .description("print the last N entries from the log")
    .option("-n, --lines <count>", "number of lines", "50")
    .action(async function (this: Command, opts: { lines: string }) {
      const path = resolveLogPath();
      if (!existsSync(path)) {
        process.stderr.write(`no log file at ${path}\n`);
        return;
      }
      const n = Math.max(1, Number.parseInt(opts.lines, 10) || 50);
      const lines = await tailLines(path, n);
      for (const line of lines) process.stdout.write(`${line}\n`);
    });

  log
    .command("clear")
    .description("remove the log file")
    .action(function () {
      const path = resolveLogPath();
      if (!existsSync(path)) {
        process.stdout.write("nothing to clear\n");
        return;
      }
      unlinkSync(path);
      process.stdout.write(`removed ${path}\n`);
    });
}

// tailLines reads only the trailing chunk of the file to avoid loading large logs
// into memory. It walks back in 4 KiB blocks until N newlines are found.
async function tailLines(path: string, n: number): Promise<string[]> {
  const size = statSync(path).size;
  if (size === 0) return [];
  const blockSize = 4096;
  const collected: string[] = [];
  let buffer = "";
  let pos = size;
  while (pos > 0 && collected.length <= n) {
    const start = Math.max(0, pos - blockSize);
    const stream = createReadStream(path, { start, end: pos - 1, encoding: "utf8" });
    let chunk = "";
    for await (const piece of stream) chunk += piece as string;
    buffer = chunk + buffer;
    const parts = buffer.split("\n");
    buffer = parts.shift() ?? "";
    for (let i = parts.length - 1; i >= 0; i--) {
      const line = parts[i];
      if (line !== undefined && line.length > 0) collected.unshift(line);
      if (collected.length >= n) break;
    }
    pos = start;
  }
  if (buffer.length > 0 && collected.length < n) collected.unshift(buffer);
  return collected.slice(-n);
}
