"use client";

import { useState } from "react";
import { BookOpen, FileCode2, RotateCcw, Save } from "lucide-react";
import { ReportHelp } from "./report-help";
import { REPORT_SYSTEM_PROMPT } from "@/lib/opencode/report-template";
import { GUIDELINE_CHECK_PROMPT } from "@/lib/opencode/guideline-prompt";
import {
  REPORT_PROMPT_MAX_LEN,
  clearReportPromptOverrides,
  getReportPromptOverrides,
  setReportPromptOverride,
} from "../lib/report-prompts";

type Props = {
  fontSize: number;
};

type Tab = "help" | "prompt";

// 訪問介護レポートパネル裏面のコンテナ。「ヘルプ」と「システムプロンプト」を
// タブで切り替える。プロンプト編集は localStorage に保存され、リクエスト時
// サーバへ override として送られる。空ならデフォルトに戻る。
export function ReportBack({ fontSize }: Props) {
  const [tab, setTab] = useState<Tab>("help");
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-stretch border-b border-slate-200 bg-slate-50">
        <TabButton
          active={tab === "help"}
          onClick={() => setTab("help")}
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="ヘルプ"
        />
        <TabButton
          active={tab === "prompt"}
          onClick={() => setTab("prompt")}
          icon={<FileCode2 className="h-3.5 w-3.5" />}
          label="システムプロンプト"
        />
      </div>
      {tab === "help" ? (
        <ReportHelp fontSize={fontSize} />
      ) : (
        <PromptEditor fontSize={fontSize} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        active
          ? "border-b-2 border-teal-600 text-teal-700"
          : "border-b-2 border-transparent text-slate-500 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

type DraftSaved = "saved" | "dirty" | "idle";

function PromptEditor({ fontSize }: { fontSize: number }) {
  // 初期値は localStorage の上書きがあればそれ、なければサーバ側デフォルトを
  // 直接表示する。「デフォルトに戻す」ボタンで個別 / 全体クリアできる。
  // SSR 時は window が無いので getReportPromptOverrides() が undefined を返し、
  // デフォルトが採用される。
  const [step1, setStep1] = useState<string>(
    () => getReportPromptOverrides().step1 ?? REPORT_SYSTEM_PROMPT,
  );
  const [step2, setStep2] = useState<string>(
    () => getReportPromptOverrides().step2 ?? GUIDELINE_CHECK_PROMPT,
  );
  const [step1Saved, setStep1Saved] = useState<DraftSaved>("idle");
  const [step2Saved, setStep2Saved] = useState<DraftSaved>("idle");

  const saveStep1 = () => {
    // 値が完全にデフォルトと一致する場合は override を持たず default 扱いにする。
    setReportPromptOverride(
      "step1",
      step1 === REPORT_SYSTEM_PROMPT ? null : step1,
    );
    setStep1Saved("saved");
    setTimeout(() => setStep1Saved("idle"), 1500);
  };
  const saveStep2 = () => {
    setReportPromptOverride(
      "step2",
      step2 === GUIDELINE_CHECK_PROMPT ? null : step2,
    );
    setStep2Saved("saved");
    setTimeout(() => setStep2Saved("idle"), 1500);
  };
  const resetStep1 = () => {
    setReportPromptOverride("step1", null);
    setStep1(REPORT_SYSTEM_PROMPT);
    setStep1Saved("idle");
  };
  const resetStep2 = () => {
    setReportPromptOverride("step2", null);
    setStep2(GUIDELINE_CHECK_PROMPT);
    setStep2Saved("idle");
  };
  const resetAll = () => {
    if (
      !confirm(
        "Step 1 / Step 2 のシステムプロンプトを両方デフォルトに戻します。よろしいですか？",
      )
    )
      return;
    clearReportPromptOverrides();
    setStep1(REPORT_SYSTEM_PROMPT);
    setStep2(GUIDELINE_CHECK_PROMPT);
    setStep1Saved("idle");
    setStep2Saved("idle");
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 text-slate-700"
      style={{ fontSize }}
    >
      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
        編集した内容を「保存」で localStorage に保持し、リクエスト時にサーバの{" "}
        <span className="font-mono">REPORT_SYSTEM_PROMPT</span> /{" "}
        <span className="font-mono">GUIDELINE_CHECK_PROMPT</span>{" "}
        を上書きします。「デフォルトに戻す」で初期プロンプトに戻り、上書きも解除されます。
      </div>

      <PromptField
        label="Step 1: 整形プロンプト"
        endpoint="POST /api/report/generate"
        value={step1}
        defaultValue={REPORT_SYSTEM_PROMPT}
        onChange={(v) => {
          setStep1(v);
          setStep1Saved("dirty");
        }}
        onSave={saveStep1}
        onReset={resetStep1}
        savedState={step1Saved}
      />
      <PromptField
        label="Step 2: ガイドライン照合プロンプト"
        endpoint="POST /api/report/guideline-check"
        value={step2}
        defaultValue={GUIDELINE_CHECK_PROMPT}
        onChange={(v) => {
          setStep2(v);
          setStep2Saved("dirty");
        }}
        onSave={saveStep2}
        onReset={resetStep2}
        savedState={step2Saved}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-3 w-3" />
          すべてデフォルトに戻す
        </button>
      </div>
    </div>
  );
}

function PromptField({
  label,
  endpoint,
  value,
  defaultValue,
  onChange,
  onSave,
  onReset,
  savedState,
}: {
  label: string;
  endpoint: string;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  savedState: DraftSaved;
}) {
  const tooLong = value.length > REPORT_PROMPT_MAX_LEN;
  const isDefault = value === defaultValue;
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-mono text-[10px] text-slate-400">{endpoint}</span>
        <span className="ml-auto font-mono text-[10px] text-slate-400">
          {value.length} / {REPORT_PROMPT_MAX_LEN}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className={`w-full resize-y rounded border bg-white px-2 py-1.5 font-mono text-[11px] leading-snug text-slate-700 focus:outline-none ${
          tooLong
            ? "border-rose-400 focus:border-rose-500"
            : "border-slate-300 focus:border-teal-400"
        }`}
      />
      {tooLong && (
        <div className="mt-1 text-[10px] text-rose-600">
          {REPORT_PROMPT_MAX_LEN} 文字を超えています。短くしてください。
        </div>
      )}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={tooLong}
          className="inline-flex items-center gap-1 rounded bg-teal-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-teal-500 disabled:opacity-40"
        >
          <Save className="h-3 w-3" />
          保存
        </button>
        {savedState === "saved" && (
          <span className="text-[10px] text-teal-700">保存しました</span>
        )}
        {savedState === "dirty" && (
          <span className="text-[10px] text-amber-700">未保存の変更あり</span>
        )}
        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          className="ml-auto inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title={isDefault ? "既にデフォルト値です" : "デフォルトプロンプトに戻す"}
        >
          <RotateCcw className="h-3 w-3" />
          デフォルトに戻す
        </button>
      </div>
    </div>
  );
}
