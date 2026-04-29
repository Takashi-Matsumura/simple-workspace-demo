"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FileSearch,
  Send,
  Sparkles,
  Terminal,
  RefreshCw,
  FilePlus2,
  FileEdit,
  Trash2,
  FolderOpen,
  FileText,
} from "lucide-react";
import type {
  DeleteFilePart,
  ListFilesPart,
  OpencodeMode,
  OpencodeUIMessage,
  ReadDocPart,
  ReadFilePart,
  RetrievedHit,
  SearchDocsPart,
  WorkspaceFileSummary,
  WriteFilePart,
} from "../types/opencode";

type Props = {
  workspaceId: string;
  fontSize: number;
};

const PRESETS_BY_MODE: Record<OpencodeMode, { label: string; text: string }[]> = {
  rag: [
    {
      label: "単発ヒット (RAG 有利)",
      text: "Acme Cloud の Pro プランの料金とAPI上限を教えて",
    },
    {
      label: "多段ホップ (Agentic 有利)",
      text: "先月（2026年3月）の障害でいちばん影響範囲が広かった件の根本原因と、関連する仕様書の内容を教えて",
    },
    {
      label: "語彙ギャップ (Agentic 有利)",
      text: "サインインできない時の対処方法を教えて",
    },
  ],
  agentic: [
    {
      label: "単発ヒット (RAG 有利)",
      text: "Acme Cloud の Pro プランの料金とAPI上限を教えて",
    },
    {
      label: "多段ホップ (Agentic 有利)",
      text: "先月（2026年3月）の障害でいちばん影響範囲が広かった件の根本原因と、関連する仕様書の内容を教えて",
    },
    {
      label: "語彙ギャップ (Agentic 有利)",
      text: "サインインできない時の対処方法を教えて",
    },
  ],
  coding: [
    {
      label: "障害サマリを保存",
      text: "2026年3月の障害をすべて調べて、docs/incidents-2026-03.md として要約を保存して",
    },
    {
      label: "FAQ を整形",
      text: "FAQ を全部読んで、docs/faq.md にカテゴリ別の Markdown 一覧として保存して",
    },
    {
      label: "ファイル一覧 / 削除",
      text: "今ある全ファイルを listFiles して、不要そうなものがあれば削除して",
    },
  ],
};

