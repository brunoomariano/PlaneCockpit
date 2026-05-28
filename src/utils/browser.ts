import open from "open";

export interface BrowserOpener {
  open(url: string): Promise<void>;
}

export const defaultBrowserOpener: BrowserOpener = {
  async open(url: string): Promise<void> {
    await open(url);
  },
};
