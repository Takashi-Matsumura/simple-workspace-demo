import type { ReactNode } from "react";
import { ClipboardList, Sparkles } from "lucide-react";
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
    switcherAccent: "#2563eb",
    switcherIcon: <Sparkles className="h-3 w-3" />,
  },
  {
    id: "report",
    variant: "report",
    slot: "right",
    switcherLabel: "訪問レポート",
    switcherTitle: "訪問介護レポート生成パネルを最前面に",
    switcherAccent: "#0d9488",
    switcherIcon: <ClipboardList className="h-3 w-3" />,
  },
];
