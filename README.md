# simple-workspace-demo

社内文書を題材にした **RAG 検索 / Agentic 検索の比較デモ** と、訪問介護の現場メモを生成 AI で整形しさらに介護ガイドラインに照らして「人間の確認が必要な箇所」を Agentic に抽出する **訪問介護レポート生成デモ** をひとつにまとめた、ローカルで完結する Next.js 16 のデモアプリです。

ホワイトボード（Excalidraw）の上にフロート型の **Workspace パネル** と **OpenCode パネル** / **訪問レポートパネル** を配置する構成。Cookie 認証 / Workspace CRUD / ホワイトボードの自動保存 / 仮想ファイルシステム / AI SDK ストリーミング + ツール呼び出し + tool ベースの決定論的レポート組立まで `npm run dev` 1 つで触れる最小構成です。

ベースは [`myworkspaces`](https://github.com/Takashi-Matsumura/myworkspaces.git) からログイン / Workspace / ホワイトボード / パネル拡張機構を移植し、PostgreSQL や opencode 連携など多数のパネル群は削ぎ落とした構成です。さらに myworkspaces のサンドボックス機能を移植し、**ログイン時にユーザ専用 Docker コンテナを払い出して xterm 端末で対話、Sandbox トグルでネットワーク隔離 ON/OFF 切替、ログアウト時に自動停止** する流れを追加しています。

## 技術スタック

- **Next.js 16.2.4** (App Router, Turbopack)
- **React 19.2.4**
- **Tailwind CSS 4**
- **Prisma 7** + **SQLite** (`@prisma/adapter-better-sqlite3`)
- **Excalidraw 0.18** (ホワイトボード、`dynamic({ ssr: false })`)
- **Vercel AI SDK v6** + `@ai-sdk/openai-compatible` (RAG / Agentic / レポート整形 / ガイドライン照合のストリーミング & ツール呼び出し)
- **react-markdown** + **remark-gfm** (Markdown レンダリング)
- **lucide-react** (アイコン)
- Cookie 認証 (`bcryptjs` + HMAC 署名 Cookie)
- **dockerode** + **ws** + **xterm.js** (ログインユーザごとの Docker サンドボックスと WebSocket 端末)
- TypeScript strict

> **RAG 実装のポイント**: 本デモの RAG は **langchain も ChromaDB も使っていない手作りの素朴な keyword 検索** (`lib/opencode/search.ts` の TF ベーススコアリング、embedding なし) です。「素朴な RAG では拾えない多段ホップ・語彙ゆれを Agentic ツール呼び出しが拾える」という対比を明示するための意図的な簡素化です。

## 起動手順

```bash
# 1. 依存をインストール
npm install

# 2. 環境変数ファイルを用意
cp .env.example .env

# 3. SQLite DB を初期化
npx prisma migrate dev

# 4. (任意) Sandbox Shell を使うなら一度だけサンドボックスイメージを構築
#    → Docker Desktop / Colima / OrbStack いずれかが起動していること
npm run sandbox:build

# 5. 開発サーバを起動 (custom server: server.ts)
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くと `/login` にリダイレクトされます。`/register` から新規ユーザーを作成し、ログイン後に Workspace を作って OpenCode パネル / 訪問レポートパネルを開けます。

新規 Workspace 作成時、および既存 Workspace を再 open した時に、社内文書サンプル 15 件 (`lib/opencode/corpus.ts` — spec 3 / faq 3 / incident 3 / guideline 6) が `corpus/{spec,faq,incident,guideline}/{id}.md` として **idempotent に seed** されます (既存ファイルは触らず、不足分だけ追加)。

### 主な npm スクリプト

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | 開発サーバ (custom server: `tsx watch server.ts`) |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクション起動 (`tsx server.ts`) |
| `npm run lint` | ESLint |
| `npm run sandbox:build` | Sandbox Shell 用 Docker イメージを構築 (`docker/sandbox/Dockerfile`) |
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
| `SANDBOX_IMAGE` | Sandbox Shell コンテナのイメージタグ (既定: `simple-workspace-sandbox:dev`) |
| `SANDBOX_DOCKER_SOCKET` | Docker daemon の UNIX socket パス (既定: `/var/run/docker.sock`) |
| `SANDBOX_IDLE_STOP_MS` | 予約。アイドル停止のしきい値 (現バージョン未使用) |

OpenCode / レポート生成パネルを実際に動かすには、ローカルの **llama.cpp サーバ**を `http://localhost:8080` で起動しておくか、`LLAMA_BASE_URL` を別の OpenAI 互換エンドポイントに切り替えてください。

## ディレクトリ構成

```
app/
├── api/
│   ├── auth/{register,login,logout,me}/   # Cookie 認証
│   ├── user/workspaces/                    # Workspace CRUD (touch 時に corpus 補充)
│   ├── whiteboard/                         # Excalidraw 自動保存 (1.5s デバウンス)
│   ├── opencode/{rag,agentic,coding,files}/  # 検索 / コーディング / 仮想 FS API
│   ├── report/
│   │   ├── generate/                       # Step 1: 訪問レポート整形 (streamText + writeWorkspaceFile)
│   │   └── guideline-check/                # Step 2: Agentic ガイドライン照合 + 決定論的ハイライト組立
│   └── shell/                              # Sandbox Shell コンテナ status / start / restart / delete
├── login/ register/                        # ログイン / 新規登録画面
├── page.tsx                                # メイン画面 (Whiteboard + フロートパネル群)
├── layout.tsx
└── demo/
    ├── components/
    │   ├── whiteboard-canvas.tsx           # Excalidraw 統合
    │   ├── floating-workspace*.tsx         # Workspace パネル (selector / tree / preview / settings / context)
    │   ├── floating-terminal.tsx           # OpenCode + レポートパネル共通フロート枠 (variant 分岐)
    │   ├── floating-shell.tsx              # Sandbox Shell パネル (xterm.js + WebSocket)
    │   ├── opencode-chat.tsx               # RAG 検索 / Agentic 検索 を 2 カラム同時投稿で並列比較
    │   ├── opencode-help.tsx               # OpenCode パネル裏面ヘルプ
    │   ├── report-composer.tsx             # 訪問介護レポート生成 UI (Step 1 → Step 2 自動連続)
    │   ├── report-back.tsx                 # レポートパネル裏面 (ヘルプ / システムプロンプト タブ)
    │   ├── report-help.tsx                 # 裏面ヘルプタブの中身
    │   ├── opencode-logo.tsx               # `<> opencode` ロゴ (variant でアクセント色を切替)
    │   ├── markdown-text.tsx               # 軽量 Markdown レンダラ + 引用クリック + 番号バッジハイライト
    │   ├── account-badge.tsx
    │   └── workspace-context.tsx
    ├── hooks/                              # use-panels / use-pointer-drag / use-pointer-resize / use-3d-flip / use-font-size 他
    ├── config/terminal-panels.tsx          # パネル拡張カタログ (opencode / report の 2 件)
    ├── api/workspace.ts                    # クライアント側 fetch ラッパー
    ├── lib/
    │   ├── storage-keys.ts
    │   └── report-prompts.ts               # システムプロンプト override の localStorage helper
    └── types/{panels,opencode}.ts
lib/
├── auth.ts                                 # Cookie 発行・検証 / bcrypt
├── user.ts                                 # getUser / requireUser (OIDC 移行点)
├── prisma.ts                               # Prisma + better-sqlite3 adapter
├── user-store.ts                           # Workspace CRUD
├── api-schemas.ts                          # zod schema (workspace 関連)
├── docker.ts                               # dockerode ラッパー (ensureContainer / recreateContainer / stopContainer / removeContainer / getInfo / execShell)
├── shell-ws.ts                             # WebSocket upgrade ハンドラ (Cookie 認証 + WS↔exec stream)
└── opencode/
    ├── corpus.ts                           # 社内文書サンプル 16 件 (spec / faq / incident / guideline)
    ├── seed-corpus.ts                      # 仮想 FS への idempotent seed
    ├── search.ts                           # シンプルな keyword 検索 (TF ベース、category filter 付き)
    ├── files.ts                            # 仮想 FS (writeWorkspaceFile / listWorkspaceFiles 等)
    ├── report-template.ts                  # 訪問介護レポート (Step 1) のシステムプロンプト
    ├── guideline-prompt.ts                 # ガイドライン照合 (Step 2) のシステムプロンプト
    └── model.ts                            # OpenAI 互換 LLM クライアント (llama.cpp 既定)
prisma/
├── schema.prisma                           # User / Session / Workspace / Whiteboard / WorkspaceFile
└── migrations/
proxy.ts                                    # Next.js 16 の proxy (Cookie 存在で /login ガード)
server.ts                                   # custom Node サーバ。/api/shell/ws の WebSocket upgrade を捌く
docker/sandbox/Dockerfile                   # Sandbox Shell イメージ (Ubuntu 24.04 + bash + curl/vim/git/jq)
```

## 認証フロー

- `proxy.ts` は Cookie の **存在** だけを判定し、未ログインなら `/login` にリダイレクト
- 実際のセッション検証は API ルート (`getUser`) と `app/page.tsx` のクライアントガードで行う
- Cookie は `<token>.<HMAC-SHA256(token)>` 形式 (HttpOnly + SameSite=Lax)
- 30 日 TTL、`POST /api/auth/logout` で DB セッションと Cookie の両方を破棄

OIDC など外部認証へ移行する場合は `lib/user.ts` の `getUser` を差し替えるだけで済む構造になっています。

## Sandbox Shell (ログインユーザごとの Docker コンテナ)

myworkspaces 由来のサンドボックス機能を移植したパネルです。**ログインしたユーザごとに Docker コンテナを 1 つ払い出す**ことで他ユーザの作業領域から隔離し、フッターの **Shell** ボタンで xterm.js + WebSocket 端末から対話できます。

| 項目 | 仕様 |
| --- | --- |
| ベースイメージ | `simple-workspace-sandbox:dev` (Ubuntu 24.04 + bash / curl / vim / git / jq / iputils-ping) |
| コンテナ名 | `simple-workspace-shell-<sanitizedUserId>` |
| Volume | `simple-workspace-data-<sanitizedUserId>` を `/root` にマウント (再起動・再生成しても永続) |
| **ネットワーク** | Sandbox **OFF** (既定) = `bridge` (通常通り外部接続可) / Sandbox **ON** = **`--network none` で外部完全遮断** (loopback のみ) |
| 起動契機 | **ログイン / 新規登録の API 完了直後に fire-and-forget で `ensureContainer`**。Docker daemon 不在でもログイン自体は通る (失敗はサーバログのみ) |
| Sandbox トグル | workspaces パネルヘッダの **Sandbox ON/OFF** (default OFF, localStorage 永続)。トグル切替で `POST /api/shell { action: "restart", networkMode }` を呼び、コンテナを force remove → 指定モードで再生成 |
| Shell パネル | **常時利用可** (Sandbox トグルとは独立)。トグルはネット隔離の有無を切り替えるだけで Shell ボタンは隠れない |
| ログアウト時 | **そのユーザの最後のセッション破棄を検知してコンテナを stop** (Volume は維持)。次回ログイン時に `ensureContainer` が start し直す |
| Shell パネルの再起動ボタン | コンテナを `force remove` → 現在のネットワークモードで再作成 → 再接続 (Volume は維持) |
| WebSocket エンドポイント | `/api/shell/ws` (`server.ts` がカスタムサーバとして upgrade を捌く) |
| 認証 | 既存のセッション署名 Cookie を WS upgrade 直前に検証。Origin が host と不一致なら 403 |
| Docker Desktop での見え方 | Compose 互換ラベル (`com.docker.compose.project=simple-workspace-demo`) を付けるので、コンテナ / Volume が「simple-workspace-demo」プロジェクトとして 1 つに折りたたまれる |

### セットアップ

```bash
# 1. Docker daemon が動いていること (Docker Desktop / OrbStack / Colima いずれか)
docker version

# 2. socket パスの確認 (Colima / OrbStack を使う場合)
docker context inspect | jq '.[0].Endpoints.docker.Host'
#  → `unix:///Users/<you>/.colima/default/docker.sock` 等が返る場合は
#     .env の SANDBOX_DOCKER_SOCKET をそのパス (unix:// は外す) に書き換え

# 3. サンドボックスイメージを構築 (一度だけ)
npm run sandbox:build

# 4. 開発サーバ起動 (custom server)
npm run dev
```

### 動作確認の手順

1. `/register` で新規ユーザを作成 → ログイン直後に `docker ps --filter label=app=simple-workspace-demo` で `simple-workspace-shell-<uid>` が `Up` になっていれば OK
2. フッターの **Shell** ボタンで端末パネルを開き、`whoami` が `root`、`cat /etc/os-release` が Ubuntu 24.04 であることを確認
3. Sandbox **OFF** のまま `ping -c 1 8.8.8.8` → 応答が返る (bridge 接続)
4. workspaces パネルヘッダの **Sandbox** トグルを **ON** → Shell パネルは自動再接続。`ping -c 1 8.8.8.8` がタイムアウトすればネット遮断成功
5. `/root/foo` などにファイルを作って `docker rm -f simple-workspace-shell-<uid>` → Shell パネルの再起動ボタンで再生成しても `/root/foo` が残っていれば Volume 永続 OK
6. ログアウト → `docker ps -a --filter label=app=simple-workspace-demo` でコンテナが `Exited` になる (停止のみ。Volume は残る)

### REST API (UI 内から利用)

| メソッド | パス | 用途 |
| --- | --- | --- |
| `GET` | `/api/shell` | コンテナ状態 (`running` / `stopped` / `absent`) / 現在の `networkMode` / イメージ準備状況を返す |
| `POST` | `/api/shell` `{ "action": "start" }` | 既存コンテナを start (無ければ既定 `bridge` で作成) |
| `POST` | `/api/shell` `{ "action": "restart", "networkMode": "none" \| "bridge" }` | コンテナを force remove → 指定モードで再作成 (Volume は維持) |
| `DELETE` | `/api/shell` | コンテナを `force remove` (Volume は残す) |

### 注意 (重要)

- **本デモはローカル開発用途のみ**です。`server.ts` は既定で `127.0.0.1` バインドで起動します。LAN や公開ホストでこのアプリを起動しないでください
- ホストの Docker socket をプロセスに共有しているため、Node プロセスを RCE されたらホスト root と同等のリスクがあります
- アイドル停止は未実装 (`SANDBOX_IDLE_STOP_MS` は予約のみ)。最後のログアウトで stop されるまでコンテナは `sleep infinity` で常駐します
- 不要になったリソースは `docker ps -a --filter label=app=simple-workspace-demo` / `docker volume ls --filter label=app=simple-workspace-demo` で確認し、`docker rm -f` / `docker volume rm` で掃除してください (退会機能は v1 では未実装)

## Workspace パネル

- **左ペイン: ファイルツリー** — `corpus/`, `reports/` 配下を含む仮想 FS をツリー表示。デフォルトは畳んだ状態で、外部 (`workspace:open-doc` / `workspace:open-path` イベント) からファイル選択された時のみ親フォルダを自動展開
- **右ペイン: プレビュー** — 選択ファイルを `MarkdownText` でレンダリング。`reports/` 配下のファイルはハイライトモード (黄色マーカー + 番号バッジ) で描画
- **`reports/` 配下のファイル削除** — ツリーから × で 1 ファイル削除可能 (`DELETE /api/opencode/files`)。`reports/` 以外はサーバ側ガードで弾く
- **裏面 (flip)**: ワークスペース設定 (App / Account / Workspace / Files / UI / Storage)
- 左上の `[doc=...]` ピンや、レポートパネルからの保存通知でツリーが自動更新 + 該当ファイルが選択される

## OpenCode パネル — RAG 検索 vs Agentic 検索

社内文書 15 件 (spec 3 / faq 3 / incident 3 / guideline 6) を題材に、RAG と Agentic を **左右 2 カラムで同時に投稿して並列比較**できます。

- **RAG 検索** (`POST /api/opencode/rag`): キーワード検索 1 回 → ヒットしたチャンクだけを文脈に LLM が回答。embedding やベクトル DB は使わない素朴な実装。多段ホップや語彙ギャップに弱い場面が見える。
- **Agentic 検索** (`POST /api/opencode/agentic`): LLM が `searchDocs` / `readDoc` ツールを最大 8 ステップ自律的に呼び出し、必要に応じて多段でドキュメントを読みに行く。ツール呼び出し履歴と Thinking がストリーム可視化される。

機能:
- 単一の入力フォームから両エンジンに同時投稿（プリセット 3 種類: 単発ヒット / 多段ホップ / 語彙ギャップ）
- 思考過程は `Thinking...` の折りたたみ表示でストリーミング中アニメーション
- Markdown レンダリング (見出し / 箇条書き / 表 / コードフェンス対応)
- 回答内の `[doc=spec-pricing]` のような引用 ID をクリックすると Workspace パネルでその文書が開く
- 「クリア」ボタンで両カラムの履歴とコンテキストを一括リセット
- 生成完了で入力欄に自動フォーカス（連続質問しやすい）

`POST /api/opencode/coding` は Coding Agent (`writeFile` / `readFile` / `listFiles` / `deleteFile` を持つ最大 10 ステップ) として API ルートのみ残してあります。UI からの導線は v1 では削除済みです。

## 訪問レポート生成パネル

訪問介護のヘルパーが帰社後に書いた自由記述メモを、生成 AI で整形 → さらに社内介護ガイドラインに照らして「人間 (管理者・ケアマネ・看護師) の確認が必要な箇所」を抽出 → ハイライト + サマリ追記する 2 段構成のパネルです。「整形してファイル保存」1 クリックで Step 1 → Step 2 が自動連続実行されます。

### Step 1: AI 整形 (`POST /api/report/generate`)

`streamText` + `toTextStreamResponse` でプレーンテキストストリームを返し、`onFinish` で `reports/{YYYY-MM-DD}-{NN}.md` に保存します。

出力テンプレート:

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
- メモにない事実を創作しない (情報なし → 「特記事項なし」)
- 体調・気分の変化、リスク兆候は「特記事項・気づき」に明示
- 各セクションは箇条書き + 「です・ます調」
- 体温・血圧などの数値は明確に記載
- コードフェンスで囲まない

### Step 2: Agentic ガイドライン照合 (`POST /api/report/guideline-check`)

Step 1 の保存ファイルを読み返し、LLM が次の 3 つのツールを最大 16 ステップ自律的に呼び出します:

| ツール | 役割 |
| --- | --- |
| `searchGuidelines(query)` | `guideline` カテゴリのみを横断検索 |
| `readGuideline(id)` | ガイドライン本文を読み込み |
| `recordFinding({ sentenceText, label, reason, citations })` | 確認が必要な箇所を 1 件記録 (最大 6 件) |

LLM の text 出力は使わず、**サーバ側で原本本文 + recordFinding 結果から最終 Markdown を決定論的に組み立てる** 設計です:

1. 各 finding の `sentenceText` を原本本文中で 1 度だけ `**[N] sentenceText**` で囲む (N は 1 始まりの通し番号)
2. 末尾に `## ⚠️ 人間の確認が必要な事項` セクションを追加し、各事項を `- **[N] label**: reason [doc=guideline-xxx]` 形式で列挙
3. 同じ path に上書き保存

`recordFinding` のサーバ側バリデーション:
- `sentenceText` は原本本文と完全一致する一文 (箇条書きマーカ・前後空白は寛容化)
- 不一致の場合は部分一致した断片を `hint` として返し、LLM が再試行できるように
- `citations` は `guideline-xxx` 形式で 1〜3 件、`readGuideline` 済みのもののみ採用
- 重複・上限超過は reject

クライアント側 (`report-composer.tsx`):
- 生 fetch + `ReadableStream` で UIMessage Stream を読み取り (`useChat` は使わない)
- `tool-input-*` / `tool-output-*` チャンクを「Agentic ガイドライン検索」ストリップに即時表示 (Search / BookOpen / Highlighter アイコンで分類)
- ストリップは Step 2 中は展開、完了後は自動折り畳み (本文プレビューを最大化)
- 最終本文は `messageMetadata` の `finalContent` でストリーム経由で受け取り、追加 fetch なしでプレビュー差し替え
- `MarkdownText` の `HighlightMark` コンポーネントが `**[N] ...**` の先頭 `[N]` を切り出して amber 円形バッジ + 黄色蛍光ペン風マーカーとして描画

参照ガイドライン (架空、`lib/opencode/corpus.ts`):
- `guideline-vital` バイタル管理
- `guideline-abuse` 虐待防止と外傷観察
- `guideline-infection` 感染症対策
- `guideline-falls` 転倒予防
- `guideline-handover` 申し送りと家族連絡
- `guideline-meds` 服薬管理

### 裏面: ヘルプ / システムプロンプトタブ

レポートパネルの裏面 (3D flip) は **「ヘルプ」と「システムプロンプト」のタブ切替** になっています:

- **ヘルプ** (`report-help.tsx`): 基本フロー / Step 2 の説明 / 出力テンプレート / 命名規則 / プリセット / プロンプト上書きの説明 / tips
- **システムプロンプト** (`report-back.tsx` の `PromptEditor`):
  - 初期値はサーバ側デフォルト (`REPORT_SYSTEM_PROMPT` / `GUIDELINE_CHECK_PROMPT`) を直接 prefill
  - 編集して「保存」すると localStorage (端末単位) に保持され、以降のリクエストで `systemPromptOverride` として送信される (max 16000 文字、サーバ zod 検証)
  - 「デフォルトに戻す」で各 Step ごとにテキストとローカル保存値を初期化
  - 「すべてデフォルトに戻す」で Step 1 / Step 2 を一括リセット

### ファイル名の命名規則

`reports/{YYYY-MM-DD}-{NN}.md`

- `{YYYY-MM-DD}` はフォームの「訪問日」フィールド
- `{NN}` はその訪問日の中での 0 埋め 2 桁シリアル (01 / 02 / ...)
- 連番は日付ごとにリセットされ、同日内は max+1 採番
- ファイル名は ASCII 固定 (仮想 FS の path 制約 `[a-zA-Z0-9._\-/]+` に従うため)。日本語は本文内のみに含まれる

## 仮想ファイルシステム

OpenCode Coding API およびレポート生成 API は、ホスト FS に触れず **SQLite 上の `WorkspaceFile` テーブル** (`workspaceId + path` で UNIQUE) で完結します。

- パスは `[a-zA-Z0-9._\-/]` のみ、`..` 禁止、最大 200 文字
- 1 ファイルあたり最大 64KB、Workspace あたり最大 100 ファイル
- Workspace を削除すれば `WorkspaceFile` も cascade で消える
- `GET /api/opencode/files?workspaceId=X` で一覧、`?path=X` を付けると本文取得
- `DELETE /api/opencode/files?workspaceId=X&path=reports/...` で個別削除 (`reports/` プレフィックスのみ許可)

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

`floating-terminal.tsx` で `variant` を分岐し、対応する React コンポーネント (`OpenCodeChat` / `ReportComposer`) と裏面 (`OpenCodeHelp` / `ReportBack`) を切り替えています。テーマカラー (フレーム枠 / ヘッダ背景 / `<> opencode` ロゴの "code" 部分 / リサイズハンドル) も variant ごとに blue / teal を出し分けます。

## 次フェーズ

- ユーザー固有のドキュメントを Workspace にアップロードして RAG / Agentic 検索の対象化
- Excalidraw との連携 (パネルから図に画像を貼り付け、図からパネルにメモを送る)
- 訪問レポートのテンプレート切り替え (介護以外の業務報告デモ)
- ガイドラインの差し替え UI (corpus を Workspace 内で編集)

## ライセンス

[MIT](./LICENSE)
