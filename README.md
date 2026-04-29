# simple-workspace-demo

社内文書を題材にした **RAG 検索 / Agentic 検索の比較デモ** と、訪問介護の現場メモを Markdown レポートに整形する **訪問介護レポート生成デモ** をひとつにまとめた、ローカルで完結する Next.js 16 のデモアプリです。

ホワイトボード（Excalidraw）の上にフロート型の **Workspace パネル** と **OpenCode パネル** / **訪問レポートパネル** を配置する構成。Cookie 認証 / Workspace CRUD / ホワイトボードの自動保存 / 仮想ファイルシステム / AI SDK ストリーミング + ツール呼び出しまで `npm run dev` 1 つで触れる最小構成です。

ベースは [`myworkspaces`](https://github.com/Takashi-Matsumura/myworkspaces.git) からログイン / Workspace / ホワイトボード / パネル拡張機構の 4 つだけを移植し、Docker / PostgreSQL / xterm + PTY / 多数のパネル群は削ぎ落としています。

## 技術スタック

- **Next.js 16.2.4** (App Router, Turbopack)
- **React 19.2.4**
- **Tailwind CSS 4**
- **Prisma 7** + **SQLite** (`@prisma/adapter-better-sqlite3`)
- **Excalidraw 0.18** (ホワイトボード、`dynamic({ ssr: false })`)
- **Vercel AI SDK v6** + `@ai-sdk/openai-compatible` (RAG / Agentic / レポート整形のストリーミング & ツール呼び出し)
- **react-markdown** + **remark-gfm** (Markdown レンダリング)
- **lucide-react** (アイコン)
- Cookie 認証 (`bcryptjs` + HMAC 署名 Cookie)
- TypeScript strict

## 起動手順

```bash
# 1. 依存をインストール
npm install

# 2. 環境変数ファイルを用意
cp .env.example .env

# 3. SQLite DB を初期化
npx prisma migrate dev

# 4. 開発サーバを起動
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くと `/login` にリダイレクトされます。`/register` から新規ユーザーを作成し、ログイン後に Workspace を作って OpenCode パネル / 訪問レポートパネルを開けます。

新規 Workspace 作成時に、社内文書サンプル 9 件 (`lib/opencode/corpus.ts`) が自動で `corpus/{spec,faq,incident}/{id}.md` として seed されます。

### 主な npm スクリプト

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | 開発サーバ |
| `npm run build` | プロダクションビルド |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Prisma マイグレーション (開発用) |
| `npm run db:studio` | Prisma Studio |

## 環境変数

`.env.example` を `.env` にコピーして使います。

| キー | 用途 |
| --- | --- |
| `DATABASE_URL` | SQLite ファイルパス (例: `file:./prisma/dev.db`) |
| `SESSION_SECRET` | Cookie 署名用シークレット (16 文字以上) |
| `LLAMA_BASE_URL` | OpenAI 互換 API のベース URL (既定: `http://localhost:8080/v1`) |
| `LLAMA_MODEL` | LLM モデル名 (既定: `gemma`) |
| `LLAMA_API_KEY` | API キー。llama.cpp ではダミー値 (`not-needed`) で OK |

OpenCode / レポート生成パネルを実際に動かすには、ローカルの **llama.cpp サーバ**を `http://localhost:8080` で起動しておくか、`LLAMA_BASE_URL` を別の OpenAI 互換エンドポイントに切り替えてください。

## ディレクトリ構成

```
app/
├── api/
│   ├── auth/{register,login,logout,me}/   # Cookie 認証
│   ├── user/workspaces/                    # Workspace CRUD
│   ├── whiteboard/                         # Excalidraw 自動保存 (1.5s デバウンス)
│   ├── opencode/{rag,agentic,coding,files}/  # 検索 / コーディング / 仮想 FS API
│   └── report/generate/                    # 訪問介護レポート生成 (streamText + writeWorkspaceFile)
├── login/ register/                        # ログイン / 新規登録画面
├── page.tsx                                # メイン画面 (Whiteboard + フロートパネル群)
├── layout.tsx
└── demo/
    ├── components/
    │   ├── whiteboard-canvas.tsx           # Excalidraw 統合
    │   ├── floating-workspace*.tsx         # Workspace パネル (selector / tree / preview / settings / context)
    │   ├── floating-terminal.tsx           # OpenCode + レポートパネル共通フロート枠 (variant 分岐)
    │   ├── opencode-chat.tsx               # RAG 検索 / Agentic 検索 を 2 カラム同時投稿で並列比較
    │   ├── opencode-help.tsx               # OpenCode パネル裏面ヘルプ
    │   ├── report-composer.tsx             # 訪問介護レポート生成 UI
    │   ├── report-help.tsx                 # レポートパネル裏面ヘルプ
    │   ├── opencode-logo.tsx               # `<> opencode` ロゴ (variant でアクセント色を切替)
    │   ├── markdown-text.tsx               # 軽量 Markdown レンダラ + 引用クリックイベント
    │   ├── account-badge.tsx
    │   └── workspace-context.tsx
    ├── hooks/                              # use-panels / use-pointer-drag / use-pointer-resize / use-3d-flip / use-font-size 他
    ├── config/terminal-panels.tsx          # パネル拡張カタログ (opencode / report の 2 件)
    ├── api/workspace.ts                    # クライアント側 fetch ラッパー
    ├── lib/storage-keys.ts
    └── types/{panels,opencode}.ts
lib/
├── auth.ts                                 # Cookie 発行・検証 / bcrypt
├── user.ts                                 # getUser / requireUser (OIDC 移行点)
├── prisma.ts                               # Prisma + better-sqlite3 adapter
├── user-store.ts                           # Workspace CRUD
├── api-schemas.ts                          # zod schema (workspace 関連)
└── opencode/
    ├── corpus.ts                           # 社内文書サンプル 9 件 (仕様 / FAQ / 障害)
    ├── seed-corpus.ts                      # 新規 Workspace 作成時に corpus を仮想 FS に書き出す
    ├── search.ts                           # シンプルなキーワード検索 (RAG / searchDocs ツール共用)
    ├── files.ts                            # 仮想 FS (writeWorkspaceFile / listWorkspaceFiles 等)
    ├── report-template.ts                  # 訪問介護レポート用システムプロンプト
    └── model.ts                            # OpenAI 互換 LLM クライアント (llama.cpp 既定)
prisma/
├── schema.prisma                           # User / Session / Workspace / Whiteboard / WorkspaceFile
└── migrations/
proxy.ts                                    # Next.js 16 の proxy (Cookie 存在で /login ガード)
```

## 認証フロー

- `proxy.ts` は Cookie の **存在** だけを判定し、未ログインなら `/login` にリダイレクト
- 実際のセッション検証は API ルート (`getUser`) と `app/page.tsx` のクライアントガードで行う
- Cookie は `<token>.<HMAC-SHA256(token)>` 形式 (HttpOnly + SameSite=Lax)
- 30 日 TTL、`POST /api/auth/logout` で DB セッションと Cookie の両方を破棄

OIDC など外部認証へ移行する場合は `lib/user.ts` の `getUser` を差し替えるだけで済む構造になっています。

## Workspace パネル

- **左ペイン: ファイルツリー** — `corpus/`, `reports/` 配下を含む仮想 FS をツリー表示。デフォルトは畳んだ状態で、外部 (`workspace:open-doc` / `workspace:open-path` イベント) からファイル選択された時のみ親フォルダを自動展開
- **右ペイン: プレビュー** — 選択ファイルを `MarkdownText` でレンダリング
- **裏面 (flip)**: ワークスペース設定
- 左上の `[doc=...]` ピンや、レポートパネルからの保存通知でツリーが自動更新 + 該当ファイルが選択される

## OpenCode パネル — RAG 検索 vs Agentic 検索

社内文書 9 件（`lib/opencode/corpus.ts`、仕様 3 / FAQ 3 / 障害 3）を題材に、RAG と Agentic を **左右 2 カラムで同時に投稿して並列比較**できます。

- **RAG 検索** (`POST /api/opencode/rag`): キーワード検索 1 回 → ヒットしたスニペットだけを文脈に LLM が回答。多段ホップや語彙ギャップに弱い場面が見える。
- **Agentic 検索** (`POST /api/opencode/agentic`): LLM が `searchDocs` / `readDoc` ツールを最大 8 ステップ自律的に呼び出し、必要に応じて多段でドキュメントを読みに行く。ツール呼び出し履歴が可視化される。

機能:
- 単一の入力フォームから両エンジンに同時投稿（プリセット 3 種類: 単発ヒット / 多段ホップ / 語彙ギャップ）
- 思考過程は `Thinking...` の折りたたみ表示でストリーミング中アニメーション
- Markdown レンダリング (見出し / 箇条書き / 表 / コードフェンス対応)
- 回答内の `[doc=spec-pricing]` のような引用 ID をクリックすると Workspace パネルでその文書が開く
- 「クリア」ボタンで両カラムの履歴とコンテキストを一括リセット
- 生成完了で入力欄に自動フォーカス（連続質問しやすい）

`POST /api/opencode/coding` は Coding Agent (`writeFile` / `readFile` / `listFiles` / `deleteFile` を持つ最大 10 ステップ) として API ルートのみ残してあります。UI からの導線は v1 では削除済みです。

## 訪問レポート生成パネル

訪問介護のヘルパーが帰社後に書いた自由記述メモを、生成 AI に整形させて Workspace の `reports/` フォルダに Markdown ファイルとして保存するデモパネルです。

### フロー

1. Workspace パネル右上の teal ボタン「**訪問レポート**」で起動
2. 訪問日 / ヘルパー名 / ゲスト名 + 自由記述メモを入力（プリセット 3 種類: 通常訪問 / 体調不良の兆し / 申し送りあり）
3. 「整形してファイル保存」を押すと `POST /api/report/generate` が叩かれ、出力がストリームでプレビューされる
4. ストリーム終端で `reports/{YYYY-MM-DD}-{NN}.md` に書き込まれ、Workspace パネルがツリー再取得 + 該当ファイル自動選択

### 出力テンプレート (`lib/opencode/report-template.ts`)

```
# 訪問介護サービス提供記録

## 基本情報
- 訪問日 / ヘルパー名 / ゲスト名

## 提供したサービス
## 利用者の様子
## 特記事項・気づき
## 次回への申し送り
```

システムプロンプトで以下を厳守させています:
- メモにない事実を創作しない（情報なし → 「特記事項なし」）
- 体調・気分の変化、リスク兆候は「特記事項・気づき」に明示
- 各セクションは箇条書き + 「です・ます調」
- 体温・血圧などの数値は明確に記載
- コードフェンスで囲まない

### ファイル名の命名規則

`reports/{YYYY-MM-DD}-{NN}.md`

- `{YYYY-MM-DD}` はフォームの「訪問日」フィールド
- `{NN}` はその訪問日の中での 0 埋め 2 桁シリアル (01 / 02 / ...)
- 連番は日付ごとにリセットされ、同日内は max+1 採番
- ファイル名は ASCII 固定（仮想 FS の path 制約 `[a-zA-Z0-9._-/]+` に従うため）。日本語は本文内のみに含まれます

### 実装の見どころ

- クライアントは **`useChat` を使わず raw fetch + `TextDecoderStream`** でストリームを読み取る (1-shot Q→A のため UI Message Protocol は過剰)
- API は `streamText({ prompt }).toTextStreamResponse()` + `onFinish` で `writeWorkspaceFile`。AI SDK は `onFinish` の `await` 完了までレスポンスをクローズしないため、stream 終端 = ファイル書き込み確定
- 保存先パスはストリーム開始前に決定し、レスポンスヘッダ `x-saved-path` でクライアントに即時返す
- 完了時に `window.dispatchEvent(new CustomEvent("workspace:open-path", { detail: { path } }))` を発火 → Workspace パネルがリスンしてツリー再取得 + 自動選択

## 仮想ファイルシステム

OpenCode Coding API およびレポート生成 API は、ホスト FS に触れず **SQLite 上の `WorkspaceFile` テーブル**（`workspaceId + path` で UNIQUE）で完結します。

- パスは `[a-zA-Z0-9._\-/]` のみ、`..` 禁止、最大 200 文字
- 1 ファイルあたり最大 64KB、Workspace あたり最大 100 ファイル
- Workspace を削除すれば `WorkspaceFile` も cascade で消える
- `GET /api/opencode/files?workspaceId=X` で一覧、`?path=X` を付けると本文取得

## パネル拡張機構

新しいフロートパネル種別を増やすときは `app/demo/config/terminal-panels.tsx` の `TERMINAL_PANEL_DEFINITIONS` に 1 行追加するだけで、`<FloatingTerminal>` と footer / Workspace selector のボタンが自動的に生えます。

```tsx
{
  id: "report",
  variant: "report",
  slot: "right",
  switcherLabel: "訪問レポート",
  switcherTitle: "訪問介護レポート生成パネルを最前面に",
  switcherAccent: "#0d9488",
  switcherIcon: <ClipboardList className="h-3 w-3" />,
}
```

`floating-terminal.tsx` で `variant` を分岐し、対応する React コンポーネント (`OpenCodeChat` / `ReportComposer`) と裏面ヘルプ (`OpenCodeHelp` / `ReportHelp`) を切り替えています。テーマカラー (フレーム枠 / ヘッダ背景 / `<> opencode` ロゴの "code" 部分 / リサイズハンドル) も variant ごとに blue / teal を出し分けます。

## 次フェーズ

- ユーザー固有のドキュメントを Workspace にアップロードして RAG 対象化
- Excalidraw との連携（パネルから図に画像を貼り付け、図からパネルにメモを送る）
- 訪問レポートのテンプレート切り替え（介護以外の業務報告デモ）

## ライセンス

[MIT](./LICENSE)
