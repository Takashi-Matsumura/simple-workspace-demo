import { getUser } from "@/lib/user";
import {
  deleteWorkspaceFile,
  listWorkspaceFiles,
  readWorkspaceFile,
  userOwnsWorkspace,
} from "@/lib/opencode/files";

export const runtime = "nodejs";

// パネル UI から仮想 FS の中身を覗くための read-only エンドポイント。
// クエリ:
//   GET /api/opencode/files?workspaceId=...           → 一覧
//   GET /api/opencode/files?workspaceId=...&path=...  → 1 ファイルの本文
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const path = url.searchParams.get("path");

  if (!workspaceId) return bad("workspaceId required");
  if (!(await userOwnsWorkspace(user.id, workspaceId))) {
    return notFound("workspace not found");
  }

  try {
    if (path) {
      const result = await readWorkspaceFile(workspaceId, path);
      return Response.json(result);
    }
    const files = await listWorkspaceFiles(workspaceId);
    return Response.json({ files });
  } catch (e) {
    return bad((e as Error).message);
  }
}

// reports/ 配下のファイルだけを削除可能な write エンドポイント。
// corpus/ など seed されたサンプル文書は誤削除を防ぐため受け付けない。
//   DELETE /api/opencode/files?workspaceId=...&path=reports/2026-04-29-01.md
export async function DELETE(req: Request) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const path = url.searchParams.get("path");

  if (!workspaceId) return bad("workspaceId required");
  if (!path) return bad("path required");
  if (!path.startsWith("reports/")) {
    return bad("only files under reports/ can be deleted");
  }
  if (!(await userOwnsWorkspace(user.id, workspaceId))) {
    return notFound("workspace not found");
  }

  try {
    const result = await deleteWorkspaceFile(workspaceId, path);
    return Response.json(result);
  } catch (e) {
    return bad((e as Error).message);
  }
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
function bad(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
function notFound(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}
