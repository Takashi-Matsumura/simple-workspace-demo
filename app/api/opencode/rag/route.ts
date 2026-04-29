import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { searchCorpus, getDocById } from "@/lib/opencode/search";
import { localModel } from "@/lib/opencode/model";
import { getUser } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query =
    lastUser?.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join(" ") ?? "";

  const hits = searchCorpus(query, 3);
  const context = hits
    .map((h) => {
      const doc = getDocById(h.id);
      return `# ${h.title} (id=${h.id})\n${doc?.content ?? h.snippet}`;
    })
    .join("\n\n---\n\n");

  const system = `あなたは社内ナレッジに基づいて回答するアシスタントです。
以下の「参考文書」のみを根拠に、日本語で簡潔に回答してください。
参考文書に答えがない場合は「文書からは判断できません」と答えてください。
回答の最後に、参照した文書 id を [doc=...] の形式で列挙してください。

# 参考文書
${context || "(該当する文書は見つかりませんでした)"}`;

  const result = streamText({
    model: localModel,
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return {
          mode: "rag" as const,
          retrieved: hits.map((h) => ({
            id: h.id,
            title: h.title,
            category: h.category,
            snippet: h.snippet,
            score: h.score,
          })),
        };
      }
    },
  });
}
