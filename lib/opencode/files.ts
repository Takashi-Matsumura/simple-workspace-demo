import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 64 * 1024;
const MAX_FILES_PER_WORKSPACE = 100;

// 仮想 FS のパス検証。ホスト FS には触れない前提だが、UI 表示時の一貫性のため
// 受け入れるパスを `a/b/c.ext` 相当に制限する。
export function normalizePath(input: string): string {
  if (typeof input !== "string") throw new Error("path must be a string");
  let p = input.trim().replace(/^\/+/, "");
  if (p.length === 0) throw new Error("path must not be empty");
  if (p.length > 200) throw new Error("path is too long (max 200 chars)");
  if (p.includes("..")) throw new Error("path must not contain '..'");
  if (/[\x00-\x1f]/.test(p)) throw new Error("path must not contain control chars");
  if (!/^[a-zA-Z0-9._\-/]+$/.test(p)) {
    throw new Error("path may only contain [a-zA-Z0-9._-/]");
  }
  // 連続スラッシュを単一に
  p = p.replace(/\/+/g, "/");
  if (p.endsWith("/")) throw new Error("path must not end with '/'");
  return p;
}

export type WorkspaceFileSummary = {
  path: string;
  size: number;
  updatedAt: string;
};

export async function listWorkspaceFiles(
  workspaceId: string,
  prefix?: string,
): Promise<WorkspaceFileSummary[]> {
  const where: { workspaceId: string; path?: { startsWith: string } } = { workspaceId };
  if (prefix && prefix.length > 0) {
    const norm = normalizePath(prefix);
    where.path = { startsWith: norm };
  }
  const rows = await prisma.workspaceFile.findMany({
    where,
    orderBy: { path: "asc" },
    select: { path: true, content: true, updatedAt: true },
  });
  return rows.map((r) => ({
    path: r.path,
    size: Buffer.byteLength(r.content, "utf8"),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function readWorkspaceFile(
  workspaceId: string,
  path: string,
): Promise<{ found: false } | { found: true; path: string; content: string; updatedAt: string }> {
  const norm = normalizePath(path);
  const row = await prisma.workspaceFile.findUnique({
    where: { workspaceId_path: { workspaceId, path: norm } },
    select: { path: true, content: true, updatedAt: true },
  });
  if (!row) return { found: false };
  return {
    found: true,
    path: row.path,
    content: row.content,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function writeWorkspaceFile(
  workspaceId: string,
  path: string,
  content: string,
): Promise<{ path: string; size: number; created: boolean }> {
  const norm = normalizePath(path);
  if (typeof content !== "string") throw new Error("content must be a string");
  const size = Buffer.byteLength(content, "utf8");
  if (size > MAX_FILE_BYTES) {
    throw new Error(`content too large: ${size} > ${MAX_FILE_BYTES} bytes`);
  }

  const existing = await prisma.workspaceFile.findUnique({
    where: { workspaceId_path: { workspaceId, path: norm } },
    select: { id: true },
  });

  if (!existing) {
    const count = await prisma.workspaceFile.count({ where: { workspaceId } });
    if (count >= MAX_FILES_PER_WORKSPACE) {
      throw new Error(
        `too many files in workspace: ${count} >= ${MAX_FILES_PER_WORKSPACE}`,
      );
    }
  }

  await prisma.workspaceFile.upsert({
    where: { workspaceId_path: { workspaceId, path: norm } },
    create: { workspaceId, path: norm, content },
    update: { content },
  });

  return { path: norm, size, created: !existing };
}

export async function deleteWorkspaceFile(
  workspaceId: string,
  path: string,
): Promise<{ deleted: boolean }> {
  const norm = normalizePath(path);
  const res = await prisma.workspaceFile.deleteMany({
    where: { workspaceId, path: norm },
  });
  return { deleted: res.count > 0 };
}

export async function userOwnsWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const row = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { id: true },
  });
  return !!row;
}
