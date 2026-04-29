"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  X,
  Minus,
  Maximize2,
  CirclePlus,
  CircleMinus,
  ArrowUpDown,
} from "lucide-react";
import type { View, SceneRect } from "./whiteboard-canvas";
import { usePointerDrag } from "../hooks/use-pointer-drag";
import { usePointerResize } from "../hooks/use-pointer-resize";
import { useFontSize } from "../hooks/use-font-size";
import { use3dFlip } from "../hooks/use-3d-flip";
import { terminalFontSizeKey } from "../lib/storage-keys";
import { OpenCodeLogo } from "./opencode-logo";
import { OpenCodeHelp } from "./opencode-help";

const OpenCodeChat = dynamic(() => import("./opencode-chat"), {
  ssr: false,
});

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

export type TerminalSession = { workspaceId: string; nonce: number };
export type TerminalVariant = "opencode";

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
  const [scenePos, setScenePos] = useState<ScenePos>(() =>
    defaultScenePos(slot, view, { w: 720, h: 440 }),
  );
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 720, h: 440 });
  const [minimized, setMinimized] = useState(false);
  const { fontSize, changeFontSize } = useFontSize(
    terminalFontSizeKey(variant),
    { default: 13, min: 10, max: 28 },
  );
  const { flipped, toggle: flip } = use3dFlip(false);

  const headerHandlers = usePointerDrag(view, scenePos, setScenePos);
  const resizeHandlers = usePointerResize(view, sceneSize, setSceneSize, {
    minW: 320,
    minH: 180,
  });

  const left = (scenePos.x + view.x) * view.zoom;
  const top = (scenePos.y + view.y) * view.zoom;

  // ヘッダーは表/裏共通。ライトテーマ + opencode ロゴ。
  const headerBar = (sublabel: string) => (
    <div
      className="flex h-9 cursor-grab items-center gap-2 rounded-t-lg border-b border-blue-300 bg-blue-100 px-3 text-xs text-slate-600 active:cursor-grabbing select-none"
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
      <OpenCodeLogo className="ml-1 text-blue-700" />
      <span className="font-mono text-[10px] text-slate-400">— {sublabel}</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => changeFontSize(-1)}
          className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          title="文字サイズを下げる"
        >
          <CircleMinus className="h-4 w-4" />
        </button>
        <span className="min-w-[1.5rem] text-center font-mono text-[10px] text-slate-500">{fontSize}</span>
        <button
          type="button"
          onClick={() => changeFontSize(1)}
          className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          title="文字サイズを上げる"
        >
          <CirclePlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={flip}
          className="ml-1 rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          title={flipped ? "チャットに戻す" : "ヘルプを開く"}
        >
          <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
        </button>
      </div>
    </div>
  );

  const resizeHandle = (
    <div
      className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
      {...resizeHandlers}
      style={{
        background: "linear-gradient(135deg, transparent 50%, rgba(59,130,246,0.55) 50%)",
      }}
    />
  );

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
        perspective: 1200,
        zIndex: z,
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onFocus?.();
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.6s ease-in-out",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front: chat */}
        <div
          className="flex flex-col rounded-lg border-2 border-blue-400 bg-white shadow-2xl shadow-slate-900/20"
          style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}
        >
          {headerBar("RAG vs Agentic")}
          {!minimized && (
            <div className="relative flex-1 overflow-hidden rounded-b-lg bg-white">
              {session ? (
                <OpenCodeChat workspaceId={session.workspaceId} fontSize={fontSize} />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-6 text-center font-mono text-xs text-slate-400">
                  Workspace パネルからワークスペースを選択して起動してください
                </div>
              )}
              {resizeHandle}
            </div>
          )}
        </div>

        {/* Back: help */}
        <div
          className="flex flex-col rounded-lg border-2 border-blue-400 bg-white shadow-2xl shadow-slate-900/20"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {headerBar("ヘルプ")}
          {!minimized && (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-lg bg-white">
              <OpenCodeHelp fontSize={fontSize} />
              {resizeHandle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
