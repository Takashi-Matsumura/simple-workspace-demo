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

  const { messages }: { messages: UIMessage[] } = await req.json();

  const tools = {
    searchDocs: tool({
      description:
        "社内ナレッジベース（製品仕様・FAQ・障害履歴）をキーワードで検索する。日本語のキーワードを空白区切りで指定。短く具体的なキーワードほど精度が高い。",
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
      description:
        "検索結果の id を指定して、その文書の本文全体を取得する。多段ホップが必要な質問では searchDocs と組み合わせて使う。",
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
  };

  const system = `あなたは社内ナレッジを横断的に調査するエージェントです。
ユーザーの質問に答えるため、searchDocs / readDoc ツールを必要なだけ使ってください。

方針:
- 質問が曖昧・多段の場合は、まずキーワードを変えて複数回 searchDocs を呼ぶ。
- 検索結果のスニペットでは情報が足りないと判断したら readDoc で本文を読む。
- 異なる用語（例: ログイン / サインイン）が使われている可能性があるなら、別の語彙でも検索する。
- 必要な情報が揃ったら、日本語で簡潔に回答し、最後に参照した文書 id を [doc=...] の形式で列挙する。
- 文書から判断できない場合は「文書からは判断できません」と答える。`;

  const result = streamText({
    model: localModel,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { mode: "agentic" as const };
      }
    },
  });
}
