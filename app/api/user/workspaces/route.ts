import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/user";
import {
  createWorkspaceEntry,
  findWorkspaceById,
  listWorkspaces,
  removeWorkspaceEntry,
  renameWorkspace,
  touchWorkspace,
  type WorkspaceEntry,
} from "@/lib/user-store";
import { seedCorpusIntoWorkspace } from "@/lib/opencode/seed-corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicEntry(w: WorkspaceEntry) {
  return {
    id: w.id,
    label: w.label,
    createdAt: w.createdAt,
    lastOpenedAt: w.lastOpenedAt,
  };
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();
  const workspaces = await listWorkspaces(user.id);
  return NextResponse.json({ workspaces: workspaces.map(publicEntry) });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    id?: string;
  };

  if (body.id) {
    const existing = await findWorkspaceById(user.id, body.id);
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (!body.label || !body.label.trim()) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }
    const renamed = await renameWorkspace(user.id, body.id, body.label.trim());
    return NextResponse.json({ workspace: publicEntry(renamed!) });
  }

  const label = (body.label?.trim() || "workspace").slice(0, 80);
  const entry = await createWorkspaceEntry(user.id, label);
  // Coding モードのファイルブラウザで最初から触れるよう、社内文書 9 件を corpus/ に seed する。
  await seedCorpusIntoWorkspace(entry.id);
  return NextResponse.json({ workspace: publicEntry(entry) });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await findWorkspaceById(user.id, id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await removeWorkspaceEntry(user.id, id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const touched = await touchWorkspace(user.id, body.id);
  if (!touched) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Workspace を開き直す機会に corpus の不足分を補充する。
  // 後から追加されたカテゴリ (例: guideline) を既存 workspace にも反映するため。
  await seedCorpusIntoWorkspace(body.id);
  return NextResponse.json({ workspace: publicEntry(touched) });
}
