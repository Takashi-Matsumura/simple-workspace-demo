import { CORPUS, type Doc } from "./corpus";
import { writeWorkspaceFile } from "./files";

const CATEGORY_LABEL: Record<Doc["category"], string> = {
  spec: "仕様書",
  faq: "FAQ",
  incident: "障害履歴",
};

function docToMarkdown(doc: Doc): string {
  const heading = `# ${doc.title}\n\n`;
  const meta = `> ${CATEGORY_LABEL[doc.category]} / id: \`${doc.id}\`\n\n`;
  return heading + meta + doc.content + "\n";
}

function pathFor(doc: Doc): string {
  return `corpus/${doc.category}/${doc.id}.md`;
}

// 新規 workspace 作成時に corpus 9 件を corpus/{category}/{id}.md として書き込む。
// 失敗しても workspace 自体は使えるよう、エラーは伝播せずに無視する。
export async function seedCorpusIntoWorkspace(workspaceId: string): Promise<void> {
  for (const doc of CORPUS) {
    try {
      await writeWorkspaceFile(workspaceId, pathFor(doc), docToMarkdown(doc));
    } catch {
      // 個別ファイルの失敗は握り潰す (容量超過などの想定外を想定)
    }
  }
}
