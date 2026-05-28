// Action ids are stable strings used both as YAML keys and as the dispatcher's
// vocabulary. Group prefix is also the help context. Adding an action requires
// extending this list and the dashboard's handler map.

export type ActionContext = "global" | "list" | "view" | "filter" | "help" | "detail";

export interface ActionDescriptor {
  id: string;
  context: ActionContext;
  description: string;
  defaultKey: string;
}

export const ACTIONS: readonly ActionDescriptor[] = [
  { id: "global.quit", context: "global", description: "quit the dashboard", defaultKey: "q" },
  { id: "global.refresh", context: "global", description: "reload current view", defaultKey: "r" },
  { id: "global.help", context: "global", description: "toggle help modal", defaultKey: "?" },
  { id: "list.next", context: "list", description: "select next issue", defaultKey: "j" },
  { id: "list.prev", context: "list", description: "select previous issue", defaultKey: "k" },
  { id: "list.next-alt", context: "list", description: "select next (arrow)", defaultKey: "down" },
  {
    id: "list.prev-alt",
    context: "list",
    description: "select previous (arrow)",
    defaultKey: "up",
  },
  { id: "list.page-down", context: "list", description: "page down", defaultKey: "pageDown" },
  { id: "list.page-up", context: "list", description: "page up", defaultKey: "pageUp" },
  { id: "list.top", context: "list", description: "jump to top", defaultKey: "g" },
  { id: "list.bottom", context: "list", description: "jump to bottom", defaultKey: "G" },
  {
    id: "list.open-detail",
    context: "list",
    description: "open detail panel",
    defaultKey: "enter",
  },
  { id: "list.open-browser", context: "list", description: "open in browser", defaultKey: "o" },
  {
    id: "list.toggle-panel",
    context: "list",
    description: "toggle detail panel",
    defaultKey: "tab",
  },
  { id: "view.next", context: "view", description: "next configured view", defaultKey: "]" },
  { id: "view.prev", context: "view", description: "previous configured view", defaultKey: "[" },
  { id: "view.next-alt", context: "view", description: "next view (arrow)", defaultKey: "right" },
  {
    id: "view.prev-alt",
    context: "view",
    description: "previous view (arrow)",
    defaultKey: "left",
  },
  { id: "filter.start", context: "filter", description: "start textual filter", defaultKey: "/" },
  {
    id: "filter.submit",
    context: "filter",
    description: "apply filter and close box",
    defaultKey: "enter",
  },
  {
    id: "filter.cancel",
    context: "filter",
    description: "cancel filter input",
    defaultKey: "escape",
  },
  { id: "help.search", context: "help", description: "search inside help modal", defaultKey: "/" },
  { id: "help.close", context: "help", description: "close help modal", defaultKey: "escape" },
  {
    id: "detail.scroll-down",
    context: "detail",
    description: "scroll detail down",
    defaultKey: "j",
  },
  { id: "detail.scroll-up", context: "detail", description: "scroll detail up", defaultKey: "k" },
  {
    id: "detail.scroll-down-alt",
    context: "detail",
    description: "scroll detail down (arrow)",
    defaultKey: "down",
  },
  {
    id: "detail.scroll-up-alt",
    context: "detail",
    description: "scroll detail up (arrow)",
    defaultKey: "up",
  },
  {
    id: "detail.page-down",
    context: "detail",
    description: "page down inside detail",
    defaultKey: "pageDown",
  },
  {
    id: "detail.page-up",
    context: "detail",
    description: "page up inside detail",
    defaultKey: "pageUp",
  },
  { id: "detail.top", context: "detail", description: "jump to top of detail", defaultKey: "g" },
  {
    id: "detail.bottom",
    context: "detail",
    description: "jump to bottom of detail",
    defaultKey: "G",
  },
  {
    id: "detail.open-browser",
    context: "detail",
    description: "open in browser",
    defaultKey: "o",
  },
  {
    id: "detail.close",
    context: "detail",
    description: "close detail modal",
    defaultKey: "escape",
  },
] as const;

export type ActionId = (typeof ACTIONS)[number]["id"];

export function isActionId(value: string): value is ActionId {
  return ACTIONS.some((a) => a.id === value);
}

export function actionDescriptor(id: ActionId): ActionDescriptor {
  const found = ACTIONS.find((a) => a.id === id);
  if (!found) throw new Error(`unknown action: ${id}`);
  return found;
}

export function actionsByContext(context: ActionContext): ActionDescriptor[] {
  return ACTIONS.filter((a) => a.context === context);
}
