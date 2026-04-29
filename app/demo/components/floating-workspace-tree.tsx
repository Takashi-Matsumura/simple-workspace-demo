"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import type { WorkspaceFileSummary } from "../types/opencode";
import { useWorkspace } from "./workspace-context";

type Props = {
  fontSize: number;
  selectedPath: string | null;
  onSelectPath: (path: string | null) => void;
  refreshSignal: number;
};

type TreeNode = {
  name: string;
  fullPath: string;
  isFile: boolean;
  size?: number;
  children: TreeNode[];
};

function buildTree(files: WorkspaceFileSummary[]): TreeNode {
  const root: TreeNode = { name: "", fullPath: "", isFile: false, children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");
      let next = cursor.children.find((c) => c.name === part && c.isFile === isLeaf);
      if (!next) {
        next = {
          name: part,
          fullPath,
          isFile: isLeaf,
          size: isLeaf ? f.size : undefined,
          children: [],
        };
        cursor.children.push(next);
      }
      cursor = next;
    }
  }
  // フォルダ → ファイル / 名前順でソート
  const sortRec = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

export function FloatingWorkspaceTree({
  fontSize,
  selectedPath,
  onSelectPath,
  refreshSignal,
}: Props) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const [files, setFiles] = useState<WorkspaceFileSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFiles = useCallback(async (id: string): Promise<WorkspaceFileSummary[]> => {
    const r = await fetch(
      `/api/opencode/files?workspaceId=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { files: WorkspaceFileSummary[] };
    return j.files;
  }, []);

  // 初期ロード / workspace 切替 / 外部からの refresh signal で再取得。
  // setState は await 後の .then で行うので react-hooks/set-state-in-effect には抵触しない。
  // workspaceId が null の場合は何もせず、render 側で「未選択」表示にする。
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetchFiles(workspaceId)
      .then((files) => {
        if (!cancelled) setFiles(files);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, fetchFiles, refreshSignal]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setRefreshing(true);
    try {
      setFiles(await fetchFiles(workspaceId));
    } catch {
      setFiles([]);
    } finally {
      setRefreshing(false);
    }
  }, [workspaceId, fetchFiles]);

  const tree = useMemo(() => buildTree(files ?? []), [files]);

  // ツリーは畳まれた状態で開始する。ユーザーがフォルダクリックで開くか、
  // 外部から selectedPath がセットされた時にその親フォルダだけを自動展開する。
  // selectedPath の変化検出は React 公式の "derive state during render" パターン
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // を採用し、useEffect + setState の組み合わせは避ける。
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  if (selectedPath !== lastSelectedPath) {
    setLastSelectedPath(selectedPath);
    if (selectedPath) {
      const parts = selectedPath.split("/");
      if (parts.length > 1) {
        setExpanded((prev) => {
          const next = new Set(prev);
          for (let i = 1; i < parts.length; i++) {
            next.add(parts.slice(0, i).join("/"));
          }
          return next;
        });
      }
    }
  }

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-white"
      style={{ fontSize }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1">
        <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[11px] font-medium text-slate-600">Files</span>
        <span className="font-mono text-[10px] text-slate-400">
          {files === null ? "" : `(${files.length})`}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || !workspaceId}
          className="ml-auto rounded p-0.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
          title="一覧を更新"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {!workspaceId ? (
          <div className="px-3 py-2 italic text-slate-400">
            (workspace 未選択)
          </div>
        ) : files === null ? (
          <div className="px-3 py-2 italic text-slate-400">読み込み中...</div>
        ) : files.length === 0 ? (
          <div className="px-3 py-2 italic text-slate-400">(ファイルなし)</div>
        ) : (
          <ul>
            {tree.children.map((node) => (
              <TreeRow
                key={node.fullPath}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                selectedPath={selectedPath}
                onSelect={onSelectPath}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const indentPx = 8 + depth * 12;

  if (node.isFile) {
    const selected = selectedPath === node.fullPath;
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(node.fullPath)}
          className={`flex w-full items-center gap-1 px-2 py-0.5 text-left hover:bg-slate-100 ${
            selected ? "bg-blue-100 text-blue-800" : "text-slate-700"
          }`}
          style={{ paddingLeft: indentPx }}
        >
          <FileText className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate font-mono">{node.name}</span>
          {typeof node.size === "number" && (
            <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">
              {node.size}B
            </span>
          )}
        </button>
      </li>
    );
  }

  const open = expanded.has(node.fullPath);
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(node.fullPath)}
        className="flex w-full items-center gap-1 px-2 py-0.5 text-left text-slate-600 hover:bg-slate-100"
        style={{ paddingLeft: indentPx }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
        )}
        <Folder className="h-3 w-3 shrink-0 text-slate-400" />
        <span className="truncate font-mono">{node.name}</span>
      </button>
      {open && (
        <ul>
          {node.children.map((child) => (
            <TreeRow
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
