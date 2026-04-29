"use client";

import { FileSearch, Sparkles } from "lucide-react";

type Props = {
  fontSize: number;
};

// OpenCode パネル裏面のヘルプペイン。RAG と Agentic の違いと使い方をまとめる。
export function OpenCodeHelp({ fontSize }: Props) {
  return (
    <div
      className="flex-1 overflow-y-auto px-3 py-3 font-mono text-slate-600"
      style={{ fontSize }}
    >
      <p className="mb-3 text-slate-500">
        OpenCode パネルは社内文書の RAG と Agentic を並べて比較するデモです。
        同じ質問を一度に投げると、左右で回答プロセスがどう変わるかを観察できます。
      </p>

      <ModeSection
        color="#10b981"
        icon={<FileSearch className="h-3.5 w-3.5" />}
        label="RAG"
        endpoint="POST /api/opencode/rag"
        desc="キーワード検索 1 回 → ヒットしたスニペットだけを LLM に渡して回答。"
        strong={["単発ヒットで答えが完結する質問", "応答が速い"]}
        weak={["多段ホップが必要な質問", "用語の表現ゆれ (例: ログイン / サインイン)"]}
      />

      <ModeSection
        color="#3b82f6"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Agentic"
        endpoint="POST /api/opencode/agentic (max 8 steps)"
        desc="LLM が searchDocs / readDoc を自律的に呼ぶ。必要なら別の語彙で再検索したり、本文全体を読みに行ったりする。"
        strong={["多段ホップ", "用語ゆれをまたぐ調査", "複数文書をまとめて答える"]}
        weak={["1 回検索で十分な質問は冗長になる"]}
      />

      <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">
          tips
        </div>
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
          <li>送信ボタンを押すと、左右の RAG / Agentic に同じ質問が同時に投げられます。</li>
          <li>パネル右下の ▢ をドラッグするとサイズ変更できます。</li>
          <li>ヘッダー右の -/+ で会話履歴のフォントサイズを変えられます。</li>
          <li>左上のトラフィックライト 🔴🟡🟢 は閉じる / 最小化 / 80% フィット表示。</li>
          <li>回答内の <span className="font-mono">[doc=...]</span> をクリックすると Workspace パネルでその文書が開きます。</li>
        </ul>
      </div>
    </div>
  );
}

function ModeSection({
  color,
  icon,
  label,
  endpoint,
  desc,
  strong,
  weak,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  endpoint: string;
  desc: string;
  strong: string[];
  weak: string[];
}) {
  return (
    <div className="mb-3 rounded border border-slate-200 bg-white px-2 py-1.5">
      <div className="mb-0.5 flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      <div className="mb-1 font-mono text-[10px] text-slate-400">{endpoint}</div>
      <div className="mb-1 text-slate-700">{desc}</div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-600">
            得意
          </div>
          <ul className="list-disc pl-4 text-slate-600">
            {strong.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-rose-600">
            苦手
          </div>
          <ul className="list-disc pl-4 text-slate-600">
            {weak.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
