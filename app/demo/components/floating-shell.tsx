"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  X,
  Minus,
  Maximize2,
  CirclePlus,
  CircleMinus,
  RotateCw,
  TerminalSquare,
} from "lucide-react";
import type { View, SceneRect } from "./whiteboard-canvas";
import { usePointerDrag } from "../hooks/use-pointer-drag";
import { usePointerResize } from "../hooks/use-pointer-resize";
import { useFontSize } from "../hooks/use-font-size";

type ScenePos = { x: number; y: number };
type SceneSize = { w: number; h: number };

type ConnState = "connecting" | "open" | "closed" | "error";

const SHELL_FONT_KEY = "shell-font-size";

function defaultScenePos(view: View, size: SceneSize): ScenePos {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const baseX = window.innerWidth / 2 / view.zoom - size.w / 2 - view.x;
  const baseY = window.innerHeight / 2 / view.zoom - size.h / 2 - view.y;
  return { x: baseX + 60, y: baseY + 40 };
}

export default function FloatingShell({
  view,
  onStop,
  onZoomToFit,
  z,
  onFocus,
  restartNonce = 0,
  sandboxEnabled = false,
}: {
  view: View;
  onStop: () => void;
  onZoomToFit?: (rect: SceneRect) => void;
  z: number;
  onFocus?: () => void;
  restartNonce?: number;
  sandboxEnabled?: boolean;
}) {
  const [scenePos, setScenePos] = useState<ScenePos>(() =>
    defaultScenePos(view, { w: 720, h: 440 }),
  );
  const [sceneSize, setSceneSize] = useState<SceneSize>({ w: 720, h: 440 });
  const [minimized, setMinimized] = useState(false);
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const { fontSize, changeFontSize } = useFontSize(SHELL_FONT_KEY, {
    default: 13,
    min: 10,
    max: 24,
  });

  const headerHandlers = usePointerDrag(view, scenePos, setScenePos);
  const resizeHandlers = usePointerResize(view, sceneSize, setSceneSize, {
    minW: 360,
    minH: 200,
  });

  const left = (scenePos.x + view.x) * view.zoom;
  const top = (scenePos.y + view.y) * view.zoom;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const restartingRef = useRef(false);
  const [connectNonce, setConnectNonce] = useState(0);

  const sendResize = useCallback(() => {
    const term = termRef.current;
    const ws = wsRef.current;
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
    );
  }, []);

  const fitAndResize = useCallback(() => {
    const fit = fitRef.current;
    if (!fit) return;
    try {
      fit.fit();
    } catch {
      /* ignore */
    }
    sendResize();
  }, [sendResize]);

  // xterm の初期化 (1 回だけ)
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const term = new XTerm({
      fontFamily:
        '"SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace',
      fontSize,
      theme: { background: "#0b1020", foreground: "#e6edf3" },
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    try {
      fit.fit();
    } catch {
      /* ignore */
    }
    termRef.current = term;
    fitRef.current = fit;
    return () => {
      try {
        term.dispose();
      } catch {
        /* ignore */
      }
      termRef.current = null;
      fitRef.current = null;
    };
    // 初期化は 1 回だけ。fontSize 変更は別エフェクトで適用する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // フォントサイズ変更を xterm に反映
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    fitAndResize();
  }, [fontSize, fitAndResize]);

  // パネルサイズ変化時に fit + resize 通知
  useEffect(() => {
    fitAndResize();
  }, [sceneSize.w, sceneSize.h, minimized, fitAndResize]);

  // WebSocket 接続。connectNonce / restartNonce どちらが変化しても再接続する。
  // restartNonce は親 (page.tsx) で Sandbox トグル → コンテナ再生成 → 既存 WS が
  // 閉じられた直後に進めて、新しいコンテナへ繋ぎ直すために使う。
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (typeof window === "undefined") return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/shell/ws`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const onOpen = (): void => {
      setConnState("open");
      setErrorText(null);
      try {
        fitRef.current?.fit();
      } catch {
        /* ignore */
      }
      ws.send(
        JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
      );
      term.focus();
    };
    const onMessage = (ev: MessageEvent): void => {
      if (ev.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(ev.data));
      } else if (typeof ev.data === "string") {
        term.write(ev.data);
      }
    };
    const onClose = (ev: CloseEvent): void => {
      setConnState("closed");
      if (ev.code !== 1000 && ev.code !== 1005 && !restartingRef.current) {
        const reason = ev.reason || `closed (${ev.code})`;
        setErrorText(reason);
      }
    };
    const onError = (): void => {
      setConnState("error");
    };
    ws.addEventListener("open", onOpen);
    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", onClose);
    ws.addEventListener("error", onError);

    const onTermData = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    });

    return () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("close", onClose);
      ws.removeEventListener("error", onError);
      onTermData.dispose();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [connectNonce, restartNonce]);

  const reconnect = useCallback(() => {
    setConnState("connecting");
    setErrorText(null);
    setConnectNonce((n) => n + 1);
  }, []);

  const restart = useCallback(async () => {
    restartingRef.current = true;
    setRestarting(true);
    setErrorText(null);
    try {
      const r = await fetch("/api/shell", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${r.status}`);
      }
      termRef.current?.clear();
      reconnect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "restart failed";
      setErrorText(msg);
    } finally {
      restartingRef.current = false;
      setRestarting(false);
    }
  }, [reconnect]);

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
      <div className="flex h-full w-full flex-col rounded-lg border-2 border-purple-500 bg-[#0b1020] shadow-2xl shadow-slate-900/30">
        <div
          className="flex h-9 cursor-grab items-center gap-2 rounded-t-lg border-b border-purple-700 bg-purple-100 px-3 text-xs text-slate-700 active:cursor-grabbing select-none"
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
                onZoomToFit?.({
                  x: scenePos.x,
                  y: scenePos.y,
                  w: sceneSize.w,
                  h: sceneSize.h,
                })
              }
              className="group h-3 w-3 rounded-full bg-[#28c840] hover:brightness-110"
              title="80% フィット表示"
            >
              <Maximize2
                className="hidden h-2.5 w-2.5 stroke-[3] text-black/60 group-hover:block"
                style={{ margin: "0.5px" }}
              />
            </button>
          </div>
          <TerminalSquare className="ml-1 h-3.5 w-3.5 text-purple-700" />
          <span className="font-mono text-[11px] font-medium text-purple-800">
            User Shell
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
              sandboxEnabled
                ? "bg-purple-100 text-purple-700"
                : "bg-slate-100 text-slate-600"
            }`}
            title={
              sandboxEnabled
                ? "Sandbox ON: ネット隔離 (--network none)"
                : "Sandbox OFF: 通常 bridge ネットワーク"
            }
          >
            {sandboxEnabled ? "sandbox: isolated" : "sandbox: networked"}
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            {connStateLabel(connState)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeFontSize(-1)}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              title="文字サイズを下げる"
            >
              <CircleMinus className="h-4 w-4" />
            </button>
            <span className="min-w-[1.5rem] text-center font-mono text-[10px] text-slate-500">
              {fontSize}
            </span>
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
              onClick={restart}
              disabled={restarting}
              className="ml-1 rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
              title="コンテナを作り直して再接続 (Volume は保持)"
            >
              <RotateCw className={`h-3.5 w-3.5 ${restarting ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="relative flex-1 overflow-hidden rounded-b-lg bg-[#0b1020]">
            <div ref={containerRef} className="h-full w-full p-1" />
            {connState !== "open" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                <div className="pointer-events-auto rounded-md border border-purple-700/60 bg-purple-900/80 px-3 py-1.5 text-[11px] text-purple-100 shadow-lg backdrop-blur">
                  {connState === "connecting" && "接続中…"}
                  {connState === "closed" && (
                    <button type="button" onClick={reconnect} className="underline">
                      切断されました — クリックで再接続
                    </button>
                  )}
                  {connState === "error" && (
                    <button type="button" onClick={reconnect} className="underline">
                      接続エラー — クリックで再試行
                    </button>
                  )}
                </div>
              </div>
            )}
            {errorText && (
              <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                <div className="pointer-events-auto max-w-[80%] truncate rounded-md border border-rose-700/60 bg-rose-900/80 px-3 py-1.5 text-[11px] text-rose-100 shadow-lg backdrop-blur">
                  {errorText}
                </div>
              </div>
            )}
            <div
              className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
              {...resizeHandlers}
              style={{
                background:
                  "linear-gradient(135deg, transparent 50%, rgba(168,85,247,0.55) 50%)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function connStateLabel(s: ConnState): string {
  switch (s) {
    case "connecting":
      return "— connecting";
    case "open":
      return "— connected";
    case "closed":
      return "— disconnected";
    case "error":
      return "— error";
  }
}
