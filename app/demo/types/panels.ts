export type PanelId = "workspace" | "opencode" | "report" | "shell";
export type TerminalPanelId = Exclude<PanelId, "workspace" | "shell">;

export const TERMINAL_PANEL_IDS: readonly TerminalPanelId[] = [
  "opencode",
  "report",
];

// 末尾ほど手前。起動直後は Shell を最前面に置く (Workspace > opencode/report > shell)。
export const INITIAL_PANEL_ORDER: readonly PanelId[] = [
  "workspace",
  "opencode",
  "report",
  "shell",
];
