"use client";

import { useCallback, useState } from "react";
import type { View } from "./whiteboard-canvas";
import { usePointerDrag } from "../hooks/use-pointer-drag";
import { usePointerResize } from "../hooks/use-pointer-resize";
import { useFontSize } from "../hooks/use-font-size";
import { use3dFlip } from "../hooks/use-3d-flip";
import { STORAGE_KEYS } from "../lib/storage-keys";
import { apiTouchWorkspace, type WorkspaceListEntry } from "../api/workspace";
import { WorkspaceContextProvider, useWorkspace } from "./workspace-context";
import { FloatingWorkspaceHeader } from "./floating-workspace-header";
import { FloatingWorkspaceSelector } from "./floating-workspace-selector";
import { FloatingWorkspaceSettings } from "./floating-workspace-settings";

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

export type Workspace = {
  id: string;
  label: string;
  createdAt: number;
  lastOpenedAt: number;
};

function workspaceToFull(e: WorkspaceListEntry): Workspace {
  return { ...e };
}

type FloatingWorkspaceProps = {
  view: View;
  workspace: Workspace | null;
  onWorkspaceChange: (ws: Workspace | null) => void;
  onStartOpencode: () => void;
  onZoomToFit?: (rect: { x: number; y: number; w: number; h: number }) => void;
  z: number;
  onFocus?: () => void;
};

export default function FloatingWorkspace(props: FloatingWorkspaceProps) {
  return (
    <WorkspaceContextProvider
      workspace={props.workspace}
      onWorkspaceChange={props.onWorkspaceChange}
    >
      <FloatingWorkspaceInner {...props} />
    </WorkspaceContextProvider>
  );
}

function FloatingWorkspaceInner({
  view,
  onStartOpencode,
  onZoomToFit,
  z,
  onFocus,
}: FloatingWorkspaceProps) {
  const { onWorkspaceChange, notice, error } = useWorkspace();
  const [scenePos, setScenePos] = useState<ScenePos>(() => {
    if (typeof window === "undefined") return { x: 60, y: 60 };
    return {
      x: Math.max(0, (window.innerWidth - 520) / 2),
      y: Math.max(0, (window.innerHeight - 200) / 2),
    };
  });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 520, h: 200 });

  const { fontSize, changeFontSize } = useFontSize(STORAGE_KEYS.workspaceFontSize, {
    default: 12,
    min: 10,
    max: 20,
  });

  const { flipped, toggle: flip } = use3dFlip(false);

  const headerHandlers = usePointerDrag(view, scenePos, setScenePos, {
    skipSelector: "button,input",
  });
  const resizeHandlers = usePointerResize(view, sceneSize, setSceneSize, {
    minW: 360,
    minH: 160,
  });

  const handleOpen = useCallback(
    async (e: WorkspaceListEntry) => {
      const ws = workspaceToFull(e);
      onWorkspaceChange(ws);
      try {
        await apiTouchWorkspace(ws.id);
      } catch {
        // touch 失敗は並び順が古いままになるだけなので握り潰す
      }
    },
    [onWorkspaceChange],
  );

  const left = (scenePos.x + view.x) * view.zoom;
  const top = (scenePos.y + view.y) * view.zoom;

  const resizeHandle = (
    <div
      className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
      {...resizeHandlers}
      style={{ background: "linear-gradient(135deg, transparent 50%, rgba(15,23,42,0.55) 50%)" }}
    />
  );

  return (
    <div
      className="fixed"
      style={{
        left: 0,
        top: 0,
        width: sceneSize.w,
        height: sceneSize.h,
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
        {/* Front: workspace selector */}
        <div
          className="flex flex-col overflow-hidden rounded-lg border-2 border-slate-900 bg-white shadow-2xl shadow-slate-900/20"
          style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}
        >
          <FloatingWorkspaceHeader
            fontSize={fontSize}
            changeFontSize={changeFontSize}
            scenePos={scenePos}
            sceneSize={sceneSize}
            onZoomToFit={onZoomToFit}
            headerHandlers={headerHandlers}
            flipped={flipped}
            onFlip={flip}
          />

          <FloatingWorkspaceSelector
            onStartOpencode={onStartOpencode}
            onOpen={handleOpen}
          />

          {error && (
            <div className="border-b border-rose-200 bg-rose-50 px-3 py-1 font-mono text-[11px] text-rose-700">{error}</div>
          )}
          {notice && (
            <div className="border-b border-sky-200 bg-sky-50 px-3 py-1 font-mono text-[11px] text-sky-800 break-all">{notice}</div>
          )}

          <div
            className="relative flex-1 px-3 py-2 font-mono text-slate-500"
            style={{ fontSize }}
          >
            ホワイトボードに自由に描けます。OpenCode パネルは workspace を選択した後に起動できます。
            {resizeHandle}
          </div>
        </div>

        {/* Back: settings */}
        <div
          className="flex flex-col overflow-hidden rounded-lg border-2 border-slate-900 bg-white shadow-2xl shadow-slate-900/20"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <FloatingWorkspaceHeader
            fontSize={fontSize}
            changeFontSize={changeFontSize}
            scenePos={scenePos}
            sceneSize={sceneSize}
            onZoomToFit={onZoomToFit}
            headerHandlers={headerHandlers}
            flipped={flipped}
            onFlip={flip}
            title="settings"
          />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <FloatingWorkspaceSettings fontSize={fontSize} />
            {resizeHandle}
          </div>
        </div>
      </div>
    </div>
  );
}
