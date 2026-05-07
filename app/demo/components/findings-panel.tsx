"use client";

import { ShieldAlert } from "lucide-react";
import type { Finding } from "@/lib/opencode/guideline-check";
import { OPEN_DOC_EVENT, type OpenDocEventDetail } from "./markdown-text";

type Status = "idle" | "streaming" | "checking" | "done" | "error";

type Props = {
  findings: Finding[];
  status: Status;
};

// 中央ペインの本文側 `**[N] ...**` (mark id="finding-N") にジャンプする。
// 一瞬リングを光らせてどの位置に飛んだかを視覚的に示す。
function scrollToFinding(index: number) {
  const el = document.getElementById(`finding-${index}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-amber-500");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-amber-500");
  }, 1200);
}

export function FindingsPanel({ findings, status }: Props) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-amber-200 bg-amber-50/60 px-3 py-1 text-[11px] font-semibold text-amber-800">
        <ShieldAlert className="h-3 w-3" />
        <span>確認事項</span>
        {findings.length > 0 && (
          <span className="font-mono text-[10px] text-amber-700/80">
            ({findings.length})
          </span>
        )}
        {status === "checking" && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] font-normal">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            running
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
        {findings.length === 0 && status !== "checking" && (
          <p className="px-1 italic text-slate-400">
            ガイドライン照合が完了すると、ここに「人間の確認が必要な事項」が
            カードで並びます。クリックで本文の該当箇所へジャンプします。
          </p>
        )}
        {findings.length === 0 && status === "checking" && (
          <p className="px-1 italic text-amber-700/70">
            ガイドラインを検索しています...
          </p>
        )}
        {findings.map((f) => (
          <FindingCard
            key={f.index}
            f={f}
            onClick={() => scrollToFinding(f.index)}
          />
        ))}
      </div>
    </div>
  );
}

function FindingCard({ f, onClick }: { f: Finding; onClick: () => void }) {
  // 内部に doc チップ (button) をネストするので outer は div + role="button"。
  // <button> in <button> は HTML 仕様違反でハイドレーション失敗を起こす。
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title="本文の該当箇所にジャンプ"
      className="w-full cursor-pointer rounded border border-amber-200 bg-white px-2.5 py-2 text-left transition-colors hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold leading-none text-white">
          {f.index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-amber-900">{f.label}</div>

          <div className="mt-1 rounded border-l-2 border-amber-400 bg-amber-100/50 px-1.5 py-1 text-[11px] leading-relaxed text-slate-700">
            <span className="mr-1 font-semibold text-amber-800">なぜ:</span>
            {f.reason}
          </div>

          <div
            className="mt-1.5 line-clamp-2 text-[10px] italic text-slate-500"
            title={f.sentenceText}
          >
            「{f.sentenceText}」
          </div>

          {f.citations.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {f.citations.map((c) => (
                <DocChip key={c} id={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocChip({ id }: { id: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent<OpenDocEventDetail>(OPEN_DOC_EVENT, {
            detail: { id },
          }),
        );
      }}
      title="Workspace パネルでこのガイドラインを開く"
      className="cursor-pointer rounded border border-blue-200 bg-blue-50 px-1 font-mono text-[10px] text-blue-700 hover:bg-blue-100"
    >
      doc={id}
    </button>
  );
}
