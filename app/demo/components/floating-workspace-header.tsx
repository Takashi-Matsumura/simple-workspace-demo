"use client";

import { ArrowUpDown, CircleMinus, CirclePlus, Maximize2 } from "lucide-react";
import type { usePointerDrag } from "../hooks/use-pointer-drag";
import { useWorkspace } from "./workspace-context";

type Props = {
  fontSize: number;
  changeFontSize: (delta: number) => void;
  scenePos: { x: number; y: number };
  sceneSize: { w: number; h: number };
  onZoomToFit?: (rect: { x: number; y: number; w: number; h: number }) => void;
  headerHandlers: ReturnType<typeof usePointerDrag>;
  flipped?: boolean;
  onFlip?: () => void;
  title?: string;
  sandboxEnabled?: boolean;
  onToggleSandbox?: () => void;
};

export function FloatingWorkspaceHeader({
  fontSize,
  changeFontSize,
  scenePos,
  sceneSize,
  onZoomToFit,
  headerHandlers,
  flipped,
  onFlip,
  title = "workspaces",
  sandboxEnabled,
  onToggleSandbox,
}: Props) {
  const { workspace } = useWorkspace();
  return (
    <div
      className="flex h-9 cursor-grab items-center justify-between gap-2 rounded-t-lg border-b border-slate-400 bg-slate-200 px-3 text-xs text-slate-600 active:cursor-grabbing select-none"
      {...headerHandlers}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoomToFit?.({ x: scenePos.x, y: scenePos.y, w: sceneSize.w, h: sceneSize.h });
          }}
          className="group h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110"
          title="80% フィット表示"
        >
          <Maximize2 className="hidden h-2.5 w-2.5 stroke-[3] text-black/60 group-hover:block" style={{ margin: "0.5px" }} />
        </button>
        <span className="font-mono font-medium text-slate-700">{title}</span>
        {onToggleSandbox && (
          <SandboxToggle
            enabled={!!sandboxEnabled}
            onToggle={onToggleSandbox}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="truncate font-mono text-[10px] text-slate-400">
          {workspace ? workspace.id : "(no workspace open)"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              changeFontSize(-1);
            }}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            title="文字サイズを下げる"
          >
            <CircleMinus className="h-4 w-4" />
          </button>
          <span className="min-w-[1.5rem] text-center font-mono text-[10px] text-slate-500">{fontSize}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              changeFontSize(1);
            }}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            title="文字サイズを上げる"
          >
            <CirclePlus className="h-4 w-4" />
          </button>
          {onFlip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFlip();
              }}
              className="ml-1 rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              title={flipped ? "Workspace に戻す" : "設定を開く"}
            >
              <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SandboxToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title={
        enabled
          ? "Sandbox を無効化 (Shell パネルを閉じる)"
          : "Sandbox を有効化 (Shell パネルを開けるように)"
      }
      className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-50"
    >
      <span
        className={`relative inline-block h-3.5 w-7 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-purple-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition-[left] ${
            enabled ? "left-4" : "left-0.5"
          }`}
        />
      </span>
      <span className={enabled ? "text-purple-700" : "text-slate-500"}>
        Sandbox {enabled ? "ON" : "OFF"}
      </span>
    </button>
  );
}
