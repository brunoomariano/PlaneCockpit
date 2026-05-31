import open from "open";

export interface BrowserOpener {
  open(url: string): Promise<void>;
}

// defaultBrowserOpener launches the system browser without letting the launcher
// touch our terminal. While the TUI owns the screen, any byte the child writes to
// stdout/stderr corrupts the Ink render (gh-dash #829/#861), so we force the
// child's stdio to be ignored and detach + unref it so it never blocks or draws.
export const defaultBrowserOpener: BrowserOpener = {
  async open(url: string): Promise<void> {
    const subprocess = await open(url, {
      // `wait: false` (default) returns immediately; combined with ignored stdio
      // the launcher cannot print into the dashboard.
      newInstance: false,
      allowNonzeroExitCode: true,
    });
    // Defensively detach: on platforms where `open` does not already ignore the
    // child's streams, unhook them from our process and let it run independently.
    subprocess.stdout?.destroy();
    subprocess.stderr?.destroy();
    subprocess.unref();
  },
};
