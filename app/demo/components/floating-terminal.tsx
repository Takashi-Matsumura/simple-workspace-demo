"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  X,
  Minus,
  Maximize2,
  CirclePlus,
  CircleMinus,
} from "lucide-react";
import type { View, SceneRect } from "./whiteboard-canvas";
import { usePointerDrag } from "../hooks/use-pointer-drag";
import { usePointerResize } from "../hooks/use-pointer-resize";
import { useFontSize } from "../hooks/use-font-size";
import { terminalFontSizeKey } from "../lib/storage-keys";

const OpenCodeChat = dynamic(() => import("./opencode-chat"), {
  ssr: false,
});

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

export type TerminalSession = { workspaceId: string; nonce: number };
export type TerminalVariant = "opencode";

type VariantStyle = {
  label: string;
  headerBg: string;
  headerText: string;
  headerBorder: string;
  panelBorder: string;
  panelBg: string;
};

const VARIANT_STYLES: Record<TerminalVariant, VariantStyle> = {
  opencode: {
    label: "opencode — RAG / Agentic",
    headerBg: "bg-[#1a1530]",
    headerText: "text-white",
    headerBorder: "border-white/10 border-t-2 border-t-violet-400",
    panelBorder: "border border-white/10 shadow-black/50",
    panelBg: "#100c1f",
  },
};

// ビューポート中心にパネル中央が来るように scenePos を逆算。
function defaultScenePos(
  slot: "left" | "center" | "right",
  view: View,
  size: { w: number; h: number },
): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const baseX = window.innerWidth / 2 / view.zoom - size.w / 2 - view.x;
  const baseY = window.innerHeight / 2 / view.zoom - size.h / 2 - view.y;
  const dx = slot === "left" ? -40 : slot === "right" ? 40 : 0;
  const dy = slot === "left" ? -20 : slot === "right" ? 20 : 0;
  return { x: baseX + dx, y: baseY + dy };
}

export default function FloatingTerminal({
  view,
  session,
  onStop,
  onZoomToFit,
  variant = "opencode",
  slot = "center",
  z,
  onFocus,
}: {
  view: View;
  session: TerminalSession | null;
  onStop: () => void;
  onZoomToFit?: (rect: SceneRect) => void;
  variant?: TerminalVariant;
  slot?: "left" | "center" | "right";
  z: number;
  onFocus?: () => void;
}) {
  const style = VARIANT_STYLES[variant];

  const [scenePos, setScenePos] = useState<ScenePos>(() =>
    defaultScenePos(slot, view, { w: 720, h: 440 }),
  );
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 720, h: 440 });
  const [minimized, setMinimized] = useState(false);
  const { fontSize, changeFontSize } = useFontSize(
    terminalFontSizeKey(variant),
    { default: 13, min: 10, max: 28 },
  );

  const headerHandlers = usePointerDrag(view, scenePos, setScenePos);
  const resizeHandlers = usePointerResize(view, sceneSize, setSceneSize, {
    minW: 320,
    minH: 180,
  });

  const left = (scenePos.x + view.x) * view.zoom;
  const top = (scenePos.y + view.y) * view.zoom;

  return (
    <div
      className="fixed"
      style={{
        left: 0,
        top: 0,
        width: sceneSize.w,
        height: minimized ? 36 : sceneSize.h,
        transform: `translate(${left}px, ${top}px) scale(${view.zoom})`,
        transformOrigin: "top left",
        zIndex: z,
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
    >
      <div
        className={`flex h-full w-full flex-col rounded-lg shadow-2xl backdrop-blur ${style.panelBorder}`}
        style={{ backgroundColor: style.panelBg }}
      >
        <div
          className={`flex h-9 cursor-grab items-center gap-2 rounded-t-lg border-b px-3 text-xs active:cursor-grabbing select-none ${style.headerBorder} ${style.headerBg} ${style.headerText}`}
          {...headerHandlers}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onStop}
              className="group h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-110"
              title="パネルを閉じる"
            >
              <X className="hidden h-3 w-3 stroke-[3] text-black/60 group-hover:block" />
            </button>
            <button
              type="button"
              onClick={() => setMinimized((m) => !m)}
              className="group h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-110"
              title={minimized ? "元に戻す" : "最小化"}
            >
              <Minus className="hidden h-3 w-3 stroke-[3] text-black/60 group-hover:block" />
            </button>
            <button
              type="button"
              onClick={() =>
                onZoomToFit?.({ x: scenePos.x, y: scenePos.y, w: sceneSize.w, h: sceneSize.h })
              }
              className="group h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110"
              title="80% フィット表示"
            >
              <Maximize2 className="hidden h-2.5 w-2.5 stroke-[3] text-black/60 group-hover:block" style={{ margin: "0.5px" }} />
            </button>
          </div>
          <span className="ml-1 flex-1 font-mono">{style.label}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeFontSize(-1)}
              className="rounded p-0.5 text-white hover:bg-white/10"
              title="文字サイズを下げる"
            >
              <CircleMinus className="h-4 w-4" />
            </button>
            <span className="font-mono text-[10px] text-white min-w-[1.5rem] text-center">{fontSize}</span>
            <button
              type="button"
              onClick={() => changeFontSize(1)}
              className="rounded p-0.5 text-white hover:bg-white/10"
              title="文字サイズを上げる"
            >
              <CirclePlus className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!minimized && (
          <div className="relative flex-1 overflow-hidden rounded-b-lg bg-[#0b0b0f]">
            {session ? (
              <OpenCodeChat workspaceId={session.workspaceId} fontSize={fontSize} />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-6 text-center font-mono text-xs text-white/50">
                Workspace パネルからワークスペースを選択して起動してください
              </div>
            )}
            <div
              className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
              {...resizeHandlers}
              style={{
                background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
