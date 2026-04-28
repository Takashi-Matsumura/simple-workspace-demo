export type PanelId = "workspace" | "opencode";
export type TerminalPanelId = Exclude<PanelId, "workspace">;

export const TERMINAL_PANEL_IDS: readonly TerminalPanelId[] = ["opencode"];

// 末尾ほど手前。起動直後はターミナル系を Workspace より上に置く。
export const INITIAL_PANEL_ORDER: readonly PanelId[] = ["workspace", "opencode"];
