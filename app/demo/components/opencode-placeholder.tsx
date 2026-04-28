"use client";

import { Sparkles } from "lucide-react";

type Props = {
  workspaceId: string;
  fontSize: number;
};

// OpenCode パネルの中身プレースホルダ。次フェーズで RAG 検索 / Agentic サーチの
// UI と差し替える前提で、まず外側の枠 (フロート、ヘッダ、リサイズ等) の動作確認に使う。
export default function OpenCodePlaceholder({ workspaceId, fontSize }: Props) {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-[#0b0b0f] px-6 py-6"
      style={{ fontSize }}
    >
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-violet-500/40 bg-violet-500/5 px-6 py-8 text-center text-white/80">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 text-violet-200">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="font-mono text-sm font-semibold text-white">
          OpenCode (RAG / Agentic)
        </div>
        <p className="font-mono text-xs leading-relaxed text-white/60">
          このパネルは次フェーズで RAG 検索と Agentic サーチの UI を載せる予定です。
        </p>
        <p className="font-mono text-[11px] text-white/40">
          workspace: <span className="text-white/70">{workspaceId}</span>
        </p>
      </div>
    </div>
  );
}
