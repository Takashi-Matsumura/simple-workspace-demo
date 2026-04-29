"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { MarkdownText } from "./markdown-text";
import { useWorkspace } from "./workspace-context";

type Props = {
  fontSize: number;
  selectedPath: string | null;
};

type FetchResult =
  | { found: false }
  | { found: true; content: string; path: string; updatedAt: string };

type LoadedState = {
  // どの (workspaceId, path) に対する結果かを保持し、最新と一致する場合だけ表示に使う。
  workspaceId: string;
  path: string;
  content: string | null;
  error: string | null;
};

export function FloatingWorkspacePreview({ fontSize, selectedPath }: Props) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const [loaded, setLoaded] = useState<LoadedState | null>(null);

  useEffect(() => {
    if (!workspaceId || !selectedPath) return;
    let cancelled = false;
    fetch(
      `/api/opencode/files?workspaceId=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(selectedPath)}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return (await r.json()) as FetchResult;
      })
      .then((j) => {
        if (cancelled) return;
        setLoaded({
          workspaceId,
          path: selectedPath,
          content: j.found ? j.content : null,
          error: j.found ? null : "(not found)",
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setLoaded({
          workspaceId,
          path: selectedPath,
          content: null,
          error: `(error: ${(e as Error).message})`,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedPath]);

  const isMarkdown = selectedPath?.toLowerCase().endsWith(".md") ?? false;
  // loaded が現在の選択 (workspaceId + path) に一致する時だけ採用。さもなくば「読み込み中」扱い。
  const matches =
    loaded &&
    loaded.workspaceId === workspaceId &&
    loaded.path === selectedPath;
  const content = matches ? loaded.content : null;
  const error = matches ? loaded.error : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white" style={{ fontSize }}>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1">
        <FileText className="h-3.5 w-3.5 text-slate-500" />
        <span className="truncate font-mono text-[11px] text-slate-700">
          {selectedPath ?? "(no file selected)"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {!selectedPath ? (
          <p className="italic text-slate-400">
            左のツリーからファイルを選択するとここに内容を表示します。
          </p>
        ) : error ? (
          <p className="text-rose-600">{error}</p>
        ) : content === null ? (
          <p className="italic text-slate-400">読み込み中...</p>
        ) : isMarkdown ? (
          <MarkdownText text={content} />
        ) : (
          <pre className="whitespace-pre-wrap break-all font-mono text-slate-700">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
