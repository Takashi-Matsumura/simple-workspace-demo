"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Loader2, ZoomIn, ZoomOut, Layers, Folder } from "lucide-react";
import type { View, CanvasActions } from "./demo/components/whiteboard-canvas";
import type { Workspace } from "./demo/components/floating-workspace";
import { AccountBadge } from "./demo/components/account-badge";
import { usePanels } from "./demo/hooks/use-panels";
import { TERMINAL_PANEL_DEFINITIONS } from "./demo/config/terminal-panels";
import type { TerminalPanelId } from "./demo/types/panels";

const WhiteboardCanvas = dynamic(
  () => import("./demo/components/whiteboard-canvas"),
  { ssr: false },
);
const FloatingTerminal = dynamic(
  () => import("./demo/components/floating-terminal"),
  { ssr: false },
);
const FloatingWorkspace = dynamic(
  () => import("./demo/components/floating-workspace"),
  { ssr: false },
);

export default function Home() {
  const router = useRouter();
  const canvasRef = useRef<CanvasActions | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [drawOver, setDrawOver] = useState(false);
  // proxy.ts は Cookie の存在しか見ないため、無効 Cookie でも / が描画される。
  // クライアント側で /api/auth/me を呼んで user が null なら /login へ送る。
  const [authState, setAuthState] = useState<"loading" | "authed">("loading");
  const panels = usePanels();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setAuthState("authed");
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ワークスペース切替時はパネル内のセッションも一緒にクリアする。
  const handleWorkspaceChange = useCallback(
    (ws: Workspace | null) => {
      setWorkspace((prev) => {
        if (prev?.id !== ws?.id) panels.clearTerminalSessions();
        return ws;
      });
    },
    [panels],
  );

  const openTerminal = (id: TerminalPanelId) => {
    if (!workspace) return;
    panels.openTerminal(id, workspace);
  };

  if (authState === "loading") {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-neutral-50">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
      </main>
    );
  }

  return (
    <main className="fixed inset-0 overflow-hidden">
      <header className="fixed top-0 right-0 left-0 z-[60] flex h-9 items-center justify-between border-b border-slate-200 bg-white/90 px-3 backdrop-blur-sm">
        <span className="font-mono text-xs font-medium text-slate-700">
          simple-workspace-demo
        </span>
        <AccountBadge />
      </header>
      <WhiteboardCanvas
        onView={setView}
        zoomRef={canvasRef}
        drawOverMode={drawOver}
        showToolbar={drawOver}
        topOffset={36}
      />
      <FloatingWorkspace
        view={view}
        workspace={workspace}
        onWorkspaceChange={handleWorkspaceChange}
        onStartOpencode={() => openTerminal("opencode")}
        onStartReport={() => openTerminal("report")}
        onZoomToFit={(rect) => canvasRef.current?.zoomToRect(rect)}
        z={panels.zFor("workspace")}
        onFocus={() => panels.bringToFront("workspace")}
      />
      {TERMINAL_PANEL_DEFINITIONS.map((def) => {
        const session = panels.sessions.get(def.id);
        if (!session) return null;
        return (
          <FloatingTerminal
            key={def.id}
            view={view}
            session={session}
            onStop={() => panels.closeTerminal(def.id)}
            onZoomToFit={(rect) => canvasRef.current?.zoomToRect(rect)}
            variant={def.variant}
            slot={def.slot}
            z={panels.zFor(def.id)}
            onFocus={() => panels.bringToFront(def.id)}
          />
        );
      })}
      <footer className="fixed right-0 bottom-0 left-0 z-[60] flex h-8 items-center justify-center gap-1 border-t border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="absolute inset-y-0 left-2 flex items-center gap-2">
          <PanelSwitcherButton
            active={panels.frontPanel === "workspace"}
            onClick={() => panels.bringToFront("workspace")}
            label="Workspace"
            title="Workspace パネルを最前面に"
          >
            <Folder className="h-3 w-3" />
          </PanelSwitcherButton>
          {TERMINAL_PANEL_DEFINITIONS.map((def) =>
            panels.sessions.has(def.id) ? (
              <PanelSwitcherButton
                key={def.id}
                active={panels.frontPanel === def.id}
                onClick={() => panels.bringToFront(def.id)}
                label={def.switcherLabel}
                title={def.switcherTitle}
                accent={def.switcherAccent}
              >
                {def.switcherIcon}
              </PanelSwitcherButton>
            ) : null,
          )}
        </div>
        <button
          type="button"
          onClick={() => canvasRef.current?.setZoom(Math.max(0.1, view.zoom - 0.1), view)}
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.resetZoom()}
          className="min-w-[4rem] rounded px-2 py-0.5 text-center font-mono text-xs text-slate-600 hover:bg-slate-100"
          title="Reset zoom"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.setZoom(Math.min(5, view.zoom + 0.1), view)}
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => setDrawOver((d) => !d)}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
            drawOver ? "bg-sky-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
          title={drawOver ? "通常モードに戻す" : "パネルの上に描画 (Toolbar 表示 / Grid 非表示)"}
        >
          <Layers className="h-3.5 w-3.5" />
          {drawOver ? "Draw Over ON" : "Draw Over"}
        </button>
      </footer>
    </main>
  );
}

function PanelSwitcherButton({
  active,
  onClick,
  label,
  title,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const style = active && accent ? { backgroundColor: accent, borderColor: accent } : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
        active
          ? accent
            ? "text-white shadow-sm"
            : "border-slate-600 bg-slate-600 text-white shadow-sm"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
      }`}
      style={style}
    >
      {children}
      {label}
    </button>
  );
}
