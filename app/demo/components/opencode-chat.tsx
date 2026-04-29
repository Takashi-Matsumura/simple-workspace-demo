"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FileSearch,
  Send,
  Sparkles,
  Brain,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { MarkdownText } from "./markdown-text";
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

const PRESETS: { label: string; text: string }[] = [
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
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const rag = useChat<OpencodeUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/opencode/rag" }),
  });
  const agentic = useChat<OpencodeUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/opencode/agentic" }),
  });

  const ragBusy = rag.status === "submitted" || rag.status === "streaming";
  const agenticBusy =
    agentic.status === "submitted" || agentic.status === "streaming";
  const busy = ragBusy || agenticBusy;

  // 両方の生成が終わったタイミングで入力欄にフォーカスを戻す。
  const prevBusy = useRef(false);
  useEffect(() => {
    if (prevBusy.current && !busy) {
      inputRef.current?.focus();
    }
    prevBusy.current = busy;
  }, [busy]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    rag.sendMessage({ text });
    agentic.sendMessage({ text });
    setInput("");
  };

  const clear = () => {
    if (busy) return;
    rag.setMessages([]);
    agentic.setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const hasMessages = rag.messages.length > 0 || agentic.messages.length > 0;

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-700">
      {/* ワークスペース表示 + クリアボタン */}
      <div className="flex shrink-0 items-center gap-2 border-b border-blue-200 bg-blue-50 px-3 py-1.5">
        <button
          type="button"
          onClick={clear}
          disabled={busy || !hasMessages}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          title="両カラムの会話履歴とコンテキストをクリア"
        >
          <Trash2 className="h-3 w-3" />
          クリア
        </button>
        <span className="ml-auto font-mono text-[10px] text-slate-400">
          ws: {workspaceId}
        </span>
      </div>

      {/* 2 カラム: RAG | Agentic */}
      <div className="flex min-h-0 flex-1">
        <ChatColumn
          label="RAG"
          color="#10b981"
          icon={<FileSearch className="h-3 w-3" />}
          mode="rag"
          messages={rag.messages}
          error={rag.error}
          busy={ragBusy}
          fontSize={fontSize}
          emptyHint="RAG: 1 回キーワード検索 → LLM がスニペットだけを根拠に回答します。多段ホップや語彙ギャップが必要な質問では弱い場面が見えます。"
        />
        <ChatColumn
          label="Agentic"
          color="#3b82f6"
          icon={<Sparkles className="h-3 w-3" />}
          mode="agentic"
          messages={agentic.messages}
          error={agentic.error}
          busy={agenticBusy}
          fontSize={fontSize}
          emptyHint="Agentic: LLM が searchDocs / readDoc を自律的に呼び、必要に応じて多段でドキュメントを読みに行きます。"
          borderLeft
        />
      </div>

      {/* プリセット + 入力フォーム (上段=プリセット / 下段=入力) */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setInput(p.text)}
              disabled={busy}
              className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder="同じ質問を RAG / Agentic 両方に投げます..."
            autoFocus
            className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            title="送信 (両方に同時投稿)"
          >
            <Send className="h-3 w-3" />
            {busy ? "実行中..." : "送信"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatColumn({
  label,
  color,
  icon,
  mode,
  messages,
  error,
  busy,
  fontSize,
  emptyHint,
  borderLeft,
}: {
  label: string;
  color: string;
  icon: React.ReactNode;
  mode: OpencodeMode;
  messages: OpencodeUIMessage[];
  error: Error | undefined;
  busy: boolean;
  fontSize: number;
  emptyHint: string;
  borderLeft?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col ${
        borderLeft ? "border-l border-slate-200" : ""
      }`}
    >
      <div
        className="flex shrink-0 items-center gap-1.5 border-b px-3 py-1.5 text-[11px] font-semibold"
        style={{
          color,
          borderColor: `${color}33`,
          backgroundColor: `${color}10`,
        }}
      >
        {icon}
        <span>{label}</span>
        {busy && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: color }} />
            running
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-3 py-3"
        style={{ fontSize }}
      >
        {messages.length === 0 && !error && (
          <p className="italic text-slate-400">{emptyHint}</p>
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
    </div>
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
          return <MarkdownText key={i} text={part.text} />;
        }
        if (part.type === "reasoning") {
          const rp = part as unknown as {
            text: string;
            state?: "streaming" | "done";
          };
          return (
            <ReasoningView
              key={i}
              text={rp.text ?? ""}
              streaming={rp.state === "streaming"}
            />
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
        return null;
      })}
    </div>
  );
}

function ReasoningView({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded border ${
        streaming
          ? "border-blue-300 bg-blue-50/60"
          : "border-slate-300 bg-slate-50"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-1.5 px-2 py-1 text-left ${
          streaming
            ? "text-blue-700 hover:bg-blue-100/50"
            : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Brain className={`h-3 w-3 ${streaming ? "animate-pulse" : ""}`} />
        {streaming ? (
          <span className="font-medium">
            Thinking<AnimatedDots />
          </span>
        ) : (
          <span className="font-medium">Thinking</span>
        )}
        <span
          className={`ml-auto font-mono text-[10px] ${
            streaming ? "text-blue-500" : "text-slate-400"
          }`}
        >
          {text.length} chars
        </span>
      </button>
      {open && (
        <div className="whitespace-pre-wrap border-t border-slate-200 px-2 py-1 italic text-slate-500">
          {text}
        </div>
      )}
    </div>
  );
}

function AnimatedDots() {
  return (
    <span className="inline-flex">
      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
        .
      </span>
      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
        .
      </span>
      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
        .
      </span>
    </span>
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
    <div className="rounded border border-blue-300 bg-blue-50 p-2">
      <div className="font-medium text-blue-700">
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
    <div className="rounded border border-blue-300 bg-blue-50 p-2">
      <div className="font-medium text-blue-700">
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