export default function OpenCodeChat({ workspaceId, fontSize }: Props) {
  const [mode, setMode] = useState<OpencodeMode>("agentic");
  const [input, setInput] = useState("");

  const rag = useChat<OpencodeUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/opencode/rag" }),
  });
  const agentic = useChat<OpencodeUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/opencode/agentic" }),
  });
  const coding = useChat<OpencodeUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/opencode/coding",
      // 仮想 FS 操作のため workspaceId をボディに同梱する
      body: { workspaceId },
    }),
  });
  const current = mode === "rag" ? rag : mode === "agentic" ? agentic : coding;
  const busy = current.status === "submitted" || current.status === "streaming";
  const error = current.error;
  const messages = current.messages;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    current.sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex h-full w-full bg-white text-slate-700">
      <div className="flex h-full flex-1 flex-col">
        {/* モードセレクタ + ワークスペース表示 */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <ModeButton
            active={mode === "rag"}
            onClick={() => setMode("rag")}
            label="RAG"
            color="#10b981"
            icon={<FileSearch className="h-3 w-3" />}
          />
          <ModeButton
            active={mode === "agentic"}
            onClick={() => setMode("agentic")}
            label="Agentic"
            color="#a78bfa"
            icon={<Sparkles className="h-3 w-3" />}
          />
          <ModeButton
            active={mode === "coding"}
            onClick={() => setMode("coding")}
            label="Coding"
            color="#fb923c"
            icon={<Terminal className="h-3 w-3" />}
          />
          <span className="ml-auto truncate font-mono text-[10px] text-slate-400">
            ws: {workspaceId}
          </span>
        </div>

        {/* プリセット */}
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-200 bg-white px-3 py-1.5">
          {PRESETS_BY_MODE[mode].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setInput(p.text)}
              disabled={busy}
              className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* メッセージ履歴 */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto bg-white px-3 py-3"
          style={{ fontSize }}
        >
          {messages.length === 0 && !error && (
            <p className="italic text-slate-400">
              {mode === "rag"
                ? "RAG: 1 回キーワード検索 → LLM がスニペットだけを根拠に回答します。多段ホップや語彙ギャップが必要な質問では弱い場面が見えます。"
                : mode === "agentic"
                  ? "Agentic: LLM が searchDocs / readDoc を自律的に呼び、必要に応じて多段でドキュメントを読みに行きます。"
                  : "Coding Agent: 上記に加えて writeFile / readFile / listFiles / deleteFile を使い、Workspace ごとの仮想 FS にファイルを作成・編集します。"}
            </p>
          )}
          {error && (
            <div className="rounded border border-rose-300 bg-rose-50 p-2 text-rose-700">
              <div className="mb-1 font-medium">エラー</div>
              <div className="whitespace-pre-wrap font-mono" style={{ fontSize: "0.85em" }}>
                {error.message}
              </div>
              <div className="mt-1 text-rose-600/80" style={{ fontSize: "0.85em" }}>
                llama.cpp が起動しているか、LLAMA_BASE_URL の値を確認してください。
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageView key={m.id} message={m} mode={mode} />
          ))}
        </div>

        {/* 入力フォーム */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder={
              mode === "rag"
                ? "RAG に質問..."
                : mode === "agentic"
                  ? "Agentic に質問..."
                  : "Coding Agent に指示..."
            }
            className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-1 rounded bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-500 disabled:opacity-40"
            title="送信"
          >
            <Send className="h-3 w-3" />
            {busy ? "実行中..." : "送信"}
          </button>
        </form>
      </div>

      {mode === "coding" && (
        <FileBrowser workspaceId={workspaceId} messages={messages} busy={busy} />
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors"
      style={
        active
          ? { backgroundColor: color, borderColor: color, color: "white" }
          : { borderColor: "rgb(203 213 225)", color: "rgb(71 85 105)" }
      }
    >
      {icon}
      {label}
    </button>
  );
}

function MessageView({
  message,
  mode,
}: {
  message: OpencodeUIMessage;
  mode: OpencodeMode;
}) {
  if (message.role === "user") {
    return (
      <div className="border-l-2 border-slate-300 pl-2 text-slate-500">
        <span className="font-medium text-slate-700">Q: </span>
        {message.parts
          .filter((p) => p.type === "text")
          .map((p, i) => (
            <span key={i}>{(p as { text: string }).text}</span>
          ))}
      </div>
    );
  }

  const meta = message.metadata;
  const retrieved = meta && meta.mode === "rag" ? meta.retrieved : null;

  return (
    <div className="space-y-2">
      {mode === "rag" && retrieved && <RetrievedList hits={retrieved} />}
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <div
              key={i}
              className="whitespace-pre-wrap leading-relaxed text-slate-800"
            >
              {part.text}
            </div>
          );
        }
        if (part.type === "step-start" && i > 0) {
          return (
            <div
              key={i}
              className="mt-1 uppercase tracking-wider text-slate-400"
              style={{ fontSize: "0.75em" }}
            >
              ── next step ──
            </div>
          );
        }
        if (part.type === "tool-searchDocs") {
          return (
            <SearchDocsView key={i} part={part as unknown as SearchDocsPart} />
          );
        }
        if (part.type === "tool-readDoc") {
          return <ReadDocView key={i} part={part as unknown as ReadDocPart} />;
        }
        if (part.type === "tool-listFiles") {
          return (
            <ListFilesView key={i} part={part as unknown as ListFilesPart} />
          );
        }
        if (part.type === "tool-readFile") {
          return (
            <ReadFileView key={i} part={part as unknown as ReadFilePart} />
          );
        }
        if (part.type === "tool-writeFile") {
          return (
            <WriteFileView key={i} part={part as unknown as WriteFilePart} />
          );
        }
        if (part.type === "tool-deleteFile") {
          return (
            <DeleteFileView key={i} part={part as unknown as DeleteFilePart} />
          );
        }
        return null;
      })}
    </div>
  );
}

