"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FileSearch, Send, Sparkles } from "lucide-react";
import type {
  OpencodeMode,
  OpencodeUIMessage,
  ReadDocPart,
  RetrievedHit,
  SearchDocsPart,
} from "../types/opencode";

type Props = {
  workspaceId: string;
  fontSize: number;
};

const PRESETS = [
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
];

export default function OpenCodeChat({ workspaceId, fontSize }: Props) {
  const [mode, setMode] = useState<OpencodeMode>("agentic");
  const [input, setInput] = useState("");

  const rag = useChat<OpencodeUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/opencode/rag" }),
  });
  const agentic = useChat<OpencodeUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/opencode/agentic" }),
  });
  const current = mode === "rag" ? rag : agentic;
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
    <div className="flex h-full w-full flex-col bg-[#0b0b0f] text-white/90">
      {/* モードセレクタ + ワークスペース表示 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#100c1f] px-3 py-2">
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
        <span className="ml-auto truncate font-mono text-[10px] text-white/40">
          ws: {workspaceId}
        </span>
      </div>

      {/* プリセット */}
      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-white/10 bg-[#0e0a1a] px-3 py-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setInput(p.text)}
            disabled={busy}
            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* メッセージ履歴 (タイトルバーの -/+ で fontSize を変えるとここがスケールする) */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
        style={{ fontSize }}
      >
        {messages.length === 0 && !error && (
          <p className="italic text-white/40">
            {mode === "rag"
              ? "RAG: 1 回キーワード検索 → LLM がスニペットだけを根拠に回答します。多段ホップや語彙ギャップが必要な質問では弱い場面が見えます。"
              : "Agentic: LLM が searchDocs / readDoc を自律的に呼び、必要に応じて多段でドキュメントを読みに行きます。"}
          </p>
        )}
        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-red-200">
            <div className="mb-1 font-medium">エラー</div>
            <div className="whitespace-pre-wrap font-mono" style={{ fontSize: "0.85em" }}>
              {error.message}
            </div>
            <div className="mt-1 text-red-300/70" style={{ fontSize: "0.85em" }}>
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
        className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#100c1f] px-3 py-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={mode === "rag" ? "RAG に質問..." : "Agentic に質問..."}
          className="flex-1 rounded border border-white/15 bg-black/30 px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1 rounded bg-violet-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-400 disabled:opacity-40"
          title="送信"
        >
          <Send className="h-3 w-3" />
          {busy ? "実行中..." : "送信"}
        </button>
      </form>
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
          : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }
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
      <div className="border-l-2 border-white/30 pl-2 text-white/60">
        <span className="font-medium text-white/80">Q: </span>
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
              className="whitespace-pre-wrap leading-relaxed text-white/90"
            >
              {part.text}
            </div>
          );
        }
        if (part.type === "step-start" && i > 0) {
          return (
            <div
              key={i}
              className="mt-1 uppercase tracking-wider text-white/30"
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
        return null;
      })}
    </div>
  );
}

function RetrievedList({ hits }: { hits: RetrievedHit[] }) {
  return (
    <div className="rounded border border-emerald-400/30 bg-emerald-500/5 p-2">
      <div className="mb-1 font-medium text-emerald-300">
        取得したチャンク ({hits.length})
      </div>
      {hits.length === 0 ? (
        <div className="italic text-white/40">該当なし</div>
      ) : (
        <ul className="space-y-0.5">
          {hits.map((h) => (
            <li key={h.id} className="flex gap-2">
              <span className="shrink-0 text-white/40">[{h.id}]</span>
              <span className="truncate text-white/80">{h.title}</span>
              <span className="ml-auto shrink-0 text-white/40">
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
    <div className="rounded border border-violet-400/30 bg-violet-500/10 p-2">
      <div className="font-medium text-violet-200">
        🔎 searchDocs
        {part.input?.query && (
          <span className="ml-2 font-mono text-white/90">
            &quot;{part.input.query}&quot;
          </span>
        )}
      </div>
      {part.output && (
        <ul className="mt-1 space-y-0.5 text-white/70">
          {part.output.hits.length === 0 ? (
            <li className="italic text-white/40">該当なし</li>
          ) : (
            part.output.hits.map((h) => (
              <li key={h.id} className="flex gap-2">
                <span className="text-white/40">[{h.id}]</span>
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
    <div className="rounded border border-violet-400/30 bg-violet-500/10 p-2">
      <div className="font-medium text-violet-200">
        📄 readDoc
        {part.input?.id && (
          <span className="ml-2 font-mono text-white/90">{part.input.id}</span>
        )}
      </div>
      {part.output && part.output.found && (
        <div className="mt-1 truncate text-white/70">
          → {part.output.title}
        </div>
      )}
      {part.output && !part.output.found && (
        <div className="mt-1 text-red-300">→ 見つかりませんでした</div>
      )}
    </div>
  );
}
