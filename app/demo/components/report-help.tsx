"use client";

import { ClipboardList, FileCheck2, FolderTree, ShieldAlert } from "lucide-react";

type Props = {
  fontSize: number;
};

// 訪問介護レポートパネル裏面のヘルプペイン。
// 概要 + テンプレート構造 + 命名規則 + プリセット + tips をまとめる。
export function ReportHelp({ fontSize }: Props) {
  return (
    <div
      className="flex-1 overflow-y-auto px-3 py-3 font-mono text-slate-600"
      style={{ fontSize }}
    >
      <p className="mb-3 text-slate-500">
        訪問介護のヘルパーが書いた自由記述メモを、所定の Markdown
        テンプレートに整形して workspace の{" "}
        <span className="font-mono">reports/</span>{" "}
        フォルダに保存するデモパネルです。
      </p>

      <Section
        color="#0d9488"
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        label="基本フロー"
      >
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
          <li>訪問日 / ヘルパー名 / ゲスト名 + 自由記述メモを入力</li>
          <li>
            「整形してファイル保存」で <strong>Step 1: AI 整形</strong>{" "}
            のストリームが流れます
          </li>
          <li>
            続けて <strong>Step 2: ガイドライン照合</strong> が自動で走り、
            人間 (管理者・ケアマネ・看護師) の確認が必要な箇所を
            太字 + サマリで追記します
          </li>
          <li>
            完了後、Workspace ツリーが自動更新され該当ファイルが選択されます
          </li>
        </ul>
      </Section>

      <Section
        color="#b45309"
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        label="Step 2: ガイドライン照合 (Agentic)"
        endpoint="/api/report/guideline-check"
      >
        <p className="mb-1 text-slate-700">
          整形済みレポートを 6 件の社内介護ガイドラインに照らして読み返し、
          人間の確認が必要な箇所を最大 6 件抽出します。LLM が
          <span className="font-mono"> searchGuidelines </span>/{" "}
          <span className="font-mono">readGuideline</span> ツールを最大 8
          step まで自律的に呼ぶ <strong>Agentic 検索</strong>{" "}
          のデモです (RAG ではありません)。
        </p>
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
          <li>
            元レポートの該当文を <span className="font-mono">**…**</span>{" "}
            で太字化 (見出し・順序・文言は変更しない)
          </li>
          <li>
            末尾に{" "}
            <span className="font-mono">## ⚠️ 人間の確認が必要な事項</span>{" "}
            セクションを追加し、各事項に{" "}
            <span className="font-mono">[doc=guideline-xxx]</span> で根拠を引用
          </li>
          <li>
            引用は readGuideline で本文を読んだガイドラインのみ。引用ボタンを
            クリックすると Workspace ツリーで該当ガイドラインが開きます
          </li>
          <li>
            Step 2 は Step 1 で保存した同 path に上書き保存します。失敗しても
            Step 1 のファイルは残ります
          </li>
        </ul>
        <p className="mt-1 text-slate-700">参照する 6 件のガイドライン:</p>
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
          <li>
            <span className="font-mono text-teal-700">guideline-vital</span> —
            バイタル管理 (体温・血圧の閾値と家族連絡基準)
          </li>
          <li>
            <span className="font-mono text-teal-700">guideline-abuse</span> —
            虐待防止と外傷観察 (経緯不明のあざの取り扱い)
          </li>
          <li>
            <span className="font-mono text-teal-700">guideline-infection</span>{" "}
            — 感染症対策 (微熱継続・食欲低下の初期兆候)
          </li>
          <li>
            <span className="font-mono text-teal-700">guideline-falls</span> —
            転倒予防 (ふらつき時の付き添いと記録)
          </li>
          <li>
            <span className="font-mono text-teal-700">guideline-handover</span>{" "}
            — 申し送りと家族連絡 (普段との差分の記録)
          </li>
          <li>
            <span className="font-mono text-teal-700">guideline-meds</span> —
            服薬管理 (補充禁止・新薬の継続観察)
          </li>
        </ul>
      </Section>

      <Section
        color="#0d9488"
        icon={<FileCheck2 className="h-3.5 w-3.5" />}
        label="出力テンプレート"
        endpoint="lib/opencode/report-template.ts"
      >
        <p className="mb-1 text-slate-700">
          AI には次の 6 見出し構成で出力するよう指示しています:
        </p>
        <ol className="list-decimal space-y-0.5 pl-4 text-slate-600">
          <li>
            <span className="font-mono"># 訪問介護サービス提供記録</span>
          </li>
          <li>
            <span className="font-mono">## 基本情報</span> (訪問日 / ヘルパー名
            / ゲスト名)
          </li>
          <li>
            <span className="font-mono">## 提供したサービス</span>
          </li>
          <li>
            <span className="font-mono">## 利用者の様子</span>
          </li>
          <li>
            <span className="font-mono">## 特記事項・気づき</span>
          </li>
          <li>
            <span className="font-mono">## 次回への申し送り</span>
          </li>
        </ol>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">
          <li>メモにない事実を創作しない（情報なし → 「特記事項なし」）</li>
          <li>体調・気分の変化、リスク兆候は「特記事項・気づき」に明示</li>
          <li>各セクションは箇条書き + 「です・ます調」</li>
          <li>体温・血圧などの数値情報は明確に記載</li>
        </ul>
      </Section>

      <Section
        color="#0d9488"
        icon={<FolderTree className="h-3.5 w-3.5" />}
        label="ファイル名の命名規則"
      >
        <p className="mb-1 text-slate-700">
          保存先は{" "}
          <span className="font-mono text-teal-700">
            reports/{"{YYYY-MM-DD}"}-{"{NN}"}.md
          </span>{" "}
          固定。
        </p>
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
          <li>
            <span className="font-mono">{"{YYYY-MM-DD}"}</span> は「訪問日」フォームの値
          </li>
          <li>
            <span className="font-mono">{"{NN}"}</span> はその訪問日の中での
            0 埋め 2 桁シリアル (01 / 02 / ...)
          </li>
          <li>連番は日付ごとにリセットされます</li>
          <li>
            ファイル名は ASCII 固定（仮想 FS の path 制約{" "}
            <span className="font-mono">[a-zA-Z0-9._-/]+</span> に従うため）。
            日本語は本文だけに含まれます
          </li>
        </ul>
        <div className="mt-1 rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] text-slate-600">
          reports/2026-04-29-01.md ← 4/29 の 1 件目
          <br />
          reports/2026-04-29-02.md ← 4/29 の 2 件目
          <br />
          reports/2026-04-30-01.md ← 翌日の 1 件目
        </div>
      </Section>

      <Section
        color="#0d9488"
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        label="プリセットメモ"
      >
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
          <li>
            <span className="font-semibold text-slate-700">通常訪問</span> —
            入浴介助 + 家事支援 + 軽微な気づき
          </li>
          <li>
            <span className="font-semibold text-slate-700">体調不良の兆し</span>{" "}
            — 微熱・あざ・ふらつきの観察記録
          </li>
          <li>
            <span className="font-semibold text-slate-700">申し送りあり</span> —
            デイサービス曜日変更 + 手すり設置の連絡事項
          </li>
        </ul>
      </Section>

      <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">
          tips
        </div>
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
          <li>
            生成中はパネル右上の{" "}
            <span className="font-mono text-teal-700">running</span>{" "}
            インジケータが点滅し、終わると入力欄に自動でフォーカスが戻ります
          </li>
          <li>「クリア」でフォームとプレビューをリセットできます (生成中は無効)</li>
          <li>パネル右下の ▢ をドラッグするとサイズ変更できます</li>
          <li>ヘッダー右の -/+ で本文のフォントサイズを変えられます</li>
          <li>左上のトラフィックライト 🔴🟡🟢 は 閉じる / 最小化 / 80% フィット表示</li>
          <li>
            ファイル本文は最大 64KB、Workspace あたり最大 100 ファイルまで
          </li>
        </ul>
      </div>
    </div>
  );
}

function Section({
  color,
  icon,
  label,
  endpoint,
  children,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  endpoint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded border border-slate-200 bg-white px-2 py-1.5">
      <div className="mb-0.5 flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      {endpoint && (
        <div className="mb-1 font-mono text-[10px] text-slate-400">
          {endpoint}
        </div>
      )}
      <div className="text-slate-700">{children}</div>
    </div>
  );
}
