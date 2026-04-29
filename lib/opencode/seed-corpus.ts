import { CORPUS, type Doc } from "./corpus";
import { prisma } from "@/lib/prisma";
import { writeWorkspaceFile } from "./files";

const CATEGORY_LABEL: Record<Doc["category"], string> = {
  spec: "仕様書",
  faq: "FAQ",
  incident: "障害履歴",
  guideline: "ガイドライン",
};

function docToMarkdown(doc: Doc): string {
  const heading = `# ${doc.title}\n\n`;
  const meta = `> ${CATEGORY_LABEL[doc.category]} / id: \`${doc.id}\`\n\n`;
  return heading + meta + doc.content + "\n";
}

function pathFor(doc: Doc): string {
  return `corpus/${doc.category}/${doc.id}.md`;
}

// workspace に corpus を書き込む。idempotent: 既に存在する path はスキップする。
// 新規 workspace 作成時はもちろん、既存 workspace を open し直した時も呼んで
// 不足分（後から追加されたカテゴリ）を補充できるようにしている。
// 失敗しても workspace 自体は使えるよう、エラーは伝播せずにログだけ残す。
export async function seedCorpusIntoWorkspace(workspaceId: string): Promise<void> {
  const existing = await prisma.workspaceFile.findMany({
    where: {
      workspaceId,
      path: { startsWith: "corpus/" },
    },
    select: { path: true },
  });
  const present = new Set(existing.map((r) => r.path));

  let added = 0;
  for (const doc of CORPUS) {
    const p = pathFor(doc);
    if (present.has(p)) continue;
    try {
      await writeWorkspaceFile(workspaceId, p, docToMarkdown(doc));
      added++;
    } catch (e) {
      console.error(
        `[seed-corpus] failed for ${doc.id} in ${workspaceId}:`,
        (e as Error).message,
      );
    }
  }
  if (added > 0) {
    console.log(
      `[seed-corpus] added ${added} missing docs into ${workspaceId}`,
    );
  }
}
