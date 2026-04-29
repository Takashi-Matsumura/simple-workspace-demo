import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { searchCorpus, getDocById } from "@/lib/opencode/search";
import { localModel } from "@/lib/opencode/model";
import { getUser } from "@/lib/user";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  deleteWorkspaceFile,
  userOwnsWorkspace,
} from "@/lib/opencode/files";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    workspaceId?: string;
  };
  const { messages, workspaceId } = body;

  if (!workspaceId || typeof workspaceId !== "string") {
    return new Response(JSON.stringify({ error: "workspaceId required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!(await userOwnsWorkspace(user.id, workspaceId))) {
    return new Response(JSON.stringify({ error: "workspace not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const tools = {
    searchDocs: tool({
      description:
        "社内ナレッジベース（製品仕様・FAQ・障害履歴）をキーワードで検索する。日本語のキーワードを空白区切りで指定。",
      inputSchema: z.object({
        query: z.string().describe("検索キーワード（短く具体的に）"),
      }),
      execute: async ({ query }) => {
        const hits = searchCorpus(query, 4);
        return {
          query,
          hits: hits.map((h) => ({
            id: h.id,
            title: h.title,
            category: h.category,
            snippet: h.snippet,
            score: h.score,
          })),
        };
      },
    }),
    readDoc: tool({
      description: "検索結果の id を指定して、文書の本文全体を取得する。",
      inputSchema: z.object({
        id: z.string().describe("文書 id (例: spec-auth, incident-2026-03-15)"),
      }),
      execute: async ({ id }) => {
        const doc = getDocById(id);
        if (!doc) return { id, found: false as const };
        return {
          id,
          found: true as const,
          title: doc.title,
          category: doc.category,
          content: doc.content,
        };
      },
    }),
    listFiles: tool({
      description:
        "現在の Workspace の仮想 FS にあるファイル一覧を返す。prefix を指定するとそのディレクトリ配下に絞れる。",
      inputSchema: z.object({
        prefix: z
          .string()
          .optional()
          .describe("ディレクトリ prefix (例: 'docs/')"),
      }),
      execute: async ({ prefix }) => {
        try {
          const files = await listWorkspaceFiles(workspaceId, prefix);
          return { ok: true as const, files };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      },
    }),
    readFile: tool({
      description: "Workspace の仮想 FS からファイルを読む。",
      inputSchema: z.object({
        path: z.string().describe("ファイルパス (例: 'docs/summary.md')"),
      }),
      execute: async ({ path }) => {
        try {
          const result = await readWorkspaceFile(workspaceId, path);
          return { ok: true as const, ...result };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      },
    }),
    writeFile: tool({
      description:
        "Workspace の仮想 FS にファイルを書き込む（既存があれば上書き）。Markdown 等の小さめのテキスト前提（最大 64KB）。",
      inputSchema: z.object({
        path: z.string().describe("ファイルパス (例: 'docs/summary.md')"),
        content: z.string().describe("ファイル本文 (UTF-8 テキスト)"),
      }),
      execute: async ({ path, content }) => {
        try {
          const result = await writeWorkspaceFile(workspaceId, path, content);
          return { ok: true as const, ...result };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      },
    }),
    deleteFile: tool({
      description: "Workspace の仮想 FS からファイルを削除する。",
      inputSchema: z.object({
        path: z.string().describe("削除するファイルパス"),
      }),
      execute: async ({ path }) => {
        try {
          const result = await deleteWorkspaceFile(workspaceId, path);
          return { ok: true as const, path, ...result };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      },
    }),
  };

  const system = `あなたは社内ナレッジ検索とファイル編集を組み合わせて作業する Coding Agent です。
ユーザーの指示に応じて以下のツールを自律的に組み合わせて使ってください。

ツール:
- searchDocs / readDoc: 社内ナレッジ (仕様 / FAQ / 障害履歴) の検索と読み取り
- listFiles / readFile / writeFile / deleteFile: Workspace 内の仮想 FS への読み書き

方針:
- 「○○について調べてまとめて」のような指示なら、searchDocs / readDoc で必要な情報を集めてから writeFile で Markdown ファイルとして保存する。
- 既に同名ファイルがあるなら readFile で内容を確認してから上書きする。
- ファイル名は英数字 / '_' / '-' / '.' / '/' のみで、'..' を含めない。docs/ や notes/ 配下に置くとよい。
- 1 ファイルあたり最大 64KB。長い内容は要点を絞って簡潔にまとめる。
- 完了後は何のファイルを作成 / 更新 / 削除したかを日本語で簡潔に報告する。
- 必要な情報が不足する場合は推測せず「情報が不足しています」と答える。`;

  const result = streamText({
    model: localModel,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { mode: "coding" as const };
      }
    },
  });
}
