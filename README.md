# simple-workspace-demo

社内文書の **RAG 検索** と **Agentic サーチ** の動作確認用デモアプリ。
ホワイトボード（Excalidraw）の上にフロート型の Workspace パネルと OpenCode パネルを配置する構成で、Cookie 認証 / Workspace CRUD / ホワイトボードの自動保存までをコンパクトに実装してあります。

ベースは [`myworkspaces`](https://github.com/Takashi-Matsumura/myworkspaces.git) から **ログイン / Workspace / ホワイトボード / パネル拡張機構** の 4 つだけを移植し、Docker / PostgreSQL / xterm + PTY / 多数のパネル群は削ぎ落とした最小構成です。OpenCode パネルは現状プレースホルダで、次フェーズで RAG / Agentic 検索 UI を載せる予定です。

## 技術スタック

- **Next.js 16.2.4** (App Router, Turbopack)
- **React 19.2.4**
- **Tailwind CSS 4**
- **Prisma 7** + **SQLite** (driver adapter: `@prisma/adapter-better-sqlite3`)
- **Excalidraw 0.18** (ホワイトボード)
- **Vercel AI SDK v6** + `@ai-sdk/openai-compatible` (RAG / Agentic 検索のストリーミング & ツール呼び出し)
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

[http://localhost:3000](http://localhost:3000) を開くと `/login` にリダイレクトされます。`/register` から新規ユーザーを作成し、ログイン後に Workspace を作って OpenCode パネルを開けます。

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
| `LLAMA_BASE_URL` | OpenCode パネルが叩く OpenAI 互換 API のベース URL (既定: `http://localhost:8080/v1`) |
| `LLAMA_MODEL` | LLM モデル名 (既定: `gemma`) |
| `LLAMA_API_KEY` | API キー。llama.cpp ではダミー値 (`not-needed`) で OK |

OpenCode パネルを実際に動かすにはローカルの **llama.cpp サーバ** を `http://localhost:8080` で起動しておくか、`LLAMA_BASE_URL` を別の OpenAI 互換エンドポイントに切り替えてください。

## ディレクトリ構成

```
app/
├── api/
│   ├── auth/{register,login,logout,me}/   # Cookie 認証
│   ├── user/workspaces/                    # Workspace CRUD
│   ├── whiteboard/                         # Excalidraw 自動保存 (1.5s デバウンス)
│   └── opencode/{rag,agentic}/             # RAG / Agentic 検索 (AI SDK ストリーミング)
├── login/                                  # ログイン画面
├── register/                               # 新規登録画面
├── page.tsx                                # メイン画面 (Whiteboard + フロートパネル群)
├── layout.tsx
└── demo/
    ├── components/
    │   ├── whiteboard-canvas.tsx           # Excalidraw 統合
    │   ├── floating-workspace*.tsx         # Workspace パネル
    │   ├── floating-terminal.tsx           # OpenCode 用フロート枠
    │   ├── opencode-chat.tsx               # RAG / Agentic 切替式チャット UI
    │   ├── account-badge.tsx               # ヘッダー右のユーザー + ログアウト
    │   └── workspace-context.tsx
    ├── hooks/                              # use-panels, use-pointer-drag/resize 等
    ├── config/terminal-panels.tsx          # パネル拡張カタログ
    ├── lib/storage-keys.ts
    ├── api/workspace.ts                    # クライアント側 fetch ラッパー
    └── types/panels.ts
lib/
├── auth.ts                                 # Cookie 発行・検証 / bcrypt
├── user.ts                                 # getUser / requireUser (OIDC 移行点)
├── prisma.ts                               # Prisma + better-sqlite3 adapter
├── user-store.ts                           # Workspace CRUD
├── api-schemas.ts                          # zod schema (workspace 関連)
└── opencode/
    ├── corpus.ts                           # 社内文書サンプル 9 件 (仕様 / FAQ / 障害)
    ├── search.ts                           # シンプルなキーワード検索 (RAG / searchDocs ツール共用)
    └── model.ts                            # OpenAI 互換 LLM クライアント (llama.cpp 既定)
prisma/
├── schema.prisma                           # User / Session / Workspace / Whiteboard
└── migrations/
proxy.ts                                    # Next.js 16 の proxy (Cookie 存在で /login ガード)
```

## 認証フロー

- `proxy.ts` は Cookie の **存在** だけを判定し、未ログインなら `/login` にリダイレクト (Edge runtime)
- 実際のセッション検証は API ルート (`getUser`) と `app/page.tsx` のクライアントガードで行う
- Cookie は `<token>.<HMAC-SHA256(token)>` 形式 (HttpOnly + SameSite=Lax)
- 30 日 TTL、`POST /api/auth/logout` で DB セッションと Cookie の両方を破棄

OIDC など外部認証へ移行する場合は `lib/user.ts` の `getUser` を差し替えるだけで済む構造になっています。

## OpenCode パネルの拡張

新しいパネル種別を増やすときは `app/demo/config/terminal-panels.tsx` の `TERMINAL_PANEL_DEFINITIONS` に 1 行追加するだけで、`<FloatingTerminal>` と footer の `<PanelSwitcherButton>` の両方が自動的に生えます。

```tsx
// app/demo/config/terminal-panels.tsx
{
  id: "opencode",
  variant: "opencode",
  slot: "center",
  switcherLabel: "OpenCode",
  switcherTitle: "OpenCode パネルを最前面に",
  switcherAccent: "#7c3aed",
  switcherIcon: <Sparkles className="h-3 w-3" />,
}
```

中身は `app/demo/components/opencode-chat.tsx` を差し替えれば良い設計です。

## OpenCode パネルの機能

OpenCode パネルにはモードセレクタ (`RAG` / `Agentic`) があり、同じ質問を別アプローチで投げて挙動の違いを比較できます。

- **RAG** (`POST /api/opencode/rag`): キーワード検索を 1 回行い、ヒットしたスニペットだけを文脈に LLM が回答する。多段ホップや語彙ギャップに弱い場面が見える。
- **Agentic** (`POST /api/opencode/agentic`): LLM が `searchDocs` / `readDoc` ツールを自律的に最大 8 ステップ呼び出し、必要に応じて多段でドキュメントを読みに行く。ツール呼び出しの履歴がパネル内に可視化される。

検索対象の社内文書 9 件は `lib/opencode/corpus.ts` にハードコードしてあります（仕様 3 件 / FAQ 3 件 / 障害履歴 3 件）。

## 次フェーズ

- **Phase B**: ファイル操作ツール (`writeFile` / `readFile` / `listFiles`) を追加して「Coding Agent」モードを実装。`Workspace` ごとに仮想 FS (SQLite) を持たせ、ファイル作成 / 編集の結果をパネル内で可視化
- **Phase C**: ユーザー固有のドキュメントを Workspace にアップロードして RAG 対象化、Excalidraw との連携など

## ライセンス

[MIT](./LICENSE)
