"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMount } from "../hooks/use-mount";
import { ClipboardList, List, Plus, X } from "lucide-react";
import { OpenCodeLogo } from "./opencode-logo";
import { useWorkspace } from "./workspace-context";
import {
  apiCreateWorkspace,
  apiDeleteWorkspace,
  apiListWorkspaces,
  type WorkspaceListEntry,
} from "../api/workspace";

type Props = {
  onStartOpencode: () => void;
  onStartReport: () => void;
  onOpen: (entry: WorkspaceListEntry) => Promise<void>;
};

export function FloatingWorkspaceSelector({
  onStartOpencode,
  onStartReport,
  onOpen,
}: Props) {
  const { workspace, onWorkspaceChange, setError } = useWorkspace();
  const [registered, setRegistered] = useState<WorkspaceListEntry[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshList = useCallback(async () => {
    try {
      const list = await apiListWorkspaces();
      setRegistered(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setError]);

  useMount(() => { void refreshList(); });

  // 初回ロード時、登録済みワークスペースがあれば最も最近開いたものを自動で開く。
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (workspace) return;
    if (registered.length === 0) return;
    autoOpenedRef.current = true;
    void onOpen(registered[0]).then(() => void refreshList());
  }, [registered, workspace, onOpen, refreshList]);

  const handleOpen = useCallback(
    async (e: WorkspaceListEntry) => {
      setListOpen(false);
      await onOpen(e);
      await refreshList();
    },
    [onOpen, refreshList],
  );

  const createWorkspace = useCallback(async () => {
    const label = prompt("新しいワークスペースの名前を入力", "workspace");
    if (!label || !label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiCreateWorkspace(label.trim());
      await refreshList();
      await onOpen(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [onOpen, refreshList, setError]);

  const deleteWorkspace = useCallback(
    async (id: string) => {
      if (!confirm("このワークスペースを削除します。続行しますか？")) {
        return;
      }
      try {
        await apiDeleteWorkspace(id);
        if (workspace?.id === id) onWorkspaceChange(null);
        await refreshList();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [onWorkspaceChange, refreshList, setError, workspace],
  );

  return (
    <div className="relative flex flex-nowrap items-center gap-1.5 border-b border-slate-300 bg-slate-100 px-2 py-1">
      <button
        type="button"
        onClick={createWorkspace}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-40"
        title="新しいワークスペースを作成"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        {busy ? "作成中…" : "新規"}
      </button>
      <button
        type="button"
        onClick={() => setListOpen((v) => !v)}
        className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${
          listOpen ? "border-slate-400 bg-slate-100 text-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
        title="ワークスペース一覧"
      >
        <List className="h-3.5 w-3.5" />
        一覧 ({registered.length})
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onStartOpencode}
          disabled={!workspace}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-[#2563eb] bg-[#2563eb] px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8] disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          title={workspace ? `OpenCode パネルを ${workspace.id} で起動` : "先にワークスペースを選択してください"}
        >
          <OpenCodeLogo showText={false} className="shrink-0" />
          OpenCode
        </button>
        <button
          type="button"
          onClick={onStartReport}
          disabled={!workspace}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-[#0d9488] bg-[#0d9488] px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          title={workspace ? `訪問レポートパネルを ${workspace.id} で起動` : "先にワークスペースを選択してください"}
        >
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          訪問レポート
        </button>
      </div>

      {listOpen && (
        <div className="absolute left-2 top-full z-10 mt-1 max-h-72 w-80 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {registered.length === 0 ? (
            <div className="px-3 py-2 font-mono text-[11px] text-slate-400">
              まだワークスペースがありません
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {registered.map((w) => (
                <li key={w.id} className="flex items-center gap-1 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => void handleOpen(w)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-medium text-slate-800">{w.label}</span>
                    </div>
                    <div className="truncate font-mono text-[10px] text-slate-400">
                      {w.id}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteWorkspace(w.id)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="削除"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
