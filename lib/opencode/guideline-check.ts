// 訪問介護レポートの Step 2 (agentic ガイドライン照合) で扱う構造化データの
// 型定義。サーバ (app/api/report/guideline-check/route.ts) とクライアント
// (app/demo/components/report-composer.tsx, findings-panel.tsx) で共有する。

export type Finding = {
  // 1-based の通し番号。本文中の `**[N] ...**` ハイライトと UI のカード番号の
  // 双方をこの値で結び付ける。
  index: number;
  sentenceText: string;
  label: string;
  reason: string;
  citations: string[];
};

export type GuidelineCheckMetadata = {
  mode: "guideline-check";
  // 本文のみ (末尾「## ⚠️ 人間の確認が必要な事項」セクション無し、ただし
  // `[N]` ハイライトは挿入済み)。UI の整形プレビュー用。
  previewBody: string;
  // 末尾セクション付きの完成形 = `reports/...md` に保存される本文。
  finalContent: string;
  findings: Finding[];
  findingsCount: number;
};
