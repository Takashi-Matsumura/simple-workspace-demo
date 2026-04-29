"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, FileCheck2, Send, ShieldAlert, Trash2 } from "lucide-react";
import { MarkdownText, OPEN_PATH_EVENT } from "./markdown-text";
import type { GuidelineHit } from "../types/opencode";

type Props = {
  workspaceId: string;
  fontSize: number;
};

type Status = "idle" | "streaming" | "checking" | "done" | "error";

type GuidelineToolEvent =
  | {
      kind: "search";
      toolCallId: string;
      query?: string;
      hits?: GuidelineHit[];
      state: "running" | "done" | "error";
    }
  | {
      kind: "read";
      toolCallId: string;
      id?: string;
      title?: string;
      found?: boolean;
      state: "running" | "done" | "error";
    }
  | {
      kind: "record";
      toolCallId: string;
      label?: string;
      sentenceText?: string;
      ok?: boolean;
      state: "running" | "done" | "error";
    };

const PRESETS: {
  label: string;
  helperName: string;
  guestName: string;
  text: string;
}[] = [
  {
    label: "通常訪問",
    helperName: "佐藤 由紀",
    guestName: "田中 ハル",
    text: `9時に到着。玄関先で出迎えあり、機嫌はいつも通り。
血圧 128/78、体温 36.4。朝食は完食済とのこと。
入浴介助 30 分、髪を洗う時に少し首が痛いと話されたが
特に皮膚トラブルなし。
洗濯 1 回、リビングの掃除機がけ。
昼食用におにぎりを冷蔵庫に。次回は薬カレンダーを補充予定。`,
  },
  {
    label: "体調不良の兆し",
    helperName: "高橋 健",
    guestName: "鈴木 みつ",
    text: `13時訪問。今日は元気がなく、食欲も「半分くらいしか食べられなかった」とのこと。
体温 37.2 でやや微熱。手の甲に新しいあざあり、本人は「いつついたか覚えていない」。
足元ふらつき気味で、トイレまで付き添い。
予定の散歩は中止し、室内でストレッチに変更。
ご家族に LINE で「微熱・あざ・ふらつき」を共有済。
明日の訪問担当者に体温・食事量の継続観察を依頼したい。`,
  },
  {
    label: "申し送りあり",
    helperName: "中村 さくら",
    guestName: "山本 一郎",
    text: `15時。本日からデイサービスの曜日が月→火に変更とご家族から連絡。
ケアマネさんへの連絡票を冷蔵庫に貼り付け済。
血圧 142/88、少し高め。塩分控えめのレシピを提案。
トイレ周りに新しい手すりが設置されていたので場所を確認。
次回ヘルパーには手すりの位置と曜日変更の周知を願いたい。`,
  },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// SSE (data: <json>\n\n) を 1 件ずつ JSON にパースする最小実装。
// AI SDK の toUIMessageStreamResponse は 1 行 1 イベントの SSE を返すので、
// `data: ` プレフィックスを剥がして JSON.parse するだけで UIMessageChunk になる。
async function* parseUIMessageStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buf += decoder.decode();
    } else if (value) {
      buf += decoder.decode(value, { stream: true });
    }
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data) as Record<string, unknown>;
        } catch {
          // 不完全な JSON は無視
        }
      }
    }
    if (done) return;
  }
}

