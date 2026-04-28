import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { TerminalVariant } from "../components/floating-terminal";
import type { TerminalPanelId } from "../types/panels";

export type TerminalPanelDefinition = {
  id: TerminalPanelId;
  variant: TerminalVariant;
  slot: "left" | "center" | "right";
  switcherLabel: string;
  switcherTitle: string;
  switcherAccent: string;
  switcherIcon: ReactNode;
};

// 新しいパネル種別を増やす時はここに 1 行追加するだけで
// <FloatingTerminal> と <PanelSwitcherButton> の両方が自動で生える。
export const TERMINAL_PANEL_DEFINITIONS: readonly TerminalPanelDefinition[] = [
  {
    id: "opencode",
    variant: "opencode",
    slot: "center",
    switcherLabel: "OpenCode",
    switcherTitle: "OpenCode パネルを最前面に",
    switcherAccent: "#7c3aed",
    switcherIcon: <Sparkles className="h-3 w-3" />,
  },
];
