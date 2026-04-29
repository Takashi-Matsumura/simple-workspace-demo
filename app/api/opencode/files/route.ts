import { getUser } from "@/lib/user";
import {
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
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const path = url.searchParams.get("path");

  if (!workspaceId) {
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

  try {
    if (path) {
      const result = await readWorkspaceFile(workspaceId, path);
      return Response.json(result);
    }
    const files = await listWorkspaceFiles(workspaceId);
    return Response.json({ files });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