export default function ReportComposer({ workspaceId, fontSize }: Props) {
  const [visitDate, setVisitDate] = useState<string>(todayISO);
  const [helperName, setHelperName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [freeText, setFreeText] = useState("");

  const [previewText, setPreviewText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [toolEvents, setToolEvents] = useState<GuidelineToolEvent[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 生成完了後に textarea にフォーカスを戻して、続けて別メモを作りやすくする。
  const prevStatus = useRef<Status>("idle");
  useEffect(() => {
    const wasBusy =
      prevStatus.current === "streaming" || prevStatus.current === "checking";
    const nowBusy = status === "streaming" || status === "checking";
    if (wasBusy && !nowBusy) {
      textareaRef.current?.focus();
    }
    prevStatus.current = status;
  }, [status]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setHelperName(p.helperName);
    setGuestName(p.guestName);
    setFreeText(p.text);
  };

  const reset = () => {
    if (status === "streaming" || status === "checking") return;
    setHelperName("");
    setGuestName("");
    setFreeText("");
    setVisitDate(todayISO());
    setPreviewText("");
    setStatus("idle");
    setErrorMsg(null);
    setWarningMsg(null);
    setSavedPath(null);
    setToolEvents([]);
    setStepIndex(0);
  };

  // Step 2: ガイドライン照合。Step 1 で保存された path を上書き保存する。
  // SSE chunk を直接読んで tool-call 系を toolEvents に積む。
  // LLM の text-delta は途中のスクラッチで、最終ファイルは onFinish の
  // assembleReport が原本本文 + recordFinding から決定論的に組み立てるので、
  // 最終的に保存ファイルを再 fetch してプレビューを置き換える。
  const runGuidelineCheck = async (path: string) => {
    setStatus("checking");
    // Step 1 のプレビューはそのまま残す: ハイライト前の元レポートとして見える方が
    // 体験が分かりやすい。最終ファイルを再 fetch する時点で highlight 入りに
    // 上書きされる。
    setToolEvents([]);
    setStepIndex(0);

    try {
      const res = await fetch("/api/report/guideline-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, path }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `${res.status}`);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      let finalContent: string | null = null;
      for await (const chunk of parseUIMessageStream(res.body)) {
        const t = chunk.type as string;
        // text-delta (LLM スクラッチ) は最終ファイルに使わないので無視する。
        if (t === "start-step") {
          setStepIndex((n) => n + 1);
        } else if (t === "finish" || t === "message-metadata") {
          // サーバが messageMetadata に最終ファイル内容を載せて送ってくる。
          const meta = chunk.messageMetadata as
            | { finalContent?: string }
            | undefined;
          if (meta && typeof meta.finalContent === "string") {
            finalContent = meta.finalContent;
          }
        } else if (t === "tool-input-start") {
          const toolCallId = String(chunk.toolCallId);
          const toolName = String(chunk.toolName);
          setToolEvents((prev) => [
            ...prev,
            toolName === "searchGuidelines"
              ? { kind: "search", toolCallId, state: "running" }
              : toolName === "readGuideline"
                ? { kind: "read", toolCallId, state: "running" }
                : { kind: "record", toolCallId, state: "running" },
          ]);
        } else if (t === "tool-input-available") {
          const toolCallId = String(chunk.toolCallId);
          const input = chunk.input as
            | { query?: string; id?: string; label?: string; sentenceText?: string }
            | undefined;
          setToolEvents((prev) =>
            prev.map((e) => {
              if (e.toolCallId !== toolCallId) return e;
              if (e.kind === "search") return { ...e, query: input?.query };
              if (e.kind === "read") return { ...e, id: input?.id };
              return {
                ...e,
                label: input?.label,
                sentenceText: input?.sentenceText,
              };
            }),
          );
        } else if (t === "tool-output-available") {
          const toolCallId = String(chunk.toolCallId);
          const output = chunk.output as
            | {
                query?: string;
                hits?: GuidelineHit[];
                id?: string;
                found?: boolean;
                title?: string;
                ok?: boolean;
              }
            | undefined;
          setToolEvents((prev) =>
            prev.map((e) => {
              if (e.toolCallId !== toolCallId) return e;
              if (e.kind === "search") {
                return {
                  ...e,
                  query: output?.query ?? e.query,
                  hits: output?.hits ?? [],
                  state: "done",
                };
              }
              if (e.kind === "read") {
                return {
                  ...e,
                  id: output?.id ?? e.id,
                  found: output?.found,
                  title: output?.title,
                  state: "done",
                };
              }
              return {
                ...e,
                ok: output?.ok ?? false,
                state: output?.ok ? "done" : "error",
              };
            }),
          );
        } else if (t === "tool-output-error" || t === "tool-input-error") {
          const toolCallId = String(chunk.toolCallId);
          setToolEvents((prev) =>
            prev.map((e) =>
              e.toolCallId === toolCallId ? { ...e, state: "error" } : e,
            ),
          );
        } else if (t === "error") {
          throw new Error(String(chunk.errorText ?? "stream error"));
        }
      }

      // サーバが messageMetadata で組み立て済みの最終本文を送ってくる。
      // ここでプレビューをハイライト入りに置き換える (file fetch 不要)。
      if (finalContent !== null) {
        setPreviewText(finalContent);
      }
      setStatus("done");
      // Step 2 で同 path を上書き保存しているので、workspace tree もリフレッシュ。
      window.dispatchEvent(
        new CustomEvent(OPEN_PATH_EVENT, { detail: { path } }),
      );
    } catch (e) {
      // Step 1 のファイルは既に保存済みなので致命にしない。
      setStatus("done");
      setWarningMsg(
        `ガイドライン照合に失敗しました (${(e as Error).message})。整形済みレポートは保存済みです。`,
      );
    }
  };

  const submit = async () => {
    if (status === "streaming" || status === "checking") return;
    if (!freeText.trim()) return;

    setPreviewText("");
    setStatus("streaming");
    setErrorMsg(null);
    setWarningMsg(null);
    setSavedPath(null);
    setToolEvents([]);
    setStepIndex(0);

    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          freeText,
          meta: {
            date: visitDate,
            helperName: helperName.trim() || undefined,
            guestName: guestName.trim() || undefined,
          },
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `${res.status}`);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const path = res.headers.get("x-saved-path");

      const reader = res.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          acc += value;
          setPreviewText(acc);
        }
      }

      if (path) {
        setSavedPath(path);
        // ストリーム終端時には onFinish 側の writeWorkspaceFile が確定済み。
        // workspace ツリーの再取得 + 自動選択を促す。
        window.dispatchEvent(
          new CustomEvent(OPEN_PATH_EVENT, { detail: { path } }),
        );
        // Step 1 の onFinish (writeWorkspaceFile) が確実に終わるよう少し待ってから Step 2 を発火。
        await new Promise((r) => setTimeout(r, 50));
        await runGuidelineCheck(path);
      } else {
        setStatus("done");
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    }
  };

  const busy = status === "streaming" || status === "checking";
  const canSubmit = !busy && freeText.trim().length > 0;
  const hasResult = previewText.length > 0 || savedPath !== null;
  // Step 2 中の進捗を、現在進行中のツール呼び出しから推定したフェーズで表示する。
  // step カウンタだけだと見た目が動かないことがあるので、tool 別の累計件数も併記。
  const runningTool = toolEvents.find((e) => e.state === "running");
  const completedSearches = toolEvents.filter(
    (e) => e.kind === "search" && e.state === "done",
  ).length;
  const completedReads = toolEvents.filter(
    (e) => e.kind === "read" && e.state === "done",
  ).length;
  const recordedFindings = toolEvents.filter(
    (e) => e.kind === "record" && e.state === "done",
  ).length;
  const phase: { icon: string; label: string } = (() => {
    if (status !== "checking") return { icon: "", label: "" };
    if (runningTool?.kind === "search")
      return { icon: "🔎", label: "ガイドライン検索中" };
    if (runningTool?.kind === "read")
      return { icon: "📄", label: "ガイドライン読込中" };
    if (runningTool?.kind === "record")
      return { icon: "🖍️", label: "ハイライト記録中" };
    return { icon: "🧠", label: "考察中" };
  })();
  const phaseStats =
    status === "checking"
      ? `step ${stepIndex} · 🔎${completedSearches} · 📄${completedReads} · 🖍️${recordedFindings}`
      : "";

  return (
    <div
      className="flex h-full w-full flex-col bg-white text-slate-700"
      style={{ fontSize }}
    >
      {/* ws + 保存先 + クリア */}
      <div className="flex shrink-0 items-center gap-2 border-b border-teal-200 bg-teal-50 px-3 py-1.5">
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          title="フォームとプレビューをリセット"
        >
          <Trash2 className="h-3 w-3" />
          クリア
        </button>
        {savedPath && (
          <span className="inline-flex items-center gap-1 rounded border border-teal-300 bg-white px-2 py-0.5 font-mono text-[10px] text-teal-700">
            <FileCheck2 className="h-3 w-3" />
            {savedPath}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-slate-400">
          ws: {workspaceId}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 左: 入力フォーム */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto border-r border-slate-200 px-3 py-2">
          <div className="flex items-center gap-1.5 font-semibold text-teal-700">
            <ClipboardList className="h-3.5 w-3.5" />
            入力メモ
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1 text-[11px] text-slate-500">
              訪問日
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                disabled={busy}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 focus:border-teal-400 focus:outline-none disabled:opacity-50"
              />
            </label>
            <input
              type="text"
              placeholder="ヘルパー名"
              value={helperName}
              onChange={(e) => setHelperName(e.target.value)}
              disabled={busy}
              className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none disabled:opacity-50"
            />
            <input
              type="text"
              placeholder="ゲスト名"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              disabled={busy}
              className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          <textarea
            ref={textareaRef}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            disabled={busy}
            placeholder="今日の訪問について自由に書いてください..."
            className="min-h-[10rem] flex-1 resize-none rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none disabled:opacity-50"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={busy}
                className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-1 rounded bg-teal-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-teal-500 disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
            {status === "streaming"
              ? "整形中..."
              : status === "checking"
                ? "ガイドライン照合中..."
                : "整形してファイル保存"}
          </button>

          {errorMsg && (
            <div className="rounded border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-700">
              <div className="mb-1 font-medium">エラー</div>
              <div className="whitespace-pre-wrap font-mono">{errorMsg}</div>
              <div className="mt-1 text-rose-600/80">
                llama.cpp が起動しているか、LLAMA_BASE_URL の値を確認してください。
              </div>
            </div>
          )}
          {warningMsg && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
              <div className="mb-1 font-medium">警告</div>
              <div className="whitespace-pre-wrap">{warningMsg}</div>
            </div>
          )}
        </div>

        {/* 右: 整形プレビュー */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className={`flex shrink-0 items-center gap-1.5 border-b px-3 py-1 text-[11px] font-semibold ${
              status === "checking"
                ? "border-amber-200 bg-amber-50/60 text-amber-800"
                : "border-teal-200 bg-teal-50/60 text-teal-700"
            }`}
          >
            <FileCheck2 className="h-3 w-3" />
            {status === "checking" ? (
              <>
                <span>{phase.icon}</span>
                <span>ガイドライン照合中 — {phase.label}</span>
                <span className="ml-2 font-mono text-[10px] font-normal text-amber-700/80">
                  {phaseStats}
                </span>
              </>
            ) : (
              "整形プレビュー"
            )}
            {busy && (
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px]">
                <span
                  className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                    status === "checking" ? "bg-amber-500" : "bg-teal-500"
                  }`}
                />
                {status === "checking" ? "checking" : "running"}
              </span>
            )}
          </div>

          {/* tool-call ストリップ (Step 2 のみ) */}
          {(toolEvents.length > 0 || status === "checking") && (
            <div className="flex shrink-0 flex-col gap-1 border-b border-amber-200 bg-amber-50/40 px-3 py-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                <ShieldAlert className="h-3 w-3" />
                Agentic ガイドライン検索
              </div>
              {toolEvents.length === 0 && status === "checking" && (
                <div className="text-[10px] italic text-amber-700/70">
                  検索待機中...
                </div>
              )}
              {toolEvents.map((ev) => (
                <ToolEventRow key={ev.toolCallId} ev={ev} />
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {!hasResult && !busy && (
              <p className="italic text-slate-400">
                左のメモを書いて「整形してファイル保存」を押すと、テンプレートに沿った
                Markdown レポートがここに流れ、{" "}
                <span className="font-mono">reports/</span> フォルダに保存されます。
                整形完了後、自動でガイドライン照合が走り、人間の確認が必要な箇所が
                太字 + サマリで追記されます。
              </p>
            )}
            {previewText.length > 0 && (
              <MarkdownText
                text={previewText}
                highlightStrong={
                  status === "checking" || status === "done" || status === "error"
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolEventRow({ ev }: { ev: GuidelineToolEvent }) {
  const stateBadge =
    ev.state === "running" ? (
      <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
    ) : ev.state === "error" ? (
      <span className="ml-auto text-[10px] text-rose-600">error</span>
    ) : null;

  if (ev.kind === "search") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
        <span>🔎</span>
        <span className="font-mono text-amber-700">searchGuidelines</span>
        {ev.query && (
          <span className="truncate font-mono text-slate-600">
            &quot;{ev.query}&quot;
          </span>
        )}
        {ev.hits && ev.hits.length > 0 && (
          <span className="truncate text-slate-500">
            → {ev.hits.map((h) => h.id).join(", ")}
          </span>
        )}
        {ev.hits && ev.hits.length === 0 && (
          <span className="italic text-slate-400">→ 該当なし</span>
        )}
        {stateBadge}
      </div>
    );
  }
  if (ev.kind === "read") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
        <span>📄</span>
        <span className="font-mono text-amber-700">readGuideline</span>
        {ev.id && <span className="font-mono text-slate-600">{ev.id}</span>}
        {ev.found === true && ev.title && (
          <span className="truncate text-slate-500">→ {ev.title}</span>
        )}
        {ev.found === false && (
          <span className="italic text-rose-600">→ 見つかりませんでした</span>
        )}
        {stateBadge}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-1.5 text-[11px] text-slate-700">
      <span>🖍️</span>
      <span className="font-mono text-amber-700">recordFinding</span>
      <div className="min-w-0 flex-1">
        {ev.label && (
          <span className="font-semibold text-amber-900">{ev.label}</span>
        )}
        {ev.sentenceText && (
          <div className="truncate text-slate-500" title={ev.sentenceText}>
            「{ev.sentenceText}」
          </div>
        )}
      </div>
      {stateBadge}
    </div>
  );
}
