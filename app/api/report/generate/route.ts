import { streamText } from "ai";
import { z } from "zod";
import { localModel } from "@/lib/opencode/model";
import { getUser } from "@/lib/user";
import {
  writeWorkspaceFile,
  userOwnsWorkspace,
} from "@/lib/opencode/files";
import { prisma } from "@/lib/prisma";
import { REPORT_SYSTEM_PROMPT } from "@/lib/opencode/report-template";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestBody = z.object({
  workspaceId: z.string().min(1),
  freeText: z.string().min(1).max(8000),
  meta: z
    .object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      helperName: z.string().max(80).optional(),
      guestName: z.string().max(80).optional(),
    })
    .optional()
    .default({}),
});

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const parsed = RequestBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.message }, 400);

  const { workspaceId, freeText, meta } = parsed.data;
  if (!(await userOwnsWorkspace(user.id, workspaceId))) {
    return json({ error: "workspace not found" }, 404);
  }

  const date = meta.date ?? new Date().toISOString().slice(0, 10);
  // 同日内のファイルカウンタを採番してから streamText を起動する。
  // クライアントは x-saved-path ヘッダで保存先を即時に知ることができる。
  const path = await nextReportPath(workspaceId, date);

  const userPrompt = buildUserPrompt(freeText, meta, date);

  const result = streamText({
    model: localModel,
    system: REPORT_SYSTEM_PROMPT,
    prompt: userPrompt,
    onFinish: async ({ text }) => {
      try {
        await writeWorkspaceFile(workspaceId, path, text);
      } catch (e) {
        console.error("[report/generate] writeWorkspaceFile failed", e);
      }
    },
  });

  const res = result.toTextStreamResponse();
  res.headers.set("x-saved-path", path);
  return res;
}

async function nextReportPath(
  workspaceId: string,
  date: string,
): Promise<string> {
  // listWorkspaceFiles は normalizePath を通すため末尾スラッシュ prefix が
  // 弾かれる。ここは reports/ 配下だけを拾えれば十分なので Prisma を直接叩く。
  const rows = await prisma.workspaceFile.findMany({
    where: { workspaceId, path: { startsWith: "reports/" } },
    select: { path: true },
  });
  const re = new RegExp(`^reports/${date}-(\\d+)\\.md$`);
  let max = 0;
  for (const r of rows) {
    const m = r.path.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `reports/${date}-${String(max + 1).padStart(2, "0")}.md`;
}

function buildUserPrompt(
  freeText: string,
  meta: { helperName?: string; guestName?: string },
  date: string,
): string {
  return [
    "# 入力情報",
    `- 訪問日: ${date}`,
    `- ヘルパー名: ${meta.helperName?.trim() || "(未入力)"}`,
    `- ゲスト名: ${meta.guestName?.trim() || "(未入力)"}`,
    "",
    "# ヘルパーの自由記述メモ",
    freeText.trim(),
  ].join("\n");
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
