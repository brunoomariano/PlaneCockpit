// Action ids are stable strings used both as YAML keys and as the dispatcher's
// vocabulary. Group prefix is also the help context. Adding an action requires
// extending this list and the dashboard's handler map.

export type ActionContext = "global" | "list" | "view" | "filter" | "help" | "detail" | "edit";

export interface ActionDescriptor {
  id: string;
  context: ActionContext;
  description: string;
  defaultKey: string;
}

// `satisfies` (not a type annotation) keeps each `id` as a string literal so
// `ActionId` is a precise union — which makes the handler maps in the dashboard
// reject typos and unknown action ids at compile time.
export const ACTIONS = [
  { id: "global.quit", context: "global", description: "quit the dashboard", defaultKey: "q" },
  { id: "global.refresh", context: "global", description: "reload current view", defaultKey: "r" },
  {
    id: "global.refresh-all",
    context: "global",
    description: "reload every view",
    defaultKey: "R",
  },
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
  { id: "list.comment", context: "list", description: "comment on issue", defaultKey: "c" },
  { id: "list.edit", context: "list", description: "edit issue fields", defaultKey: "e" },
  { id: "list.create", context: "list", description: "create a new issue", defaultKey: "n" },
  {
    id: "list.state-next",
    context: "list",
    description: "advance issue to the next state",
    defaultKey: ">",
  },
  {
    id: "list.state-prev",
    context: "list",
    description: "move issue to the previous state",
    defaultKey: "<",
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
  { id: "detail.comment", context: "detail", description: "comment on issue", defaultKey: "c" },
  { id: "detail.edit", context: "detail", description: "edit issue fields", defaultKey: "e" },
  {
    id: "detail.activity",
    context: "detail",
    description: "toggle the state-change activity log",
    defaultKey: "a",
  },
  {
    id: "detail.relations",
    context: "detail",
    description: "toggle the relations section",
    defaultKey: "l",
  },
  {
    id: "detail.relation-open",
    context: "detail",
    description: "open the focused relation",
    defaultKey: "enter",
  },
  {
    id: "detail.close",
    context: "detail",
    description: "close detail modal",
    defaultKey: "escape",
  },
  {
    id: "edit.open-field",
    context: "edit",
    description: "open the focused field picker",
    defaultKey: "enter",
  },
  { id: "edit.save", context: "edit", description: "save all changes", defaultKey: "ctrl+s" },
  { id: "edit.cancel", context: "edit", description: "close the editor", defaultKey: "escape" },
] as const satisfies readonly ActionDescriptor[];

export type ActionId = (typeof ACTIONS)[number]["id"];

export function isActionId(value: string): value is ActionId {
  return ACTIONS.some((a) => a.id === value);
}
