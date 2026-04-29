import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { localModel } from "@/lib/opencode/model";
import { getUser } from "@/lib/user";
import {
  readWorkspaceFile,
  writeWorkspaceFile,
  userOwnsWorkspace,
} from "@/lib/opencode/files";
import { searchCorpus, getDocById } from "@/lib/opencode/search";
import { GUIDELINE_CHECK_PROMPT } from "@/lib/opencode/guideline-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestBody = z.object({
  workspaceId: z.string().min(1),
  // Step 1 で生成されたレポートのみ受け付ける。任意 path への上書き経路を作らない。
  path: z
    .string()
    .min(1)
    .max(200)
    .regex(/^reports\/\d{4}-\d{2}-\d{2}-\d{2}\.md$/, {
      message: "path must match reports/YYYY-MM-DD-NN.md",
    }),
});

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const parsed = RequestBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.message }, 400);

  const { workspaceId, path } = parsed.data;
  if (!(await userOwnsWorkspace(user.id, workspaceId))) {
    return json({ error: "workspace not found" }, 404);
  }

  const file = await readWorkspaceFile(workspaceId, path);
  if (!file.found) return json({ error: "report not found" }, 404);

  const tools = {
    searchGuidelines: tool({
      description:
        "介護ガイドライン (バイタル管理・虐待防止・感染症対策・転倒予防・申し送り・服薬管理) のみを横断検索する。短く具体的な日本語キーワードを渡す。",
      inputSchema: z.object({
        query: z.string().describe("検索キーワード (短く具体的に)"),
      }),
      execute: async ({ query }) => {
        const hits = searchCorpus(query, 4, "guideline");
        return {
          query,
          hits: hits.map((h) => ({
            id: h.id,
            title: h.title,
            snippet: h.snippet,
            score: h.score,
          })),
        };
      },
    }),
    readGuideline: tool({
      description:
        "ガイドライン id (例: guideline-vital, guideline-abuse) を指定して本文全体を読む。",
      inputSchema: z.object({
        id: z.string().describe("ガイドライン id"),
      }),
      execute: async ({ id }) => {
        const doc = getDocById(id);
        if (!doc || doc.category !== "guideline") {
          return { id, found: false as const };
        }
        return {
          id,
          found: true as const,
          title: doc.title,
          content: doc.content,
        };
      },
    }),
  };

  const userPrompt = `# 元の整形済みレポート (このまま受け取って、該当文の太字化と末尾サマリ追加だけを行う)

${file.content.trim()}`;

  const result = streamText({
    model: localModel,
    system: GUIDELINE_CHECK_PROMPT,
    prompt: userPrompt,
    tools,
    stopWhen: stepCountIs(8),
    onFinish: async ({ text }) => {
      try {
        await writeWorkspaceFile(workspaceId, path, text);
      } catch (e) {
        console.error(
          "[report/guideline-check] writeWorkspaceFile failed",
          (e as Error).message,
        );
      }
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return { mode: "guideline-check" as const };
      }
    },
  });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
