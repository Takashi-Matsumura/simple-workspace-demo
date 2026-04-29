"use client";

import { useCallback, useEffect, useState } from "react";
import {
  OPEN_DOC_EVENT,
  OPEN_PATH_EVENT,
  type OpenDocEventDetail,
  type OpenPathEventDetail,
} from "./markdown-text";
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
import { FloatingWorkspaceTree } from "./floating-workspace-tree";
import { FloatingWorkspacePreview } from "./floating-workspace-preview";

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
  onStartReport: () => void;
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

// ツリー / プレビューの幅を %  で切り分ける垂直ドラッガ。
// 親の bounding rect 基準で onPointerMove を %  に変換するだけのシンプル実装。
function SplitDragger({
  splitPct,
  onChange,
}: {
  splitPct: number;
  onChange: (pct: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const parent = e.currentTarget.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
          const x = ev.clientX - rect.left;
          const pct = Math.max(15, Math.min(80, (x / rect.width) * 100));
          onChange(pct);
        };
        const up = () => {
          target.releasePointerCapture(e.pointerId);
          target.removeEventListener("pointermove", move as EventListener);
          target.removeEventListener("pointerup", up as EventListener);
        };
        target.addEventListener("pointermove", move as EventListener);
        target.addEventListener("pointerup", up as EventListener);
      }}
      className="w-1 shrink-0 cursor-col-resize bg-slate-200 hover:bg-blue-300"
      title={`split: ${Math.round(splitPct)}%`}
    />
  );
}

function FloatingWorkspaceInner({
  view,
  onStartOpencode,
  onStartReport,
  onZoomToFit,
  z,
  onFocus,
}: FloatingWorkspaceProps) {
  const { workspace, onWorkspaceChange, notice, error } = useWorkspace();
  const [scenePos, setScenePos] = useState<ScenePos>(() => {
    if (typeof window === "undefined") return { x: 60, y: 60 };
    return {
      x: Math.max(0, (window.innerWidth - 720) / 2),
      y: Math.max(0, (window.innerHeight - 420) / 2),
    };
  });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 720, h: 420 });
  const [splitPct, setSplitPct] = useState<number>(38);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const { fontSize, changeFontSize } = useFontSize(STORAGE_KEYS.workspaceFontSize, {
    default: 12,
    min: 10,
    max: 20,
  });

  const { flipped, setFlipped } = use3dFlip(false);
  const flip = useCallback(() => setFlipped((f) => !f), [setFlipped]);

  // 回答中の `[doc=xxx]` クリックで該当ファイルを tree+preview に開く。
  // doc id は corpus の category prefix から path を組み立てる。
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<OpenDocEventDetail>).detail;
      const id = detail?.id;
      if (!id || !workspace) return;
      const category = id.startsWith("spec-")
        ? "spec"
        : id.startsWith("faq-")
          ? "faq"
          : id.startsWith("incident-")
            ? "incident"
            : null;
      if (!category) return;
      setSelectedPath(`corpus/${category}/${id}.md`);
      setFlipped(false);
      onFocus?.();
    };
    window.addEventListener(OPEN_DOC_EVENT, handler);
    return () => window.removeEventListener(OPEN_DOC_EVENT, handler);
  }, [workspace, setFlipped, onFocus]);

  // 任意の path を直接指定して開くイベント（レポート整形後の自動オープン用）。
  // ツリーに新しく書かれたファイルを反映するため refreshSignal も bump する。
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<OpenPathEventDetail>).detail;
      const path = detail?.path;
      if (!path || !workspace) return;
      setRefreshSignal((n) => n + 1);
      setSelectedPath(path);
      setFlipped(false);
      onFocus?.();
    };
    window.addEventListener(OPEN_PATH_EVENT, handler);
    return () => window.removeEventListener(OPEN_PATH_EVENT, handler);
  }, [workspace, setFlipped, onFocus]);

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
      setSelectedPath(null);
      setRefreshSignal((n) => n + 1);
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
      style={{ background: "linear-gradient(135deg, transparent 50%, rgba(148,163,184,0.6) 50%)" }}
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
          className="flex flex-col overflow-hidden rounded-lg border-2 border-slate-400 bg-white shadow-2xl shadow-slate-900/20"
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
            onStartReport={onStartReport}
            onOpen={handleOpen}
          />

          {error && (
            <div className="border-b border-rose-200 bg-rose-50 px-3 py-1 font-mono text-[11px] text-rose-700">{error}</div>
          )}
          {notice && (
            <div className="border-b border-sky-200 bg-sky-50 px-3 py-1 font-mono text-[11px] text-sky-800 break-all">{notice}</div>
          )}

          <div className="relative flex min-h-0 flex-1">
            {workspace ? (
              <>
                <div
                  className="min-w-0 overflow-hidden border-r border-slate-200"
                  style={{ width: `${splitPct}%` }}
                >
                  <FloatingWorkspaceTree
                    fontSize={fontSize}
                    selectedPath={selectedPath}
                    onSelectPath={setSelectedPath}
                    refreshSignal={refreshSignal}
                  />
                </div>
                <SplitDragger splitPct={splitPct} onChange={setSplitPct} />
                <div className="min-w-0 flex-1">
                  <FloatingWorkspacePreview
                    fontSize={fontSize}
                    selectedPath={selectedPath}
                  />
                </div>
              </>
            ) : (
              <div
                className="flex-1 px-3 py-2 font-mono text-slate-500"
                style={{ fontSize }}
              >
                ホワイトボードに自由に描けます。OpenCode パネルや、ファイルツリーは
                workspace を選択した後に表示されます。
              </div>
            )}
            {resizeHandle}
          </div>
        </div>

        {/* Back: settings */}
        <div
          className="flex flex-col overflow-hidden rounded-lg border-2 border-slate-400 bg-white shadow-2xl shadow-slate-900/20"
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
