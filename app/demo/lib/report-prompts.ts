"use client";

// 訪問介護レポート用システムプロンプトの override を localStorage で保持する。
// サーバ側のデフォルト (lib/opencode/report-template.ts /
// lib/opencode/guideline-prompt.ts) を上書きしたい時だけ値を保存し、
// 空 / 未設定ならサーバはデフォルトを使う。
// ブラウザ単位のユーザ嗜好で良いので DB は使わない。

const KEY_STEP1 = "reportPrompt.step1";
const KEY_STEP2 = "reportPrompt.step2";

export const REPORT_PROMPT_MAX_LEN = 16000;

export type ReportPromptOverrides = {
  step1?: string;
  step2?: string;
};

function read(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(key);
    return v && v.trim().length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value.trim().length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // localStorage 書き込み失敗は握り潰す (デモ用途)
  }
}

export function getReportPromptOverrides(): ReportPromptOverrides {
  return {
    step1: read(KEY_STEP1),
    step2: read(KEY_STEP2),
  };
}

export function setReportPromptOverride(
  step: "step1" | "step2",
  value: string | null,
) {
  write(step === "step1" ? KEY_STEP1 : KEY_STEP2, value);
}

export function clearReportPromptOverrides() {
  write(KEY_STEP1, null);
  write(KEY_STEP2, null);
}
