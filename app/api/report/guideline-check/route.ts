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
  // 裏面「システムプロンプト」タブで保存されたユーザ上書き。
  // 空 / 未指定ならデフォルト (GUIDELINE_CHECK_PROMPT) を使う。
  systemPromptOverride: z.string().min(1).max(16000).optional(),
});

type Finding = {
  sentenceText: string;
  label: string;
  reason: string;
  citations: string[];
};

const MAX_FINDINGS = 6;

// 原本本文と findings から最終 Markdown を決定論的に組み立てる。
// - 各 finding の sentenceText を 1 回だけ **...** で囲む (原文に存在しない場合はスキップ)
// - 末尾に「## ⚠️ 人間の確認が必要な事項」セクションを 1 つ追加
function assembleReport(originalBody: string, findings: Finding[]): string {
  let body = originalBody.trim();
  // 本文中の該当文を **[N] ...** で囲む。N は finding の通し番号 (1 始まり)。
  // クライアント側の MarkdownText が [N] を抽出してバッジ描画する。
  findings.forEach((f, i) => {
    const idx = body.indexOf(f.sentenceText);
    if (idx === -1) return;
    const wrapped = `**[${i + 1}] ${f.sentenceText}**`;
    body =
      body.slice(0, idx) + wrapped + body.slice(idx + f.sentenceText.length);
  });
  const summary =
    findings.length === 0
      ? "- 特記すべき確認事項はありません。"
      : findings
          .map((f, i) => {
            const cites = f.citations.map((c) => `[doc=${c}]`).join(" ");
            return `- **[${i + 1}] ${f.label}**: ${f.reason} ${cites}`.trimEnd();
          })
          .join("\n");
  return `${body}\n\n## ⚠️ 人間の確認が必要な事項\n\n${summary}\n`;
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const parsed = RequestBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.message }, 400);

  const { workspaceId, path, systemPromptOverride } = parsed.data;
  if (!(await userOwnsWorkspace(user.id, workspaceId))) {
    return json({ error: "workspace not found" }, 404);
  }

  const file = await readWorkspaceFile(workspaceId, path);
  if (!file.found) return json({ error: "report not found" }, 404);

  const originalBody = file.content;
  const findings: Finding[] = [];
  const seenSentences = new Set<string>();

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
    recordFinding: tool({
      description:
        "確認が必要な箇所を 1 件記録する。元レポート本文に文字通り存在する一文 (句点まで) を sentenceText に渡す。最大 6 件。同じ sentenceText を 2 度記録しない。",
      inputSchema: z.object({
        sentenceText: z
          .string()
          .min(1)
          .max(400)
          .describe("元レポート本文中の該当文を文字通り (句点まで)"),
        label: z.string().min(1).max(60).describe("事項の短いラベル"),
        reason: z
          .string()
          .min(1)
          .max(300)
          .describe("なぜ確認が必要か (1〜2 文)"),
        citations: z
          .array(
            z
              .string()
              .regex(/^guideline-[a-z]+$/, "guideline-xxx 形式")
              .min(1),
          )
          .min(1)
          .max(3)
          .describe("根拠ガイドライン id (1〜3 件)"),
      }),
      execute: async ({ sentenceText, label, reason, citations }) => {
        if (findings.length >= MAX_FINDINGS) {
          return { ok: false as const, error: "max findings reached (6)" };
        }
        // LLM がしばしば付けてしまう箇条書きマーカ・前後空白・全角空白を取り除いて
        // 本文と照合する。それでも一致しなければ、近そうな行を hint で返して
        // LLM に再試行のヒントを与える。
        const normalized = sentenceText
          .trim()
          .replace(/^[\s　\-・*]+/, "")
          .trim();
        if (!normalized) {
          return { ok: false as const, error: "sentenceText is empty" };
        }
        if (seenSentences.has(normalized)) {
          return { ok: false as const, error: "duplicate sentence" };
        }
        if (!originalBody.includes(normalized)) {
          // 部分一致するもう少し短い断片を探してヒントにする (10 文字以上の連続一致)
          const hints: string[] = [];
          for (let len = Math.min(normalized.length, 40); len >= 10; len -= 5) {
            for (let i = 0; i + len <= normalized.length; i += 5) {
              const slice = normalized.slice(i, i + len);
              if (originalBody.includes(slice)) {
                hints.push(slice);
                break;
              }
            }
            if (hints.length > 0) break;
          }
          return {
            ok: false as const,
            error:
              "sentenceText must be a verbatim substring of the original report body. 元レポート本文の一文をそのままコピー&ペーストしてください。",
            hint:
              hints.length > 0
                ? `近い断片が本文に存在します: 「${hints[0]}…」を含む完全な一文を探して再度送ってください。`
                : undefined,
          };
        }
        const valid = citations.filter((c) => {
          const doc = getDocById(c);
          return doc && doc.category === "guideline";
        });
        if (valid.length === 0) {
          return {
            ok: false as const,
            error:
              "citations must include at least one valid guideline-xxx id",
          };
        }
        seenSentences.add(normalized);
        findings.push({
          sentenceText: normalized,
          label: label.trim(),
          reason: reason.trim(),
          citations: valid,
        });
        return {
          ok: true as const,
          recorded: findings.length,
          remaining: MAX_FINDINGS - findings.length,
        };
      },
    }),
  };

  const userPrompt = `# 元の整形済みレポート (この本文を読んで、確認が必要な箇所を recordFinding で記録すること)

${originalBody.trim()}`;

  const result = streamText({
    model: localModel,
    system: systemPromptOverride ?? GUIDELINE_CHECK_PROMPT,
    prompt: userPrompt,
    tools,
    // step 数 = LLM 呼び出し回数 (各 tool 呼び出しごとに 1 step 消費)。
    // search 3 + read 3 + recordFinding 6 + α を見込んで 16 に設定。
    stopWhen: stepCountIs(16),
    onFinish: async () => {
      try {
        const finalContent = assembleReport(originalBody, findings);
        await writeWorkspaceFile(workspaceId, path, finalContent);
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
      // finish 時点で全 tool 呼び出しは完了している (LLM のループ条件)。
      // 最終ファイルを決定論的に組み立てて、クライアントへ同じ stream で届ける。
      // これでクライアント側の追加 fetch やタイミング問題なく previewText を
      // 確定できる。
      if (part.type === "finish") {
        return {
          mode: "guideline-check" as const,
          finalContent: assembleReport(originalBody, findings),
          findingsCount: findings.length,
        };
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