function RetrievedList({ hits }: { hits: RetrievedHit[] }) {
  return (
    <div className="rounded border border-emerald-300 bg-emerald-50 p-2">
      <div className="mb-1 font-medium text-emerald-700">
        取得したチャンク ({hits.length})
      </div>
      {hits.length === 0 ? (
        <div className="italic text-slate-400">該当なし</div>
      ) : (
        <ul className="space-y-0.5">
          {hits.map((h) => (
            <li key={h.id} className="flex gap-2">
              <span className="shrink-0 text-slate-400">[{h.id}]</span>
              <span className="truncate text-slate-700">{h.title}</span>
              <span className="ml-auto shrink-0 text-slate-400">
                score {h.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchDocsView({ part }: { part: SearchDocsPart }) {
  return (
    <div className="rounded border border-violet-300 bg-violet-50 p-2">
      <div className="font-medium text-violet-700">
        🔎 searchDocs
        {part.input?.query && (
          <span className="ml-2 font-mono text-slate-700">
            &quot;{part.input.query}&quot;
          </span>
        )}
      </div>
      {part.output && (
        <ul className="mt-1 space-y-0.5 text-slate-600">
          {part.output.hits.length === 0 ? (
            <li className="italic text-slate-400">該当なし</li>
          ) : (
            part.output.hits.map((h) => (
              <li key={h.id} className="flex gap-2">
                <span className="text-slate-400">[{h.id}]</span>
                <span className="truncate">{h.title}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function ReadDocView({ part }: { part: ReadDocPart }) {
  return (
    <div className="rounded border border-violet-300 bg-violet-50 p-2">
      <div className="font-medium text-violet-700">
        📄 readDoc
        {part.input?.id && (
          <span className="ml-2 font-mono text-slate-700">{part.input.id}</span>
        )}
      </div>
      {part.output && part.output.found && (
        <div className="mt-1 truncate text-slate-600">
          → {part.output.title}
        </div>
      )}
      {part.output && !part.output.found && (
        <div className="mt-1 text-rose-600">→ 見つかりませんでした</div>
      )}
    </div>
  );
}

function ListFilesView({ part }: { part: ListFilesPart }) {
  return (
    <div className="rounded border border-orange-300 bg-orange-50 p-2">
      <div className="flex items-center gap-1.5 font-medium text-orange-700">
        <FolderOpen className="h-3 w-3" />
        listFiles
        {part.input?.prefix && (
          <span className="ml-1 font-mono text-slate-700">
            {part.input.prefix}
          </span>
        )}
      </div>
      {part.output?.ok === true && (
        <ul className="mt-1 space-y-0.5 text-slate-600">
          {part.output.files.length === 0 ? (
            <li className="italic text-slate-400">(empty)</li>
          ) : (
            part.output.files.map((f) => (
              <li key={f.path} className="flex gap-2">
                <span className="truncate font-mono">{f.path}</span>
                <span className="ml-auto shrink-0 text-slate-400">
                  {f.size} B
                </span>
              </li>
            ))
          )}
        </ul>
      )}
      {part.output?.ok === false && (
        <div className="mt-1 text-rose-600">→ {part.output.error}</div>
      )}
    </div>
  );
}

function ReadFileView({ part }: { part: ReadFilePart }) {
  return (
    <div className="rounded border border-orange-300 bg-orange-50 p-2">
      <div className="flex items-center gap-1.5 font-medium text-orange-700">
        <FileText className="h-3 w-3" />
        readFile
        {part.input?.path && (
          <span className="ml-1 font-mono text-slate-700">{part.input.path}</span>
        )}
      </div>
      {part.output?.ok === true && part.output.found === true && (
        <div className="mt-1 text-slate-600">
          → {part.output.content?.length ?? 0} chars
        </div>
      )}
      {part.output?.ok === true && part.output.found === false && (
        <div className="mt-1 text-rose-600">→ not found</div>
      )}
      {part.output?.ok === false && (
        <div className="mt-1 text-rose-600">→ {part.output.error}</div>
      )}
    </div>
  );
}

function WriteFileView({ part }: { part: WriteFilePart }) {
  return (
    <div className="rounded border border-orange-300 bg-orange-50 p-2">
      <div className="flex items-center gap-1.5 font-medium text-orange-700">
        {part.output?.ok === true && part.output.created ? (
          <FilePlus2 className="h-3 w-3" />
        ) : (
          <FileEdit className="h-3 w-3" />
        )}
        writeFile
        {part.input?.path && (
          <span className="ml-1 font-mono text-slate-700">{part.input.path}</span>
        )}
      </div>
      {part.output?.ok === true && (
        <div className="mt-1 text-slate-600">
          → {part.output.created ? "created" : "updated"} ({part.output.size} B)
        </div>
      )}
      {part.output?.ok === false && (
        <div className="mt-1 text-rose-600">→ {part.output.error}</div>
      )}
    </div>
  );
}

function DeleteFileView({ part }: { part: DeleteFilePart }) {
  return (
    <div className="rounded border border-orange-300 bg-orange-50 p-2">
      <div className="flex items-center gap-1.5 font-medium text-orange-700">
        <Trash2 className="h-3 w-3" />
        deleteFile
        {part.input?.path && (
          <span className="ml-1 font-mono text-slate-700">{part.input.path}</span>
        )}
      </div>
      {part.output?.ok === true && (
        <div className="mt-1 text-slate-600">
          → {part.output.deleted ? "deleted" : "not found"}
        </div>
      )}
      {part.output?.ok === false && (
        <div className="mt-1 text-rose-600">→ {part.output.error}</div>
      )}
    </div>
  );
}

function FileBrowser({
  workspaceId,
  messages,
  busy,
}: {
  workspaceId: string;
  messages: OpencodeUIMessage[];
  busy: boolean;
}) {
  const [files, setFiles] = useState<WorkspaceFileSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFiles = useCallback(async (): Promise<WorkspaceFileSummary[]> => {
    const r = await fetch(
      `/api/opencode/files?workspaceId=${encodeURIComponent(workspaceId)}`,
      { cache: "no-store" },
    );
    if (!r.ok) throw new Error(`${r.status}`);
    const j = (await r.json()) as { files: WorkspaceFileSummary[] };
    return j.files;
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setFiles(await fetchFiles());
    } catch {
      setFiles([]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFiles]);

  useEffect(() => {
    let cancelled = false;
    fetchFiles()
      .then((files) => {
        if (!cancelled) setFiles(files);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchFiles]);

  const prevBusy = useRef(false);
  const lastFileOpKey = useRef<string | null>(null);
  useEffect(() => {
    const wasBusy = prevBusy.current;
    prevBusy.current = busy;

    const last = messages[messages.length - 1];
    let opKey: string | null = null;
    if (last) {
      const hasFileOp = last.parts.some(
        (p) => p.type === "tool-writeFile" || p.type === "tool-deleteFile",
      );
      if (hasFileOp) opKey = `${last.id}:${last.parts.length}`;
    }

    const busyTransition = wasBusy && !busy;
    const newFileOp = opKey !== null && opKey !== lastFileOpKey.current;
    lastFileOpKey.current = opKey;

    if (!busyTransition && !newFileOp) return;

    let cancelled = false;
    fetchFiles()
      .then((files) => {
        if (!cancelled) setFiles(files);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [busy, messages, fetchFiles]);

  const openFile = useCallback(
    async (path: string) => {
      setSelected(path);
      setContent(null);
      try {
        const r = await fetch(
          `/api/opencode/files?workspaceId=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(path)}`,
          { cache: "no-store" },
        );
        if (!r.ok) throw new Error(`${r.status}`);
        const j = (await r.json()) as
          | { found: false }
          | { found: true; content: string };
        setContent(j.found ? j.content : "(not found)");
      } catch (e) {
        setContent(`(error: ${(e as Error).message})`);
      }
    },
    [workspaceId],
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2">
        <FolderOpen className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-[11px] font-medium text-slate-700">
          Workspace Files
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="ml-auto rounded p-0.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
          title="一覧を更新"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {files === null ? (
          <div className="px-3 py-2 text-[11px] italic text-slate-400">
            読み込み中...
          </div>
        ) : files.length === 0 ? (
          <div className="px-3 py-2 text-[11px] italic text-slate-400">
            (まだファイルはありません)
          </div>
        ) : (
          <ul>
            {files.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => openFile(f.path)}
                  className={`flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] hover:bg-slate-100 ${
                    selected === f.path ? "bg-orange-50 text-orange-700" : "text-slate-600"
                  }`}
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono">{f.path}</span>
                  <span className="ml-auto shrink-0 text-slate-400">{f.size}B</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && (
        <div className="flex max-h-[40%] shrink-0 flex-col border-t border-slate-200 bg-white">
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-1">
            <span className="truncate font-mono text-[10px] text-orange-700">
              {selected}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setContent(null);
              }}
              className="ml-auto rounded p-0.5 text-slate-400 hover:bg-slate-200"
              title="閉じる"
            >
              ×
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[10px] text-slate-700 whitespace-pre-wrap break-all">
            {content ?? "loading..."}
          </pre>
        </div>
      )}
    </aside>
  );
}
